"""Environment management API endpoints for Nexa Databricks API.

This module provides RESTful API endpoints to create, manage, and monitor
deployment environments for Databricks workspaces.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from ...core.database import get_db
from ...models.api.environments import (
    EnvironmentCreateRequest,
    EnvironmentResponse,
    EnvironmentUpdateRequest,
)
from ...models.db import Environment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/environments", tags=["Environment Management"])

# =============================================================================
# ENVIRONMENT ENDPOINTS
# =============================================================================


@router.post(
    "/",
    response_model=EnvironmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create environment",
    description="Create a new deployment environment",
)
async def create_environment(
    request: EnvironmentCreateRequest, db: Annotated[Session, Depends(get_db)]
):
    """Create a new deployment environment.

    Args:
        request: The environment creation request.
        db: The database session.

    Returns:
        The created environment object.
    """
    name_col: ColumnElement[str] = Environment.__table__.c.name  # type: ignore[attr-defined]
    existing = db.query(Environment).filter(name_col == request.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'Environment with name "{request.name}" already exists',
        )

    config = request.configuration or {}

    environment = Environment(
        id=str(uuid.uuid4()),
        name=request.name,
        description=request.description,
        platform=request.platform or "databricks",
        protected=bool(request.protected),
        # Git fields (now top-level per spec)
        git_provider=request.git_provider,
        git_repository=request.git_repository or config.get("git_repository"),
        target_git_branch=request.target_git_branch or config.get("git_branch"),
        # Persist configuration and selected denormalized fields
        configuration=config,
        is_active=True if request.is_active is None else bool(request.is_active),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        created_by=request.created_by,
        updated_by=request.created_by,
        # Denormalized fields for convenience (databricks)
        databricks_host=config.get("host") or config.get("databricks_host"),
        workspace_id=config.get("workspace_id"),
        workspace_folder=config.get("workspace_repos_folder")
        or config.get("workspace_folder"),
        secret_scope=config.get("secret_scope"),
        display_name=request.name.replace("-", " ").title(),
    )

    db.add(environment)
    db.commit()
    db.refresh(environment)

    logger.info(f"Created environment: {request.name} ({environment.id})")
    return _to_environment_response(environment)


@router.get(
    "/",
    response_model=list[EnvironmentResponse],
    summary="List environments",
    description="Get all deployment environments",
)
async def list_environments(db: Annotated[Session, Depends(get_db)]):
    """List all deployment environments.

    Args:
        db: The database session.

    Returns:
        List of environment objects.
    """
    environments = db.query(Environment).all()
    return [_to_environment_response(env) for env in environments]


# =============================================================================
# NEW: Retrieve single environment (added to align with CLI `nexa environments get`)
# =============================================================================
@router.get(
    "/{environment_id}",
    response_model=EnvironmentResponse,
    summary="Get environment",
    description="Get a deployment environment by ID",
)
async def get_environment(
    environment_id: str,
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieve a single environment by ID."""
    id_col: ColumnElement[str] = Environment.__table__.c.id  # type: ignore[attr-defined]
    env = db.query(Environment).filter(id_col == environment_id).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found",
        )
    return _to_environment_response(env)
# =============================================================================
# END NEW ENDPOINT
# =============================================================================


@router.patch(
    "/{environment_id}",
    response_model=EnvironmentResponse,
    summary="Update environment",
    description="Update an existing deployment environment",
)
async def update_environment(
    environment_id: str,
    request: EnvironmentUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Update fields of an existing environment.

    - Validates name uniqueness when renaming
    - Syncs select configuration keys into top-level columns
    """
    # Fetch existing environment
    id_col: ColumnElement[str] = Environment.__table__.c.id  # type: ignore[attr-defined]
    env = db.query(Environment).filter(id_col == environment_id).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found"
        )

    # Name conflict check
    if request.name and request.name != env.name:
        name_col: ColumnElement[str] = Environment.__table__.c.name  # type: ignore[attr-defined]
        existing = db.query(Environment).filter(name_col == request.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f'Environment with name "{request.name}" already exists',
            )
        env.name = request.name
        env.display_name = request.name.replace("-", " ").title()

    # Simple field updates
    if request.description is not None:
        env.description = request.description
    if request.platform is not None:
        env.platform = request.platform
    if request.protected is not None:
        env.protected = bool(request.protected)
    if request.git_provider is not None:
        env.git_provider = request.git_provider
    if request.git_repository is not None:
        env.git_repository = request.git_repository
    if request.target_git_branch is not None:
        env.target_git_branch = request.target_git_branch
    if request.is_active is not None:
        env.is_active = bool(request.is_active)
    if request.updated_by is not None:
        env.updated_by = request.updated_by

    # Configuration update and top-level sync
    if request.configuration is not None:
        env.configuration = request.configuration
        cfg = request.configuration or {}
        # Sync denormalized fields
        host = cfg.get("host") or cfg.get("databricks_host")
        if host is not None:
            env.databricks_host = host
        if "workspace_id" in cfg:
            env.workspace_id = cfg.get("workspace_id")
        if "secret_scope" in cfg:
            env.secret_scope = cfg.get("secret_scope")
        if "workspace_repos_folder" in cfg or "workspace_folder" in cfg:
            env.workspace_folder = cfg.get("workspace_repos_folder") or cfg.get(
                "workspace_folder"
            )
        if "git_provider" in cfg and not request.git_provider:
            env.git_provider = cfg.get("git_provider")
        if "git_repository" in cfg and not request.git_repository:
            env.git_repository = cfg.get("git_repository")
        if "git_branch" in cfg and not request.target_git_branch:
            env.target_git_branch = cfg.get("git_branch")

    env.updated_at = datetime.now(timezone.utc)

    db.add(env)
    db.commit()
    db.refresh(env)

    logger.info(f"Updated environment: {env.id} ({env.name})")
    return _to_environment_response(env)


@router.delete(
    "/{environment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete environment",
    description="Delete an existing deployment environment",
)
async def delete_environment(
    environment_id: str,
    db: Annotated[Session, Depends(get_db)],
):
    """Delete an environment by ID."""
    id_col: ColumnElement[str] = Environment.__table__.c.id  # type: ignore[attr-defined]
    env = db.query(Environment).filter(id_col == environment_id).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found"
        )

    db.delete(env)
    db.commit()
    logger.info(f"Deleted environment: {environment_id}")
    # 204 No Content


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def _to_environment_response(environment: Environment) -> EnvironmentResponse:
    """Convert a database Environment model to an EnvironmentResponse.

    Args:
        environment: The database Environment model.

    Returns:
        The EnvironmentResponse model.
    """
    return EnvironmentResponse.model_validate(
        {
            "id": environment.id,
            "name": environment.name,
            "description": environment.description,
            "protected": environment.protected,
            "platform": environment.platform,
            "gitProvider": environment.git_provider,
            "gitRepository": environment.git_repository,
            "targetGitBranch": environment.target_git_branch,
            "configuration": environment.configuration or {},
            "isActive": environment.is_active,
            "createdAt": environment.created_at,
            "updatedAt": environment.updated_at,
            "createdBy": environment.created_by,
            "updatedBy": environment.updated_by,
        }
    )
