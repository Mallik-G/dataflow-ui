"""FastAPI router for Databricks Identity and Access Management (IAM) operations."""

import logging
from typing import Annotated, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.config import settings
from ...models.db.deployments import Environment
from ...services.databricks.databricks_iam_api import DatabricksIAMAPI
from ...services.databricks.base_client import DatabricksAPIError

router = APIRouter(prefix="/iam", tags=["Identity & Access Management"])
logger = logging.getLogger(__name__)


def get_databricks_iam_client(
    db: Annotated[Session, Depends(get_db)],
) -> DatabricksIAMAPI:
    """Dependency to get a configured Databricks IAM API client."""
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

    return DatabricksIAMAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


def handle_databricks_error(e: Exception, operation: str):
    """Map Databricks SDK errors to HTTP exceptions."""
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


@router.get(
    "/users",
    summary="List all users in the workspace",
    description="Retrieves a list of all users in the Databricks workspace with their details.",
)
async def list_users(
    iam_client: Annotated[DatabricksIAMAPI, Depends(get_databricks_iam_client)],
    count: Optional[int] = Query(None, ge=1, le=1000, description="Maximum number of users to return"),
    start_index: Optional[int] = Query(None, ge=1, description="Starting index for pagination"),
    filter: Optional[str] = Query(None, description="SCIM filter expression (e.g., 'active eq true')"),
):
    """
    List all users in the workspace.

    Returns user information including:
    - User ID and username
    - Display name
    - Email addresses
    - Active status
    - Groups membership
    """
    try:
        result = await iam_client.list_users(
            count=count,
            start_index=start_index,
            filter_expression=filter,
        )

        # Convert users to serializable format
        users_list = []
        users_data = result.get("users", [])

        for user in users_data:
            # Handle both dict and object formats
            if hasattr(user, 'as_dict'):
                user_dict = user.as_dict()
            elif isinstance(user, dict):
                user_dict = user
            else:
                user_dict = {
                    "id": getattr(user, "id", None),
                    "user_name": getattr(user, "user_name", None),
                    "display_name": getattr(user, "display_name", None),
                    "active": getattr(user, "active", None),
                    "emails": getattr(user, "emails", []),
                }

            users_list.append({
                "id": user_dict.get("id"),
                "user_name": user_dict.get("user_name"),
                "display_name": user_dict.get("display_name"),
                "active": user_dict.get("active", True),
                "emails": user_dict.get("emails", []),
                "groups": user_dict.get("groups", []),
                "roles": user_dict.get("roles", []),
            })

        return {
            "users": users_list,
            "total_results": result.get("total_results", len(users_list)),
            "start_index": start_index or 1,
            "items_per_page": count or len(users_list),
        }

    except Exception as e:
        logger.error(f"Failed to list users: {e!s}")
        handle_databricks_error(e, "list users")


@router.get(
    "/users/{user_id}",
    summary="Get user details",
    description="Retrieves detailed information about a specific user by ID or username.",
)
async def get_user(
    user_id: str,
    iam_client: Annotated[DatabricksIAMAPI, Depends(get_databricks_iam_client)],
):
    """Get detailed information about a specific user."""
    try:
        user = await iam_client.get_user(user_id)

        # Convert to serializable format
        if hasattr(user, 'as_dict'):
            user_dict = user.as_dict()
        elif isinstance(user, dict):
            user_dict = user
        else:
            user_dict = {
                "id": getattr(user, "id", None),
                "user_name": getattr(user, "user_name", None),
                "display_name": getattr(user, "display_name", None),
                "active": getattr(user, "active", None),
                "emails": getattr(user, "emails", []),
            }

        return {
            "id": user_dict.get("id"),
            "user_name": user_dict.get("user_name"),
            "display_name": user_dict.get("display_name"),
            "active": user_dict.get("active", True),
            "emails": user_dict.get("emails", []),
            "groups": user_dict.get("groups", []),
            "roles": user_dict.get("roles", []),
            "external_id": user_dict.get("external_id"),
        }

    except Exception as e:
        logger.error(f"Failed to get user {user_id}: {e!s}")
        handle_databricks_error(e, f"get user {user_id}")


@router.get(
    "/groups",
    summary="List all groups in the workspace",
    description="Retrieves a list of all groups in the Databricks workspace.",
)
async def list_groups(
    iam_client: Annotated[DatabricksIAMAPI, Depends(get_databricks_iam_client)],
    count: Optional[int] = Query(None, ge=1, le=1000, description="Maximum number of groups to return"),
    start_index: Optional[int] = Query(None, ge=1, description="Starting index for pagination"),
    filter: Optional[str] = Query(None, description="SCIM filter expression"),
):
    """List all groups in the workspace."""
    try:
        result = await iam_client.list_groups(
            count=count,
            start_index=start_index,
            filter_expression=filter,
        )

        # Convert groups to serializable format
        groups_list = []
        groups_data = result.get("groups", [])

        for group in groups_data:
            if hasattr(group, 'as_dict'):
                group_dict = group.as_dict()
            elif isinstance(group, dict):
                group_dict = group
            else:
                group_dict = {
                    "id": getattr(group, "id", None),
                    "display_name": getattr(group, "display_name", None),
                    "members": getattr(group, "members", []),
                }

            groups_list.append({
                "id": group_dict.get("id"),
                "display_name": group_dict.get("display_name"),
                "members": group_dict.get("members", []),
                "roles": group_dict.get("roles", []),
            })

        return {
            "groups": groups_list,
            "total_results": result.get("total_results", len(groups_list)),
            "start_index": start_index or 1,
            "items_per_page": count or len(groups_list),
        }

    except Exception as e:
        logger.error(f"Failed to list groups: {e!s}")
        handle_databricks_error(e, "list groups")


@router.get(
    "/groups/{group_id}",
    summary="Get group details",
    description="Retrieves detailed information about a specific group.",
)
async def get_group(
    group_id: str,
    iam_client: Annotated[DatabricksIAMAPI, Depends(get_databricks_iam_client)],
):
    """Get detailed information about a specific group."""
    try:
        group = await iam_client.get_group(group_id)

        # Convert to serializable format
        if hasattr(group, 'as_dict'):
            group_dict = group.as_dict()
        elif isinstance(group, dict):
            group_dict = group
        else:
            group_dict = {
                "id": getattr(group, "id", None),
                "display_name": getattr(group, "display_name", None),
                "members": getattr(group, "members", []),
            }

        return {
            "id": group_dict.get("id"),
            "display_name": group_dict.get("display_name"),
            "members": group_dict.get("members", []),
            "roles": group_dict.get("roles", []),
            "external_id": group_dict.get("external_id"),
        }

    except Exception as e:
        logger.error(f"Failed to get group {group_id}: {e!s}")
        handle_databricks_error(e, f"get group {group_id}")


@router.get(
    "/service-principals",
    summary="List all service principals in the workspace",
    description="Retrieves a list of all service principals in the Databricks workspace.",
)
async def list_service_principals(
    iam_client: Annotated[DatabricksIAMAPI, Depends(get_databricks_iam_client)],
    count: Optional[int] = Query(None, ge=1, le=1000, description="Maximum number of service principals to return"),
    start_index: Optional[int] = Query(None, ge=1, description="Starting index for pagination"),
    filter: Optional[str] = Query(None, description="SCIM filter expression"),
):
    """List all service principals in the workspace."""
    try:
        result = await iam_client.list_service_principals(
            count=count,
            start_index=start_index,
            filter_expression=filter,
        )

        # Convert service principals to serializable format
        sps_list = []
        sps_data = result.get("service_principals", [])

        for sp in sps_data:
            if hasattr(sp, 'as_dict'):
                sp_dict = sp.as_dict()
            elif isinstance(sp, dict):
                sp_dict = sp
            else:
                sp_dict = {
                    "id": getattr(sp, "id", None),
                    "application_id": getattr(sp, "application_id", None),
                    "display_name": getattr(sp, "display_name", None),
                    "active": getattr(sp, "active", None),
                }

            sps_list.append({
                "id": sp_dict.get("id"),
                "application_id": sp_dict.get("application_id"),
                "display_name": sp_dict.get("display_name"),
                "active": sp_dict.get("active", True),
            })

        return {
            "service_principals": sps_list,
            "total_results": result.get("total_results", len(sps_list)),
            "start_index": start_index or 1,
            "items_per_page": count or len(sps_list),
        }

    except Exception as e:
        logger.error(f"Failed to list service principals: {e!s}")
        handle_databricks_error(e, "list service principals")


@router.get(
    "/service-principals/{sp_id}",
    summary="Get service principal details",
    description="Retrieves detailed information about a specific service principal.",
)
async def get_service_principal(
    sp_id: str,
    iam_client: Annotated[DatabricksIAMAPI, Depends(get_databricks_iam_client)],
):
    """Get detailed information about a specific service principal."""
    try:
        sp = await iam_client.get_service_principal(sp_id)

        # Convert to serializable format
        if hasattr(sp, 'as_dict'):
            sp_dict = sp.as_dict()
        elif isinstance(sp, dict):
            sp_dict = sp
        else:
            sp_dict = {
                "id": getattr(sp, "id", None),
                "application_id": getattr(sp, "application_id", None),
                "display_name": getattr(sp, "display_name", None),
                "active": getattr(sp, "active", None),
            }

        return {
            "id": sp_dict.get("id"),
            "application_id": sp_dict.get("application_id"),
            "display_name": sp_dict.get("display_name"),
            "active": sp_dict.get("active", True),
            "groups": sp_dict.get("groups", []),
            "roles": sp_dict.get("roles", []),
        }

    except Exception as e:
        logger.error(f"Failed to get service principal {sp_id}: {e!s}")
        handle_databricks_error(e, f"get service principal {sp_id}")
