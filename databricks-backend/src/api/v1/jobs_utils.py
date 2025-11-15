from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, cast

from sqlalchemy import String, and_, func, or_
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from ...models.api.jobs import DashboardStats, JobRunResponse, JobWithHealth
from ...models.db import Job, JobHealth, JobRun


def running_jobs_subquery(db: Session):
    jrid_col = cast(ColumnElement[int], JobRun.job_id)
    state_col = cast(ColumnElement[Optional[str]], JobRun.life_cycle_state)
    return (
        db.query(jrid_col)
        .filter(state_col.in_(["RUNNING", "QUEUED", "PENDING"]))
        .distinct()
    )


DateFilters = Dict[str, Optional[str]]


def apply_job_filters(
    db: Session,
    query,
    *,
    status: str,
    job_type: Optional[str],
    schedule: Optional[str],
    search: Optional[str],
    dates: DateFilters,
    tags: Optional[str] = None,
    timeout_min: Optional[int] = None,
    timeout_max: Optional[int] = None,
):
    if status != "all":
        if status == "failed":
            query = query.filter(
                cast(ColumnElement[int], JobHealth.consecutive_failures) > 0
            )
        elif status == "running":
            query = query.filter(
                cast(ColumnElement[int], Job.job_id).in_(running_jobs_subquery(db))
            )
        elif status == "succeeded":
            cf_col = cast(ColumnElement[int], JobHealth.consecutive_failures)
            last_succ_col = cast(
                ColumnElement[Optional[datetime]], JobHealth.last_successful_run
            )
            query = query.filter(and_(cf_col == 0, last_succ_col.is_not(None)))
        elif status == "overdue":
            query = query.filter(
                cast(ColumnElement[Optional[bool]], JobHealth.is_overdue).is_(True)
            )

    if job_type:
        query = query.filter(
            cast(ColumnElement[Optional[str]], Job.job_type) == job_type
        )

    if schedule:
        query = query.filter(
            cast(ColumnElement[Optional[str]], Job.schedule) == schedule
        )

    if search:
        query = query.filter(
            cast(ColumnElement[Optional[str]], Job.job_name).ilike(f"%{search}%")
        )

    created_after = dates.get("created_after")
    created_before = dates.get("created_before")
    modified_after = dates.get("modified_after")
    modified_before = dates.get("modified_before")

    if created_after:
        try:
            created_after_date = datetime.strptime(created_after, "%Y-%m-%d")
            query = query.filter(
                cast(ColumnElement[datetime], Job.created_time) >= created_after_date
            )
        except ValueError:
            pass

    if created_before:
        try:
            created_before_date = datetime.strptime(
                created_before, "%Y-%m-%d"
            ) + timedelta(days=1)
            query = query.filter(
                cast(ColumnElement[datetime], Job.created_time) < created_before_date
            )
        except ValueError:
            pass

    if modified_after:
        try:
            modified_after_date = datetime.strptime(modified_after, "%Y-%m-%d")
            query = query.filter(
                cast(ColumnElement[datetime], Job.modified_time) >= modified_after_date
            )
        except ValueError:
            pass

    if modified_before:
        try:
            modified_before_date = datetime.strptime(
                modified_before, "%Y-%m-%d"
            ) + timedelta(days=1)
            query = query.filter(
                cast(ColumnElement[datetime], Job.modified_time) < modified_before_date
            )
        except ValueError:
            pass

    # Filter by tags (JSON containment check for PostgreSQL)
    if tags:
        # tags parameter format: "key1:value1,key2:value2"
        # We'll check if the job's tags JSON contains these key-value pairs
        try:
            import json
            from sqlalchemy import text

            tag_filters = []
            for tag_pair in tags.split(","):
                if ":" in tag_pair:
                    key, value = tag_pair.split(":", 1)
                    # Use PostgreSQL's @> containment operator
                    tag_json = json.dumps({key.strip(): value.strip()})
                    tag_filters.append(
                        cast(ColumnElement, Job.tags).op("@>")(
                            text(f"'{tag_json}'::jsonb")
                        )
                    )
            if tag_filters:
                query = query.filter(and_(*tag_filters))
        except Exception:
            pass  # Ignore invalid tag filter format

    # Filter by timeout range
    if timeout_min is not None:
        query = query.filter(
            cast(ColumnElement[Optional[int]], Job.timeout_seconds) >= timeout_min
        )

    if timeout_max is not None:
        query = query.filter(
            cast(ColumnElement[Optional[int]], Job.timeout_seconds) <= timeout_max
        )

    return query


def apply_job_sort(query, sort_by: str, sort_order: str):
    sort_column: Optional[ColumnElement] = None
    if sort_by == "job_name":
        sort_column = cast(ColumnElement, Job.job_name)
    elif sort_by == "modified_time":
        sort_column = cast(ColumnElement, Job.modified_time)
    elif sort_by == "created_time":
        sort_column = cast(ColumnElement, Job.created_time)
    elif sort_by == "health_score":
        sort_column = cast(ColumnElement, JobHealth.health_score)
    else:
        sort_column = cast(ColumnElement, Job.modified_time)

    if sort_order.lower() == "asc":
        return query.order_by(
            (sort_column or cast(ColumnElement, Job.modified_time)).asc()
        )
    return query.order_by(
        (sort_column or cast(ColumnElement, Job.modified_time)).desc()
    )


def job_to_with_health(job: Job) -> JobWithHealth:
    data = {
        "job_id": job.job_id,
        "job_name": job.job_name,
        "creator_user_name": job.creator_user_name,
        "run_as_user_name": job.run_as_user_name,
        "job_type": job.job_type,
        "schedule": job.schedule,
        "settings": job.settings,
        "created_time": job.created_time,
        "modified_time": job.modified_time,
        "is_active": job.is_active,
        # Additional fields from Databricks SDK
        "tags": job.tags,
        "timeout_seconds": job.timeout_seconds,
        "max_concurrent_runs": job.max_concurrent_runs,
        "email_notifications": job.email_notifications,
        "webhook_notifications": job.webhook_notifications,
        "git_source": job.git_source,
        "deployment_config": job.deployment_config,
        "edit_mode": job.edit_mode,
        "budget_policy_id": job.budget_policy_id,
        "usage_policy_id": job.usage_policy_id,
        "health": (
            {
                "job_id": job.job_id,
                "health_score": job.health.health_score if job.health else None,
                "is_overdue": job.health.is_overdue if job.health else False,
                "consecutive_failures": job.health.consecutive_failures
                if job.health
                else 0,
                "last_successful_run": job.health.last_successful_run
                if job.health
                else None,
                "last_failed_run": job.health.last_failed_run if job.health else None,
            }
            if getattr(job, "health", None)
            else None
        ),
    }
    return JobWithHealth.model_validate(data)


def compute_dashboard_stats(db: Session) -> DashboardStats:
    stats_query = db.query(Job).outerjoin(JobHealth)
    running_subq = running_jobs_subquery(db)
    return DashboardStats(
        total_jobs=stats_query.count(),
        failed_jobs=stats_query.filter(
            cast(ColumnElement[int], JobHealth.consecutive_failures) > 0
        ).count(),
        running_jobs=stats_query.filter(
            cast(ColumnElement[int], Job.job_id).in_(running_subq)
        ).count(),
        succeeded_jobs=stats_query.filter(
            and_(
                cast(ColumnElement[int], JobHealth.consecutive_failures) == 0,
                cast(
                    ColumnElement[Optional[datetime]], JobHealth.last_successful_run
                ).is_not(None),
            )
        ).count(),
        overdue_jobs=stats_query.filter(
            cast(ColumnElement[Optional[bool]], JobHealth.is_overdue).is_(True)
        ).count(),
        jobs_needing_attention=stats_query.filter(
            cast(ColumnElement[int], JobHealth.consecutive_failures) > 2
        ).count()
        + stats_query.filter(
            cast(ColumnElement[Optional[bool]], JobHealth.is_overdue).is_(True)
        ).count(),
    )


def apply_run_filters(
    query,
    *,
    status: str,
    state: str,
    result_state: str,
    search: Optional[str],
    started_after: Optional[str],
    started_before: Optional[str],
):
    if status != "all":
        if status == "failed":
            query = query.filter(
                cast(ColumnElement[Optional[str]], JobRun.result_state).in_(
                    ["FAILED", "CANCELLED", "TIMEOUT"]
                )
            )
        elif status == "running":
            query = query.filter(
                cast(ColumnElement[Optional[str]], JobRun.life_cycle_state).in_(
                    ["RUNNING", "QUEUED", "PENDING"]
                )
            )
        elif status == "succeeded":
            query = query.filter(
                cast(ColumnElement[Optional[str]], JobRun.result_state) == "SUCCESS"
            )

    if state != "all":
        query = query.filter(
            cast(ColumnElement[Optional[str]], JobRun.life_cycle_state) == state
        )

    if result_state != "all":
        query = query.filter(
            cast(ColumnElement[Optional[str]], JobRun.result_state) == result_state
        )

    if search:
        query = query.filter(
            or_(
                cast(ColumnElement[Optional[str]], JobRun.run_name).ilike(
                    f"%{search}%"
                ),
                func.cast(cast(ColumnElement[int], JobRun.run_id), String).ilike(
                    f"%{search}%"
                ),
            )
        )

    if started_after:
        try:
            started_after_date = datetime.strptime(started_after, "%Y-%m-%d")
            query = query.filter(
                cast(ColumnElement[datetime], JobRun.start_time) >= started_after_date
            )
        except ValueError:
            pass

    if started_before:
        try:
            started_before_date = datetime.strptime(
                started_before, "%Y-%m-%d"
            ) + timedelta(days=1)
            query = query.filter(
                cast(ColumnElement[datetime], JobRun.start_time) < started_before_date
            )
        except ValueError:
            pass

    return query


def apply_run_sort(query, sort_by: str, sort_order: str):
    sort_column: Optional[ColumnElement] = None
    if sort_by == "start_time":
        sort_column = cast(ColumnElement, JobRun.start_time)
    elif sort_by == "run_id":
        sort_column = cast(ColumnElement, JobRun.run_id)
    elif sort_by == "state":
        sort_column = cast(ColumnElement, JobRun.life_cycle_state)
    elif sort_by == "result_state":
        sort_column = cast(ColumnElement, JobRun.result_state)
    else:
        sort_column = cast(ColumnElement, JobRun.start_time)

    if sort_order.lower() == "asc":
        return query.order_by(
            (sort_column or cast(ColumnElement, JobRun.start_time)).asc()
        )
    return query.order_by(
        (sort_column or cast(ColumnElement, JobRun.start_time)).desc()
    )


def run_to_response(run: JobRun) -> JobRunResponse:
    run_dict: Dict[str, Any] = {
        "run_id": run.run_id,
        "job_id": run.job_id,
        "run_name": run.run_name,
        "state": run.life_cycle_state,
        "life_cycle_state": run.life_cycle_state,
        "result_state": run.result_state,
        "start_time": run.start_time,
        "end_time": run.end_time,
        "execution_duration": getattr(run, "execution_duration", None),
        "setup_duration": getattr(run, "setup_duration", None),
        "cleanup_duration": getattr(run, "cleanup_duration", None),
        "trigger": getattr(run, "trigger", None),
        "run_page_url": getattr(run, "run_page_url", None),
        "original_attempt_run_id": getattr(run, "original_attempt_run_id", None),
        "cluster_instance": getattr(run, "cluster_instance", None),
    }
    if hasattr(run, "error_message"):
        run_dict["error_message"] = run.error_message
    return JobRunResponse.model_validate(run_dict)


def parse_create_job_payload(
    body: Dict[str, Any],
) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    name = body.get("name")
    tasks = body.get("tasks")
    if not name or not isinstance(name, str):
        raise ValueError("'name' is required and must be a string")
    if not tasks or not isinstance(tasks, list):
        raise ValueError("'tasks' list is required")

    optional_keys = [
        "description",
        "schedule",
        "continuous",
        "max_concurrent_runs",
        "timeout_seconds",
        "email_notifications",
        "webhook_notifications",
        "notification_settings",
        "git_source",
        "job_clusters",
        "environments",
        "run_as",
        "access_control_list",
        "tags",
        "parameters",
    ]
    kwargs = {k: body[k] for k in optional_keys if k in body and body[k] is not None}
    return name, tasks, kwargs
