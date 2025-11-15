"""Service for syncing Databricks workspace metadata to PostgreSQL."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ...models.db.metadata import CatalogMetadata
from .metadata_transformer import MetadataTransformer
from .system_tables_client import SystemTablesClient

logger = logging.getLogger(__name__)


class MetadataSyncService:
    """Service for syncing catalog metadata with parallel execution."""

    def __init__(self, system_client: SystemTablesClient):
        """
        Initialize metadata sync service.

        Args:
            system_client: System tables client for querying Databricks
        """
        self.system_client = system_client
        self.transformer = MetadataTransformer()

    async def sync_all(self, db: Session) -> Dict[str, int]:
        """
        Sync all metadata types in parallel, including tags and privileges.

        Args:
            db: SQLAlchemy session

        Returns:
            Dict with counts of synced entities by type
        """
        start_time = datetime.now(timezone.utc)
        logger.info("Starting catalog metadata sync")

        # Step 1: Mark all existing records as potentially deleted
        db.query(CatalogMetadata).update({"is_active": False})
        db.commit()

        # Step 2: Fetch all system tables in parallel (base entities + tags + privileges)
        logger.info("Fetching system tables and governance data in parallel...")
        results = await asyncio.gather(
            # Base entities
            self._sync_catalogs(db),
            self._sync_schemas(db),
            self._sync_tables(db),
            self._sync_columns(db),
            self._sync_volumes(db),
            self._sync_functions(db),
            # Tags
            self._fetch_all_tags(),
            # Privileges
            self._fetch_table_privileges(),
            return_exceptions=True,
        )

        # Step 3: Extract tags and privileges for enrichment
        tags_data = results[6] if not isinstance(results[6], Exception) else {}
        privileges_data = results[7] if not isinstance(results[7], Exception) else {}

        # Step 4: Enrich entities with tags and privileges
        await self._enrich_with_tags_and_privileges(db, tags_data, privileges_data)

        # Step 5: Count synced entities
        summary = {
            "catalogs": results[0] if not isinstance(results[0], Exception) else 0,
            "schemas": results[1] if not isinstance(results[1], Exception) else 0,
            "tables": results[2] if not isinstance(results[2], Exception) else 0,
            "columns": results[3] if not isinstance(results[3], Exception) else 0,
            "volumes": results[4] if not isinstance(results[4], Exception) else 0,
            "functions": results[5] if not isinstance(results[5], Exception) else 0,
            "tags_enriched": len(tags_data),
            "privileges_enriched": len(privileges_data),
        }
        summary["total"] = sum(
            v
            for k, v in summary.items()
            if k not in ["tags_enriched", "privileges_enriched"]
        )

        # Log any exceptions
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                entity_types = [
                    "catalogs",
                    "schemas",
                    "tables",
                    "columns",
                    "volumes",
                    "functions",
                    "tags",
                    "privileges",
                ]
                logger.error(f"Failed to sync {entity_types[i]}: {result}")

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(f"Metadata sync completed in {duration:.2f}s: {summary}")

        return summary

    async def _sync_catalogs(self, db: Session) -> int:
        """Sync catalogs."""
        try:
            catalogs = await self.system_client.fetch_catalogs()
            records = self.transformer.transform_catalogs(catalogs)
            self._bulk_upsert(db, records)
            logger.info(f"Synced {len(records)} catalogs")
            return len(records)
        except Exception as e:
            logger.error(f"Error syncing catalogs: {e}")
            raise

    async def _sync_schemas(self, db: Session) -> int:
        """Sync schemas."""
        try:
            schemas = await self.system_client.fetch_schemas()
            records = self.transformer.transform_schemas(schemas)
            self._bulk_upsert(db, records)
            logger.info(f"Synced {len(records)} schemas")
            return len(records)
        except Exception as e:
            logger.error(f"Error syncing schemas: {e}")
            raise

    async def _sync_tables(self, db: Session) -> int:
        """Sync tables."""
        try:
            tables = await self.system_client.fetch_tables()
            records = self.transformer.transform_tables(tables)
            self._bulk_upsert(db, records)
            logger.info(f"Synced {len(records)} tables")
            return len(records)
        except Exception as e:
            logger.error(f"Error syncing tables: {e}")
            raise

    async def _sync_columns(self, db: Session) -> int:
        """Sync columns."""
        try:
            columns = await self.system_client.fetch_columns()
            records = self.transformer.transform_columns(columns)
            self._bulk_upsert(db, records)
            logger.info(f"Synced {len(records)} columns")
            return len(records)
        except Exception as e:
            logger.error(f"Error syncing columns: {e}")
            raise

    async def _sync_volumes(self, db: Session) -> int:
        """Sync volumes."""
        try:
            volumes = await self.system_client.fetch_volumes()
            records = self.transformer.transform_volumes(volumes)
            self._bulk_upsert(db, records)
            logger.info(f"Synced {len(records)} volumes")
            return len(records)
        except Exception as e:
            logger.error(f"Error syncing volumes: {e}")
            raise

    async def _sync_functions(self, db: Session) -> int:
        """Sync functions."""
        try:
            functions = await self.system_client.fetch_functions()
            records = self.transformer.transform_functions(functions)
            self._bulk_upsert(db, records)
            logger.info(f"Synced {len(records)} functions")
            return len(records)
        except Exception as e:
            logger.error(f"Error syncing functions: {e}")
            raise

    async def _fetch_all_tags(self) -> Dict[str, List[Dict]]:
        """
        Fetch all tags and organize by entity path.

        Returns:
            Dict mapping entity_path to list of tags
        """
        tags_by_path = {}

        try:
            # Fetch all tag types in parallel
            (
                catalog_tags,
                schema_tags,
                table_tags,
                column_tags,
                volume_tags,
            ) = await asyncio.gather(
                self.system_client.fetch_catalog_tags(),
                self.system_client.fetch_schema_tags(),
                self.system_client.fetch_table_tags(),
                self.system_client.fetch_column_tags(),
                self.system_client.fetch_volume_tags(),
                return_exceptions=True,
            )

            # Process catalog tags
            if not isinstance(catalog_tags, Exception):
                for tag in catalog_tags:
                    path = tag["catalog_name"]
                    if path not in tags_by_path:
                        tags_by_path[path] = []
                    tags_by_path[path].append(
                        {"name": tag["tag_name"], "value": tag["tag_value"]}
                    )

            # Process schema tags
            if not isinstance(schema_tags, Exception):
                for tag in schema_tags:
                    path = f"{tag['catalog_name']}.{tag['schema_name']}"
                    if path not in tags_by_path:
                        tags_by_path[path] = []
                    tags_by_path[path].append(
                        {"name": tag["tag_name"], "value": tag["tag_value"]}
                    )

            # Process table tags
            if not isinstance(table_tags, Exception):
                for tag in table_tags:
                    path = f"{tag['catalog_name']}.{tag['schema_name']}.{tag['table_name']}"
                    if path not in tags_by_path:
                        tags_by_path[path] = []
                    tags_by_path[path].append(
                        {"name": tag["tag_name"], "value": tag["tag_value"]}
                    )

            # Process column tags
            if not isinstance(column_tags, Exception):
                for tag in column_tags:
                    path = f"{tag['catalog_name']}.{tag['schema_name']}.{tag['table_name']}.{tag['column_name']}"
                    if path not in tags_by_path:
                        tags_by_path[path] = []
                    tags_by_path[path].append(
                        {"name": tag["tag_name"], "value": tag["tag_value"]}
                    )

            # Process volume tags
            if not isinstance(volume_tags, Exception):
                for tag in volume_tags:
                    path = f"{tag['catalog_name']}.{tag['schema_name']}.{tag['volume_name']}"
                    if path not in tags_by_path:
                        tags_by_path[path] = []
                    tags_by_path[path].append(
                        {"name": tag["tag_name"], "value": tag["tag_value"]}
                    )

            logger.info(f"Fetched tags for {len(tags_by_path)} entities")
            return tags_by_path

        except Exception as e:
            logger.error(f"Error fetching tags: {e}")
            return {}

    async def _fetch_table_privileges(self) -> Dict[str, List[Dict]]:
        """
        Fetch table privileges and organize by table path.

        Returns:
            Dict mapping table_path to list of privileges
        """
        privileges_by_path = {}

        try:
            privileges = await self.system_client.fetch_table_privileges()

            for priv in privileges:
                path = f"{priv['table_catalog']}.{priv['table_schema']}.{priv['table_name']}"
                if path not in privileges_by_path:
                    privileges_by_path[path] = []
                privileges_by_path[path].append(
                    {
                        "grantee": priv["grantee"],
                        "privilege_type": priv["privilege_type"],
                        "is_grantable": priv.get("is_grantable"),
                        "inherited_from": priv.get("inherited_from"),
                    }
                )

            logger.info(f"Fetched privileges for {len(privileges_by_path)} tables")
            return privileges_by_path

        except Exception as e:
            logger.error(f"Error fetching privileges: {e}")
            return {}

    async def _enrich_with_tags_and_privileges(
        self,
        db: Session,
        tags_data: Dict[str, List[Dict]],
        privileges_data: Dict[str, List[Dict]],
    ):
        """
        Enrich existing metadata records with tags and privileges.

        Args:
            db: SQLAlchemy session
            tags_data: Tags organized by entity path
            privileges_data: Privileges organized by table path
        """
        try:
            # Get all active records
            records = db.query(CatalogMetadata).filter(CatalogMetadata.is_active).all()

            updated_count = 0
            for record in records:
                updated = False

                # Add tags if available
                if record.entity_path in tags_data:
                    record.metadata_json["tags"] = tags_data[record.entity_path]
                    updated = True

                # Add privileges if this is a table
                if (
                    record.entity_type == "table"
                    and record.entity_path in privileges_data
                ):
                    record.metadata_json["privileges"] = privileges_data[
                        record.entity_path
                    ]
                    updated = True

                if updated:
                    updated_count += 1

            db.commit()
            logger.info(f"Enriched {updated_count} records with tags and privileges")

        except Exception as e:
            logger.error(f"Error enriching metadata: {e}")
            db.rollback()

    def _bulk_upsert(self, db: Session, records: List[Dict]):
        """
        Bulk upsert records using PostgreSQL INSERT ... ON CONFLICT.

        Args:
            db: SQLAlchemy session
            records: List of dicts to upsert
        """
        if not records:
            return

        stmt = insert(CatalogMetadata).values(records)
        stmt = stmt.on_conflict_do_update(
            constraint="unique_entity_path",
            set_={
                "metadata": stmt.excluded.metadata_json,
                "synced_at": datetime.now(timezone.utc),
                "is_active": True,
            },
        )
        db.execute(stmt)
        db.commit()
