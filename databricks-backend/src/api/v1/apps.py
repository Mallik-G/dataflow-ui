"""Databricks Apps API endpoints - Spec Compliant Implementation.

This module provides RESTful API endpoints that exactly match the Databricks Apps API
specifications found in api_docs/ OpenAPI definitions. All endpoints follow the
official Databricks patterns and integrate with real Databricks services.
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status

from ...core.config import settings
from ...models.api.apps import (
    App,
    AppDeployment,
    AppPermissions,
    AppPermissionsRequest,
    CreateAppDeploymentRequest,
    CreateAppRequest,
    DatabricksError,
    GetAppPermissionLevelsResponse,
    ListAppDeploymentsResponse,
    ListAppsResponse,
    UpdateAppRequest,
)
from ...services.databricks.databricks_apps_api import DatabricksAppsAPI

logger = logging.getLogger(__name__)

# Use /api/2.0/apps to match Databricks specification exactly
router = APIRouter(prefix="/apps", tags=["Application Management"])


def get_databricks_apps_client() -> DatabricksAppsAPI:
    """Dependency to get Apps API client using single-environment settings.

    Uses settings.databricks_host/client_id/client_secret directly to avoid DB dependency.
    """
    host = settings.databricks_host
    if not host:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Databricks host is not configured. Set DATABRICKS_HOST in environment.",
        )
    return DatabricksAppsAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


def handle_databricks_error(e: Exception, operation: str):
    """Handle Databricks API errors with proper error codes."""
    error_msg = str(e)

    if "not found" in error_msg.lower() or "404" in error_msg:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=DatabricksError(
                error_code="NOT_FOUND",
                message=f"App not found during {operation}: {error_msg}",
                details=[],
            ).model_dump(),
        ) from e
    if "permission" in error_msg.lower() or "403" in error_msg:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail=DatabricksError(
                error_code="PERMISSION_DENIED",
                message=f"Permission denied for {operation}: {error_msg}",
                details=[],
            ).model_dump(),
        ) from e
    if "invalid" in error_msg.lower() or "400" in error_msg:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=DatabricksError(
                error_code="INVALID_PARAMETER_VALUE",
                message=f"Invalid request for {operation}: {error_msg}",
                details=[],
            ).model_dump(),
        ) from e
    raise HTTPException(
        status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=DatabricksError(
            error_code="INTERNAL_ERROR",
            message=f"Internal error during {operation}: {error_msg}",
            details=[],
        ).model_dump(),
    ) from e


# =============================================================================
# APP MANAGEMENT ENDPOINTS
# =============================================================================


@router.get(
    "/",
    response_model=ListAppsResponse,
    summary="List apps",
    description="Lists all apps in the workspace.",
)
async def list_apps(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    page_token: Optional[str] = Query(None, description="Pagination token"),
    page_size: Optional[int] = Query(
        None, ge=1, le=1000, description="Upper bound for items returned"
    ),
):
    """List all apps in the workspace."""
    try:
        # Call actual Databricks Apps API
        response = await databricks_client.list_apps(
            max_results=page_size, page_token=page_token
        )

        # Parse response into our models
        apps_data = response.get("apps", [])
        apps = [App.model_validate(app_data) for app_data in apps_data]

        return ListAppsResponse(
            apps=apps, next_page_token=response.get("next_page_token")
        )

    except Exception as e:
        logger.error(f"Failed to list apps: {e!s}")
        handle_databricks_error(e, "list apps")


@router.post(
    "/",
    response_model=App,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create an app",
    description="Creates a new app.",
)
async def create_app(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    request: CreateAppRequest,
    no_compute: Optional[bool] = Query(
        None, description="If true, the app will not be started after creation"
    ),
):
    """Create a new app."""
    try:
        # Prepare app data for Databricks API
        app_data = {
            "name": request.name,
            "description": request.description,
            "source_code_path": request.source_code_path,
        }

        # Call actual Databricks Apps API with no_compute parameter
        response = await databricks_client.create_app(app_data, no_compute=no_compute)

        # Return the created app
        return App.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to create app {request.name}: {e!s}")
        handle_databricks_error(e, "create app")


@router.get(
    "/{app_name}",
    response_model=App,
    summary="Get an app",
    description="Retrieves information for the app with the supplied name.",
)
async def get_app(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
):
    """Get details of a specific app."""
    try:
        # Call actual Databricks Apps API
        response = await databricks_client.get_app(app_name)

        # Return the app data
        return App.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to get app {app_name}: {e!s}")
        handle_databricks_error(e, f"get app {app_name}")


@router.patch(
    "/{app_name}",
    response_model=App,
    summary="Update an app",
    description="Updates the app with the supplied name.",
)
async def update_app(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
    request: UpdateAppRequest,
):
    """Update an existing app."""
    try:
        # Prepare update data (only include non-None fields)
        update_data = {}
        if request.description is not None:
            update_data["description"] = request.description
        if request.source_code_path is not None:
            update_data["source_code_path"] = request.source_code_path

        # Call actual Databricks Apps API
        response = await databricks_client.update_app(app_name, update_data)

        # Return the updated app
        return App.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to update app {app_name}: {e!s}")
        handle_databricks_error(e, f"update app {app_name}")


@router.delete(
    "/{app_name}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Delete an app",
    description="Delete the app with the supplied name.",
)
async def delete_app(
    app_name: str,
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
):
    """Delete an app."""
    try:
        # Call actual Databricks Apps API
        await databricks_client.delete_app(app_name)

        # 204 No Content response

    except Exception as e:
        logger.error(f"Failed to delete app {app_name}: {e!s}")
        handle_databricks_error(e, f"delete app {app_name}")


# =============================================================================
# APP DEPLOYMENT ENDPOINTS
# =============================================================================


@router.get(
    "/{app_name}/deployments",
    response_model=ListAppDeploymentsResponse,
    summary="List app deployments",
    description="Get deployments for the app with the supplied name.",
)
async def list_deployments(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
    page_token: Optional[str] = Query(None, description="Pagination token"),
    page_size: Optional[int] = Query(
        None, ge=1, le=1000, description="Upper bound for items returned"
    ),
):
    """List all deployments of an app."""
    try:
        # Call actual Databricks Apps API
        response = await databricks_client.list_deployments(
            app_name=app_name, max_results=page_size, page_token=page_token
        )

        # Parse response into our models
        deployments_data = response.get("app_deployments", [])
        deployments = [
            AppDeployment.model_validate(dep_data) for dep_data in deployments_data
        ]

        return ListAppDeploymentsResponse(
            app_deployments=deployments,
            next_page_token=response.get("next_page_token"),
        )

    except Exception as e:
        logger.error(f"Failed to list deployments for app {app_name}: {e!s}")
        handle_databricks_error(e, f"list deployments for {app_name}")


@router.post(
    "/{app_name}/deployments",
    response_model=AppDeployment,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create an app deployment",
    description="Creates an app deployment for the app with the supplied name.",
)
async def create_deployment(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
    request: CreateAppDeploymentRequest,
):
    """Create a new deployment of an app."""
    try:
        # Prepare deployment data for Databricks API
        deployment_data = {
            "source_code_path": request.source_code_path,
            "mode": request.mode.value if request.mode else "SNAPSHOT",
        }

        # Call actual Databricks Apps API
        response = await databricks_client.create_deployment(app_name, deployment_data)

        # Return the created deployment
        return AppDeployment.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to create deployment for app {app_name}: {e!s}")
        handle_databricks_error(e, f"create deployment for {app_name}")


@router.get(
    "/{app_name}/deployments/{deployment_id}",
    response_model=AppDeployment,
    summary="Get an app deployment",
    description="Get deployment information for the app with the supplied name and deployment id.",
)
async def get_deployment(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
    deployment_id: str,
):
    """Get details of a specific deployment."""
    try:
        # Call actual Databricks Apps API
        response = await databricks_client.get_deployment(app_name, deployment_id)

        # Return the deployment data
        return AppDeployment.model_validate(response)

    except Exception as e:
        logger.error(
            f"Failed to get deployment {deployment_id} for app {app_name}: {e!s}"
        )
        handle_databricks_error(e, f"get deployment {deployment_id} for {app_name}")


# =============================================================================
# APP LIFECYCLE ENDPOINTS
# =============================================================================


@router.post(
    "/{app_name}/start",
    response_model=App,
    summary="Start an app",
    description="Start the last active deployment of the app in the workspace.",
)
async def start_app(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
):
    """Start an app."""
    try:
        # Use actual SDK start_app method
        response = await databricks_client.start_app(app_name)

        # Return the app deployment status (convert to App format for compatibility)
        return App.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to start app {app_name}: {e!s}")
        handle_databricks_error(e, f"start app {app_name}")


@router.post(
    "/{app_name}/stop",
    response_model=App,
    summary="Stop an app",
    description="Stop the active deployment of the app in the workspace.",
)
async def stop_app(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
):
    """Stop an app."""
    try:
        # Use actual SDK stop_app method
        response = await databricks_client.stop_app(app_name)

        # Return the updated app state
        return App.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to stop app {app_name}: {e!s}")
        handle_databricks_error(e, f"stop app {app_name}")


# =============================================================================
# APP PERMISSIONS ENDPOINTS
# =============================================================================


@router.get(
    "/{app_name}/permissions",
    response_model=AppPermissions,
    summary="Get app permissions",
    description="Gets the permissions of an app. Apps can inherit permissions from their root object.",
)
async def get_app_permissions(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
):
    """Get the permissions of an app."""
    try:
        # Call actual Databricks Apps Permissions API
        response = await databricks_client.get_app_permissions(app_name)

        # Return the permissions data
        return AppPermissions.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to get permissions for app {app_name}: {e!s}")
        handle_databricks_error(e, f"get permissions for app {app_name}")


@router.patch(
    "/{app_name}/permissions",
    response_model=AppPermissions,
    summary="Update app permissions",
    description="Updates the permissions on an app. Apps can inherit permissions from their root object.",
)
async def update_app_permissions(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
    request: AppPermissionsRequest,
):
    """Update the permissions of an app (partial update)."""
    try:
        # Prepare permissions data for Databricks API
        permissions_data = request.model_dump()

        # Call actual Databricks Apps Permissions API
        response = await databricks_client.update_app_permissions(
            app_name, permissions_data
        )

        # Return the updated permissions
        return AppPermissions.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to update permissions for app {app_name}: {e!s}")
        handle_databricks_error(e, f"update permissions for app {app_name}")


@router.put(
    "/{app_name}/permissions",
    response_model=AppPermissions,
    summary="Set app permissions",
    description="Sets permissions on an object, replacing existing permissions if they exist. "
    "Deletes all direct permissions if none are specified.",
)
async def set_app_permissions(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
    request: AppPermissionsRequest,
):
    """Set the permissions of an app (replace all)."""
    try:
        # Prepare permissions data for Databricks API
        permissions_data = request.model_dump()

        # Call actual Databricks Apps Permissions API
        response = await databricks_client.set_app_permissions(
            app_name, permissions_data
        )

        # Return the updated permissions
        return AppPermissions.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to set permissions for app {app_name}: {e!s}")
        handle_databricks_error(e, f"set permissions for app {app_name}")


@router.get(
    "/{app_name}/permissions/levels",
    response_model=GetAppPermissionLevelsResponse,
    summary="Get app permission levels",
    description="Gets the permission levels that a user can have on an object.",
)
async def get_app_permission_levels(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
):
    """Get available permission levels for an app."""
    try:
        # Call actual Databricks Apps Permissions API
        response = await databricks_client.get_app_permission_levels(app_name)

        # Return the permission levels
        return GetAppPermissionLevelsResponse.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to get permission levels for app {app_name}: {e!s}")
        handle_databricks_error(e, f"get permission levels for app {app_name}")


# =============================================================================
# WAIT OPERATION ENDPOINTS
# =============================================================================


@router.post(
    "/create-and-wait",
    response_model=App,
    status_code=http_status.HTTP_201_CREATED,
    summary="Create an app and wait",
    description="Creates a new app and waits for it to become active.",
)
async def create_app_and_wait(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    request: CreateAppRequest,
    no_compute: Optional[bool] = Query(
        None, description="If true, the app will not be started after creation"
    ),
    timeout_minutes: int = Query(
        20, description="Maximum time to wait for the app to become active"
    ),
):
    """Create a new app and wait for it to become active."""
    try:
        # Prepare app data for Databricks API
        app_data = {
            "name": request.name,
            "description": request.description,
            "source_code_path": request.source_code_path,
        }

        # Call actual Databricks Apps API with wait
        response = await databricks_client.create_app_and_wait(
            app_data, no_compute=no_compute, timeout_minutes=timeout_minutes
        )

        # Return the created app
        return App.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to create app and wait {request.name}: {e!s}")
        handle_databricks_error(e, "create app and wait")


@router.post(
    "/{app_name}/deployments/deploy-and-wait",
    response_model=AppDeployment,
    status_code=http_status.HTTP_201_CREATED,
    summary="Deploy an app and wait",
    description="Creates an app deployment and waits for it to succeed.",
)
async def deploy_app_and_wait(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
    request: CreateAppDeploymentRequest,
    timeout_minutes: int = Query(
        20, description="Maximum time to wait for deployment to succeed"
    ),
):
    """Deploy an app and wait for completion."""
    try:
        # Prepare deployment data for Databricks API
        deployment_data = {
            "source_code_path": request.source_code_path,
            "mode": request.mode.value if request.mode else "SNAPSHOT",
        }

        # Call actual Databricks Apps API with wait
        response = await databricks_client.deploy_and_wait(
            app_name, deployment_data, timeout_minutes=timeout_minutes
        )

        # Return the created deployment
        return AppDeployment.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to deploy app and wait {app_name}: {e!s}")
        handle_databricks_error(e, f"deploy app and wait {app_name}")


@router.post(
    "/{app_name}/start-and-wait",
    response_model=App,
    summary="Start an app and wait",
    description="Start the last active deployment of the app and wait for it to become active.",
)
async def start_app_and_wait(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
    app_name: str,
    timeout_minutes: int = Query(
        20, description="Maximum time to wait for the app to become active"
    ),
):
    """Start an app and wait for it to become active."""
    try:
        # Use actual SDK start_app_and_wait method
        response = await databricks_client.start_app_and_wait(
            app_name, timeout_minutes=timeout_minutes
        )

        # Return the app status
        return App.model_validate(response)

    except Exception as e:
        logger.error(f"Failed to start app and wait {app_name}: {e!s}")
        handle_databricks_error(e, f"start app and wait {app_name}")


# =============================================================================
# HEALTH CHECK ENDPOINT
# =============================================================================


@router.get(
    "/health",
    summary="Apps API Health Check",
    description="Check connectivity to Databricks Apps API",
)
async def apps_health_check(
    databricks_client: Annotated[
        DatabricksAppsAPI, Depends(get_databricks_apps_client)
    ],
):
    """Check Databricks Apps API connectivity."""
    try:
        # Simple connectivity test - try to list apps with limit 1
        await databricks_client.list_apps(max_results=1)

        return {
            "status": "healthy",
            "service": "databricks-apps-api",
            "message": "Apps API connectivity verified",
        }

    except Exception as e:
        logger.error(f"Apps API health check failed: {e!s}")
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "service": "databricks-apps-api",
                "error": str(e),
                "message": "Apps API connectivity failed",
            },
        ) from e
