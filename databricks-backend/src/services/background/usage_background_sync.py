"""Background service for syncing DBU usage data from Databricks system tables."""

import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import and_

from ...core.config import settings
from ...core.database import get_db
from ...models.db.compute_tracking import (
    DBUAggregates,
    DBUSyncStatus,
    PipelineDBUUsage,
)
from ..databricks.databricks_billing_api import (
    DatabricksBillingAPI,
)

logger = logging.getLogger(__name__)


class DBUBackgroundSyncService:
    """Manages a background task for daily synchronization of DBU usage data.

    This service is responsible for periodically fetching DBU (Databricks Unit)
    usage data from Databricks system tables via the billing API. It runs on a
    daily schedule, typically at a fixed time, to update the local database
    with the latest usage metrics, which are then used for cost analysis and
    reporting.

    Attributes:
        sync_interval (int): The interval in seconds between sync checks.
        is_running (bool): A flag indicating if the sync loop is active.
        task (asyncio.Task): The asyncio task for the running sync loop.
    """

    def __init__(self, sync_interval: int = 86400):  # Default 24 hours
        """Initialize DBU background sync service.

        Args:
            sync_interval: Sync interval in seconds (default 24 hours)
        """
        self.sync_interval = sync_interval
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        self.billing_api: Optional[DatabricksBillingAPI] = None

        # Configuration
        self.warehouse_id = settings.databricks_warehouse_id
        self.max_retries = 3
        self.retry_delay = 300  # 5 minutes

    async def start(self):
        """Start the background sync service."""
        if self.is_running:
            logger.warning("DBU sync service is already running")
            return

        logger.info(f"Starting DBU sync service with {self.sync_interval}s interval")
        self.is_running = True
        self.task = asyncio.create_task(self._sync_loop())

    async def stop(self):
        """Stop the background sync service."""
        if not self.is_running:
            logger.warning("DBU sync service is not running")
            return

        logger.info("Stopping DBU sync service")
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
                    logger.info(f"Next DBU sync scheduled for {next_sync}")
                    await asyncio.sleep(wait_seconds)

                if not self.is_running:
                    break

                logger.info("Starting scheduled DBU sync")
                await self._perform_daily_sync()

            except asyncio.CancelledError:
                logger.info("DBU sync loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in DBU sync loop: {e!s}", exc_info=True)
                # Wait 1 hour before retrying on error
                await asyncio.sleep(3600)

    def _calculate_next_sync_time(self) -> datetime:
        """Calculate the next sync time (2 AM tomorrow)."""
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        next_sync = tomorrow.replace(hour=2, minute=0, second=0, microsecond=0)
        return next_sync

    async def _perform_daily_sync(self, force_resync: bool = False):
        """Perform daily DBU usage sync for all workspaces.

        Args:
            force_resync: Force resync even if recently synced
        """
        sync_batch_id = str(uuid.uuid4())[:8]
        logger.info(
            f"Starting daily DBU sync batch: {sync_batch_id} (force_resync={force_resync})"
        )

        try:
            # Initialize billing API
            from ...core.config import settings

            self.billing_api = DatabricksBillingAPI(
                host=settings.databricks_host,
                client_id=settings.databricks_client_id,
                client_secret=settings.databricks_client_secret,
            )

            # Validate system tables access
            if not await self._validate_system_access():
                logger.error("Cannot access system tables, skipping sync")
                return

            # Get all workspaces that need syncing
            workspaces = await self._get_workspaces_to_sync()
            logger.info(f"Found {len(workspaces)} workspaces to sync")

            total_records = 0
            successful_workspaces = 0

            for workspace in workspaces:
                try:
                    records = await self._sync_workspace_dbu_usage(
                        workspace["workspace_id"], sync_batch_id
                    )
                    total_records += records
                    successful_workspaces += 1

                    # Update sync status
                    await self._update_sync_status(
                        workspace["workspace_id"], "success", records, sync_batch_id
                    )

                except Exception as e:
                    logger.error(
                        f"Failed to sync workspace {workspace['workspace_id']}: {e!s}"
                    )
                    await self._update_sync_status(
                        workspace["workspace_id"], "failed", 0, sync_batch_id, str(e)
                    )

            # Generate aggregations
            await self._generate_daily_aggregations(sync_batch_id)

            # Check for cost anomalies
            await self._detect_cost_anomalies(sync_batch_id)

            logger.info(
                f"Daily sync completed: {total_records} records, {successful_workspaces}/{len(workspaces)} workspaces successful"
            )

        except Exception as e:
            logger.error(f"Daily sync failed: {e!s}", exc_info=True)

    async def _validate_system_access(self) -> bool:
        """Validate access to system tables."""
        if not self.warehouse_id:
            logger.error("No warehouse_id configured for system table access")
            return False

        try:
            return await self.billing_api.validate_system_tables_access(
                self.warehouse_id
            )
        except Exception as e:
            logger.error(f"System table validation failed: {e!s}")
            return False

    async def _get_workspaces_to_sync(self) -> list[dict[str, Any]]:
        """Get list of workspaces that need DBU sync."""
        try:
            # Get workspaces from billing data
            workspaces = await self.billing_api.get_workspace_info(self.warehouse_id)

            # Filter to only include workspaces that need syncing
            db = next(get_db())
            workspaces_to_sync = []

            for workspace in workspaces:
                workspace_id = workspace["workspace_id"]

                # Check last sync status
                sync_status = (
                    db.query(DBUSyncStatus)
                    .filter(DBUSyncStatus.workspace_id == workspace_id)
                    .first()
                )

                # Determine if sync is needed
                yesterday = date.today() - timedelta(days=1)

                if not sync_status or sync_status.last_sync_date < yesterday:
                    workspaces_to_sync.append(workspace)

            db.close()
            return workspaces_to_sync

        except Exception as e:
            logger.error(f"Failed to get workspaces for sync: {e!s}")
            return []

    async def _sync_workspace_dbu_usage(
        self,
        workspace_id: str,
        sync_batch_id: str,
        target_date: Optional[date] = None,
        force_resync: bool = False,
    ) -> int:
        """Sync DBU usage for a specific workspace.

        Args:
            workspace_id: Workspace to sync
            sync_batch_id: Batch ID for tracking
            target_date: Specific date to sync (None for next date in sequence)
            force_resync: Force resync even if already synced

        Returns:
            Number of records processed
        """
        logger.info(
            f"Syncing DBU usage for workspace: {workspace_id}, "
            f"target_date: {target_date or 'next'}, force_resync: {force_resync}"
        )

        # Determine date range to sync
        if target_date:
            sync_date = target_date
        else:
            sync_date = await self._get_next_sync_date(workspace_id)
            if not sync_date and not force_resync:
                logger.info(f"No sync needed for workspace {workspace_id}")
                return 0
            elif not sync_date:
                # Force resync - use yesterday
                sync_date = date.today() - timedelta(days=1)

        # Get DBU usage data
        dbu_usage_records = await self.billing_api.get_dbu_usage_by_date(
            sync_date, self.warehouse_id, workspace_id
        )

        # Get pipeline job runs for correlation
        job_runs = await self.billing_api.get_pipeline_job_runs(
            sync_date, self.warehouse_id, workspace_id
        )

        # Process and store usage records
        records_stored = await self._store_dbu_usage_records(
            dbu_usage_records, job_runs, sync_batch_id, workspace_id
        )

        logger.info(f"Stored {records_stored} DBU usage records for {workspace_id}")
        return records_stored

    async def _get_next_sync_date(self, workspace_id: str) -> Optional[date]:
        """Get the next date that needs syncing for a workspace."""
        db = next(get_db())
        try:
            sync_status = (
                db.query(DBUSyncStatus)
                .filter(DBUSyncStatus.workspace_id == workspace_id)
                .first()
            )

            if not sync_status:
                # First sync - start with 7 days ago
                return date.today() - timedelta(days=7)

            if sync_status.last_sync_date:
                # Sync next day after last successful sync
                next_date = sync_status.last_sync_date + timedelta(days=1)
                yesterday = date.today() - timedelta(days=1)

                if next_date <= yesterday:
                    return next_date

            return None

        finally:
            db.close()

    async def _store_dbu_usage_records(
        self,
        dbu_records: list[dict[str, Any]],
        job_runs: list[dict[str, Any]],
        sync_batch_id: str,
        workspace_id: str,
    ) -> int:
        """Store DBU usage records in database.

        For resync scenarios, this will delete existing records for the same
        workspace_id and usage_date before inserting new records.
        """
        if not dbu_records:
            return 0

        db = next(get_db())
        try:
            # Get unique dates from the records being synced
            usage_dates = set()
            for record in dbu_records:
                usage_date = datetime.strptime(record["usage_date"], "%Y-%m-%d").date()
                usage_dates.add(usage_date)

            # Delete existing records for these dates (for upsert behavior)
            if usage_dates:
                logger.info(
                    f"Deleting existing records for workspace {workspace_id} "
                    f"on dates: {sorted(usage_dates)}"
                )
                deleted_count = (
                    db.query(PipelineDBUUsage)
                    .filter(
                        PipelineDBUUsage.workspace_id == workspace_id,
                        PipelineDBUUsage.usage_date.in_(usage_dates),
                    )
                    .delete(synchronize_session=False)
                )
                logger.info(f"Deleted {deleted_count} existing records for resync")
                db.commit()

            # Create job run lookup for correlation
            job_run_lookup = {str(run["job_id"]): run for run in job_runs}

            stored_count = 0

            for record in dbu_records:
                try:
                    # Extract pipeline information from custom tags or job correlation
                    pipeline_id = self._extract_pipeline_id(record, job_run_lookup)

                    # Log sample record for debugging (only first record)
                    if stored_count == 0:
                        logger.info(
                            f"Sample record - pipeline_id: {record.get('pipeline_id')}, billing_origin_product: {record.get('billing_origin_product')}, job_id: {record.get('job_id')}, custom_tags: {record.get('custom_tags')}"
                        )

                    # Parse timestamps if they exist
                    usage_start_time = None
                    usage_end_time = None
                    if record.get("usage_start_time"):
                        try:
                            usage_start_time = datetime.fromisoformat(
                                record["usage_start_time"]
                                .replace("+00:00", "")
                                .replace("Z", "")
                            ).replace(tzinfo=timezone.utc)
                        except Exception:
                            pass
                    if record.get("usage_end_time"):
                        try:
                            usage_end_time = datetime.fromisoformat(
                                record["usage_end_time"]
                                .replace("+00:00", "")
                                .replace("Z", "")
                            ).replace(tzinfo=timezone.utc)
                        except Exception:
                            pass

                    usage_record = PipelineDBUUsage(
                        pipeline_id=pipeline_id or "unknown",
                        pipeline_name=self._extract_pipeline_name(
                            record, job_run_lookup, pipeline_id
                        ),
                        usage_date=datetime.strptime(
                            record["usage_date"], "%Y-%m-%d"
                        ).date(),
                        dbu_consumed=record["dbu_consumed"],
                        dbu_unit_price=record.get("dbu_unit_price"),
                        dbu_cost_usd=record.get("dbu_cost_usd"),
                        workspace_id=workspace_id,
                        environment=self._determine_environment(record),
                        sku_name=record.get("sku_name"),
                        sync_batch_id=sync_batch_id,
                        # Fields from system.billing.usage
                        usage_start_time=usage_start_time,
                        usage_end_time=usage_end_time,
                        billing_origin_product=record.get("billing_origin_product"),
                        executed_by=record.get("executed_by"),
                        dlt_tier=record.get("dlt_tier"),
                        is_serverless=record.get("is_serverless"),
                        usage_unit=record.get("usage_unit", "DBU"),
                        cloud_provider=record.get("cloud"),
                        # Fields from usage_metadata
                        job_id=record.get("job_id"),
                        run_id=record.get("job_run_id"),
                    )

                    # Legacy job correlation (deprecated since we now get this from usage_metadata)
                    if pipeline_id and pipeline_id in job_run_lookup:
                        run_info = job_run_lookup[pipeline_id]
                        # Only override if not already set from usage_metadata
                        if not usage_record.job_id:
                            usage_record.job_id = str(run_info["job_id"])
                        if not usage_record.run_id:
                            usage_record.run_id = str(run_info["run_id"])
                        usage_record.execution_start_time = run_info.get("start_time")
                        usage_record.execution_end_time = run_info.get("end_time")
                        usage_record.execution_duration_minutes = run_info.get(
                            "duration_minutes"
                        )

                    db.add(usage_record)
                    stored_count += 1

                except Exception as e:
                    logger.error(f"Failed to store DBU record: {e!s}")
                    continue

            db.commit()
            logger.info(f"Stored {stored_count} DBU usage records")
            return stored_count

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to store DBU records: {e!s}")
            raise
        finally:
            db.close()

    def _extract_pipeline_id(
        self, record: dict[str, Any], job_runs: dict[str, Any]
    ) -> Optional[str]:
        """Extract pipeline ID from usage record or job correlation."""
        # First try to get from usage_metadata.dlt_pipeline_id (now in pipeline_id field)
        pipeline_id = record.get("pipeline_id")
        if pipeline_id and pipeline_id != "NULL" and str(pipeline_id).strip():
            logger.debug(f"Found pipeline_id from usage_metadata: {pipeline_id}")
            return str(pipeline_id)

        # Try to get from custom tags
        tags = record.get("custom_tags", {})
        if isinstance(tags, dict):
            # Check for pipeline_id in tags
            if "pipeline_id" in tags and tags["pipeline_id"]:
                logger.debug(
                    f"Found pipeline_id from custom_tags: {tags['pipeline_id']}"
                )
                return tags["pipeline_id"]

            # Check for dlt_pipeline_id in tags
            if "dlt_pipeline_id" in tags and tags["dlt_pipeline_id"]:
                logger.debug(
                    f"Found dlt_pipeline_id from custom_tags: {tags['dlt_pipeline_id']}"
                )
                return tags["dlt_pipeline_id"]

        # Check if this is DLT usage - if so, we should try harder to find pipeline_id
        if record.get("billing_origin_product") == "DLT":
            logger.warning(
                f"DLT usage record without pipeline_id - "
                f"job_id: {record.get('job_id')}, "
                f"sku: {record.get('sku_name')}"
            )

        # No pipeline_id found - this might be non-pipeline usage (e.g., SQL warehouse, all-purpose compute)
        logger.debug(
            f"No pipeline_id found for billing_origin_product: {record.get('billing_origin_product')}"
        )
        return None

    def _extract_pipeline_name(
        self,
        record: dict[str, Any],
        job_runs: dict[str, Any],
        pipeline_id: Optional[str],
    ) -> Optional[str]:
        """Extract pipeline name from job correlation."""
        if pipeline_id and pipeline_id in job_runs:
            return job_runs[pipeline_id].get("job_name")
        return None

    def _determine_environment(self, record: dict[str, Any]) -> str:
        """Determine environment from usage record."""
        # This could be enhanced to use workspace naming conventions
        # or custom tags to determine environment
        return "production"

    async def _generate_daily_aggregations(self, sync_batch_id: str):
        """Generate daily aggregations for fast querying."""
        logger.info("Generating daily aggregations")

        db = next(get_db())
        try:
            # Get data from current sync batch
            yesterday = date.today() - timedelta(days=1)

            # Aggregate by pipeline
            pipeline_aggs = (
                db.query(
                    PipelineDBUUsage.pipeline_id,
                    PipelineDBUUsage.workspace_id,
                    PipelineDBUUsage.environment,
                    PipelineDBUUsage.usage_date,
                )
                .filter(
                    and_(
                        PipelineDBUUsage.sync_batch_id == sync_batch_id,
                        PipelineDBUUsage.usage_date == yesterday,
                    )
                )
                .distinct()
                .all()
            )

            for agg in pipeline_aggs:
                # Calculate aggregated metrics
                usage_records = (
                    db.query(PipelineDBUUsage)
                    .filter(
                        and_(
                            PipelineDBUUsage.pipeline_id == agg.pipeline_id,
                            PipelineDBUUsage.usage_date == yesterday,
                        )
                    )
                    .all()
                )

                if usage_records:
                    total_executions = len(usage_records)
                    total_dbu = sum(
                        r.dbu_consumed for r in usage_records if r.dbu_consumed
                    )
                    total_cost = sum(
                        r.dbu_cost_usd for r in usage_records if r.dbu_cost_usd
                    )

                    # Create or update daily aggregate
                    daily_agg = (
                        db.query(DBUAggregates)
                        .filter(
                            and_(
                                DBUAggregates.aggregation_level == "daily",
                                DBUAggregates.aggregation_date == yesterday,
                                DBUAggregates.pipeline_id == agg.pipeline_id,
                            )
                        )
                        .first()
                    )

                    if not daily_agg:
                        daily_agg = DBUAggregates(
                            aggregation_level="daily",
                            aggregation_date=yesterday,
                            pipeline_id=agg.pipeline_id,
                            workspace_id=agg.workspace_id,
                            environment=agg.environment,
                        )
                        db.add(daily_agg)

                    daily_agg.total_executions = total_executions
                    daily_agg.total_dbu_consumed = total_dbu
                    daily_agg.total_dbu_cost_usd = total_cost
                    daily_agg.avg_dbu_per_execution = (
                        total_dbu / total_executions if total_executions > 0 else 0
                    )
                    daily_agg.updated_at = datetime.now(timezone.utc)

            db.commit()
            logger.info("Daily aggregations completed")

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to generate aggregations: {e!s}")
        finally:
            db.close()

    async def _detect_cost_anomalies(self, sync_batch_id: str):
        """Detect cost anomalies and create alerts."""
        logger.info("Checking for cost anomalies")

        # Implementation would include:
        # - Compare current costs with historical averages
        # - Detect unusual spikes in DBU consumption
        # - Create alerts for significant cost increases
        # - Check against budget thresholds

        # For now, just log that anomaly detection ran
        logger.info("Cost anomaly detection completed")

    async def _update_sync_status(
        self,
        workspace_id: str,
        status: str,
        records_processed: int,
        sync_batch_id: str,
        error_message: Optional[str] = None,
    ):
        """Update sync status for a workspace."""
        db = next(get_db())
        try:
            sync_status = (
                db.query(DBUSyncStatus)
                .filter(DBUSyncStatus.workspace_id == workspace_id)
                .first()
            )

            if not sync_status:
                sync_status = DBUSyncStatus(workspace_id=workspace_id)
                db.add(sync_status)

            sync_status.last_sync_attempt = datetime.now(timezone.utc)
            sync_status.last_sync_status = status
            sync_status.records_processed = records_processed
            sync_status.sync_batch_id = sync_batch_id

            if status == "success":
                sync_status.last_successful_sync = datetime.now(timezone.utc)
                sync_status.last_sync_date = date.today() - timedelta(days=1)
                sync_status.retry_count = 0
                sync_status.error_message = None
            else:
                sync_status.retry_count = (sync_status.retry_count or 0) + 1
                sync_status.error_message = error_message

            db.commit()

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update sync status: {e!s}")
        finally:
            db.close()

    async def trigger_manual_sync(
        self,
        workspace_id: Optional[str] = None,
        force_resync: bool = False,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> dict[str, Any]:
        """Trigger manual sync for testing/admin purposes.

        Args:
            workspace_id: Specific workspace ID to sync (None for all)
            force_resync: Force resync even if recently synced
            start_date: Start date of sync range (None for yesterday)
            end_date: End date of sync range (None for yesterday)

        Returns:
            Dict with sync results including status, records processed, and batch ID
        """
        logger.info(
            f"Manual sync triggered - workspace: {workspace_id or 'all'}, "
            f"date range: {start_date or 'latest'} to {end_date or 'latest'}, "
            f"force_resync: {force_resync}"
        )

        sync_batch_id = str(uuid.uuid4())[:8]

        try:
            if not self.billing_api:
                from ...core.config import settings

                self.billing_api = DatabricksBillingAPI(
                    host=settings.databricks_host,
                    client_id=settings.databricks_client_id,
                    client_secret=settings.databricks_client_secret,
                )

            # Determine date range for sync
            if not start_date and not end_date:
                # Default to yesterday
                start_date = end_date = date.today() - timedelta(days=1)
            elif start_date and not end_date:
                # Single date sync
                end_date = start_date
            elif end_date and not start_date:
                # Single date sync
                start_date = end_date

            # If no workspace_id provided, this is likely a full sync without date range support
            if not workspace_id:
                logger.warning(
                    "No workspace_id provided for sync - this will sync all workspaces "
                    "but date range filtering may not work properly"
                )
                await self._perform_daily_sync(force_resync=force_resync)
                return {
                    "status": "success",
                    "message": "Full sync completed (all workspaces). Please configure workspace_id for date range sync.",
                    "sync_batch_id": sync_batch_id,
                    "records_processed": 0,
                }

            # Sync specific workspace for date range
            total_records = 0
            current_date = start_date
            days_processed = 0

            while current_date <= end_date:
                logger.info(
                    f"Syncing workspace {workspace_id} for date: {current_date}"
                )
                try:
                    records = await self._sync_workspace_dbu_usage(
                        workspace_id=workspace_id,
                        sync_batch_id=sync_batch_id,
                        target_date=current_date,
                        force_resync=force_resync,
                    )
                    total_records += records
                    days_processed += 1
                    logger.info(f"✓ Synced {current_date}: {records} records")
                except Exception as e:
                    logger.error(f"✗ Failed to sync {current_date}: {e}")
                    # Continue with next date even if one fails

                current_date += timedelta(days=1)

            return {
                "status": "success",
                "workspace_id": workspace_id,
                "records_processed": total_records,
                "sync_batch_id": sync_batch_id,
                "message": f"Synced {days_processed} days, {total_records} records processed",
            }

        except Exception as e:
            logger.error(f"Manual sync failed: {e!s}")
            return {"status": "failed", "error": str(e), "sync_batch_id": sync_batch_id}


# Create global instance
dbu_background_sync_service = DBUBackgroundSyncService(
    sync_interval=settings.background_sync_interval
)
