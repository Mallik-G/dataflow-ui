"""SQLModel ORM models for Jobs and Job Runs."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Index, JSON, Text, BigInteger


if TYPE_CHECKING:
    from .deployments import Deployment


class Job(SQLModel, table=True):
    """Job configurations and metadata for platform jobs (Databricks, Snowflake, etc.)."""

    __tablename__ = "jobs"

    job_id: int = Field(primary_key=True, sa_type=BigInteger)
    job_name: str
    creator_user_name: Optional[str] = Field(default=None)
    run_as_user_name: Optional[str] = Field(default=None)
    job_type: Optional[str] = Field(
        default=None
    )  # NOTEBOOK, SPARK_JAR, DLT_PIPELINE, etc.
    platform: str = Field(default="databricks")  # Fixed to Databricks
    schedule: Optional[str] = Field(
        default=None
    )  # DAILY, WEEKLY, MONTHLY, STREAMING, MANUAL
    settings: Optional[Dict[str, Any]] = Field(
        default=None, sa_type=JSON
    )  # Full job configuration
    permissions: Optional[Dict[str, Any]] = Field(
        default=None, sa_type=JSON
    )  # Access control list
    created_time: Optional[datetime] = Field(default=None)
    modified_time: Optional[datetime] = Field(default=None)
    last_fetched: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = Field(default=True)

    # Additional fields from Databricks SDK JobSettings for easier querying
    tags: Optional[Dict[str, str]] = Field(
        default=None, sa_type=JSON
    )  # Job tags for organization/filtering
    timeout_seconds: Optional[int] = Field(
        default=None
    )  # Maximum allowed execution time
    max_concurrent_runs: Optional[int] = Field(
        default=None
    )  # Maximum concurrent job runs
    email_notifications: Optional[Dict[str, Any]] = Field(
        default=None, sa_type=JSON
    )  # Email notification config
    webhook_notifications: Optional[Dict[str, Any]] = Field(
        default=None, sa_type=JSON
    )  # Webhook notification config
    git_source: Optional[Dict[str, Any]] = Field(
        default=None, sa_type=JSON
    )  # Git repository source configuration
    deployment_config: Optional[Dict[str, Any]] = Field(
        default=None, sa_type=JSON
    )  # Job deployment settings
    edit_mode: Optional[str] = Field(default=None)  # Job edit mode (UI_LOCKED, etc.)

    # Additional fields from Databricks SDK Job (top-level) for cost attribution
    budget_policy_id: Optional[str] = Field(
        default=None
    )  # Budget policy for cost tracking
    usage_policy_id: Optional[str] = Field(
        default=None
    )  # Usage policy for cost tracking

    # Nexa-specific fields
    nexa_created: bool = Field(default=False)  # Created by Nexa platform
    deployment_id: Optional[str] = Field(default=None, foreign_key="deployments.id")

    # Relationships
    runs: List["JobRun"] = Relationship(back_populates="job", cascade_delete=True)
    deployment: Optional["Deployment"] = Relationship(back_populates="jobs")
    # New: one-to-one health relationship
    health: Optional["JobHealth"] = Relationship(
        back_populates="job", cascade_delete=True
    )

    def __repr__(self):
        return f"<Job(job_id={self.job_id}, name='{self.job_name}', platform='{self.platform}')>"


class JobRun(SQLModel, table=True):
    """Job runs and execution history."""

    __tablename__ = "job_runs"

    run_id: int = Field(primary_key=True, sa_type=BigInteger)
    job_id: int = Field(foreign_key="jobs.job_id", sa_type=BigInteger)
    run_name: Optional[str] = Field(default=None)
    platform: str = Field(default="databricks")
    state: Optional[str] = Field(default=None)  # QUEUED, RUNNING, TERMINATED, etc.
    life_cycle_state: Optional[str] = Field(
        default=None
    )  # PENDING, RUNNING, TERMINATING, etc.
    result_state: Optional[str] = Field(
        default=None
    )  # SUCCESS, FAILED, TIMEDOUT, CANCELLED
    start_time: Optional[datetime] = Field(default=None)
    end_time: Optional[datetime] = Field(default=None)
    execution_duration: Optional[int] = Field(default=None)  # in seconds
    setup_duration: Optional[int] = Field(default=None)  # in seconds
    cleanup_duration: Optional[int] = Field(default=None)  # in seconds
    trigger: Optional[str] = Field(default=None)  # PERIODIC, ONE_TIME, RETRY, etc.
    run_page_url: Optional[str] = Field(default=None)
    original_attempt_run_id: Optional[int] = Field(default=None, sa_type=BigInteger)
    cluster_instance: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    error_message: Optional[str] = Field(default=None, sa_type=Text)  # For failed runs
    created_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_fetched: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    job: Optional["Job"] = Relationship(back_populates="runs")

    def __repr__(self):
        return f"<JobRun(run_id={self.run_id}, job_id={self.job_id}, state='{self.state}')>"

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


class JobHealth(SQLModel, table=True):
    """Aggregate health and monitoring metrics for a job."""

    __tablename__ = "job_health"

    job_id: int = Field(primary_key=True, foreign_key="jobs.job_id", sa_type=BigInteger)
    health_score: Optional[float] = Field(default=None)
    is_overdue: bool = Field(default=False)
    consecutive_failures: int = Field(default=0)
    avg_runtime_seconds: Optional[float] = Field(default=None)
    runtime_trend: Optional[str] = Field(default=None)  # IMPROVING, STABLE, DEGRADING
    last_successful_run: Optional[datetime] = Field(default=None)
    last_failed_run: Optional[datetime] = Field(default=None)
    last_overdue_check: Optional[datetime] = Field(default=None)

    # Relationship
    job: Optional["Job"] = Relationship(back_populates="health")

    def __repr__(self):
        return f"<JobHealth(job_id={self.job_id}, score={self.health_score}, overdue={self.is_overdue})>"


# Indexes for performance optimization
Index("idx_job_runs_run_id", JobRun.run_id)

Index("idx_jobs_platform_active", Job.platform, Job.is_active)
Index("idx_jobs_last_fetched", Job.last_fetched)
Index("idx_jobs_timeout", Job.timeout_seconds)  # For filtering by timeout
Index("idx_job_runs_job_id_start_time", JobRun.job_id, JobRun.start_time)
Index("idx_job_runs_platform_state", JobRun.platform, JobRun.state)
