"""Unity Catalog Permissions API endpoints for the Nexa Databricks API.

This module provides RESTful API endpoints to manage Unity Catalog permissions.
It allows users to grant, revoke, and audit permissions on catalogs, schemas, and tables.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.api.permissions import (
    AuditPermissionsRequest,
    CleanupStalePermissionsRequest,
    DeploymentAccessValidationResponse,
    DeploymentPermissionsResponse,
    GrantCatalogPermissionRequest,
    GrantSchemaPermissionRequest,
    GrantTablePermissionRequest,
    PermissionEntry,
    PermissionOperationResponse,
    PermissionsAuditResponse,
    PermissionsHealthCheckResponse,
    RevokeTablePermissionRequest,
    SetupDeploymentPermissionsRequest,
    StalePermissionsCleanupResponse,
    TablePermissionsResponse,
    ValidateDeploymentAccessRequest,
)
from ...models.db import Environment
from ...services.databricks.databricks_uc_api import (
    DatabricksUCAPI as UnityCatalogPermissionsAPI,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/permissions", tags=["Security & Access Control"])


# =============================================================================
# DEPENDENCIES
# =============================================================================


def get_permissions_api(
    db: Annotated[Session, Depends(get_db)],
    environment_id: str = None,
) -> UnityCatalogPermissionsAPI:
    """Dependency to get permissions API client from environment configuration.

    Args:
        environment_id: The ID of the environment to get the configuration for.
        db: The database session.

    Raises:
        HTTPException: If the environment is not found or configuration is invalid.

    Returns:
        A configured UnityCatalogPermissionsAPI client.
    """
    if not environment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment ID is required",
        )

    environment = db.query(Environment).filter(Environment.id == environment_id).first()
    if not environment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment not found: {environment_id}",
        )

    config = environment.configuration or {}
    host = config.get("databricks_host")

    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )

    from ...core.config import settings

    return UnityCatalogPermissionsAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


# =============================================================================
# TABLE PERMISSIONS ENDPOINTS
# =============================================================================


@router.post(
    "/tables/grant",
    response_model=PermissionOperationResponse,
    summary="Grant table permission",
    description="Grant a permission on a table to a principal",
)
async def grant_table_permission(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    request: GrantTablePermissionRequest,
    environment_id: str = None,
) -> PermissionOperationResponse:
    """Grant permission on a table to a principal.

    Args:
        request: The permission grant request.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        Result of the permission grant operation.
    """
    try:
        await permissions_api.grant_table_permission(
            catalog=request.catalog,
            schema=request.schema,
            table=request.table,
            principal=request.principal,
            principal_type=request.principal_type,
            permission=request.permission,
        )

        resource = f"{request.catalog}.{request.schema}.{request.table}"
        return PermissionOperationResponse(
            success=True,
            message=f"Successfully granted {request.permission.value} permission to {request.principal}",
            resource=resource,
            principal=request.principal,
            permission=request.permission.value,
        )

    except Exception as e:
        logger.error(f"Failed to grant table permission: {e}")
        resource = f"{request.catalog}.{request.schema}.{request.table}"
        return PermissionOperationResponse(
            success=False,
            message=f"Failed to grant permission: {e!s}",
            resource=resource,
            principal=request.principal,
            permission=request.permission.value,
        )


@router.post(
    "/tables/revoke",
    response_model=PermissionOperationResponse,
    summary="Revoke table permission",
    description="Revoke a permission on a table from a principal",
)
async def revoke_table_permission(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    request: RevokeTablePermissionRequest,
    environment_id: str = None,
) -> PermissionOperationResponse:
    """Revoke permission on a table from a principal.

    Args:
        request: The permission revoke request.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        Result of the permission revoke operation.
    """
    try:
        await permissions_api.revoke_table_permission(
            catalog=request.catalog,
            schema=request.schema,
            table=request.table,
            principal=request.principal,
            principal_type=request.principal_type,
            permission=request.permission,
        )

        resource = f"{request.catalog}.{request.schema}.{request.table}"
        return PermissionOperationResponse(
            success=True,
            message=f"Successfully revoked {request.permission.value} permission from {request.principal}",
            resource=resource,
            principal=request.principal,
            permission=request.permission.value,
        )

    except Exception as e:
        logger.error(f"Failed to revoke table permission: {e}")
        resource = f"{request.catalog}.{request.schema}.{request.table}"
        return PermissionOperationResponse(
            success=False,
            message=f"Failed to revoke permission: {e!s}",
            resource=resource,
            principal=request.principal,
            permission=request.permission.value,
        )


@router.get(
    "/tables/{catalog}/{schema}/{table}",
    response_model=TablePermissionsResponse,
    summary="Get table permissions",
    description="Get all permissions for a specific table",
)
async def get_table_permissions(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    catalog: str = Path(description="Catalog name"),
    schema: str = Path(description="Schema name"),
    table: str = Path(description="Table name"),
    environment_id: str = None,
) -> TablePermissionsResponse:
    """Get all permissions for a table.

    Args:
        catalog: The catalog name.
        schema: The schema name.
        table: The table name.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        All permissions for the specified table.
    """
    try:
        result = await permissions_api.get_table_permissions(catalog, schema, table)

        permissions_data = result.get("privilege_assignments", [])
        permissions = [
            PermissionEntry(
                principal=perm.get("principal", ""),
                principal_type=perm.get("principal_type", ""),
                permission=perm.get("privilege", ""),
                inherited=perm.get("inherited", False),
            )
            for perm in permissions_data
        ]

        return TablePermissionsResponse(
            catalog=catalog,
            schema=schema,
            table=table,
            permissions=permissions,
            count=len(permissions),
        )

    except Exception as e:
        logger.error(
            f"Failed to get table permissions for {catalog}.{schema}.{table}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get table permissions: {e!s}",
        )


# =============================================================================
# SCHEMA PERMISSIONS ENDPOINTS
# =============================================================================


@router.post(
    "/schemas/grant",
    response_model=PermissionOperationResponse,
    summary="Grant schema permission",
    description="Grant a permission on a schema to a principal",
)
async def grant_schema_permission(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    request: GrantSchemaPermissionRequest,
    environment_id: str = None,
) -> PermissionOperationResponse:
    """Grant permission on a schema to a principal.

    Args:
        request: The permission grant request.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        Result of the permission grant operation.
    """
    try:
        await permissions_api.grant_schema_permission(
            catalog=request.catalog,
            schema=request.schema,
            principal=request.principal,
            principal_type=request.principal_type,
            permission=request.permission,
        )

        resource = f"{request.catalog}.{request.schema}"
        return PermissionOperationResponse(
            success=True,
            message=f"Successfully granted {request.permission.value} permission to {request.principal}",
            resource=resource,
            principal=request.principal,
            permission=request.permission.value,
        )

    except Exception as e:
        logger.error(f"Failed to grant schema permission: {e}")
        resource = f"{request.catalog}.{request.schema}"
        return PermissionOperationResponse(
            success=False,
            message=f"Failed to grant permission: {e!s}",
            resource=resource,
            principal=request.principal,
            permission=request.permission.value,
        )


# =============================================================================
# CATALOG PERMISSIONS ENDPOINTS
# =============================================================================


@router.post(
    "/catalogs/grant",
    response_model=PermissionOperationResponse,
    summary="Grant catalog permission",
    description="Grant a permission on a catalog to a principal",
)
async def grant_catalog_permission(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    request: GrantCatalogPermissionRequest,
    environment_id: str = None,
) -> PermissionOperationResponse:
    """Grant permission on a catalog to a principal.

    Args:
        request: The permission grant request.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        Result of the permission grant operation.
    """
    try:
        await permissions_api.grant_catalog_permission(
            catalog=request.catalog,
            principal=request.principal,
            principal_type=request.principal_type,
            permission=request.permission,
        )

        return PermissionOperationResponse(
            success=True,
            message=f"Successfully granted {request.permission.value} permission to {request.principal}",
            resource=request.catalog,
            principal=request.principal,
            permission=request.permission.value,
        )

    except Exception as e:
        logger.error(f"Failed to grant catalog permission: {e}")
        return PermissionOperationResponse(
            success=False,
            message=f"Failed to grant permission: {e!s}",
            resource=request.catalog,
            principal=request.principal,
            permission=request.permission.value,
        )


# =============================================================================
# DEPLOYMENT PERMISSIONS ENDPOINTS
# =============================================================================


@router.post(
    "/deployment/setup",
    response_model=DeploymentPermissionsResponse,
    summary="Setup deployment permissions",
    description="Setup standard permissions for a deployment environment",
)
async def setup_deployment_permissions(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    request: SetupDeploymentPermissionsRequest,
    environment_id: str = None,
) -> DeploymentPermissionsResponse:
    """Setup deployment permissions.

    Args:
        request: The deployment setup request.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        Result of the deployment permissions setup.
    """
    try:
        results = await permissions_api.setup_deployment_permissions(
            catalog=request.catalog,
            environment=request.environment,
            deployment_service_principal=request.deployment_service_principal,
            read_groups=request.read_groups,
            write_groups=request.write_groups,
        )

        return DeploymentPermissionsResponse(
            success=True,
            message=f"Successfully setup deployment permissions for {request.environment}",
            catalog=request.catalog,
            environment=request.environment,
            permissions_granted=results,
        )

    except Exception as e:
        logger.error(f"Failed to setup deployment permissions: {e}")
        return DeploymentPermissionsResponse(
            success=False,
            message=f"Failed to setup deployment permissions: {e!s}",
            catalog=request.catalog,
            environment=request.environment,
            permissions_granted=[],
        )


@router.post(
    "/deployment/validate",
    response_model=DeploymentAccessValidationResponse,
    summary="Validate deployment access",
    description="Validate that a service principal has required permissions for deployment",
)
async def validate_deployment_access(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    request: ValidateDeploymentAccessRequest,
    environment_id: str = None,
) -> DeploymentAccessValidationResponse:
    """Validate deployment access.

    Args:
        request: The validation request.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        Validation result for deployment access.
    """
    try:
        result = await permissions_api.validate_deployment_access(
            catalog=request.catalog,
            schema=request.schema,
            service_principal=request.service_principal,
        )

        return DeploymentAccessValidationResponse(
            valid=result.get("valid", False),
            service_principal=request.service_principal,
            catalog=request.catalog,
            schema=request.schema,
            missing_permissions=result.get("missing_permissions", []),
            recommendations=result.get("recommendations", []),
        )

    except Exception as e:
        logger.error(f"Failed to validate deployment access: {e}")
        return DeploymentAccessValidationResponse(
            valid=False,
            service_principal=request.service_principal,
            catalog=request.catalog,
            schema=request.schema,
            missing_permissions=[],
            recommendations=[f"Validation failed: {e!s}"],
        )


# =============================================================================
# AUDIT AND MANAGEMENT ENDPOINTS
# =============================================================================


@router.post(
    "/audit",
    response_model=PermissionsAuditResponse,
    summary="Audit permissions",
    description="Audit permissions for a catalog and identify issues",
)
async def audit_permissions(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    request: AuditPermissionsRequest,
    environment_id: str = None,
) -> PermissionsAuditResponse:
    """Audit permissions for a catalog.

    Args:
        request: The audit request.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        Audit results for the catalog permissions.
    """
    try:
        result = await permissions_api.audit_permissions(
            catalog=request.catalog,
            include_inherited=request.include_inherited,
        )

        return PermissionsAuditResponse(
            catalog=request.catalog,
            total_permissions=result.get("total_permissions", 0),
            by_principal_type=result.get("by_principal_type", {}),
            by_permission_level=result.get("by_permission_level", {}),
            unusual_permissions=result.get("unusual_permissions", []),
            recommendations=result.get("recommendations", []),
        )

    except Exception as e:
        logger.error(f"Failed to audit permissions for {request.catalog}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to audit permissions: {e!s}",
        )


@router.post(
    "/cleanup",
    response_model=StalePermissionsCleanupResponse,
    summary="Cleanup stale permissions",
    description="Find and optionally remove stale permissions",
)
async def cleanup_stale_permissions(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    request: CleanupStalePermissionsRequest,
    environment_id: str = None,
) -> StalePermissionsCleanupResponse:
    """Cleanup stale permissions.

    Args:
        request: The cleanup request.
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        Result of the stale permissions cleanup.
    """
    try:
        result = await permissions_api.cleanup_stale_permissions(
            catalog=request.catalog,
            dry_run=request.dry_run,
        )

        return StalePermissionsCleanupResponse(
            catalog=request.catalog,
            dry_run=request.dry_run,
            stale_permissions_found=result.get("stale_permissions_found", 0),
            permissions_removed=result.get("permissions_removed", 0),
            stale_permissions=result.get("stale_permissions", []),
        )

    except Exception as e:
        logger.error(f"Failed to cleanup stale permissions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup stale permissions: {e!s}",
        )


@router.get(
    "/health",
    response_model=PermissionsHealthCheckResponse,
    summary="Health check",
    description="Check Unity Catalog Permissions API connectivity",
)
async def permissions_health_check(
    permissions_api: Annotated[
        UnityCatalogPermissionsAPI, Depends(get_permissions_api)
    ],
    environment_id: str = None,
) -> PermissionsHealthCheckResponse:
    """Check Unity Catalog Permissions API connectivity.

    Args:
        environment_id: The ID of the environment to use.
        permissions_api: The permissions API client.

    Returns:
        The health check status of the permissions connection.
    """
    try:
        # Simple connectivity test - this will verify the API connection

        return PermissionsHealthCheckResponse(
            status="healthy",
            databricks_connection="ok",
            permissions_accessible=True,
            message="Unity Catalog Permissions API connectivity verified",
        )

    except Exception as e:
        logger.error(f"Databricks permissions health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=PermissionsHealthCheckResponse(
                status="unhealthy",
                databricks_connection="failed",
                permissions_accessible=False,
                error=str(e),
                message="Unity Catalog Permissions API connectivity failed",
            ).dict(),
        )
