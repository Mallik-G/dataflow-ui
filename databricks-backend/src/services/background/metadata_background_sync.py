"""Background service for periodic metadata synchronization."""

import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from ...core.database import get_db_session
from ..base_service import BaseService
from ..databricks.databricks_warehouse_api import DatabricksWarehouseAPI
from ..metadata.metadata_sync_service import MetadataSyncService
from ..metadata.system_tables_client import SystemTablesClient

logger = logging.getLogger(__name__)


class MetadataBackgroundSyncService(BaseService):
    """Background service for syncing Unity Catalog metadata from Databricks."""

    def __init__(self, sync_interval: int = 3600):
        """
        Initialize the metadata background sync service.

        Args:
            sync_interval: Interval in seconds between syncs (default: 3600 = 1 hour)
        """
        super().__init__(sync_interval)
        self.sql_api: Optional[DatabricksWarehouseAPI] = None
        self.last_sync_summary: Optional[Dict] = None
        self.last_sync_duration: Optional[float] = None
        self.last_sync_time: Optional[datetime] = None

    async def _perform_sync(self):
        """Perform metadata sync."""
        start_time = datetime.now(timezone.utc)

        try:
            # Initialize API client if needed
            if not self.sql_api:
                from ...core.config import settings

                self.sql_api = DatabricksWarehouseAPI(
                    host=settings.databricks_host,
                    client_id=settings.databricks_client_id,
                    client_secret=settings.databricks_client_secret,
                    default_warehouse_id=settings.databricks_warehouse_id,
                )

            logger.info("Starting catalog metadata background sync...")

            # Create clients
            system_client = SystemTablesClient(self.sql_api)
            sync_service = MetadataSyncService(system_client)

            # Perform sync
            with get_db_session() as db:
                self.last_sync_summary = await sync_service.sync_all(db)

            self.last_sync_duration = (
                datetime.now(timezone.utc) - start_time
            ).total_seconds()
            self.last_sync_time = datetime.now(timezone.utc)

            logger.info(
                f"Metadata sync completed: {self.last_sync_summary['total']} entities synced "
                f"in {self.last_sync_duration:.2f}s"
            )

        except Exception as e:
            logger.error(f"Metadata sync failed: {e}", exc_info=True)
            raise


# Global instance for access from API endpoints
metadata_sync_service: Optional[MetadataBackgroundSyncService] = None
