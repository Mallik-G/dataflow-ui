"""Background service for syncing usage data to star schema.

This is the new implementation that uses:
- UsageRecordTransformer for platform-agnostic transformation
- DimensionUpsertService for dimension management
- Star schema (usage_facts + dimension tables) for storage
"""

import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Optional, List, Dict

from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.database import get_db
from ...models.db.usage_star_schema import UsageFact
from ...models.db.compute_tracking import DBUSyncStatus
from ..databricks.databricks_billing_api import DatabricksBillingAPI
from ..usage_record_transformer import UsageRecordTransformer
from ..dimension_upsert_service import DimensionUpsertService

logger = logging.getLogger(__name__)


class UsageStarSchemaSyncService:
    """Syncs usage data from Databricks to star schema.

    This service:
    1. Fetches enriched usage data from Databricks
    2. Transforms it to platform-agnostic format
    3. Upserts dimension records
    4. Inserts usage facts with proper FK links
    """

    def __init__(self, sync_interval: int = 86400):
        """Initialize sync service.

        Args:
            sync_interval: Sync interval in seconds (default 24 hours)
        """
        self.sync_interval = sync_interval
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        self.billing_api: Optional[DatabricksBillingAPI] = None
        self.transformer = UsageRecordTransformer(platform="databricks")

        # Configuration
        self.warehouse_id = settings.databricks_warehouse_id
        self.max_retries = 3
        self.retry_delay = 300  # 5 minutes

    async def start(self):
        """Start the background sync service."""
        if self.is_running:
            logger.warning("Usage star schema sync service is already running")
            return

        logger.info(
            f"Starting usage star schema sync with {self.sync_interval}s interval"
        )
        self.is_running = True
        self.task = asyncio.create_task(self._sync_loop())

    async def stop(self):
        """Stop the background sync service."""
        if not self.is_running:
            logger.warning("Usage star schema sync service is not running")
            return

        logger.info("Stopping usage star schema sync service")
        self.is_running = False

        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

        self.task = None

    async def _sync_loop(self):
        """Main sync loop that runs periodically."""
        while self.is_running:
            try:
                # Calculate next sync time (2 AM local time)
                next_sync = self._calculate_next_sync_time()
                wait_seconds = (next_sync - datetime.now()).total_seconds()

                if wait_seconds > 0:
                    logger.info(f"Next usage sync scheduled for {next_sync}")
                    await asyncio.sleep(wait_seconds)

                if not self.is_running:
                    break

                logger.info("Starting scheduled usage sync to star schema")
                await self._perform_daily_sync()

            except Exception as e:
                logger.error(f"Error in usage sync loop: {e}", exc_info=True)
                await asyncio.sleep(300)  # Wait 5 minutes before retry

    def _calculate_next_sync_time(self) -> datetime:
        """Calculate next sync time (2 AM local time)."""
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        next_sync = tomorrow.replace(hour=2, minute=0, second=0, microsecond=0)

        # If it's before 2 AM today, sync today at 2 AM
        today_sync = now.replace(hour=2, minute=0, second=0, microsecond=0)
        if now < today_sync:
            return today_sync

        return next_sync

    async def _perform_daily_sync(self):
        """Perform daily sync for all workspaces."""
        db = next(get_db())
        try:
            # Get workspace ID from environment
            workspace_id = await self._get_workspace_id()

            if not workspace_id:
                logger.error("No workspace_id configured - skipping sync")
                return

            # Sync yesterday's data
            sync_date = date.today() - timedelta(days=1)

            logger.info(f"Syncing usage data for {sync_date} to star schema")
            records_synced = await self.sync_usage_for_date(
                sync_date=sync_date,
                workspace_id=workspace_id,
            )

            logger.info(f"Daily sync completed: {records_synced} records synced")

        except Exception as e:
            logger.error(f"Daily sync failed: {e}", exc_info=True)
        finally:
            db.close()

    async def _get_workspace_id(self) -> Optional[str]:
        """Get workspace ID from environment configuration."""
        # Get from environment config in database
        db = next(get_db())
        try:
            from sqlalchemy import text

            result = db.execute(
                text("SELECT configuration FROM nexa_admin.environments LIMIT 1")
            )
            row = result.fetchone()
            if row and row[0]:
                config = row[0]
                return config.get("workspace_id")

            # Fallback to settings
            return settings.databricks_workspace_id

        except Exception as e:
            logger.warning(f"Failed to get workspace_id from environment: {e}")
            return settings.databricks_workspace_id
        finally:
            db.close()

    async def sync_usage_for_date(
        self,
        sync_date: date,
        workspace_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> int:
        """Sync usage data for a specific date or date range.

        Args:
            sync_date: Single date to sync (ignored if start_date/end_date provided)
            workspace_id: Databricks workspace ID
            start_date: Start of date range (optional)
            end_date: End of date range (optional)

        Returns:
            Number of usage fact records stored
        """
        # Initialize billing API if needed
        if not self.billing_api:
            self.billing_api = DatabricksBillingAPI()

        sync_batch_id = str(uuid.uuid4())

        # Determine date range
        if start_date and end_date:
            dates_to_sync = []
            current_date = start_date
            while current_date <= end_date:
                dates_to_sync.append(current_date)
                current_date += timedelta(days=1)
        else:
            dates_to_sync = [sync_date]

        total_records = 0

        for target_date in dates_to_sync:
            logger.info(f"Syncing usage data for {target_date}")

            try:
                # Fetch enriched usage data from Databricks
                dbu_records = await self.billing_api.get_dbu_usage_by_date(
                    target_date, self.warehouse_id, workspace_id
                )

                if not dbu_records:
                    logger.info(f"No usage records found for {target_date}")
                    continue

                # Transform to star schema format
                usage_facts, dimensions_by_type = self.transformer.transform_batch(
                    dbu_records
                )

                # Store in database
                records_stored = await self._store_star_schema_records(
                    usage_facts=usage_facts,
                    dimensions_by_type=dimensions_by_type,
                    sync_batch_id=sync_batch_id,
                    workspace_id=workspace_id,
                    target_date=target_date,
                )

                total_records += records_stored
                logger.info(f"Stored {records_stored} records for {target_date}")

            except Exception as e:
                logger.error(f"Failed to sync {target_date}: {e}", exc_info=True)
                continue

        return total_records

    async def _store_star_schema_records(
        self,
        usage_facts: List[Dict[str, Any]],
        dimensions_by_type: Dict[str, List[Dict[str, Any]]],
        sync_batch_id: str,
        workspace_id: str,
        target_date: date,
    ) -> int:
        """Store transformed records in star schema.

        Process:
        1. Delete existing usage_facts for the date (upsert behavior)
        2. Upsert all dimension records
        3. Get dimension ID mappings
        4. Insert usage_facts with proper dimension FKs
        """
        db = next(get_db())
        try:
            # 1. Delete existing usage_facts for this date (upsert behavior)
            deleted_count = (
                db.query(UsageFact)
                .filter(
                    UsageFact.workspace_id == workspace_id,
                    UsageFact.usage_date == target_date,
                )
                .delete(synchronize_session=False)
            )
            if deleted_count > 0:
                logger.info(f"Deleted {deleted_count} existing records for resync")
            db.commit()

            # 2. Upsert dimensions and get ID mappings
            dimension_service = DimensionUpsertService(db)
            id_mappings = dimension_service.upsert_batch(dimensions_by_type)

            # 3. Insert usage_facts with dimension FKs
            stored_count = 0
            for usage_fact_data in usage_facts:
                try:
                    # Get dimension ID for this resource
                    resource_type = usage_fact_data["resource_type"]
                    dimension_id = None

                    if resource_type in id_mappings:
                        # Get the resource ID to look up dimension ID
                        resource_id = self._get_resource_id_from_fact(
                            usage_fact_data, resource_type
                        )
                        if resource_id and resource_id in id_mappings[resource_type]:
                            dimension_id = id_mappings[resource_type][resource_id]

                    # Remove temporary _resource_id field before creating model
                    fact_data_clean = {
                        k: v for k, v in usage_fact_data.items() if k != "_resource_id"
                    }

                    # Create usage fact record
                    usage_fact = UsageFact(
                        **fact_data_clean,
                        resource_dimension_id=dimension_id,
                        sync_batch_id=sync_batch_id,
                    )
                    db.add(usage_fact)
                    stored_count += 1

                except Exception as e:
                    logger.error(f"Failed to store usage fact: {e}", exc_info=True)
                    continue

            # Commit all usage facts
            db.commit()

            # 4. Update sync status
            self._update_sync_status(db, workspace_id, target_date, stored_count)

            logger.info(
                f"Stored {stored_count} usage facts with dimension links for {target_date}"
            )
            return stored_count

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to store star schema records: {e}", exc_info=True)
            raise
        finally:
            db.close()

    def _get_resource_id_from_fact(
        self, usage_fact_data: Dict[str, Any], resource_type: str
    ) -> Optional[str]:
        """Extract resource ID from usage fact data.

        The transformer adds a temporary _resource_id field for this purpose.
        """
        return usage_fact_data.get("_resource_id")

    def _update_sync_status(
        self, db: Session, workspace_id: str, sync_date: date, records_count: int
    ):
        """Update sync status tracking."""
        try:
            sync_status = (
                db.query(DBUSyncStatus)
                .filter(DBUSyncStatus.workspace_id == workspace_id)
                .first()
            )

            if not sync_status:
                sync_status = DBUSyncStatus(workspace_id=workspace_id, environment=None)
                db.add(sync_status)

            sync_status.last_sync_date = sync_date
            sync_status.last_successful_sync = datetime.now()
            sync_status.last_sync_status = "success" if records_count > 0 else "no_data"
            sync_status.dbu_records_found = records_count
            sync_status.updated_at = datetime.now()

            db.commit()

        except Exception as e:
            logger.error(f"Failed to update sync status: {e}")
            db.rollback()


# Global service instance
_usage_star_sync_service: Optional[UsageStarSchemaSyncService] = None


def get_usage_star_sync_service() -> UsageStarSchemaSyncService:
    """Get or create the global usage star schema sync service instance."""
    global _usage_star_sync_service
    if _usage_star_sync_service is None:
        sync_interval = settings.background_sync_interval
        _usage_star_sync_service = UsageStarSchemaSyncService(
            sync_interval=sync_interval
        )
    return _usage_star_sync_service
