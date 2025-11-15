"""Databricks Workspace API endpoints for the Nexa Databricks API.

This module provides RESTful API endpoints to manage Databricks Workspace objects.
It allows users to list, create, delete, export, and import workspace files and notebooks.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...core.config import settings
from ...core.dependencies import get_active_environment
from ...models.db.deployments import Environment
from ...models.api.workspace import (
    WorkspaceDeleteRequest,
    WorkspaceExportResponse,
    WorkspaceHealthCheckResponse,
    WorkspaceImportRequest,
    WorkspaceListResponse,
    WorkspaceMkdirsRequest,
    WorkspaceObjectResponse,
    WorkspaceOperationResponse,
    WorkspaceStatusResponse,
)
from ...services.databricks.databricks_workspace_api import DatabricksWorkspaceAPI

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspace", tags=["Workspace Management"])


# =============================================================================
# DEPENDENCIES
# =============================================================================


def get_workspace_api(
    environment: Annotated[Environment, Depends(get_active_environment)],
) -> DatabricksWorkspaceAPI:
    """Dependency to get a configured Databricks Workspace API client."""
    host = environment.databricks_host
    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )

    return DatabricksWorkspaceAPI(
        host=host,
        client_id=settings.databricks_client_id or "",
        client_secret=settings.databricks_client_secret or "",
    )


# =============================================================================
# WORKSPACE ENDPOINTS
# =============================================================================


@router.get(
    "/status",
    response_model=WorkspaceStatusResponse,
    summary="Get workspace object status",
)
async def get_workspace_status(
    workspace_api: Annotated[DatabricksWorkspaceAPI, Depends(get_workspace_api)],
    path: str = Query(..., description="Workspace path to check"),
) -> WorkspaceStatusResponse:
    """Get status of a workspace object."""
    try:
        result = await workspace_api.get_status(path)
        return WorkspaceStatusResponse.model_validate(result.as_dict())

    except Exception as e:
        logger.error(f"Failed to get workspace status for {path}: {e}")
        if "does not exist" in str(e).lower() or "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workspace object not found: {path}",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get workspace status: {e!s}",
        )


@router.get(
    "/list",
    response_model=WorkspaceListResponse,
    summary="List workspace objects",
)
async def list_workspace_objects(
    workspace_api: Annotated[DatabricksWorkspaceAPI, Depends(get_workspace_api)],
    path: str = Query(..., description="Workspace directory path to list"),
) -> WorkspaceListResponse:
    """List objects in a workspace directory."""
    try:
        objects_iterator = await workspace_api.list(path)
        workspace_objects = [
            WorkspaceObjectResponse.model_validate(obj.as_dict())
            for obj in objects_iterator
        ]

        return WorkspaceListResponse(
            objects=workspace_objects,
            path=path,
            count=len(workspace_objects),
        )

    except Exception as e:
        logger.error(f"Failed to list workspace objects in {path}: {e}")
        if "does not exist" in str(e).lower() or "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workspace directory not found: {path}",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list workspace objects: {e!s}",
        )


@router.post(
    "/mkdirs",
    response_model=WorkspaceOperationResponse,
    summary="Create workspace directories",
)
async def create_workspace_directories(
    request: WorkspaceMkdirsRequest,
    workspace_api: Annotated[DatabricksWorkspaceAPI, Depends(get_workspace_api)],
) -> WorkspaceOperationResponse:
    """Create workspace directories."""
    try:
        await workspace_api.mkdirs(request.path)

        return WorkspaceOperationResponse(
            success=True,
            message=f"Successfully created directories: {request.path}",
            path=request.path,
        )

    except Exception as e:
        logger.error(f"Failed to create directories {request.path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create directories: {e!s}",
        )


@router.post(
    "/delete",
    response_model=WorkspaceOperationResponse,
    summary="Delete workspace objects",
)
async def delete_workspace_objects(
    request: WorkspaceDeleteRequest,
    workspace_api: Annotated[DatabricksWorkspaceAPI, Depends(get_workspace_api)],
) -> WorkspaceOperationResponse:
    """Delete workspace objects."""
    try:
        await workspace_api.delete(request.path, request.recursive)

        return WorkspaceOperationResponse(
            success=True,
            message=f"Successfully deleted: {request.path}",
            path=request.path,
        )

    except Exception as e:
        logger.error(f"Failed to delete {request.path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete: {e!s}",
        )


@router.get(
    "/export",
    response_model=WorkspaceExportResponse,
    summary="Export workspace object",
)
async def export_workspace_object(
    workspace_api: Annotated[DatabricksWorkspaceAPI, Depends(get_workspace_api)],
    path: str = Query(..., description="Workspace path to export"),
    format: str = Query("SOURCE", description="Export format"),
) -> WorkspaceExportResponse:
    """Export a workspace object."""
    try:
        result = await workspace_api.export(path, format)

        return WorkspaceExportResponse(
            content=result.content or "",
            format=format,
            path=path,
            file_type=str(result.file_type) if result.file_type else None,
        )

    except Exception as e:
        logger.error(f"Failed to export {path}: {e}")
        if "does not exist" in str(e).lower() or "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workspace object not found: {path}",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export workspace object: {e!s}",
        )


@router.post(
    "/import",
    response_model=WorkspaceOperationResponse,
    summary="Import workspace object",
)
async def import_workspace_object(
    request: WorkspaceImportRequest,
    workspace_api: Annotated[DatabricksWorkspaceAPI, Depends(get_workspace_api)],
) -> WorkspaceOperationResponse:
    """Import a workspace object."""
    try:
        await workspace_api.import_object(
            path=request.path,
            format=request.format,
            language=request.language,
            content_base64=request.content_base64,
            overwrite=request.overwrite,
        )

        return WorkspaceOperationResponse(
            success=True,
            message=f"Successfully imported to: {request.path}",
            path=request.path,
        )

    except Exception as e:
        logger.error(f"Failed to import to {request.path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import: {e!s}",
        )


@router.get(
    "/health",
    response_model=WorkspaceHealthCheckResponse,
    summary="Health check",
)
async def workspace_health_check(
    workspace_api: Annotated[DatabricksWorkspaceAPI, Depends(get_workspace_api)],
) -> WorkspaceHealthCheckResponse:
    """Check Databricks Workspace connectivity."""
    try:
        await workspace_api.list("/")

        return WorkspaceHealthCheckResponse(
            status="healthy",
            databricks_connection="ok",
            workspace_accessible=True,
            message="Workspace connectivity verified",
            error=None,
        )

    except Exception as e:
        logger.error(f"Databricks workspace health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=WorkspaceHealthCheckResponse(
                status="unhealthy",
                databricks_connection="failed",
                workspace_accessible=False,
                error=str(e),
                message="Workspace connectivity failed",
            ).model_dump(),
        )
