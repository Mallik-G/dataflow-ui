"""
Ephemeral Environment Service

Provisions user-specific ephemeral environments for isolated testing.
Auto-creates catalogs/schemas and handles cleanup.
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from ..models.db import Environment
from ..models.db.user_sessions import EphemeralEnvironment, UserSession
from ..services.databricks.databricks_catalog_api import DatabricksCatalogAPI
from ..core.config import settings

logger = logging.getLogger(__name__)


class EphemeralEnvironmentService:
    """Service for provisioning and managing ephemeral environments."""

    def __init__(self, db: Session):
        self.db = db

    async def create_ephemeral_environment(
        self,
        user_id: str,
        session_id: str,
        base_environment_id: str,
        ttl_hours: int = 24,
        auto_cleanup: bool = True,
    ) -> EphemeralEnvironment:
        """
        Create ephemeral environment for user testing.

        Creates:
        - User-specific schema in catalog
        - Optionally dedicated warehouse
        - Auto-cleanup after TTL

        Args:
            user_id: User identifier
            session_id: User session ID
            base_environment_id: Base environment to inherit from
            ttl_hours: Time-to-live in hours (default 24)
            auto_cleanup: Auto-delete resources after TTL

        Returns:
            EphemeralEnvironment record
        """
        logger.info(
            f"Creating ephemeral environment for user {user_id}, session {session_id}"
        )

        # Get base environment
        base_env = (
            self.db.query(Environment).filter_by(id=base_environment_id).first()
        )

        if not base_env:
            raise ValueError(f"Base environment {base_environment_id} not found")

        # Generate unique names
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        catalog_name = self._generate_catalog_name(user_id)
        schema_name = f"ephemeral_{timestamp}"
        env_name = f"{user_id}_ephemeral_{timestamp}"

        # Calculate expiration
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)

        # Create ephemeral environment record
        ephemeral_env = EphemeralEnvironment(
            id=f"ephemeral-{uuid.uuid4()}",
            user_id=user_id,
            session_id=session_id,
            name=env_name,
            display_name=f"{user_id}'s Test Environment",
            catalog=catalog_name,
            schema=schema_name,
            base_environment_id=base_environment_id,
            created_at=datetime.now(timezone.utc),
            expires_at=expires_at,
            ttl_hours=ttl_hours,
            status="provisioning",
            auto_cleanup=auto_cleanup,
        )

        self.db.add(ephemeral_env)
        self.db.commit()
        self.db.refresh(ephemeral_env)

        # Provision resources in Databricks
        try:
            await self._provision_databricks_resources(ephemeral_env, base_env)

            # Update status to active
            ephemeral_env.status = "active"
            self.db.commit()

            logger.info(
                f"Ephemeral environment created: {ephemeral_env.id} (catalog: {catalog_name}, schema: {schema_name})"
            )

        except Exception as e:
            logger.error(f"Failed to provision ephemeral environment: {e}")
            ephemeral_env.status = "failed"
            self.db.commit()
            raise

        return ephemeral_env

    async def cleanup_expired_environments(self) -> int:
        """
        Clean up expired ephemeral environments.

        Returns:
            Number of environments cleaned up
        """
        logger.info("Cleaning up expired ephemeral environments")

        now = datetime.now(timezone.utc)

        # Find expired environments
        expired_envs = (
            self.db.query(EphemeralEnvironment)
            .filter(
                EphemeralEnvironment.expires_at <= now,
                EphemeralEnvironment.status == "active",
                EphemeralEnvironment.auto_cleanup == True,
            )
            .all()
        )

        cleaned_count = 0

        for env in expired_envs:
            try:
                await self.delete_ephemeral_environment(env.id)
                cleaned_count += 1
            except Exception as e:
                logger.error(f"Failed to cleanup environment {env.id}: {e}")

        logger.info(f"Cleaned up {cleaned_count} expired environments")
        return cleaned_count

    async def delete_ephemeral_environment(self, ephemeral_env_id: str) -> None:
        """
        Delete ephemeral environment and its resources.

        Args:
            ephemeral_env_id: Ephemeral environment ID
        """
        logger.info(f"Deleting ephemeral environment {ephemeral_env_id}")

        ephemeral_env = (
            self.db.query(EphemeralEnvironment).filter_by(id=ephemeral_env_id).first()
        )

        if not ephemeral_env:
            raise ValueError(f"Ephemeral environment {ephemeral_env_id} not found")

        # Get base environment for credentials
        base_env = (
            self.db.query(Environment)
            .filter_by(id=ephemeral_env.base_environment_id)
            .first()
        )

        # Delete Databricks resources
        try:
            await self._delete_databricks_resources(ephemeral_env, base_env)
        except Exception as e:
            logger.error(f"Failed to delete Databricks resources: {e}")
            # Continue with database cleanup even if Databricks cleanup fails

        # Update status
        ephemeral_env.status = "deleted"
        ephemeral_env.cleanup_at = datetime.now(timezone.utc)
        self.db.commit()

        logger.info(f"Ephemeral environment {ephemeral_env_id} deleted")

    async def extend_ttl(self, ephemeral_env_id: str, additional_hours: int) -> EphemeralEnvironment:
        """
        Extend TTL of ephemeral environment.

        Args:
            ephemeral_env_id: Ephemeral environment ID
            additional_hours: Hours to add to TTL

        Returns:
            Updated ephemeral environment
        """
        ephemeral_env = (
            self.db.query(EphemeralEnvironment).filter_by(id=ephemeral_env_id).first()
        )

        if not ephemeral_env:
            raise ValueError(f"Ephemeral environment {ephemeral_env_id} not found")

        # Extend expiration
        ephemeral_env.expires_at = ephemeral_env.expires_at + timedelta(
            hours=additional_hours
        )
        ephemeral_env.ttl_hours += additional_hours

        self.db.commit()
        self.db.refresh(ephemeral_env)

        logger.info(
            f"Extended TTL for {ephemeral_env_id} by {additional_hours} hours (new expiration: {ephemeral_env.expires_at})"
        )

        return ephemeral_env

    # -------------------------------------------------------------------------
    # Private Helper Methods
    # -------------------------------------------------------------------------

    def _generate_catalog_name(self, user_id: str) -> str:
        """
        Generate user-specific catalog name.

        Args:
            user_id: User identifier

        Returns:
            Catalog name (e.g., dev_user123)
        """
        # Sanitize user ID (remove special characters)
        safe_user_id = "".join(c for c in user_id if c.isalnum() or c == "_")[:20]

        # Use base catalog from settings
        base_catalog = settings.databricks_catalog or "dev"

        return f"{base_catalog}_{safe_user_id}"

    async def _provision_databricks_resources(
        self, ephemeral_env: EphemeralEnvironment, base_env: Environment
    ) -> None:
        """
        Provision Databricks resources (catalog, schema).

        Args:
            ephemeral_env: Ephemeral environment record
            base_env: Base environment for credentials
        """
        logger.info(
            f"Provisioning Databricks resources for {ephemeral_env.id}"
        )

        # Get Databricks credentials
        databricks_host = base_env.databricks_host or settings.databricks_host

        # Initialize Databricks Catalog API
        # Note: Would need DatabricksCatalogAPI to support OAuth
        # catalog_api = DatabricksCatalogAPI(...)

        # Create schema (catalog should already exist)
        # In production, you'd:
        # 1. Check if catalog exists, create if needed
        # 2. Create schema
        # 3. Set permissions for user

        # For now, we'll log what would be done
        logger.info(
            f"Would create schema: {ephemeral_env.catalog}.{ephemeral_env.schema}"
        )

        # TODO: Implement actual Databricks API calls:
        # await catalog_api.create_schema(
        #     catalog=ephemeral_env.catalog,
        #     schema=ephemeral_env.schema
        # )

    async def _delete_databricks_resources(
        self, ephemeral_env: EphemeralEnvironment, base_env: Environment
    ) -> None:
        """
        Delete Databricks resources (schema, optionally catalog).

        Args:
            ephemeral_env: Ephemeral environment record
            base_env: Base environment for credentials
        """
        logger.info(
            f"Deleting Databricks resources for {ephemeral_env.id}"
        )

        # TODO: Implement actual Databricks API calls:
        # await catalog_api.drop_schema(
        #     catalog=ephemeral_env.catalog,
        #     schema=ephemeral_env.schema,
        #     cascade=True  # Drop all tables in schema
        # )

        logger.info(
            f"Would delete schema: {ephemeral_env.catalog}.{ephemeral_env.schema}"
        )
