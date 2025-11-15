"""Background service for periodic Databricks to SQLite synchronization."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from ...core.database import get_db_session

# Fixed import path
from ...models.db import Job
from ..base_service import BaseService
from ..databricks.base_client import DatabricksAPIError
from ..databricks.databricks_jobs_api import DatabricksJobsAPI

# Configure logging
logger = logging.getLogger(__name__)


class JobsBackgroundSyncService(BaseService):
    """Manages a background task for periodic synchronization of Databricks jobs."""

    def __init__(self, sync_interval: int = 300):  # 300 seconds default
        """Initialize the background sync service."""
        super().__init__(sync_interval)
        self.databricks_api: Optional[DatabricksJobsAPI] = None

    async def _perform_sync(self):
        """Perform comprehensive sync operation with full job details, runs, and health data."""
        start_time = datetime.now(timezone.utc)

        try:
            # Initialize API client if needed
            if not self.databricks_api:
                from ...core.config import settings

                self.databricks_api = DatabricksJobsAPI(
                    host=settings.databricks_host,
                    client_id=settings.databricks_client_id,
                    client_secret=settings.databricks_client_secret,
                )

            logger.info("Starting comprehensive background sync from Databricks API...")

            jobs_synced = 0
            limit = 100

            with get_db_session() as db:
                # Fetch all jobs in one call; SDK iterator may paginate internally
                logger.info(f"Fetching jobs (limit per page: {limit})")
                jobs_batch = (
                    await self.databricks_api.list_jobs(limit=limit)
                    if self.databricks_api
                    else []
                )
                jobs_data = jobs_batch or []

                for job_data in jobs_data:
                    job_id_val = job_data.get("job_id")
                    if job_id_val is None:
                        continue
                    try:
                        job_id = int(job_id_val)
                    except Exception:
                        continue
                    logger.info(f"Processing job {job_id}")

                    # Sync job details
                    await self._sync_job_details(db, job_id, job_data)

                    # Sync job runs history
                    await self._sync_job_runs(db, job_id)

                    # Calculate and sync job health metrics
                    await self._sync_job_health(db, job_id)

                    jobs_synced += 1

                db.commit()

            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(
                f"Comprehensive sync completed: {jobs_synced} jobs synced in {duration:.2f}s"
            )

        except DatabricksAPIError as e:
            logger.error(f"Databricks API error during background sync: {e.message}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during background sync: {e}")
            raise

    async def _sync_job_details(self, db, job_id: int, job_data: dict):
        """Sync comprehensive job details."""
        try:
            if not self.databricks_api:
                return
            # Get detailed job info if we don't have all details
            detailed_job = await self.databricks_api.get_job(job_id)
            settings = detailed_job.get("settings", {})

            # Check if job exists
            existing_job = db.query(Job).filter(Job.job_id == job_id).first()

            if existing_job:
                # Update existing job with comprehensive details
                existing_job.job_name = settings.get("name", existing_job.job_name)
                existing_job.job_type = settings.get("format", existing_job.job_type)
                existing_job.creator_user_name = detailed_job.get(
                    "creator_user_name", existing_job.creator_user_name
                )
                existing_job.run_as_user_name = detailed_job.get(
                    "run_as_user_name", existing_job.run_as_user_name
                )
                existing_job.settings = settings
                # Prefer API modified_time if available
                api_modified = detailed_job.get("modified_time")
                existing_job.modified_time = (
                    datetime.fromtimestamp(api_modified / 1000)
                    if api_modified
                    else datetime.now(timezone.utc)
                )
                existing_job.last_fetched = datetime.now(timezone.utc)

                # Extract schedule information
                schedule_info = settings.get("schedule", {})
                if schedule_info:
                    existing_job.schedule = schedule_info.get(
                        "quartz_cron_expression", "CRON"
                    )
                elif settings.get("continuous"):
                    existing_job.schedule = "STREAMING"
                else:
                    existing_job.schedule = "MANUAL"

                # Extract additional fields from JobSettings for easier querying
                existing_job.tags = settings.get("tags")
                existing_job.timeout_seconds = settings.get("timeout_seconds")
                existing_job.max_concurrent_runs = settings.get("max_concurrent_runs")
                existing_job.email_notifications = settings.get("email_notifications")
                existing_job.webhook_notifications = settings.get(
                    "webhook_notifications"
                )
                existing_job.git_source = settings.get("git_source")
                existing_job.deployment_config = settings.get("deployment")
                existing_job.edit_mode = settings.get("edit_mode")

                # Extract top-level Job fields for cost attribution
                existing_job.budget_policy_id = detailed_job.get(
                    "effective_budget_policy_id"
                )
                existing_job.usage_policy_id = detailed_job.get(
                    "effective_usage_policy_id"
                )
            else:
                # Create new job with comprehensive details
                schedule_info = settings.get("schedule", {})
                if schedule_info:
                    schedule = schedule_info.get("quartz_cron_expression", "CRON")
                elif settings.get("continuous"):
                    schedule = "STREAMING"
                else:
                    schedule = "MANUAL"

                new_job = Job(
                    job_id=job_id,
                    job_name=settings.get("name", "Unknown Job"),
                    creator_user_name=detailed_job.get("creator_user_name", ""),
                    run_as_user_name=detailed_job.get("run_as_user_name", ""),
                    job_type=settings.get("format", "MULTI_TASK"),
                    schedule=schedule,
                    settings=settings,
                    created_time=datetime.fromtimestamp(
                        detailed_job.get("created_time", 0) / 1000
                    )
                    if detailed_job.get("created_time")
                    else datetime.now(timezone.utc),
                    modified_time=(
                        datetime.fromtimestamp(
                            detailed_job.get("modified_time", 0) / 1000
                        )
                        if detailed_job.get("modified_time")
                        else datetime.now(timezone.utc)
                    ),
                    last_fetched=datetime.now(timezone.utc),
                    is_active=True,
                    # Additional fields from JobSettings
                    tags=settings.get("tags"),
                    timeout_seconds=settings.get("timeout_seconds"),
                    max_concurrent_runs=settings.get("max_concurrent_runs"),
                    email_notifications=settings.get("email_notifications"),
                    webhook_notifications=settings.get("webhook_notifications"),
                    git_source=settings.get("git_source"),
                    deployment_config=settings.get("deployment"),
                    edit_mode=settings.get("edit_mode"),
                    # Top-level Job fields for cost attribution
                    budget_policy_id=detailed_job.get("effective_budget_policy_id"),
                    usage_policy_id=detailed_job.get("effective_usage_policy_id"),
                )
                db.add(new_job)

            # Sync permissions if available
            try:
                permissions_data = await self.databricks_api.get_permissions(
                    str(job_id)
                )
                # Store full envelope for flexibility
                if existing_job:
                    existing_job.permissions = permissions_data
                else:
                    new_job.permissions = permissions_data
            except Exception as e:
                logger.warning(f"Could not fetch permissions for job {job_id}: {e}")

        except Exception as e:
            logger.error(f"Error syncing job details for {job_id}: {e}")

    async def _sync_job_runs(self, db, job_id: int):
        """Incrementally sync job runs with pagination and active run refresh."""
        try:
            if not self.databricks_api:
                return
            from ...models.db import JobRun

            # Watermark: last known start_time for this job
            last_run = (
                db.query(JobRun)
                .filter(JobRun.job_id == job_id)
                .order_by(JobRun.start_time.desc())
                .first()
            )
            start_time_from = None
            if last_run and last_run.start_time:
                start_time_from = int(last_run.start_time.timestamp() * 1000)

            # Page through completed runs since watermark
            page_token = None
            fetched = 0
            while True:
                runs_page = await self.databricks_api.get_job_runs(
                    job_id=job_id,
                    active_only=False,
                    completed_only=False,
                    limit=25,
                    expand_tasks=True,
                    start_time_from=start_time_from,
                    page_token=page_token,
                )
                runs_data = runs_page or []
                if not runs_data:
                    break

                for run_data in runs_data:
                    run_id_val = run_data.get("run_id")
                    try:
                        run_id = int(run_id_val) if run_id_val is not None else None
                    except Exception:
                        run_id = None
                    if run_id is None:
                        continue

                    existing_run = (
                        db.query(JobRun).filter(JobRun.run_id == run_id).first()
                    )
                    fields = {
                        "run_name": run_data.get("run_name"),
                        "state": run_data.get("state", {}).get("life_cycle_state"),
                        "life_cycle_state": run_data.get("state", {}).get(
                            "life_cycle_state"
                        ),
                        "result_state": run_data.get("state", {}).get("result_state"),
                        "start_time": datetime.fromtimestamp(
                            run_data.get("start_time", 0) / 1000
                        )
                        if run_data.get("start_time")
                        else None,
                        "end_time": datetime.fromtimestamp(
                            run_data.get("end_time", 0) / 1000
                        )
                        if run_data.get("end_time")
                        else None,
                        "execution_duration": run_data.get("execution_duration"),
                        "setup_duration": run_data.get("setup_duration"),
                        "cleanup_duration": run_data.get("cleanup_duration"),
                        "trigger": run_data.get("trigger"),
                        "run_page_url": run_data.get("run_page_url"),
                        "original_attempt_run_id": run_data.get(
                            "original_attempt_run_id"
                        ),
                        "cluster_instance": run_data.get("cluster_instance"),
                        "error_message": (
                            run_data.get("state", {}).get("state_message", "") or ""
                        )[:500],
                    }

                    if existing_run:
                        for k, v in fields.items():
                            setattr(existing_run, k, v)
                    else:
                        db.add(JobRun(run_id=run_id, job_id=job_id, **fields))
                    fetched += 1

                # The SDK list_runs returns a list; page_token support depends on adapter.
                # Break to avoid infinite loop; rely on start_time_from watermark per sync.
                break

            # Refresh active runs without watermark to get latest state
            active_runs = await self.databricks_api.get_job_runs(
                job_id=job_id,
                active_only=True,
                completed_only=False,
                limit=25,
                expand_tasks=True,
            )
            for run_data in active_runs or []:
                run_id = run_data.get("run_id")
                if run_id is None:
                    continue
                existing_run = (
                    db.query(JobRun).filter(JobRun.run_id == int(run_id)).first()
                )
                if existing_run:
                    existing_run.state = run_data.get("state", {}).get(
                        "life_cycle_state"
                    )
                    existing_run.life_cycle_state = run_data.get("state", {}).get(
                        "life_cycle_state"
                    )
                    existing_run.result_state = run_data.get("state", {}).get(
                        "result_state"
                    )
                    existing_run.end_time = (
                        datetime.fromtimestamp(run_data.get("end_time", 0) / 1000)
                        if run_data.get("end_time")
                        else None
                    )

        except Exception as e:
            logger.error(f"Error syncing runs for job {job_id}: {e}")

    async def _sync_job_health(self, db, job_id: int):
        """Calculate and sync job health metrics based on recent runs."""
        try:
            from ...models.db import JobHealth, JobRun
            from sqlalchemy import desc as sa_desc
            from sqlalchemy.sql.elements import ColumnElement
            from typing import Optional, cast

            # Query recent runs for health calculation (last 30 days)
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)

            # Treat ORM attribute as a SQLAlchemy column expression for typing
            st_col = cast(ColumnElement[Optional[datetime]], JobRun.start_time)

            recent_runs = (
                db.query(JobRun)
                .filter(
                    JobRun.job_id == job_id, st_col.is_not(None), st_col >= cutoff_date
                )
                .order_by(sa_desc(st_col))
                .limit(20)
                .all()
            )

            if not recent_runs:
                return

            # Calculate health metrics
            total_runs = len(recent_runs)
            successful_runs = len(
                [r for r in recent_runs if r.result_state == "SUCCESS"]
            )

            # Calculate consecutive failures from most recent runs
            consecutive_failures = 0
            for run in recent_runs:
                if run.result_state in ["FAILED", "CANCELLED", "TIMEOUT"]:
                    consecutive_failures += 1
                else:
                    break

            # Calculate success rate and health score
            success_rate = successful_runs / total_runs if total_runs > 0 else 0.0
            health_score = success_rate * (
                1.0 - min(consecutive_failures / 5.0, 0.5)
            )  # Penalize consecutive failures

            # Calculate average runtime for successful runs
            successful_runtimes = [
                (getattr(r, "execution_duration", 0) or 0)
                + (getattr(r, "setup_duration", 0) or 0)
                + (getattr(r, "cleanup_duration", 0) or 0)
                for r in recent_runs
                if r.result_state == "SUCCESS" and r.end_time and r.start_time
            ]
            avg_runtime = (
                sum(successful_runtimes) / len(successful_runtimes)
                if successful_runtimes
                else 0
            )

            # Check if job is overdue (simplified check)
            is_overdue = False
            if recent_runs:
                last_run = recent_runs[0]
                # Simple overdue logic: if last run was more than 2x the average interval ago
                if last_run.start_time and avg_runtime > 0:
                    expected_next_run = last_run.start_time + timedelta(
                        seconds=avg_runtime * 2
                    )
                    is_overdue = datetime.now(timezone.utc) > expected_next_run

            # Update or create health record
            existing_health = (
                db.query(JobHealth).filter(JobHealth.job_id == job_id).first()
            )

            if existing_health:
                existing_health.health_score = health_score
                existing_health.is_overdue = is_overdue
                existing_health.consecutive_failures = consecutive_failures
                existing_health.last_successful_run = max(
                    [r.start_time for r in recent_runs if r.result_state == "SUCCESS"],
                    default=None,
                )
                existing_health.last_failed_run = max(
                    [
                        r.start_time
                        for r in recent_runs
                        if r.result_state in ["FAILED", "CANCELLED", "TIMEOUT"]
                    ],
                    default=None,
                )
                existing_health.avg_runtime_seconds = avg_runtime
                existing_health.last_overdue_check = datetime.now(timezone.utc)
            else:
                new_health = JobHealth(
                    job_id=job_id,
                    health_score=health_score,
                    is_overdue=is_overdue,
                    consecutive_failures=consecutive_failures,
                    last_successful_run=max(
                        [
                            r.start_time
                            for r in recent_runs
                            if r.result_state == "SUCCESS"
                        ],
                        default=None,
                    ),
                    last_failed_run=max(
                        [
                            r.start_time
                            for r in recent_runs
                            if r.result_state in ["FAILED", "CANCELLED", "TIMEOUT"]
                        ],
                        default=None,
                    ),
                    avg_runtime_seconds=avg_runtime,
                    last_overdue_check=datetime.now(timezone.utc),
                )
                db.add(new_health)

        except Exception as e:
            logger.error(f"Error syncing health for job {job_id}: {e}")
