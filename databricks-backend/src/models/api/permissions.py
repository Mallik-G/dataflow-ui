"""Pydantic models for Unity Catalog Permissions API endpoints."""

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class PermissionLevel(str, Enum):
    """Unity Catalog permission levels."""

    READ = "SELECT"
    WRITE = "MODIFY"
    OWNER = "OWN"
    USE = "USE"
    CREATE = "CREATE"
    EXECUTE = "EXECUTE"


class PrincipalType(str, Enum):
    """Principal types for UC permissions."""

    USER = "user"
    GROUP = "group"
    SERVICE_PRINCIPAL = "service_principal"


# Request Models
class GrantTablePermissionRequest(BaseModel):
    """Request model for granting table permissions."""

    catalog: str = Field(description="Catalog name")
    schema_name: str = Field(alias="schema", description="Schema name")
    table: str = Field(description="Table name")
    principal: str = Field(
        description="Principal name (user, group, or service principal)"
    )
    principal_type: PrincipalType = Field(description="Type of principal")
    permission: PermissionLevel = Field(description="Permission level to grant")


class RevokeTablePermissionRequest(BaseModel):
    """Request model for revoking table permissions."""

    catalog: str = Field(description="Catalog name")
    schema_name: str = Field(alias="schema", description="Schema name")
    table: str = Field(description="Table name")
    principal: str = Field(description="Principal name")
    principal_type: PrincipalType = Field(description="Type of principal")
    permission: PermissionLevel = Field(description="Permission level to revoke")


class GrantSchemaPermissionRequest(BaseModel):
    """Request model for granting schema permissions."""

    catalog: str = Field(description="Catalog name")
    schema_name: str = Field(alias="schema", description="Schema name")
    principal: str = Field(description="Principal name")
    principal_type: PrincipalType = Field(description="Type of principal")
    permission: PermissionLevel = Field(description="Permission level to grant")


class GrantCatalogPermissionRequest(BaseModel):
    """Request model for granting catalog permissions."""

    catalog: str = Field(description="Catalog name")
    principal: str = Field(description="Principal name")
    principal_type: PrincipalType = Field(description="Type of principal")
    permission: PermissionLevel = Field(description="Permission level to grant")


class SetupDeploymentPermissionsRequest(BaseModel):
    """Request model for setting up deployment permissions."""

    catalog: str = Field(description="Catalog name")
    environment: str = Field(description="Environment name")
    deployment_service_principal: str = Field(
        description="Service principal for deployment"
    )
    read_groups: Optional[list[str]] = Field(
        None, description="Groups with read access"
    )
    write_groups: Optional[list[str]] = Field(
        None, description="Groups with write access"
    )


class AuditPermissionsRequest(BaseModel):
    """Request model for permissions audit."""

    catalog: str = Field(description="Catalog name to audit")
    include_inherited: bool = Field(
        default=True, description="Include inherited permissions"
    )


class ValidateDeploymentAccessRequest(BaseModel):
    """Request model for validating deployment access."""

    catalog: str = Field(description="Catalog name")
    schema_name: str = Field(alias="schema", description="Schema name")
    service_principal: str = Field(description="Service principal to validate")


class CleanupStalePermissionsRequest(BaseModel):
    """Request model for cleaning up stale permissions."""

    catalog: str = Field(description="Catalog name")
    dry_run: bool = Field(
        default=True, description="Dry run mode (don't actually remove)"
    )


# Response Models
class PermissionEntry(BaseModel):
    """Individual permission entry."""

    principal: str = Field(description="Principal name")
    principal_type: str = Field(description="Principal type")
    permission: str = Field(description="Permission level")
    inherited: bool = Field(
        default=False, description="Whether permission is inherited"
    )


class TablePermissionsResponse(BaseModel):
    """Response model for table permissions."""

    catalog: str = Field(description="Catalog name")
    schema_name: str = Field(alias="schema", description="Schema name")
    table: str = Field(description="Table name")
    permissions: list[PermissionEntry] = Field(description="List of permissions")
    count: int = Field(description="Number of permissions")


class PermissionOperationResponse(BaseModel):
    """Response model for permission operations."""

    success: bool = Field(description="Operation success status")
    message: str = Field(description="Operation result message")
    resource: str = Field(description="Resource that was operated on")
    principal: Optional[str] = Field(None, description="Principal involved")
    permission: Optional[str] = Field(None, description="Permission involved")


class DeploymentPermissionsResponse(BaseModel):
    """Response model for deployment permissions setup."""

    success: bool = Field(description="Setup success status")
    message: str = Field(description="Setup result message")
    catalog: str = Field(description="Catalog name")
    environment: str = Field(description="Environment name")
    permissions_granted: list[dict[str, Any]] = Field(
        description="List of granted permissions"
    )


class PermissionsAuditResponse(BaseModel):
    """Response model for permissions audit."""

    catalog: str = Field(description="Audited catalog")
    total_permissions: int = Field(description="Total number of permissions")
    by_principal_type: dict[str, int] = Field(
        description="Permissions count by principal type"
    )
    by_permission_level: dict[str, int] = Field(
        description="Permissions count by level"
    )
    unusual_permissions: list[dict[str, Any]] = Field(
        description="Unusual or problematic permissions"
    )
    recommendations: list[str] = Field(description="Audit recommendations")


class DeploymentAccessValidationResponse(BaseModel):
    """Response model for deployment access validation."""

    valid: bool = Field(description="Whether access is valid")
    service_principal: str = Field(description="Validated service principal")
    catalog: str = Field(description="Catalog name")
    schema_name: str = Field(alias="schema", description="Schema name")
    missing_permissions: list[str] = Field(description="List of missing permissions")
    recommendations: list[str] = Field(description="Access recommendations")


class StalePermissionsCleanupResponse(BaseModel):
    """Response model for stale permissions cleanup."""

    catalog: str = Field(description="Catalog name")
    dry_run: bool = Field(description="Whether this was a dry run")
    stale_permissions_found: int = Field(
        description="Number of stale permissions found"
    )
    permissions_removed: int = Field(
        description="Number of permissions actually removed"
    )
    stale_permissions: list[dict[str, Any]] = Field(
        description="List of stale permissions"
    )


class PermissionsHealthCheckResponse(BaseModel):
    """Response model for permissions health check."""

    status: str = Field(description="Health status (healthy, unhealthy)")
    message: str = Field(description="Health check message")
    permissions_accessible: bool = Field(
        description="Whether permissions API is accessible"
    )
    databricks_connection: str = Field(description="Databricks connection status")
    error: Optional[str] = Field(None, description="Error message if unhealthy")
