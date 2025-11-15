"""Pydantic models for API request/response validation related to Jobs."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# Health and Monitoring Models
class JobHealth(BaseModel):
    """Job health status."""

    job_id: int
    health_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    is_overdue: bool = False
    consecutive_failures: int = 0
    avg_runtime_seconds: Optional[float] = None
    runtime_trend: Optional[Literal["IMPROVING", "STABLE", "DEGRADING"]] = None
    overdue_threshold_minutes: Optional[int] = None
    last_successful_run: Optional[datetime] = None
    last_failed_run: Optional[datetime] = None

    class Config:
        from_attributes = True

    @property
    def is_healthy(self) -> bool:
        """Check if job is healthy."""
        return (self.health_score or 0) > 0.7 and not self.is_overdue

    @property
    def needs_attention(self) -> bool:
        """Check if job needs immediate attention."""
        return self.consecutive_failures > 2 or self.is_overdue


# Job Models
class JobBase(BaseModel):
    """Base job information."""

    job_name: str = Field(..., description="Name of the job")
    job_type: Optional[str] = Field(
        None, description="Type of job (NOTEBOOK, SPARK_JAR, etc.)"
    )
    schedule: Optional[str] = Field(
        None, description="Schedule type (DAILY, WEEKLY, MONTHLY, STREAMING, MANUAL)"
    )


class JobCreate(JobBase):
    """Request model for creating a new job."""

    settings: dict[str, Any] = Field(..., description="Job configuration settings")


class JobUpdate(BaseModel):
    """Request model for updating job settings."""

    job_name: Optional[str] = None
    settings: Optional[dict[str, Any]] = None


class JobResponse(JobBase):
    """Response model for job information."""

    job_id: int
    creator_user_name: Optional[str] = None
    run_as_user_name: Optional[str] = None
    schedule_interval: Optional[int] = None
    settings: Optional[dict[str, Any]] = None
    permissions: Optional[dict[str, Any]] = None
    created_time: Optional[datetime] = None
    modified_time: Optional[datetime] = None
    last_fetched: Optional[datetime] = None
    is_active: bool = True

    # Additional fields from Databricks SDK
    tags: Optional[dict[str, str]] = None
    timeout_seconds: Optional[int] = None
    max_concurrent_runs: Optional[int] = None
    email_notifications: Optional[dict[str, Any]] = None
    webhook_notifications: Optional[dict[str, Any]] = None
    git_source: Optional[dict[str, Any]] = None
    deployment_config: Optional[dict[str, Any]] = None
    edit_mode: Optional[str] = None
    budget_policy_id: Optional[str] = None
    usage_policy_id: Optional[str] = None

    class Config:
        from_attributes = True


class JobWithHealth(JobResponse):
    """Job response with health information."""

    health: Optional[JobHealth] = None


class DashboardStats(BaseModel):
    """Statistics for the jobs dashboard."""

    total_jobs: int
    failed_jobs: int
    running_jobs: int
    succeeded_jobs: int
    overdue_jobs: int
    jobs_needing_attention: int


class JobsListResponse(BaseModel):
    """Response model for a list of jobs."""

    jobs: list["JobWithHealth"]
    stats: "DashboardStats"
    total_count: int
    has_more: bool


class JobRunRequest(BaseModel):
    """Request model for triggering job runs."""

    job_id: int
    notebook_params: Optional[dict[str, str]] = None
    python_params: Optional[list[str]] = None
    spark_submit_params: Optional[list[str]] = None
    jar_params: Optional[list[str]] = None
    python_named_params: Optional[dict[str, str]] = None


class RunNowRequest(BaseModel):
    """Request model for one-time job runs without creating a job."""

    notebook_task: Optional[dict[str, Any]] = None
    spark_jar_task: Optional[dict[str, Any]] = None
    python_wheel_task: Optional[dict[str, Any]] = None
    spark_python_task: Optional[dict[str, Any]] = None
    spark_submit_task: Optional[dict[str, Any]] = None
    new_cluster: Optional[dict[str, Any]] = None
    existing_cluster_id: Optional[str] = None
    libraries: Optional[list[dict[str, Any]]] = None
    timeout_seconds: Optional[int] = None


# Additional request/response models for missing endpoints
class JobUpdateRequest(BaseModel):
    """Request model for updating job settings."""

    new_settings: dict[str, Any]


class JobPermissionRequest(BaseModel):
    """Request model for setting job permissions."""

    access_control_list: list[dict[str, Any]]


class RepairRunRequest(BaseModel):
    """Request model for repairing a failed job run."""

    run_id: int
    rerun_tasks: Optional[list[str]] = None
    latest_repair_id: Optional[int] = None


class RunOutputResponse(BaseModel):
    """Response model for job run output."""

    notebook_output: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    truncated: bool = False
    metadata: Optional[dict[str, Any]] = None


class RunExportResponse(BaseModel):
    """Response model for exported run results."""

    views: dict[str, str] = {}  # view_name -> content


class JobPermissionsResponse(BaseModel):
    """Response model for job permissions."""

    object_id: str
    object_type: str = "job"
    access_control_list: list[dict[str, Any]] = []


# =============================================================================
# JOB RUN MODELS (consolidated from job_runs.py)
# =============================================================================


class JobRunBase(BaseModel):
    """Base job run information."""

    run_name: Optional[str] = None
    state: Optional[str] = None
    result_state: Optional[str] = None


class JobRunTrigger(BaseModel):
    """Request model for triggering a job run (Jobs 2.2 API)."""

    job_id: int
    job_parameters: Optional[dict[str, str]] = None
    idempotency_token: Optional[str] = None

    # Legacy parameters (for older job types)
    notebook_params: Optional[dict[str, str]] = None
    python_params: Optional[list[str]] = None
    spark_submit_params: Optional[list[str]] = None
    jar_params: Optional[list[str]] = None
    python_named_params: Optional[dict[str, str]] = None


class JobRunResponse(JobRunBase):
    """Response model for job run information."""

    run_id: int
    job_id: int
    original_attempt_run_id: Optional[int] = None
    life_cycle_state: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    execution_duration: Optional[int] = None
    setup_duration: Optional[int] = None
    cleanup_duration: Optional[int] = None
    trigger: Optional[str] = None
    run_page_url: Optional[str] = None
    cluster_instance: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    created_time: Optional[datetime] = None

    class Config:
        from_attributes = True

    @property
    def is_running(self) -> bool:
        """Check if the job run is currently running."""
        return self.state in ["RUNNING", "QUEUED", "PENDING"]

    @property
    def is_failed(self) -> bool:
        """Check if the job run failed."""
        return self.result_state in ["FAILED", "TIMEDOUT", "CANCELLED"]

    @property
    def is_successful(self) -> bool:
        """Check if the job run was successful."""
        return self.result_state == "SUCCESS"


class RunsListResponse(BaseModel):
    """Response model for a list of job runs."""

    runs: list[JobRunResponse]
    total_count: int
    has_more: bool
