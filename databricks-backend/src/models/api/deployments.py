"""Pydantic models for API request/response validation related to Deployments."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class DeploymentDetailResponse(BaseModel):
    """Detailed status of a single file in a deployment."""

    id: str
    file_path: str
    file_type: str
    git_status: str
    deployment_status: str
    platform_object_id: Optional[str] = None
    error_message: Optional[str] = None
    deployed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeploymentPreviewResponse(BaseModel):
    """Response for a deployment preview, showing files to be deployed."""

    deployment_id: str
    files: List[DeploymentDetailResponse]


class DeploymentCreateRequest(BaseModel):
    """Request to create a new Databricks deployment."""

    deployment_name: Optional[str] = Field(
        None, description="Optional name for the deployment"
    )
    git_branch: str = Field(..., description="The Git branch to deploy from")
    git_commit_sha: Optional[str] = Field(
        None, description="The specific Git commit SHA to deploy"
    )
    base_branch: str = Field(
        "main", description="The base branch for comparison to find changed files"
    )

    from_commit_sha: Optional[str] = Field(
        None, description="Starting commit SHA for precise change detection"
    )
    to_commit_sha: Optional[str] = Field(
        None, description="Ending commit SHA for precise change detection"
    )
    use_merge_commit_detection: bool = Field(
        False, description="Auto-detect changes from merge commit parents"
    )
    use_incremental_deployment: bool = Field(
        False, description="Deploy only changes since last successful deployment"
    )

    initiated_by: Optional[str] = Field(
        None, description="User or service that initiated the deployment"
    )
    force_deploy: bool = Field(
        False, description="If true, ignores any currently running deployments"
    )


class DeploymentResponse(BaseModel):
    """Databricks deployment response model."""

    id: str
    deployment_name: Optional[str]
    environment_id: str
    status: str
    git_branch: str
    git_commit_sha: Optional[str]
    job_run_id: Optional[int]
    initiated_by: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    details: Optional[List[DeploymentDetailResponse]] = None

    class Config:
        from_attributes = True


class DeploymentComponentStatus(BaseModel):
    """Status of a single component in a deployment."""

    component_id: str
    component_type: str
    file_path: str
    databricks_object_id: Optional[str]
    status: str
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class DeploymentStatusResponse(BaseModel):
    """Databricks deployment status with component details."""

    deployment_id: str
    overall_status: str
    progress_percentage: float
    total_components: int
    completed_components: int
    failed_components: int
    component_status: list[DeploymentComponentStatus]
    databricks_job_url: Optional[str]
    deployment_log: Optional[str]
    error_message: Optional[str]


class DeploymentListResponse(BaseModel):
    """Response for listing deployments."""

    deployments: list[DeploymentResponse]
    total_count: int
    page: int
    page_size: int
    has_next: bool
    has_previous: bool


class CancelDeploymentResponse(BaseModel):
    """Response for cancelling a deployment."""

    message: str
    deployment_id: str
