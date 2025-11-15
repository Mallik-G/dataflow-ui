"""Databricks Repos API endpoints for workspace Git synchronization.

This module provides RESTful API endpoints to interact with Databricks Repos,
allowing users to manage and synchronize Git repositories in the workspace.
"""

import logging
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ...core.config import settings
from ...core.dependencies import get_active_environment
from ...models.db.deployments import Environment
from ...models.api.repos import RepoListResponse, RepoResponse
from ...services.databricks.base_client import DatabricksAPIError
from ...services.databricks.databricks_repos_api import (
    DatabricksReposAPI,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repos", tags=["Repository Management"])


def get_repos_api_client(
    environment: Annotated[Environment, Depends(get_active_environment)],
) -> DatabricksReposAPI:
    """Dependency to get a configured Databricks Repos API client."""
    host = environment.databricks_host
    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )

    return DatabricksReposAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


def _convert_repo_response(repo_data: dict[str, Any]) -> RepoResponse:
    """Convert raw Databricks API repo response to RepoResponse model."""
    return RepoResponse(
        id=repo_data.get("id"),
        path=repo_data.get("path", ""),
        url=repo_data.get("url", ""),
        provider=repo_data.get("provider", ""),
        head_commit_id=repo_data.get("head_commit_id"),
        branch=repo_data.get("branch"),
        status=repo_data.get("status"),
    )


# =============================================================================
# REPOS ENDPOINTS
# =============================================================================


@router.get(
    "/",
    response_model=RepoListResponse,
    summary="List workspace repos",
    description="Get all repos in the Databricks workspace",
)
async def list_repos(
    repos_api: Annotated[DatabricksReposAPI, Depends(get_repos_api_client)],
    path_prefix: Optional[str] = Query(
        None, description="Filter repos by workspace path prefix"
    ),
):
    """List all repos in the workspace."""
    try:
        repos_iterator = await repos_api.list_repos(path_prefix=path_prefix)
        repos = [_convert_repo_response(repo.as_dict()) for repo in repos_iterator]
        return RepoListResponse(repos=repos, total_count=len(repos))

    except DatabricksAPIError as e:
        logger.error(f"Failed to list repos: {e}")
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list repos: {e.message}",
        )


@router.get(
    "/{repo_id}",
    response_model=RepoResponse,
    summary="Get repo details",
    description="Get details of a specific repo by ID",
)
async def get_repo(
    repo_id: int,
    repos_api: Annotated[DatabricksReposAPI, Depends(get_repos_api_client)],
):
    """Get details of a specific repo."""
    try:
        response = await repos_api.get_repo(repo_id)
        return _convert_repo_response(response.as_dict())

    except DatabricksAPIError as e:
        logger.error(f"Failed to get repo {repo_id}: {e}")
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get repo: {e.message}",
        )


class CreateRepoRequest(BaseModel):
    """Request model for creating a new repo."""

    url: str = Field(..., description="Git repository URL")
    provider: str = Field(
        ..., description="Git provider (github, gitlab, azure_devops)"
    )
    path: Optional[str] = Field(None, description="Workspace path for the repo")


@router.post(
    "/",
    response_model=RepoResponse,
    summary="Create repo",
    description="Create a new repo from a Git repository URL",
)
async def create_repo(
    request: CreateRepoRequest,
    repos_api: Annotated[DatabricksReposAPI, Depends(get_repos_api_client)],
):
    """Create a new repo from a remote Git URL."""
    try:
        logger.info(
            f"Creating repo from {request.url} with provider {request.provider}"
        )

        response = await repos_api.create_repo(
            url=request.url,
            provider=request.provider,
            path=request.path,
        )

        return _convert_repo_response(response.as_dict())

    except DatabricksAPIError as e:
        logger.error(f"Failed to create repo from {request.url}: {e}")
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create repo: {e.message}",
        )


class UpdateRepoRequest(BaseModel):
    """Request model for updating repo reference."""

    branch: Optional[str] = Field(None, description="Branch to checkout")
    tag: Optional[str] = Field(None, description="Tag to checkout")


@router.patch(
    "/{repo_id}",
    response_model=RepoResponse,
    summary="Update repo reference",
    description="Update the checked-out branch or tag of a repo",
)
async def update_repo(
    repo_id: int,
    request: UpdateRepoRequest,
    repos_api: Annotated[DatabricksReposAPI, Depends(get_repos_api_client)],
):
    """Update a repo's checked-out reference (branch or tag)."""
    try:
        if not request.branch and not request.tag:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either branch or tag must be specified",
            )

        logger.info(
            f"Updating repo {repo_id} to branch={request.branch} tag={request.tag}"
        )

        await repos_api.update_repo(
            repo_id=repo_id,
            branch=request.branch,
            tag=request.tag,
        )

        # After update, get the repo details to return the updated state
        updated_repo = await repos_api.get_repo(repo_id)
        return _convert_repo_response(updated_repo.as_dict())

    except DatabricksAPIError as e:
        logger.error(f"Failed to update repo {repo_id}: {e}")
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update repo: {e.message}",
        )


@router.delete(
    "/{repo_id}",
    summary="Delete repo",
    description="Delete a repo from the workspace",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_repo(
    repo_id: int,
    repos_api: Annotated[DatabricksReposAPI, Depends(get_repos_api_client)],
):
    """Delete a repo from the workspace."""
    try:
        logger.info(f"Deleting repo {repo_id}")
        await repos_api.delete_repo(repo_id)
        return

    except DatabricksAPIError as e:
        logger.error(f"Failed to delete repo {repo_id}: {e}")
        raise HTTPException(
            status_code=e.status_code or status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete repo: {e.message}",
        )


# Other endpoints like sync_workspace_repos and list_repo_folders are more complex
# and seem to involve more business logic than direct API mapping.
# They are left as is for now but should be reviewed for alignment with the new architecture.


@router.get(
    "/health",
    summary="Check repos service health",
    description="Check the health of the Databricks Repos API connectivity",
)
async def get_repos_health(
    repos_api: Annotated[DatabricksReposAPI, Depends(get_repos_api_client)],
):
    """Check repos service health and connectivity."""
    try:
        logger.info("Performing repos service health check")
        await repos_api.list_repos()
        return {"status": "healthy", "message": "Repos service is healthy"}

    except Exception as e:
        logger.error(f"Repos health check failed: {e!s}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Repos health check failed: {e!s}",
        )
