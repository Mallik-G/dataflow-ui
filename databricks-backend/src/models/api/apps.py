"""Pydantic models for Databricks Apps API - Spec Compliant Implementation.

This module provides request/response models that match the exact Databricks Apps API
specifications found in api_docs/ OpenAPI definitions.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

# =============================================================================
# DATABRICKS APP ENUMS
# =============================================================================


class ApplicationState(str, Enum):
    """Application state enum from Databricks SDK."""

    CRASHED = "CRASHED"
    DEPLOYING = "DEPLOYING"
    RUNNING = "RUNNING"
    UNAVAILABLE = "UNAVAILABLE"


class ComputeState(str, Enum):
    """Compute state enum from Databricks."""

    ACTIVE = "ACTIVE"
    DELETING = "DELETING"
    ERROR = "ERROR"
    STARTING = "STARTING"
    STOPPED = "STOPPED"
    STOPPING = "STOPPING"
    UPDATING = "UPDATING"


class DeploymentMode(str, Enum):
    """Deployment mode enum from Databricks."""

    AUTO_SYNC = "AUTO_SYNC"
    SNAPSHOT = "SNAPSHOT"


class DeploymentState(str, Enum):
    """Deployment state enum from Databricks."""

    IN_PROGRESS = "IN_PROGRESS"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


# =============================================================================
# DATABRICKS APP CORE MODELS
# =============================================================================


class AppDeploymentArtifacts(BaseModel):
    """Deployment artifacts information."""

    source_code_path: Optional[str] = Field(None, description="Path to source code")


class ApplicationStatus(BaseModel):
    """Application status information."""

    state: ApplicationState = Field(..., description="Current application state")
    message: Optional[str] = Field(None, description="Status message")


class ComputeStatus(BaseModel):
    """Compute status information."""

    state: ComputeState = Field(..., description="Current compute state")
    message: Optional[str] = Field(None, description="Status message")


class AppDeploymentStatus(BaseModel):
    """Deployment status information."""

    state: DeploymentState = Field(..., description="Deployment state")
    message: Optional[str] = Field(None, description="Status message")


class AppDeployment(BaseModel):
    """App deployment model matching Databricks specification."""

    # Core identifiers
    deployment_id: Optional[str] = Field(None, description="Unique deployment ID")

    # Source and configuration
    deployment_artifacts: Optional[AppDeploymentArtifacts] = Field(
        None, description="Deployment artifacts"
    )
    mode: Optional[DeploymentMode] = Field(
        DeploymentMode.SNAPSHOT, description="Deployment mode"
    )
    source_code_path: Optional[str] = Field(None, description="Source code path")

    # Status and lifecycle (OUTPUT_ONLY fields)
    create_time: Optional[datetime] = Field(None, description="Creation timestamp")
    creator: Optional[str] = Field(None, description="Creator email")
    deployment_status: Optional[AppDeploymentStatus] = Field(
        None, description="Deployment status"
    )

    class Config:
        from_attributes = True


class App(BaseModel):
    """App model matching Databricks specification exactly."""

    # Required fields
    name: str = Field(..., description="App name")

    # Configuration
    description: Optional[str] = Field(None, description="App description")

    # Computed/output-only fields
    active_deployment: Optional[AppDeployment] = Field(
        None, description="Currently active deployment"
    )
    app_status: Optional[ApplicationStatus] = Field(
        None, description="Application status"
    )
    compute_status: Optional[ComputeStatus] = Field(None, description="Compute status")
    create_time: Optional[datetime] = Field(None, description="Creation timestamp")
    creator: Optional[str] = Field(None, description="Creator email")
    service_principal_name: Optional[str] = Field(
        None, description="Service principal name"
    )
    updater: Optional[str] = Field(None, description="Last updater email")
    update_time: Optional[datetime] = Field(None, description="Last update timestamp")
    url: Optional[str] = Field(None, description="App URL")

    class Config:
        from_attributes = True


# =============================================================================
# REQUEST MODELS
# =============================================================================


class CreateAppRequest(BaseModel):
    """Request model for creating an app."""

    name: str = Field(..., description="App name")
    description: Optional[str] = Field(None, description="App description")

    # Optional configuration
    source_code_path: Optional[str] = Field(None, description="Source code path")


class UpdateAppRequest(BaseModel):
    """Request model for updating an app."""

    description: Optional[str] = Field(None, description="Updated description")
    source_code_path: Optional[str] = Field(
        None, description="Updated source code path"
    )


class CreateAppDeploymentRequest(BaseModel):
    """Request model for creating an app deployment."""

    # Source configuration
    source_code_path: Optional[str] = Field(None, description="Source code path")
    mode: Optional[DeploymentMode] = Field(
        DeploymentMode.SNAPSHOT, description="Deployment mode"
    )


class StartAppRequest(BaseModel):
    """Request model for starting an app (empty body per spec)."""

    pass


class StopAppRequest(BaseModel):
    """Request model for stopping an app (empty body per spec)."""

    pass


# =============================================================================
# RESPONSE MODELS
# =============================================================================


class ListAppsResponse(BaseModel):
    """Response model for listing apps."""

    apps: list[App] = Field(default_factory=list, description="List of apps")
    next_page_token: Optional[str] = Field(None, description="Next page token")


class ListAppDeploymentsResponse(BaseModel):
    """Response model for listing app deployments."""

    app_deployments: list[AppDeployment] = Field(
        default_factory=list, description="List of app deployments"
    )
    next_page_token: Optional[str] = Field(None, description="Next page token")


# =============================================================================
# PERMISSIONS MODELS
# =============================================================================


class AppPermissionLevel(str, Enum):
    """App permission levels enum from Databricks."""

    CAN_READ = "CAN_READ"
    CAN_RUN = "CAN_RUN"
    CAN_MANAGE = "CAN_MANAGE"


class AppAccessControlRequest(BaseModel):
    """Request model for app access control entry."""

    user_name: Optional[str] = Field(
        None, description="User name to grant permissions to"
    )
    group_name: Optional[str] = Field(
        None, description="Group name to grant permissions to"
    )
    service_principal_name: Optional[str] = Field(
        None, description="Service principal name"
    )
    permission_level: AppPermissionLevel = Field(
        ..., description="Permission level to grant"
    )


class AppAccessControl(BaseModel):
    """Response model for app access control entry."""

    user_name: Optional[str] = Field(None, description="User name")
    group_name: Optional[str] = Field(None, description="Group name")
    service_principal_name: Optional[str] = Field(
        None, description="Service principal name"
    )
    display_name: Optional[str] = Field(
        None, description="Display name of the principal"
    )
    all_permissions: list[dict[str, Any]] = Field(
        default_factory=list, description="All permissions for this principal"
    )


class AppPermissions(BaseModel):
    """App permissions response model."""

    access_control_list: list[AppAccessControl] = Field(
        default_factory=list, description="List of access control entries"
    )
    object_id: Optional[str] = Field(None, description="App object ID")
    object_type: Optional[str] = Field(
        None, description="Object type (should be 'app')"
    )


class AppPermissionsRequest(BaseModel):
    """App permissions request model."""

    access_control_list: list[AppAccessControlRequest] = Field(
        ..., description="List of access control entries to set/update"
    )


class PermissionLevel(BaseModel):
    """Permission level information."""

    permission_level: str = Field(..., description="Permission level name")
    description: Optional[str] = Field(None, description="Permission level description")


class GetAppPermissionLevelsResponse(BaseModel):
    """Response model for available app permission levels."""

    permission_levels: list[PermissionLevel] = Field(
        default_factory=list, description="Available permission levels"
    )


# =============================================================================
# ERROR MODELS
# =============================================================================


class DatabricksError(BaseModel):
    """Standard Databricks error response."""

    error_code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[list[dict[str, Any]]] = Field(
        None, description="Additional error details"
    )
