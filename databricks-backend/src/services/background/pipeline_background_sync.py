"""Background service for periodic pipeline observability sync from Databricks to PostgreSQL."""

import logging
from datetime import datetime, timezone
from typing import Optional

from ...core.config import settings
from ..base_service import BaseService
from ..pipeline_metric_export_service import PipelineMetricExportService

logger = logging.getLogger(__name__)


class PipelineBackgroundSyncService(BaseService):
    """Manages periodic export of DLT aggregates from Databricks to PostgreSQL."""

    def __init__(self, sync_interval: int = 900):  # 15 minutes default
        """Initialize the pipeline background sync service.

        Args:
            sync_interval: Seconds between sync operations (default: 300 = 5 minutes)
        """
        super().__init__(sync_interval)
        self.sync_service: Optional[PipelineMetricExportService] = None
        self.last_sync_time: Optional[datetime] = None
        self.last_sync_result: Optional[dict] = None
        self._pipelines_api = None

    async def _perform_sync(self):
        """Perform observability sync operation."""
        start_time = datetime.now(timezone.utc)

        try:
            # Initialize sync service if needed
            if not self.sync_service:
                if not all(
                    [
                        settings.databricks_host,
                        settings.databricks_client_id,
                        settings.databricks_client_secret,
                        settings.databricks_warehouse_id,
                        settings.databricks_catalog,
                    ]
                ):
                    logger.warning(
                        "Observability sync service not fully configured. "
                        "Required: databricks_host, client_id, client_secret, warehouse_id, catalog"
                    )
                    return

                self.sync_service = PipelineMetricExportService(
                    host=settings.databricks_host or "",
                    client_id=settings.databricks_client_id or "",
                    client_secret=settings.databricks_client_secret or "",
                    warehouse_id=settings.databricks_warehouse_id,
                    catalog=settings.databricks_catalog,
                )
                logger.info("Aggregate export service initialized")

            # Ensure pipelines API
            if not self._pipelines_api:
                from ..databricks.databricks_pipelines_api import DatabricksPipelinesAPI

                self._pipelines_api = DatabricksPipelinesAPI(
                    host=settings.databricks_host or "",
                    client_id=settings.databricks_client_id or "",
                    client_secret=settings.databricks_client_secret or "",
                )

            logger.info(
                "Starting aggregate export background job and pipeline catalog sync..."
            )

            # Discover pipelines from deployment details and upsert into DB
            await self._discover_and_upsert_pipelines()

            # Perform metrics sync for all pipelines
            result = await self.sync_service.export_all()

            duration = (datetime.now(timezone.utc) - start_time).total_seconds()

            # Store sync results
            self.last_sync_time = datetime.now(timezone.utc)
            self.last_sync_result = {
                **result,
                "sync_duration_seconds": round(duration, 2),
                "sync_time": self.last_sync_time.isoformat(),
            }

            # Log summary
            logger.info(
                f"Aggregate export completed: pipelines={result.get('pipelines_synced', 0)}, rows={result.get('rows_upserted', result.get('total_events_synced', 0))}, duration={duration:.2f}s"
            )

        except Exception as e:
            logger.error(
                f"Unexpected error during observability sync: {e}", exc_info=True
            )
            self.last_sync_result = {
                "status": "error",
                "error": str(e),
                "sync_time": datetime.now(timezone.utc).isoformat(),
            }
            raise

    async def _discover_and_upsert_pipelines(self):
        from ...core.database import get_db_session
        from ...models.db import DeploymentDetail, Pipeline

        with get_db_session() as db:
            rows = (
                db.query(DeploymentDetail)
                .filter(DeploymentDetail.file_type.in_(["pipeline", "dlt_pipeline"]))
                .all()
            )
            count = 0
            for d in rows:
                pid = d.platform_object_id
                if not pid:
                    continue
                try:
                    # Fetch details from Databricks
                    info = await self._pipelines_api.get_pipeline(pid)
                    info_dict = info.as_dict() if hasattr(info, "as_dict") else info
                    name = info_dict.get("name") or pid
                    # Identify target table from spec if present
                    target_table = None
                    spec = info_dict.get("spec") or {}
                    conf = spec.get("configuration") or {}
                    # Our tagging convention
                    tags = {
                        "created_by": conf.get("created_by"),
                        "managed_by": conf.get("managed_by"),
                    }
                    if conf.get("target") and conf.get("layer") and conf.get("table"):
                        target_table = (
                            f"{conf['target']}.{conf['layer']}.{conf['table']}"
                        )
                    # Upsert
                    existing = (
                        db.query(Pipeline).filter(Pipeline.pipeline_id == pid).first()
                    )
                    if existing:
                        existing.name = name
                        existing.target_table = target_table
                        existing.tags = tags
                        existing.spec = spec
                        existing.updated_at = datetime.now(timezone.utc)
                    else:
                        db.add(
                            Pipeline(
                                pipeline_id=pid,
                                name=name,
                                target_table=target_table,
                                tags=tags,
                                spec=spec,
                            )
                        )
                    count += 1
                except Exception as e:
                    logger.warning(f"Failed to sync pipeline {pid}: {e}")
            db.commit()
            logger.info(f"Pipeline catalog sync upserted {count} pipelines")

    def get_health_status(self) -> dict:
        """Get health status of the sync service.

        Returns:
            Dict with health status information
        """
        if not self.is_running:
            return {
                "status": "stopped",
                "is_running": False,
                "message": "Service is not running",
            }

        if not self.last_sync_result:
            return {
                "status": "initializing",
                "is_running": True,
                "message": "Service started, waiting for first sync",
                "sync_interval_seconds": self.sync_interval,
            }

        # Calculate time since last sync
        if self.last_sync_time:
            time_since_sync = (
                datetime.now(timezone.utc) - self.last_sync_time
            ).total_seconds()
        else:
            time_since_sync = None

        return {
            "status": self.last_sync_result.get("status", "unknown"),
            "is_running": True,
            "last_sync": self.last_sync_result,
            "time_since_last_sync_seconds": round(time_since_sync, 2)
            if time_since_sync
            else None,
            "sync_interval_seconds": self.sync_interval,
        }


# Global instance
pipeline_background_sync_service = PipelineBackgroundSyncService(
    sync_interval=settings.background_sync_interval
)
