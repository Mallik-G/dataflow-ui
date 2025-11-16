"""
User Session API Endpoints

Manages user work sessions for workspace isolation and multi-user scenarios.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...services.user_session_service import UserSessionService
from ...services.ephemeral_environment_service import EphemeralEnvironmentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["User Sessions"])


# =============================================================================
# Request/Response Models
# =============================================================================


class CreateSessionRequest(BaseModel):
    """Request to create a new user session."""

    user_id: str = Field(..., description="User identifier")
    user_email: Optional[str] = Field(None, description="User email")
    session_name: Optional[str] = Field(None, description="Friendly session name")
    base_environment_id: str = Field("dev", description="Base environment ID")
    create_ephemeral_env: bool = Field(
        False, description="Create ephemeral environment for testing"
    )


class SessionResponse(BaseModel):
    """User session response."""

    id: str
    user_id: str
    user_email: Optional[str]
    session_name: Optional[str]
    git_branch: str
    status: str
    ephemeral_environment_id: Optional[str]
    catalog: Optional[str]
    schema: Optional[str]
    created_at: str
    commit_sha: Optional[str]
    deployment_id: Optional[str]

    class Config:
        from_attributes = True


class SaveCanvasRequest(BaseModel):
    """Request to save canvas state."""

    canvas_state: Dict[str, Any] = Field(..., description="Canvas state from frontend")


class LockFilesRequest(BaseModel):
    """Request to lock files for editing."""

    file_paths: List[str] = Field(..., description="Files to lock")


class FileConflictResponse(BaseModel):
    """File conflict response."""

    id: str
    file_path: str
    session_1_id: str
    session_2_id: str
    user_1_id: str
    user_2_id: str
    conflict_type: str
    status: str
    detected_at: str

    class Config:
        from_attributes = True


class CheckConflictsRequest(BaseModel):
    """Request to check for file conflicts."""

    file_paths: List[str] = Field(..., description="Files to check")


class EphemeralEnvResponse(BaseModel):
    """Ephemeral environment response."""

    id: str
    user_id: str
    name: str
    catalog: str
    schema: str
    status: str
    expires_at: str
    ttl_hours: int

    class Config:
        from_attributes = True


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/create", response_model=SessionResponse)
async def create_session(request: CreateSessionRequest, db: Session = Depends(get_db)):
    """
    Create a new user work session.

    Creates:
    - Isolated git branch (feature/{user_id}/{timestamp})
    - Optional ephemeral environment (user-specific catalog/schema)
    - File locking mechanism

    Use this before starting work on canvas to prevent conflicts with other users.

    Returns:
        User session with git branch and optional ephemeral environment
    """
    try:
        logger.info(f"Creating session for user {request.user_id}")

        session_service = UserSessionService(db)

        session = session_service.create_session(
            user_id=request.user_id,
            user_email=request.user_email,
            session_name=request.session_name,
            base_environment_id=request.base_environment_id,
            create_ephemeral_env=request.create_ephemeral_env,
        )

        return SessionResponse(
            id=session.id,
            user_id=session.user_id,
            user_email=session.user_email,
            session_name=session.session_name,
            git_branch=session.git_branch,
            status=session.status,
            ephemeral_environment_id=session.ephemeral_environment_id,
            catalog=session.catalog,
            schema=session.schema,
            created_at=session.created_at.isoformat(),
            commit_sha=session.commit_sha,
            deployment_id=session.deployment_id,
        )

    except Exception as e:
        logger.error(f"Failed to create session: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to create session: {str(e)}"
        )


@router.post("/{session_id}/save-canvas", response_model=SessionResponse)
async def save_canvas_state(
    session_id: str, request: SaveCanvasRequest, db: Session = Depends(get_db)
):
    """
    Save canvas state to session (auto-save).

    Allows recovery if browser crashes or user closes tab.

    Returns:
        Updated session
    """
    try:
        session_service = UserSessionService(db)

        session = session_service.save_canvas_state(
            session_id=session_id, canvas_state=request.canvas_state
        )

        return SessionResponse(
            id=session.id,
            user_id=session.user_id,
            user_email=session.user_email,
            session_name=session.session_name,
            git_branch=session.git_branch,
            status=session.status,
            ephemeral_environment_id=session.ephemeral_environment_id,
            catalog=session.catalog,
            schema=session.schema,
            created_at=session.created_at.isoformat(),
            commit_sha=session.commit_sha,
            deployment_id=session.deployment_id,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to save canvas: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to save canvas: {str(e)}"
        )


@router.post("/{session_id}/lock-files", response_model=SessionResponse)
async def lock_files(
    session_id: str, request: LockFilesRequest, db: Session = Depends(get_db)
):
    """
    Lock files for editing in this session.

    Prevents other users from editing the same files concurrently.

    Returns:
        Updated session
    """
    try:
        session_service = UserSessionService(db)

        session = session_service.lock_files(
            session_id=session_id, file_paths=request.file_paths
        )

        return SessionResponse(
            id=session.id,
            user_id=session.user_id,
            user_email=session.user_email,
            session_name=session.session_name,
            git_branch=session.git_branch,
            status=session.status,
            ephemeral_environment_id=session.ephemeral_environment_id,
            catalog=session.catalog,
            schema=session.schema,
            created_at=session.created_at.isoformat(),
            commit_sha=session.commit_sha,
            deployment_id=session.deployment_id,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to lock files: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to lock files: {str(e)}")


@router.post(
    "/{session_id}/check-conflicts", response_model=List[FileConflictResponse]
)
async def check_file_conflicts(
    session_id: str, request: CheckConflictsRequest, db: Session = Depends(get_db)
):
    """
    Check if files are locked by other users (conflict detection).

    Call this before committing to git to detect conflicts early.

    Returns:
        List of file conflicts (empty if no conflicts)
    """
    try:
        session_service = UserSessionService(db)

        conflicts = session_service.check_file_conflicts(
            session_id=session_id, file_paths=request.file_paths
        )

        return [
            FileConflictResponse(
                id=conflict.id,
                file_path=conflict.file_path,
                session_1_id=conflict.session_1_id,
                session_2_id=conflict.session_2_id,
                user_1_id=conflict.user_1_id,
                user_2_id=conflict.user_2_id,
                conflict_type=conflict.conflict_type,
                status=conflict.status,
                detected_at=conflict.detected_at.isoformat(),
            )
            for conflict in conflicts
        ]

    except Exception as e:
        logger.error(f"Failed to check conflicts: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to check conflicts: {str(e)}"
        )


@router.post("/{session_id}/abandon", response_model=SessionResponse)
async def abandon_session(session_id: str, db: Session = Depends(get_db)):
    """
    Abandon session (cancel work, no commit).

    Releases file locks and marks session as abandoned.

    Returns:
        Updated session
    """
    try:
        session_service = UserSessionService(db)

        session = session_service.abandon_session(session_id=session_id)

        return SessionResponse(
            id=session.id,
            user_id=session.user_id,
            user_email=session.user_email,
            session_name=session.session_name,
            git_branch=session.git_branch,
            status=session.status,
            ephemeral_environment_id=session.ephemeral_environment_id,
            catalog=session.catalog,
            schema=session.schema,
            created_at=session.created_at.isoformat(),
            commit_sha=session.commit_sha,
            deployment_id=session.deployment_id,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to abandon session: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to abandon session: {str(e)}"
        )


@router.get("/active", response_model=List[SessionResponse])
async def get_active_sessions(
    user_id: Optional[str] = None, db: Session = Depends(get_db)
):
    """
    Get active sessions (optionally filtered by user).

    Returns:
        List of active sessions
    """
    try:
        session_service = UserSessionService(db)

        sessions = session_service.get_active_sessions(user_id=user_id)

        return [
            SessionResponse(
                id=session.id,
                user_id=session.user_id,
                user_email=session.user_email,
                session_name=session.session_name,
                git_branch=session.git_branch,
                status=session.status,
                ephemeral_environment_id=session.ephemeral_environment_id,
                catalog=session.catalog,
                schema=session.schema,
                created_at=session.created_at.isoformat(),
                commit_sha=session.commit_sha,
                deployment_id=session.deployment_id,
            )
            for session in sessions
        ]

    except Exception as e:
        logger.error(f"Failed to get active sessions: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get sessions: {str(e)}"
        )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, db: Session = Depends(get_db)):
    """
    Get session by ID.

    Returns:
        Session details
    """
    try:
        from ...models.db.user_sessions import UserSession

        session = db.query(UserSession).filter_by(id=session_id).first()

        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        return SessionResponse(
            id=session.id,
            user_id=session.user_id,
            user_email=session.user_email,
            session_name=session.session_name,
            git_branch=session.git_branch,
            status=session.status,
            ephemeral_environment_id=session.ephemeral_environment_id,
            catalog=session.catalog,
            schema=session.schema,
            created_at=session.created_at.isoformat(),
            commit_sha=session.commit_sha,
            deployment_id=session.deployment_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get session: {str(e)}"
        )


# Ephemeral Environment Endpoints

@router.post("/{session_id}/extend-ttl", response_model=EphemeralEnvResponse)
async def extend_ephemeral_ttl(
    session_id: str, additional_hours: int = 24, db: Session = Depends(get_db)
):
    """
    Extend TTL of ephemeral environment.

    Args:
        session_id: Session ID
        additional_hours: Hours to add to TTL (default 24)

    Returns:
        Updated ephemeral environment
    """
    try:
        from ...models.db.user_sessions import UserSession

        # Get session
        session = db.query(UserSession).filter_by(id=session_id).first()

        if not session or not session.ephemeral_environment_id:
            raise HTTPException(
                status_code=404, detail="Session or ephemeral environment not found"
            )

        ephemeral_service = EphemeralEnvironmentService(db)

        ephemeral_env = await ephemeral_service.extend_ttl(
            ephemeral_env_id=session.ephemeral_environment_id,
            additional_hours=additional_hours,
        )

        return EphemeralEnvResponse(
            id=ephemeral_env.id,
            user_id=ephemeral_env.user_id,
            name=ephemeral_env.name,
            catalog=ephemeral_env.catalog,
            schema=ephemeral_env.schema,
            status=ephemeral_env.status,
            expires_at=ephemeral_env.expires_at.isoformat(),
            ttl_hours=ephemeral_env.ttl_hours,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to extend TTL: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to extend TTL: {str(e)}")
