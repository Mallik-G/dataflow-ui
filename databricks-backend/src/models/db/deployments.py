"""SQLModel ORM models for Deployments and Environments."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Index, JSON, Text, BigInteger

if TYPE_CHECKING:
    # For type checkers only; avoids runtime import cycles
    from .jobs import Job
    from .deployment_details import DeploymentDetail


class Environment(SQLModel, table=True):
    """Deployment environment configurations (dev, test, prod)."""

    __tablename__: str = "environments"

    id: str = Field(primary_key=True)  # UUID
    name: str = Field(unique=True)  # development, testing, production
    description: Optional[str] = Field(
        default=None, sa_type=Text
    )  # Optional description
    display_name: Optional[str] = Field(default=None)  # Human-readable name
    platform: str = Field(default="databricks")  # databricks/snowflake/...

    # Protection flag to disable interactive editing in UI
    protected: bool = Field(default=False)

    # Platform-specific connection info (non-sensitive)
    databricks_host: Optional[str] = Field(default=None)  # Databricks workspace URL
    workspace_id: Optional[str] = Field(default=None)  # Workspace identifier

    # Git repository mapping (now aligned with spec)
    git_provider: Optional[str] = Field(
        default=None
    )  # github/gitlab/bitbucket/azure-devops
    git_repository: Optional[str] = Field(default=None)  # URL or owner/repo
    target_git_branch: Optional[str] = Field(default=None)  # main/master/develop/...
    workspace_folder: Optional[str] = Field(
        default=None
    )  # Workspace folder path for repos sync

    # Secret management (references only, no actual secrets stored)
    secret_scope: Optional[str] = Field(default=None)  # Databricks secret scope name
    databricks_client_id_key: Optional[str] = Field(default=None)
    databricks_client_secret_key: Optional[str] = Field(default=None)
    git_token_key: Optional[str] = Field(default=None)
    postgres_username_key: Optional[str] = Field(default=None)
    postgres_password_key: Optional[str] = Field(default=None)

    # Environment configuration (non-sensitive settings)
    configuration: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)

    # Activity and audit
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = Field(default=None)
    updated_by: Optional[str] = Field(default=None)

    # Relationships
    deployments: List["Deployment"] = Relationship(
        back_populates="environment", cascade_delete=True
    )

    def __repr__(self):
        return f"<Environment(id='{self.id}', name='{self.name}', platform='{self.platform}')>"


class Deployment(SQLModel, table=True):
    """Deployment tracking and history."""

    __tablename__: str = "deployments"

    id: str = Field(primary_key=True)  # UUID - deployment_id
    deployment_name: Optional[str] = Field(default=None)
    environment_id: str = Field(foreign_key="environments.id")
    platform: str = Field(default="databricks")  # Fixed to Databricks

    # Deployment metadata
    status: str  # pending, running, success, partial, failed, cancelled
    git_commit_sha: str  # SHA of deployed commit (critical for change tracking)
    git_branch: str  # Branch deployed (critical for repo sync)
    job_run_id: Optional[int] = Field(
        default=None, sa_type=BigInteger
    )  # Platform-specific serverless job execution ID

    # User and timing info
    initiated_by: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)

    # Deployment results
    deployment_config: Optional[Dict[str, Any]] = Field(
        default=None, sa_type=JSON
    )  # Configuration used for deployment
    error_message: Optional[str] = Field(
        default=None, sa_type=Text
    )  # Error details if failed
    deployment_log: Optional[str] = Field(
        default=None, sa_type=Text
    )  # Overall deployment output

    # Relationships
    environment: Optional["Environment"] = Relationship(back_populates="deployments")
    jobs: List["Job"] = Relationship(back_populates="deployment")
    deployment_details: List["DeploymentDetail"] = Relationship(
        back_populates="deployment", cascade_delete=True
    )

    def __repr__(self):
        return f"<Deployment(id='{self.id}', env='{self.environment_id}', status='{self.status}', platform='{self.platform}')>"


class EnvironmentDeploymentState(SQLModel, table=True):
    """Tracks the last deployed commit for each environment to enable incremental deployments."""

    __tablename__: str = "environment_deployment_state"

    environment_id: str = Field(primary_key=True, foreign_key="environments.id")
    git_branch: str  # The branch being tracked
    last_deployed_commit: str  # Last successfully deployed commit SHA
    last_deployment_id: Optional[str] = Field(
        default=None, foreign_key="deployments.id"
    )  # Reference to the deployment

    # Timing
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    environment: Optional["Environment"] = Relationship()
    last_deployment: Optional["Deployment"] = Relationship()

    def __repr__(self):
        return f"<EnvironmentDeploymentState(env='{self.environment_id}', branch='{self.git_branch}', commit='{self.last_deployed_commit[:8]}')>"


# Indexes for performance optimization
Index("idx_deployments_environment_status", "environment_id", "status")
Index("idx_deployments_platform_created", "platform", "created_at")

Index(
    "idx_environment_deployment_state_branch",
    EnvironmentDeploymentState.environment_id,
    EnvironmentDeploymentState.git_branch,
)
