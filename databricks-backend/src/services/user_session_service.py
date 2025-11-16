"""
User Session Service

Manages user work sessions for workspace isolation and conflict prevention.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.db.user_sessions import UserSession, FileConflict
from ..models.db import Environment
from ..services.ephemeral_environment_service import EphemeralEnvironmentService
from ..providers.git_provider_interface import GitProviderInterface

logger = logging.getLogger(__name__)


class UserSessionService:
    """Service for managing user sessions and preventing conflicts."""

    def __init__(self, db: Session):
        self.db = db
        self.ephemeral_service = EphemeralEnvironmentService(db)

    def create_session(
        self,
        user_id: str,
        user_email: Optional[str] = None,
        session_name: Optional[str] = None,
        base_environment_id: Optional[str] = "dev",
        create_ephemeral_env: bool = False,
    ) -> UserSession:
        """
        Create a new user session with isolated workspace.

        Args:
            user_id: User identifier
            user_email: User email (optional)
            session_name: Friendly session name
            base_environment_id: Base environment ID
            create_ephemeral_env: Create ephemeral environment for testing

        Returns:
            UserSession record
        """
        logger.info(f"Creating session for user {user_id}")

        # Generate unique session ID
        session_id = f"session-{uuid.uuid4()}"

        # Generate git branch name: feature/{user_id}/{timestamp}
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_user_id = "".join(c for c in user_id if c.isalnum() or c == "_")[:20]
        git_branch = f"feature/{safe_user_id}/{timestamp}"

        # Create session record
        session = UserSession(
            id=session_id,
            user_id=user_id,
            user_email=user_email,
            session_name=session_name or f"{user_id}'s workspace",
            git_branch=git_branch,
            base_branch="develop",
            status="active",
            created_at=datetime.now(timezone.utc),
            last_activity_at=datetime.now(timezone.utc),
        )

        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        logger.info(
            f"Created session {session_id} for user {user_id} (branch: {git_branch})"
        )

        # Create ephemeral environment if requested
        if create_ephemeral_env and base_environment_id:
            try:
                ephemeral_env = self.ephemeral_service.create_ephemeral_environment(
                    user_id=user_id,
                    session_id=session_id,
                    base_environment_id=base_environment_id,
                    ttl_hours=24,
                )

                session.ephemeral_environment_id = ephemeral_env.id
                session.catalog = ephemeral_env.catalog
                session.schema = ephemeral_env.schema
                self.db.commit()

                logger.info(
                    f"Created ephemeral environment {ephemeral_env.id} for session {session_id}"
                )

            except Exception as e:
                logger.error(f"Failed to create ephemeral environment: {e}")
                # Session still valid without ephemeral environment

        return session

    def save_canvas_state(
        self, session_id: str, canvas_state: Dict[str, Any]
    ) -> UserSession:
        """
        Save canvas state to session (auto-save).

        Args:
            session_id: Session ID
            canvas_state: Canvas state from frontend

        Returns:
            Updated session
        """
        session = self.db.query(UserSession).filter_by(id=session_id).first()

        if not session:
            raise ValueError(f"Session {session_id} not found")

        session.canvas_state = canvas_state
        session.last_activity_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(session)

        return session

    def lock_files(self, session_id: str, file_paths: List[str]) -> UserSession:
        """
        Lock files for editing in this session.

        Args:
            session_id: Session ID
            file_paths: List of file paths to lock

        Returns:
            Updated session
        """
        session = self.db.query(UserSession).filter_by(id=session_id).first()

        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Add files to locked list (deduplicate)
        current_locks = set(session.locked_files or [])
        current_locks.update(file_paths)
        session.locked_files = list(current_locks)

        session.last_activity_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(session)

        logger.info(f"Locked {len(file_paths)} files in session {session_id}")

        return session

    def check_file_conflicts(
        self, session_id: str, file_paths: List[str]
    ) -> List[FileConflict]:
        """
        Check if files are locked by other sessions (conflict detection).

        Args:
            session_id: Current session ID
            file_paths: Files to check

        Returns:
            List of file conflicts (empty if no conflicts)
        """
        # Find other active sessions with locked files
        other_sessions = (
            self.db.query(UserSession)
            .filter(
                and_(
                    UserSession.id != session_id,
                    UserSession.status == "active",
                )
            )
            .all()
        )

        conflicts = []

        for file_path in file_paths:
            for other_session in other_sessions:
                if file_path in (other_session.locked_files or []):
                    # Create or get existing conflict
                    conflict = self._create_or_get_conflict(
                        file_path=file_path,
                        session_1_id=session_id,
                        session_2_id=other_session.id,
                    )
                    conflicts.append(conflict)

        logger.info(
            f"Found {len(conflicts)} file conflicts for session {session_id}"
        )

        return conflicts

    def mark_session_committed(
        self, session_id: str, commit_sha: str
    ) -> UserSession:
        """
        Mark session as committed (files committed to git).

        Args:
            session_id: Session ID
            commit_sha: Git commit SHA

        Returns:
            Updated session
        """
        session = self.db.query(UserSession).filter_by(id=session_id).first()

        if not session:
            raise ValueError(f"Session {session_id} not found")

        session.status = "committed"
        session.commit_sha = commit_sha
        session.committed_at = datetime.now(timezone.utc)

        # Release file locks
        session.locked_files = []

        self.db.commit()
        self.db.refresh(session)

        logger.info(f"Session {session_id} marked as committed ({commit_sha})")

        return session

    def mark_session_deployed(
        self, session_id: str, deployment_id: str
    ) -> UserSession:
        """
        Mark session as deployed.

        Args:
            session_id: Session ID
            deployment_id: Deployment ID

        Returns:
            Updated session
        """
        session = self.db.query(UserSession).filter_by(id=session_id).first()

        if not session:
            raise ValueError(f"Session {session_id} not found")

        session.status = "deployed"
        session.deployment_id = deployment_id
        session.deployed_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(session)

        logger.info(f"Session {session_id} marked as deployed ({deployment_id})")

        return session

    def abandon_session(self, session_id: str) -> UserSession:
        """
        Abandon session (user cancelled, no commit).

        Args:
            session_id: Session ID

        Returns:
            Updated session
        """
        session = self.db.query(UserSession).filter_by(id=session_id).first()

        if not session:
            raise ValueError(f"Session {session_id} not found")

        session.status = "abandoned"

        # Release file locks
        session.locked_files = []

        self.db.commit()
        self.db.refresh(session)

        logger.info(f"Session {session_id} abandoned")

        return session

    def get_active_sessions(self, user_id: Optional[str] = None) -> List[UserSession]:
        """
        Get active sessions (optionally filtered by user).

        Args:
            user_id: Filter by user ID (optional)

        Returns:
            List of active sessions
        """
        query = self.db.query(UserSession).filter_by(status="active")

        if user_id:
            query = query.filter_by(user_id=user_id)

        sessions = query.order_by(UserSession.created_at.desc()).all()

        return sessions

    # -------------------------------------------------------------------------
    # Private Helper Methods
    # -------------------------------------------------------------------------

    def _create_or_get_conflict(
        self, file_path: str, session_1_id: str, session_2_id: str
    ) -> FileConflict:
        """
        Create or get existing file conflict.

        Args:
            file_path: File path
            session_1_id: First session ID
            session_2_id: Second session ID

        Returns:
            FileConflict record
        """
        # Check if conflict already exists
        existing_conflict = (
            self.db.query(FileConflict)
            .filter(
                and_(
                    FileConflict.file_path == file_path,
                    FileConflict.status == "unresolved",
                    (
                        (
                            (FileConflict.session_1_id == session_1_id)
                            & (FileConflict.session_2_id == session_2_id)
                        )
                        | (
                            (FileConflict.session_1_id == session_2_id)
                            & (FileConflict.session_2_id == session_1_id)
                        )
                    ),
                )
            )
            .first()
        )

        if existing_conflict:
            return existing_conflict

        # Get sessions to get user IDs
        session_1 = self.db.query(UserSession).filter_by(id=session_1_id).first()
        session_2 = self.db.query(UserSession).filter_by(id=session_2_id).first()

        # Create new conflict
        conflict = FileConflict(
            id=f"conflict-{uuid.uuid4()}",
            file_path=file_path,
            session_1_id=session_1_id,
            session_2_id=session_2_id,
            user_1_id=session_1.user_id if session_1 else "unknown",
            user_2_id=session_2.user_id if session_2 else "unknown",
            conflict_type="concurrent_modification",
            status="unresolved",
            detected_at=datetime.now(timezone.utc),
        )

        self.db.add(conflict)
        self.db.commit()
        self.db.refresh(conflict)

        logger.warning(
            f"File conflict detected: {file_path} between sessions {session_1_id} and {session_2_id}"
        )

        return conflict
