"""SQLModel ORM models for Auditing."""

from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Index, Text


if TYPE_CHECKING:
    from .deployments import Environment, Deployment


class APIAudit(SQLModel, table=True):
    """Audit log for all API operations."""

    __tablename__ = "api_audit"

    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: Optional[str] = Field(default=None)  # X-Request-ID header
    user_id: Optional[str] = Field(default=None)  # User identifier if available
    method: str  # HTTP method
    endpoint: str  # API endpoint
    platform: Optional[str] = Field(
        default=None
    )  # Target platform for platform-specific operations

    # Request/Response info
    status_code: int  # HTTP response status
    request_body: Optional[str] = Field(
        default=None, sa_type=Text
    )  # Request payload (sanitized)
    response_body: Optional[str] = Field(
        default=None, sa_type=Text
    )  # Response payload (sanitized)
    error_message: Optional[str] = Field(
        default=None, sa_type=Text
    )  # Error details if any

    # Timing
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    duration_ms: Optional[int] = Field(default=None)  # Request duration in milliseconds

    def __repr__(self):
        return f"<APIAudit(id={self.id}, method='{self.method}', endpoint='{self.endpoint}', status={self.status_code})>"


class PullRequestAudit(SQLModel, table=True):
    """Audit trail for PR approvals and merges per environment."""

    __tablename__ = "pull_request_audit"

    id: Optional[int] = Field(default=None, primary_key=True)
    pr_id: str  # Pull request ID from Git provider
    environment_id: Optional[str] = Field(default=None, foreign_key="environments.id")
    git_provider: str  # github, gitlab, azure_devops
    repository: str  # Repository name
    source_branch: str
    target_branch: str

    # PR lifecycle
    created_by: Optional[str] = Field(default=None)
    created_at: Optional[datetime] = Field(default=None)
    approved_by: Optional[str] = Field(default=None)
    approved_at: Optional[datetime] = Field(default=None)
    merged_by: Optional[str] = Field(default=None)
    merged_at: Optional[datetime] = Field(default=None)

    # Deployment linkage
    deployment_id: Optional[str] = Field(default=None, foreign_key="deployments.id")

    # Metadata
    pr_title: Optional[str] = Field(default=None)
    pr_url: Optional[str] = Field(default=None)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    environment: Optional["Environment"] = Relationship()
    deployment: Optional["Deployment"] = Relationship()

    def __repr__(self):
        return f"<PullRequestAudit(pr_id='{self.pr_id}', env='{self.environment_id}', merged_by='{self.merged_by}')>"


# Indexes for performance optimization
Index("idx_api_audit_timestamp", APIAudit.timestamp)
Index("idx_api_audit_platform_endpoint", APIAudit.platform, APIAudit.endpoint)
Index(
    "idx_pr_audit_environment_merged",
    PullRequestAudit.environment_id,
    PullRequestAudit.merged_at,
)
