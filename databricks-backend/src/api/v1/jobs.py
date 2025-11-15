"""FastAPI router for Databricks Jobs management operations, using the Databricks SDK.

This router is aligned with Databricks Jobs 2.1/2.2 API via the official SDK. It avoids
mixing local DB state with Databricks state and supports permissions and export APIs.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Annotated, Dict, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy import desc

from ...core.database import get_db
from ...core.config import settings
from ...models.api.jobs import (
    JobPermissionRequest,
    JobPermissionsResponse,
    JobResponse,
    JobRunResponse,
    JobsListResponse,
    JobUpdateRequest,
    RunExportResponse,
    RunNowRequest,
    RunOutputResponse,
    RunsListResponse,
    JobWithHealth,
)
from ...models.db import Job, JobHealth, JobRun
from ...models.db.deployments import Environment
from ...services.databricks.base_client import DatabricksAPIError
from ...services.databricks.databricks_jobs_api import DatabricksJobsAPI
from .jobs_utils import (
    apply_job_filters,
    apply_job_sort,
    apply_run_filters,
    apply_run_sort,
    compute_dashboard_stats,
    job_to_with_health,
    parse_create_job_payload,
    run_to_response,
)

router = APIRouter(prefix="/jobs", tags=["Job Orchestration & Scheduling"])
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Dependency: Get Databricks Jobs client from environment configuration
# -----------------------------------------------------------------------------


def get_databricks_jobs_client(
    db: Annotated[Session, Depends(get_db)],
) -> DatabricksJobsAPI:
    """Dependency to get a configured Databricks Jobs API client."""
    environment = db.query(Environment).first()
    if not environment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Environment configuration not found. Please configure the application environment.",
        )

    host = environment.databricks_host
    if not host:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )

    return DatabricksJobsAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


def handle_databricks_error(e: Exception, operation: str):
    """Map Databricks SDK errors to HTTP exceptions with consistent messages.
    Simplified to keep function complexity low while preserving status codes.
    """
    msg = str(e)
    if isinstance(e, DatabricksAPIError):
        status_code = e.status_code or http_status.HTTP_500_INTERNAL_SERVER_ERROR
        raise HTTPException(
            status_code=status_code, detail={"message": f"{operation}: {msg}"}
        ) from e
    raise HTTPException(
        status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"error_code": "INTERNAL_ERROR", "message": f"{operation}: {msg}"},
    ) from e


# -----------------------------------------------------------------------------
# Core Jobs Endpoints
# -----------------------------------------------------------------------------


@router.get("/", response_model=JobsListResponse, summary="List and filter jobs")
async def list_jobs(
    status: str = Query(
        "all",
        description="Filter by job status: all, failed, running, succeeded, overdue",
    ),
    job_type: Optional[str] = Query(None, description="Filter by job type"),
    schedule: Optional[str] = Query(None, description="Filter by schedule type"),
    search: Optional[str] = Query(None, description="Search in job names"),
    created_after: Optional[str] = Query(
        None, description="Filter jobs created after this date (YYYY-MM-DD)"
    ),
    created_before: Optional[str] = Query(
        None, description="Filter jobs created before this date (YYYY-MM-DD)"
    ),
    modified_after: Optional[str] = Query(
        None, description="Filter jobs modified after this date (YYYY-MM-DD)"
    ),
    modified_before: Optional[str] = Query(
        None, description="Filter jobs modified before this date (YYYY-MM-DD)"
    ),
    tags: Optional[str] = Query(
        None, description="Filter by tags (format: key1:value1,key2:value2)"
    ),
    timeout_min: Optional[int] = Query(
        None, ge=0, description="Minimum timeout in seconds"
    ),
    timeout_max: Optional[int] = Query(
        None, ge=0, description="Maximum timeout in seconds"
    ),
    sort_by: str = Query(
        "modified_time",
        description="Sort by: job_name, modified_time, created_time, health_score",
    ),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    limit: int = Query(25, ge=1, le=100, description="Number of jobs to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
):
    """List jobs with filtering and pagination from database."""
    try:
        query = db.query(Job).outerjoin(JobHealth)
        query = apply_job_filters(
            db,
            query,
            status=status,
            job_type=job_type,
            schedule=schedule,
            search=search,
            dates={
                "created_after": created_after,
                "created_before": created_before,
                "modified_after": modified_after,
                "modified_before": modified_before,
            },
            tags=tags,
            timeout_min=timeout_min,
            timeout_max=timeout_max,
        )
        total_count = query.count()
        query = apply_job_sort(query, sort_by, sort_order)
        jobs = query.offset(offset).limit(limit).all()
        jobs_with_health = [job_to_with_health(j) for j in jobs]
        stats = compute_dashboard_stats(db)
        return JobsListResponse(
            jobs=jobs_with_health,
            stats=stats,
            total_count=total_count,
            has_more=offset + limit < total_count,
        )
    except Exception as e:
        logger.error(f"Failed to list jobs: {e!s}")
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {str(e)}")


@router.post(
    "/",
    response_model=JobResponse,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create a job",
)
async def create_job(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    payload: Dict,
):
    try:
        name, tasks, kwargs = parse_create_job_payload(payload or {})
        created = await databricks.create_job(name=name, tasks=tasks, **kwargs)
        created_id = created.get("job_id")
        if not created_id:
            raise HTTPException(
                status_code=500, detail="create job: missing job_id in response"
            )
        job = await databricks.get_job(job_id=int(created_id))
        settings_dict = job.get("settings", {}) or {}
        return JobResponse.model_validate(
            {
                "job_id": job.get("job_id"),
                "job_name": settings_dict.get("name"),
                "job_type": None,
                "schedule": None,
                "creator_user_name": job.get("creator_user_name"),
                "run_as_user_name": job.get("run_as_user_name"),
                "settings": job,
                "created_time": job.get("created_time"),
                "modified_time": job.get("modified_time"),
                "is_active": True,
            }
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(ve)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create job: {e!s}")
        handle_databricks_error(e, "create job")


@router.get("/{job_id}", response_model=JobWithHealth, summary="Get job details")
async def get_job(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Get detailed information about a specific job from database."""
    try:
        job = (
            db.query(Job)
            .outerjoin(JobHealth)
            .filter(cast(ColumnElement[int], Job.job_id) == job_id)
            .first()
        )
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return job_to_with_health(job)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job {job_id}: {e!s}")
        raise HTTPException(status_code=500, detail=f"Failed to get job: {str(e)}")


@router.patch("/{job_id}", response_model=JobResponse, summary="Update a job")
async def update_job(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
    request: JobUpdateRequest,
):
    try:
        await databricks.update_job(job_id=job_id, new_settings=request.new_settings)
        job = await databricks.get_job(job_id)
        settings_dict = job.get("settings", {}) or {}
        return JobResponse.model_validate(
            {
                "job_id": job.get("job_id"),
                "job_name": settings_dict.get("name"),
                "job_type": None,
                "schedule": None,
                "creator_user_name": job.get("creator_user_name"),
                "run_as_user_name": job.get("run_as_user_name"),
                "settings": job,
                "created_time": job.get("created_time"),
                "modified_time": job.get("modified_time"),
                "is_active": True,
            }
        )
    except Exception as e:
        logger.error(f"Failed to update job {job_id}: {e!s}")
        handle_databricks_error(e, f"update job {job_id}")


@router.delete(
    "/{job_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="Delete a job"
)
async def delete_job(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
):
    try:
        await databricks.delete_job(job_id)
    except Exception as e:
        logger.error(f"Failed to delete job {job_id}: {e!s}")
        handle_databricks_error(e, f"delete job {job_id}")


# -----------------------------------------------------------------------------
# Job Run Operations
# -----------------------------------------------------------------------------


@router.get(
    "/{job_id}/runs", response_model=RunsListResponse, summary="Get job run history"
)
async def get_job_runs(
    job_id: int,
    status: str = Query(
        "all", description="Filter by run status: all, failed, running, succeeded"
    ),
    state: str = Query(
        "all",
        description="Filter by run state: all, RUNNING, TERMINATED, PENDING, etc.",
    ),
    result_state: str = Query(
        "all",
        description="Filter by result state: all, SUCCESS, FAILED, CANCELED, TIMEDOUT",
    ),
    search: Optional[str] = Query(None, description="Search in run names and run IDs"),
    started_after: Optional[str] = Query(
        None, description="Filter runs started after this date (YYYY-MM-DD)"
    ),
    started_before: Optional[str] = Query(
        None, description="Filter runs started before this date (YYYY-MM-DD)"
    ),
    sort_by: str = Query(
        "start_time", description="Sort by: start_time, run_id, state, result_state"
    ),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    limit: int = Query(25, ge=1, le=100, description="Number of runs to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: Session = Depends(get_db),
):
    """Get runs for a specific job from database."""
    try:
        job = (
            db.query(Job).filter(cast(ColumnElement[int], Job.job_id) == job_id).first()
        )
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        query = db.query(JobRun).filter(
            cast(ColumnElement[int], JobRun.job_id) == job_id
        )
        query = apply_run_filters(
            query,
            status=status,
            state=state,
            result_state=result_state,
            search=search,
            started_after=started_after,
            started_before=started_before,
        )
        total_count = query.count()
        query = apply_run_sort(query, sort_by, sort_order)
        runs = query.offset(offset).limit(limit).all()

        run_responses = [
            JobRunResponse.model_validate(
                {
                    "run_id": r.run_id,
                    "job_id": r.job_id,
                    "run_name": r.run_name,
                    "state": r.life_cycle_state,
                    "life_cycle_state": r.life_cycle_state,
                    "result_state": r.result_state,
                    "start_time": r.start_time,
                    "end_time": r.end_time,
                    **(
                        {"error_message": r.error_message}
                        if hasattr(r, "error_message")
                        else {}
                    ),
                }
            )
            for r in runs
        ]

        return RunsListResponse(
            runs=run_responses,
            total_count=total_count,
            has_more=offset + limit < total_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get runs for job {job_id}: {e!s}")
        raise HTTPException(status_code=500, detail=f"Failed to get job runs: {str(e)}")


# Keep backward compatible trigger endpoint and add a canonical run-now route
@router.post(
    "/{job_id}/trigger", response_model=JobRunResponse, summary="Trigger a job run"
)
@router.post("/{job_id}/run-now", response_model=JobRunResponse, summary="Run job now")
async def trigger_job_run(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
):
    try:
        resp = await databricks.run_now(job_id=job_id)
        run_id_val = resp.get("run_id")
        if run_id_val is None:
            raise HTTPException(
                status_code=500, detail="run-now: missing run_id in response"
            )
        run_details = await databricks.get_run(run_id=int(run_id_val))
        details_dict = run_details.as_dict()
        state_obj = details_dict.get("state", {})
        details_dict["state"] = state_obj.get("life_cycle_state")
        details_dict["result_state"] = state_obj.get("result_state")
        return JobRunResponse.model_validate(details_dict)
    except Exception as e:
        logger.error(f"Failed to trigger run for job {job_id}: {e!s}")
        handle_databricks_error(e, f"run-now job {job_id}")


@router.post(
    "/runs/submit",
    response_model=JobRunResponse,
    status_code=http_status.HTTP_202_ACCEPTED,
    summary="Submit a one-time run",
)
async def submit_run(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    request: RunNowRequest,
):
    try:
        # Pass through allowed fields directly to SDK submit
        payload = request.model_dump(exclude_none=True)
        resp = await databricks.submit_run(**payload)
        run_id_val = resp.get("run_id")
        if run_id_val is None:
            raise HTTPException(
                status_code=500, detail="submit run: missing run_id in response"
            )
        run_details = await databricks.get_run(run_id=int(run_id_val))
        details_dict = run_details.as_dict()
        state_obj = details_dict.get("state", {})
        details_dict["state"] = state_obj.get("life_cycle_state")
        details_dict["result_state"] = state_obj.get("result_state")
        return JobRunResponse.model_validate(details_dict)
    except Exception as e:
        logger.error(f"Failed to submit run: {e!s}")
        handle_databricks_error(e, "submit run")


@router.get("/runs/{run_id}", response_model=JobRunResponse, summary="Get run details")
async def get_run(
    run_id: int,
    db: Session = Depends(get_db),
):
    try:
        run = (
            db.query(JobRun)
            .filter(cast(ColumnElement[int], JobRun.run_id) == run_id)
            .first()
        )
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        return run_to_response(run)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get run {run_id}: {e!s}")
        raise HTTPException(status_code=500, detail=f"Failed to get run: {str(e)}")


@router.post(
    "/runs/{run_id}/cancel",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Cancel a job run",
)
async def cancel_job_run(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    run_id: int,
):
    try:
        await databricks.cancel_run(run_id)
    except Exception as e:
        logger.error(f"Failed to cancel run {run_id}: {e!s}")
        handle_databricks_error(e, f"cancel run {run_id}")


@router.get(
    "/runs/{run_id}/output",
    response_model=RunOutputResponse,
    summary="Get job run output",
)
async def get_run_output(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    run_id: int,
):
    try:
        output = await databricks.get_run_output(run_id)
        return RunOutputResponse.model_validate(output)
    except Exception as e:
        logger.error(f"Failed to get run output {run_id}: {e!s}")
        handle_databricks_error(e, f"get run output {run_id}")


@router.get(
    "/runs/{run_id}/export",
    response_model=RunExportResponse,
    summary="Export and retrieve run views",
)
async def export_run(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    run_id: int,
    views_to_export: str = Query("CODE", description="CODE | DASHBOARDS | ALL"),
):
    try:
        export = await databricks.export_run(
            run_id=run_id, views_to_export=views_to_export
        )
        return RunExportResponse.model_validate(export)
    except Exception as e:
        logger.error(f"Failed to export run {run_id}: {e!s}")
        handle_databricks_error(e, f"export run {run_id}")


# -----------------------------------------------------------------------------
# Permission Management
# -----------------------------------------------------------------------------


@router.get(
    "/{job_id}/permissions",
    response_model=JobPermissionsResponse,
    summary="Get job permissions",
)
async def get_job_permissions(
    job_id: int,
    db: Session = Depends(get_db),
):
    try:
        job = (
            db.query(Job).filter(cast(ColumnElement[int], Job.job_id) == job_id).first()
        )
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        perms_raw = job.permissions
        if isinstance(perms_raw, list):
            perms = {
                "object_id": str(job_id),
                "object_type": "job",
                "access_control_list": perms_raw,
            }
        elif isinstance(perms_raw, dict):
            perms = {
                "object_id": str(job_id),
                "object_type": "job",
                "access_control_list": perms_raw.get("access_control_list", []),
            }
        else:
            perms = {
                "object_id": str(job_id),
                "object_type": "job",
                "access_control_list": [],
            }
        return JobPermissionsResponse.model_validate(perms)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get permissions for job {job_id}: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get job permissions: {str(e)}"
        )


@router.patch(
    "/{job_id}/permissions",
    response_model=JobPermissionsResponse,
    summary="Update job permissions",
)
async def update_job_permissions(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
    request: JobPermissionRequest,
):
    try:
        perms = await databricks.update_permissions(
            job_id=str(job_id), access_control_list=request.access_control_list
        )
        return JobPermissionsResponse.model_validate(perms)
    except Exception as e:
        logger.error(f"Failed to update permissions for job {job_id}: {e!s}")
        handle_databricks_error(e, f"update permissions for job {job_id}")


@router.put(
    "/{job_id}/permissions",
    response_model=JobPermissionsResponse,
    summary="Set job permissions (replace)",
)
async def set_job_permissions(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
    request: JobPermissionRequest,
):
    try:
        perms = await databricks.set_permissions(
            job_id=str(job_id), access_control_list=request.access_control_list
        )
        return JobPermissionsResponse.model_validate(perms)
    except Exception as e:
        logger.error(f"Failed to set permissions for job {job_id}: {e!s}")
        handle_databricks_error(e, f"set permissions for job {job_id}")


@router.get(
    "/{job_id}/permissions/levels",
    summary="Get job permission levels",
)
async def get_job_permission_levels(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
):
    try:
        levels = await databricks.get_permission_levels(job_id=str(job_id))
        return levels
    except Exception as e:
        logger.error(f"Failed to get permission levels for job {job_id}: {e!s}")
        handle_databricks_error(e, f"get permission levels for job {job_id}")


# -----------------------------------------------------------------------------
# Health and Monitoring Endpoints
# -----------------------------------------------------------------------------


@router.get("/{job_id}/health", summary="Get job health status")
async def get_job_health(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Get health status for a specific job."""
    try:
        health = (
            db.query(JobHealth)
            .filter(cast(ColumnElement[int], JobHealth.job_id) == job_id)
            .first()
        )

        if not health:
            raise HTTPException(status_code=404, detail="Job health data not found")

        return {
            "job_id": health.job_id,
            "health_score": health.health_score,
            "is_overdue": health.is_overdue,
            "consecutive_failures": health.consecutive_failures,
            "avg_runtime_seconds": getattr(health, "avg_runtime_seconds", None),
            "last_successful_run": health.last_successful_run,
            "last_failed_run": health.last_failed_run,
            "last_overdue_check": getattr(health, "last_overdue_check", None),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job health for {job_id}: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get job health: {str(e)}"
        )


# -----------------------------------------------------------------------------
# Waiter Endpoints for long-running operations
# -----------------------------------------------------------------------------


@router.post(
    "/{job_id}/run-now-and-wait",
    response_model=JobRunResponse,
    summary="Run job now and wait",
)
async def run_now_and_wait(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
    timeout_minutes: int = Query(
        20, ge=1, le=240, description="Max minutes to wait for completion"
    ),
    payload: Optional[Dict] = None,
):
    try:
        kwargs = payload or {}
        run = await databricks.run_now_and_wait(
            job_id=job_id, timeout_minutes=timeout_minutes, **kwargs
        )
        details_dict = run.as_dict()
        state_obj = details_dict.get("state", {})
        details_dict["state"] = state_obj.get("life_cycle_state")
        details_dict["result_state"] = state_obj.get("result_state")
        return JobRunResponse.model_validate(details_dict)
    except Exception as e:
        logger.error(f"Failed to run-now-and-wait for job {job_id}: {e!s}")
        handle_databricks_error(e, f"run-now-and-wait job {job_id}")


@router.post(
    "/runs/submit-and-wait",
    response_model=JobRunResponse,
    summary="Submit a one-time run and wait",
)
async def submit_and_wait(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    timeout_minutes: int = Query(
        20, ge=1, le=240, description="Max minutes to wait for completion"
    ),
    payload: Optional[Dict] = None,
):
    try:
        body = payload or {}
        tasks = body.get("tasks")
        if not tasks or not isinstance(tasks, list):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="'tasks' list is required",
            )
        run_name = body.get("run_name")
        timeout_seconds = body.get("timeout_seconds")
        run = await databricks.submit_run_and_wait(
            tasks=tasks,
            run_name=run_name,
            timeout_seconds=timeout_seconds,
            timeout_minutes=timeout_minutes,
        )
        details_dict = run.as_dict()
        state_obj = details_dict.get("state", {})
        details_dict["state"] = state_obj.get("life_cycle_state")
        details_dict["result_state"] = state_obj.get("result_state")
        return JobRunResponse.model_validate(details_dict)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit-and-wait: {e!s}")
        handle_databricks_error(e, "submit-and-wait")


@router.post(
    "/runs/{run_id}/repair-and-wait",
    response_model=JobRunResponse,
    summary="Repair a failed run and wait",
)
async def repair_and_wait(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    run_id: int,
    timeout_minutes: int = Query(
        20, ge=1, le=240, description="Max minutes to wait for completion"
    ),
    payload: Optional[Dict] = None,
):
    try:
        body = payload or {}
        rerun_tasks = body.get("rerun_tasks")
        latest_repair_id = body.get("latest_repair_id")
        # Pass remaining optional params through (**body)
        run = await databricks.repair_run_and_wait(
            run_id=run_id,
            rerun_tasks=rerun_tasks,
            latest_repair_id=latest_repair_id,
            timeout_minutes=timeout_minutes,
            **{
                k: v
                for k, v in body.items()
                if k not in {"rerun_tasks", "latest_repair_id"}
            },
        )
        details_dict = run.as_dict()
        state_obj = details_dict.get("state", {})
        details_dict["state"] = state_obj.get("life_cycle_state")
        details_dict["result_state"] = state_obj.get("result_state")
        return JobRunResponse.model_validate(details_dict)
    except Exception as e:
        logger.error(f"Failed to repair-and-wait run {run_id}: {e!s}")
        handle_databricks_error(e, f"repair-and-wait run {run_id}")


# -----------------------------------------------------------------------------
# Synchronization Endpoints
# -----------------------------------------------------------------------------


@router.post("/sync", summary="Sync jobs from Databricks")
async def sync_jobs_from_databricks(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    db: Session = Depends(get_db),
):
    """Sync jobs data from Databricks API to local database."""
    try:
        synced_count = await _sync_jobs(db, databricks, limit=25)
        return {
            "message": "Jobs synchronized successfully",
            "synced_count": synced_count,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to sync jobs: {e!s}")
        raise HTTPException(status_code=500, detail=f"Failed to sync jobs: {str(e)}")


async def _sync_jobs(db: Session, databricks: DatabricksJobsAPI, limit: int) -> int:
    synced_count = 0
    jobs_data = await databricks.list_jobs(limit=limit)
    if not jobs_data:
        return 0

    for job_data in jobs_data:
        job_id = job_data.get("job_id")
        if not job_id:
            continue

        existing_job = db.query(Job).filter(Job.job_id == job_id).first()
        settings = job_data.get("settings", {})

        if existing_job:
            existing_job.job_name = settings.get("name", existing_job.job_name)
            existing_job.job_type = settings.get("format", existing_job.job_type)
            existing_job.settings = settings
            existing_job.modified_time = datetime.now(timezone.utc)
            existing_job.last_fetched = datetime.now(timezone.utc)
            # Extract additional fields from JobSettings
            existing_job.tags = settings.get("tags")
            existing_job.timeout_seconds = settings.get("timeout_seconds")
            existing_job.max_concurrent_runs = settings.get("max_concurrent_runs")
            existing_job.email_notifications = settings.get("email_notifications")
            existing_job.webhook_notifications = settings.get("webhook_notifications")
            existing_job.git_source = settings.get("git_source")
            existing_job.deployment_config = settings.get("deployment")
            existing_job.edit_mode = settings.get("edit_mode")
            # Top-level Job fields
            existing_job.budget_policy_id = job_data.get("effective_budget_policy_id")
            existing_job.usage_policy_id = job_data.get("effective_usage_policy_id")
        else:
            try:
                json.dumps(settings)
            except (TypeError, ValueError) as e:
                logger.warning(
                    f"Settings JSON serialization failed for job {job_id}: {e}"
                )
                settings = {"name": settings.get("name", "Unknown Job")}

            new_job = Job(
                job_id=job_id,
                job_name=settings.get("name", "Unknown Job"),
                creator_user_name=job_data.get("creator_user_name", ""),
                run_as_user_name=job_data.get("run_as_user_name", ""),
                job_type=settings.get("format", "MULTI_TASK"),
                settings=settings,
                created_time=datetime.fromtimestamp(
                    job_data.get("created_time", 0) / 1000
                )
                if job_data.get("created_time")
                else datetime.now(timezone.utc),
                modified_time=datetime.now(timezone.utc),
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
                # Top-level Job fields
                budget_policy_id=job_data.get("effective_budget_policy_id"),
                usage_policy_id=job_data.get("effective_usage_policy_id"),
            )
            db.add(new_job)

        synced_count += 1

    db.commit()
    return synced_count


# -----------------------------------------------------------------------------
# Job Control Endpoints (Pause/Resume)
# -----------------------------------------------------------------------------


@router.post(
    "/{job_id}/pause",
    summary="Pause a job (disable schedule)",
    description="Pauses a job by removing its schedule, preventing it from running automatically. "
    "Manual triggers will still work.",
)
async def pause_job(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
):
    """
    Pause a job by removing its schedule.

    This prevents the job from running on its schedule but doesn't delete it.
    The job can still be triggered manually or resumed later.
    """
    try:
        # Get current job to check if it has a schedule
        job_details = await databricks.get_job(job_id)
        current_settings = job_details.get("settings", {})

        has_schedule = "schedule" in current_settings
        has_continuous = "continuous" in current_settings

        if not has_schedule and not has_continuous:
            return {
                "message": f"Job {job_id} has no schedule to pause",
                "job_id": job_id,
                "status": "already_manual",
                "note": "Job is already manual (no schedule configured).",
            }

        # Use fields_to_remove to remove schedule/continuous
        fields_to_remove = []
        if has_schedule:
            fields_to_remove.append("schedule")
        if has_continuous:
            fields_to_remove.append("continuous")

        # Update the job to remove schedule
        await databricks.update_job(
            job_id=job_id,
            new_settings=None,
            fields_to_remove=fields_to_remove,
        )

        return {
            "message": f"Job {job_id} paused successfully",
            "job_id": job_id,
            "status": "paused",
            "removed_fields": fields_to_remove,
            "note": "Schedule removed. Job can still be triggered manually.",
        }

    except Exception as e:
        logger.error(f"Failed to pause job {job_id}: {e!s}")
        handle_databricks_error(e, f"pause job {job_id}")


@router.post(
    "/{job_id}/resume",
    summary="Resume a paused job",
    description="Resumes a paused job by restoring its schedule. "
    "The schedule must be provided in the request body.",
)
async def resume_job(
    databricks: Annotated[DatabricksJobsAPI, Depends(get_databricks_jobs_client)],
    job_id: int,
    schedule_config: Dict,
):
    """
    Resume a paused job by restoring its schedule.

    The schedule_config should contain either:
    - schedule: CronSchedule configuration for periodic jobs
      Example: {"schedule": {"quartz_cron_expression": "0 0 * * * ?", "timezone_id": "UTC"}}
    - continuous: Continuous configuration for streaming jobs
      Example: {"continuous": {"pause_status": "UNPAUSED"}}
    """
    try:
        # Validate that schedule_config contains either schedule or continuous
        if "schedule" not in schedule_config and "continuous" not in schedule_config:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="schedule_config must contain either 'schedule' or 'continuous' key"
            )

        # Update the job with the new schedule
        await databricks.update_job(
            job_id=job_id,
            new_settings=schedule_config,
        )

        # Get updated job to confirm
        job_details = await databricks.get_job(job_id)
        updated_settings = job_details.get("settings", {})

        schedule_type = "unknown"
        if "schedule" in updated_settings:
            schedule_type = "cron"
        elif "continuous" in updated_settings:
            schedule_type = "continuous"

        return {
            "message": f"Job {job_id} resumed successfully",
            "job_id": job_id,
            "status": "active",
            "schedule_type": schedule_type,
            "schedule_config": schedule_config,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resume job {job_id}: {e!s}")
        handle_databricks_error(e, f"resume job {job_id}")


# -----------------------------------------------------------------------------
# Enhanced Monitoring Endpoints for Operations Team
# -----------------------------------------------------------------------------


@router.get(
    "/{job_id}/monitoring",
    summary="Get comprehensive monitoring data for a job",
    description="Returns comprehensive monitoring information for operations teams including "
    "job state, recent runs, health metrics, schedules, triggers, and URLs.",
)
async def get_job_monitoring(
    job_id: int,
    db: Session = Depends(get_db),
    include_recent_runs: int = Query(5, ge=1, le=20, description="Number of recent runs to include"),
):
    """
    Get comprehensive monitoring data for operations team.

    Includes:
    - Job configuration and state
    - Schedule and trigger information
    - Recent run history with URLs
    - Health metrics and trends
    - Error patterns
    - Performance metrics
    """
    try:
        # Get job from database
        job = (
            db.query(Job)
            .outerjoin(JobHealth)
            .filter(cast(ColumnElement[int], Job.job_id) == job_id)
            .first()
        )

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Get recent runs with full details
        recent_runs = (
            db.query(JobRun)
            .filter(cast(ColumnElement[int], JobRun.job_id) == job_id)
            .order_by(desc(JobRun.start_time))
            .limit(include_recent_runs)
            .all()
        )

        # Build run details with URLs
        run_details = []
        for run in recent_runs:
            run_dict = {
                "run_id": run.run_id,
                "run_name": run.run_name,
                "state": run.life_cycle_state,
                "result_state": run.result_state,
                "start_time": run.start_time,
                "end_time": run.end_time,
                "duration_seconds": run.execution_duration,
                "run_page_url": run.run_page_url,  # This is the job run URL
                "trigger": run.trigger,
                "error_message": run.error_message if run.is_failed else None,
            }
            run_details.append(run_dict)

        # Extract schedule and trigger information from job settings
        settings = job.settings or {}
        schedule_info = settings.get("schedule", {})
        continuous_info = settings.get("continuous", {})
        trigger_info = settings.get("trigger", {})

        # Determine schedule type and details
        if schedule_info:
            schedule_type = "SCHEDULED"
            schedule_details = {
                "type": "cron",
                "quartz_cron_expression": schedule_info.get("quartz_cron_expression"),
                "timezone_id": schedule_info.get("timezone_id"),
                "pause_status": schedule_info.get("pause_status"),
            }
        elif continuous_info:
            schedule_type = "CONTINUOUS"
            schedule_details = {
                "type": "continuous",
                "pause_status": continuous_info.get("pause_status"),
            }
        else:
            schedule_type = "MANUAL"
            schedule_details = None

        # Calculate error patterns from recent runs
        failed_runs = [r for r in recent_runs if r.is_failed]
        error_patterns = {}
        for run in failed_runs:
            if run.error_message:
                # Simple error categorization
                error_key = run.error_message[:100]  # First 100 chars as pattern
                if error_key not in error_patterns:
                    error_patterns[error_key] = {
                        "count": 0,
                        "last_occurrence": None,
                        "sample_run_id": None,
                    }
                error_patterns[error_key]["count"] += 1
                error_patterns[error_key]["last_occurrence"] = run.start_time
                error_patterns[error_key]["sample_run_id"] = run.run_id

        # Build comprehensive response
        return {
            "job_id": job.job_id,
            "job_name": job.job_name,
            "job_state": {
                "is_active": job.is_active,
                "schedule_type": schedule_type,
                "schedule_details": schedule_details,
                "last_modified": job.modified_time,
            },
            "urls": {
                "job_url": f"https://{settings.get('workspace_url', '')}/jobs/{job_id}" if settings.get('workspace_url') else None,
                "recent_run_urls": [r["run_page_url"] for r in run_details if r["run_page_url"]],
            },
            "schedule_and_triggers": {
                "schedule_type": schedule_type,
                "schedule": schedule_details,
                "max_concurrent_runs": job.max_concurrent_runs,
                "timeout_seconds": job.timeout_seconds,
                "trigger_info": trigger_info,
            },
            "health_metrics": {
                "health_score": job.health.health_score if job.health else None,
                "is_overdue": job.health.is_overdue if job.health else False,
                "consecutive_failures": job.health.consecutive_failures if job.health else 0,
                "avg_runtime_seconds": job.health.avg_runtime_seconds if job.health else None,
                "last_successful_run": job.health.last_successful_run if job.health else None,
                "last_failed_run": job.health.last_failed_run if job.health else None,
            },
            "recent_runs": run_details,
            "error_analysis": {
                "total_failed_runs": len(failed_runs),
                "failure_rate": len(failed_runs) / len(recent_runs) if recent_runs else 0,
                "error_patterns": list(error_patterns.values())[:5],  # Top 5 error patterns
            },
            "performance_metrics": {
                "avg_duration_seconds": sum(r.execution_duration or 0 for r in recent_runs) / len(recent_runs) if recent_runs else 0,
                "min_duration_seconds": min((r.execution_duration or 0 for r in recent_runs), default=0),
                "max_duration_seconds": max((r.execution_duration or 0 for r in recent_runs), default=0),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get monitoring data for job {job_id}: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get monitoring data: {str(e)}"
        )


@router.get(
    "/monitoring/summary",
    summary="Get monitoring summary for all jobs",
    description="Returns a summary of monitoring data for all jobs, useful for operations dashboards.",
)
async def get_jobs_monitoring_summary(
    db: Session = Depends(get_db),
    status_filter: Optional[str] = Query(None, description="Filter by status: failed, running, healthy, needs_attention"),
):
    """
    Get monitoring summary for all jobs.

    Useful for operations dashboards to get a quick overview of job health.
    """
    try:
        query = db.query(Job).outerjoin(JobHealth)

        # Apply filters
        if status_filter == "failed":
            query = query.join(JobRun).filter(JobRun.result_state == "FAILED")
        elif status_filter == "running":
            query = query.join(JobRun).filter(JobRun.life_cycle_state == "RUNNING")
        elif status_filter == "healthy":
            # Only include jobs with health data where score > 0.7
            query = query.join(JobHealth).filter(JobHealth.health_score > 0.7)
        elif status_filter == "needs_attention":
            query = query.filter(
                (JobHealth.consecutive_failures > 2) | (JobHealth.is_overdue)
            )

        jobs = query.all()

        summary = []
        for job in jobs:
            summary.append({
                "job_id": job.job_id,
                "job_name": job.job_name,
                "health_score": job.health.health_score if job.health else None,
                "is_overdue": job.health.is_overdue if job.health else False,
                "consecutive_failures": job.health.consecutive_failures if job.health else 0,
                "schedule": job.schedule,
                "is_active": job.is_active,
            })

        return {
            "jobs": summary,
            "total_count": len(summary),
            "filter_applied": status_filter,
        }

    except Exception as e:
        logger.error(f"Failed to get monitoring summary: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get monitoring summary: {str(e)}"
        )
