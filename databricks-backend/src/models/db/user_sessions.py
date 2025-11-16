"""User Session Models for Workspace Isolation."""

from datetime import datetime, timezone
from typing import Optional, List

from sqlmodel import SQLModel, Field, Index, JSON
from sqlalchemy import Text


class UserSession(SQLModel, table=True):
    """
    Isolates user work sessions to prevent concurrent editing conflicts.

    Each user gets their own workspace with:
    - Dedicated git branch (feature/{user_id}/{session_id})
    - Dedicated schema in ephemeral environment
    - File locks to prevent conflicts
    """

    __tablename__ = "user_sessions"

    id: str = Field(primary_key=True)  # session-uuid
    user_id: str = Field(index=True)  # User identifier (email, username, etc.)
    user_email: Optional[str] = Field(default=None)

    # Session metadata
    session_name: Optional[str] = Field(default=None)  # "Customer Pipeline v2"
    description: Optional[str] = Field(default=None, sa_type=Text)

    # Workspace isolation
    git_branch: str  # feature/{user_id}/{session_id}
    base_branch: str = Field(default="develop")  # Branch created from

    # Ephemeral environment (if created)
    ephemeral_environment_id: Optional[str] = Field(
        default=None, foreign_key="environments.id"
    )
    catalog: Optional[str] = Field(default=None)  # User-specific catalog
    schema: Optional[str] = Field(default=None)  # User-specific schema

    # Canvas state (saved work)
    canvas_state: Optional[dict] = Field(default=None, sa_type=JSON)

    # File locks (files being edited)
    locked_files: List[str] = Field(default_factory=list, sa_type=JSON)

    # Status
    status: str = Field(
        default="active"
    )  # active, committed, deployed, abandoned, expired

    # Lifecycle
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    committed_at: Optional[datetime] = Field(default=None)
    deployed_at: Optional[datetime] = Field(default=None)
    expires_at: Optional[datetime] = Field(
        default=None
    )  # Auto-cleanup ephemeral resources

    # Results
    commit_sha: Optional[str] = Field(default=None)
    deployment_id: Optional[str] = Field(default=None)

    def __repr__(self):
        return f"<UserSession(id='{self.id}', user='{self.user_id}', status='{self.status}')>"


class EphemeralEnvironment(SQLModel, table=True):
    """
    User-specific ephemeral environments for isolated testing.

    Auto-provisioned and auto-cleaned up after TTL expires.
    """

    __tablename__ = "ephemeral_environments"

    id: str = Field(primary_key=True)  # ephemeral-uuid
    user_id: str = Field(index=True)
    session_id: str = Field(foreign_key="user_sessions.id")

    # Environment naming
    name: str  # {user_id}_ephemeral_{timestamp}
    display_name: str  # "John Doe's Test Environment"

    # Resource allocation
    catalog: str  # User-specific catalog (e.g., dev_user123)
    schema: str  # User-specific schema (e.g., ephemeral_20250115)
    warehouse_id: Optional[str] = Field(default=None)  # Dedicated warehouse (optional)

    # Base environment (inherited from)
    base_environment_id: str = Field(foreign_key="environments.id")

    # Lifecycle
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime  # Auto-cleanup time
    ttl_hours: int = Field(default=24)  # Time-to-live in hours

    # Status
    status: str = Field(
        default="provisioning"
    )  # provisioning, active, expiring, expired, deleted

    # Cleanup
    auto_cleanup: bool = Field(default=True)
    cleanup_at: Optional[datetime] = Field(default=None)

    def __repr__(self):
        return f"<EphemeralEnvironment(id='{self.id}', user='{self.user_id}', status='{self.status}')>"


class FileConflict(SQLModel, table=True):
    """
    Tracks file conflicts when multiple users edit the same files.
    """

    __tablename__ = "file_conflicts"

    id: str = Field(primary_key=True)
    file_path: str = Field(index=True)

    # Conflicting sessions
    session_1_id: str = Field(foreign_key="user_sessions.id")
    session_2_id: str = Field(foreign_key="user_sessions.id")

    # Users involved
    user_1_id: str
    user_2_id: str

    # Conflict details
    conflict_type: str  # concurrent_modification, file_lock, branch_conflict
    base_version_sha: Optional[str] = Field(default=None)  # Git SHA of base

    # Resolution
    status: str = Field(
        default="unresolved"
    )  # unresolved, resolved, user_1_wins, user_2_wins, merged
    resolved_at: Optional[datetime] = Field(default=None)
    resolved_by: Optional[str] = Field(default=None)
    resolution_notes: Optional[str] = Field(default=None, sa_type=Text)

    # Timestamps
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<FileConflict(file='{self.file_path}', users=['{self.user_1_id}', '{self.user_2_id}'], status='{self.status}')>"


# Indexes for performance
Index("idx_user_sessions_user_status", "user_id", "status")
Index("idx_user_sessions_branch", "git_branch")
Index("idx_ephemeral_env_user", "user_id")
Index("idx_ephemeral_env_expires", "expires_at")
Index("idx_file_conflicts_file", "file_path")
Index("idx_file_conflicts_status", "status")
