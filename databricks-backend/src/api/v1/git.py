"""Git operations API endpoints for Nexa X360 CI/CD platform.

This module provides RESTful API endpoints to interact with Git repositories,
supporting operations like branching, committing, and managing pull requests.
"""

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.dependencies import get_active_environment
from ...models.db.deployments import Environment
from ...models.api.git import (
    BranchListResponse,
    CommitFilesRequest,
    CommitFilesResponse,
    CreateBranchRequest,
    CreateBranchResponse,
    CreatePRRequest,
    CreatePRResponse,
    MergePRRequest,
    MergePRResponse,
)
from ...models.api.deployments import DeploymentCreateRequest
from .deployments import create_deployment as create_deployment_endpoint
from ...services import git_service
from ...services.gitops_service import GitOpsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/git", tags=["Git Repository Management"])


# =============================================================================
# DEPENDENCIES
# =============================================================================


def get_git_client_dep(
    db: Annotated[Session, Depends(get_db)],
    env: Annotated[Environment, Depends(get_active_environment)],
) -> GitOpsService:
    """Dependency to get a configured Git service client bound to the active Environment.

    The active environment is resolved via get_active_environment which supports the
    X-Environment-Id header override. This keeps behavior consistent across routers.
    """
    try:
        return git_service.get_git_client_for_env(env)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to initialize Git client: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Git service is not available.",
        )


# =============================================================================
# BRANCH OPERATIONS
# =============================================================================


@router.post(
    "/branches",
    response_model=CreateBranchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new branch",
)
async def create_branch(
    request: CreateBranchRequest,
    git_client: Annotated[GitOpsService, Depends(get_git_client_dep)],
):
    """Create a new branch from a specified source branch."""
    try:
        ok = await git_client.create_branch(
            branch_name=request.name, source_branch=request.source
        )
        if not ok:
            # Try direct provider call to capture detailed error
            try:
                await asyncio.to_thread(
                    git_client.git_provider.create_branch, request.name, request.source
                )
            except Exception as pe:
                msg = f"Failed to create branch via provider: {pe}"
                logger.error(msg, exc_info=True)
                raise HTTPException(status_code=502, detail=msg)
            # If provider call did not raise but ok was False, still return 502
            raise HTTPException(status_code=502, detail="Failed to create branch")
        logger.info(f"Created branch: {request.name} from {request.source}")
        return CreateBranchResponse(
            branch=request.name,
            source=request.source,
            sha=None,
            message=f"Branch {request.name} created successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create branch {request.name}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create branch: {e!s}",
        )


@router.get("/branches", response_model=BranchListResponse, summary="List branches")
async def list_branches(
    git_client: Annotated[GitOpsService, Depends(get_git_client_dep)],
):
    """List branches for the configured repository."""
    try:
        branches = await git_client.list_branches()
        return BranchListResponse(items=branches, count=len(branches))
    except Exception as e:
        logger.error("Failed to list branches", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/files", response_model=CommitFilesResponse, summary="Commit multiple files"
)
async def commit_files(
    request: CommitFilesRequest,
    git_client: Annotated[GitOpsService, Depends(get_git_client_dep)],
):
    """Commit one or more files to a specific branch."""
    try:
        files_to_commit = [f.dict() for f in request.files]

        results = await git_client.commit_files(
            files=files_to_commit,
            message=request.message,
            branch=request.branch,
            assume_base64=True,
        )

        failed_files = [r for r in results if r.get("status") == "error"]
        if failed_files:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to commit {len(failed_files)} files: {failed_files}",
            )

        # The underlying service commits files one by one, so there isn't a single commit SHA.
        # A more advanced implementation could create a single commit with multiple files.
        return CommitFilesResponse(
            branch=request.branch,
            commit_sha=None,
            files_count=len(request.files),
            message="Files committed successfully.",
        )
    except Exception as e:
        logger.error(f"Failed to commit files to branch {request.branch}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit files: {e!s}",
        )


# =============================================================================
# PULL REQUEST OPERATIONS
# =============================================================================


@router.post(
    "/pull-requests", response_model=CreatePRResponse, summary="Create a pull request"
)
async def create_pr(
    request: CreatePRRequest,
    git_client: Annotated[GitOpsService, Depends(get_git_client_dep)],
):
    """Create a pull request."""
    try:
        pr = await git_client.create_pull_request_async(
            from_branch=request.from_branch,
            to_branch=request.to_branch,
            title=request.title,
            body=request.body or "",
        )
        if pr and (
            pr.get("id") or pr.get("number") or pr.get("pullRequestId") or pr.get("iid")
        ):
            pr_id_val = (
                pr.get("number")
                or pr.get("id")
                or pr.get("pullRequestId")
                or pr.get("iid")
            )
            pr_id_int: int = int(str(pr_id_val)) if pr_id_val is not None else 0
            url_val = pr.get("html_url") or pr.get("web_url") or pr.get("url") or ""
            return CreatePRResponse(
                pr_id=pr_id_int,
                url=str(url_val),
                from_branch=request.from_branch,
                to_branch=request.to_branch,
                title=request.title,
                message="Pull request created successfully.",
            )
        else:
            raise HTTPException(
                status_code=500, detail=f"Failed to create pull request: {pr}"
            )
    except Exception as e:
        logger.error(f"Failed to create pull request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/pull-requests/{pr_id}/merge",
    response_model=MergePRResponse,
    summary="Merge a pull request",
)
async def merge_pr(
    pr_id: int,
    request: MergePRRequest,
    git_client: Annotated[GitOpsService, Depends(get_git_client_dep)],
    db: Annotated[Session, Depends(get_db)],
    env: Annotated[Environment, Depends(get_active_environment)],
    background_tasks: BackgroundTasks,
    auto_deploy: bool = Query(
        False, description="Trigger a deployment after a successful merge"
    ),
):
    """Merge a pull request and optionally trigger a deployment on success."""
    try:
        success = await git_client.merge_pull_request_async(
            pr_id=pr_id,
            commit_title=request.commit_title,
            commit_message=request.commit_message or "",
        )
        if success:
            # On success, optionally trigger deployment against the environment's target branch
            if auto_deploy:
                target_branch = (
                    getattr(env, "target_git_branch", None)
                    or (env.configuration or {}).get("git_branch")
                    or "main"
                )
                try:
                    dc_req = DeploymentCreateRequest(
                        deployment_name=None,
                        git_branch=target_branch,
                        git_commit_sha=None,
                        base_branch="main",
                        from_commit_sha=None,
                        to_commit_sha=None,
                        use_merge_commit_detection=False,
                        use_incremental_deployment=True,
                        initiated_by=f"git-merge:{pr_id}",
                        force_deploy=False,
                    )
                    await create_deployment_endpoint(dc_req, background_tasks, db)
                    logger.info(
                        f"Auto-deploy triggered for branch '{target_branch}' after PR #{pr_id} merge."
                    )
                except Exception as de:
                    logger.error(f"Auto-deploy after merge failed: {de}", exc_info=True)
            return MergePRResponse(
                pr_id=pr_id,
                merged=True,
                sha=None,
                message=f"Pull request #{pr_id} merged successfully.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Merge operation failed. Check logs for details.",
            )
    except Exception as e:
        logger.error(f"Failed to merge PR #{pr_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to merge pull request: {e!s}",
        )
