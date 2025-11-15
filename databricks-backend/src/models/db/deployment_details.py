"""SQLModel ORM model for Deployment Details."""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Text, UniqueConstraint
from .deployments import Deployment


class DeploymentDetail(SQLModel, table=True):
    """Tracks the deployment status of individual files in a deployment."""

    __tablename__ = "deployment_details"

    id: str = Field(primary_key=True)  # UUID
    deployment_id: str = Field(foreign_key="deployments.id")

    # File and type info
    file_path: str  # Required
    file_type: str  # 'ddl', 'pipeline', 'job', 'notebook', 'dlt_pipeline'

    # Git and execution info
    git_status: str  # 'added', 'modified', 'removed'
    execution_order: int = Field(default=99)

    # Deployment status and results
    deployment_status: str = Field(
        default="pending"
    )  # 'pending', 'deploying', 'success', 'failed', 'skipped'
    platform_object_id: Optional[str] = Field(
        default=None
    )  # pipeline_id, table_name, job_id, etc.
    error_message: Optional[str] = Field(default=None, sa_type=Text)

    # Timestamps
    deployed_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship
    deployment: Optional["Deployment"] = Relationship(
        back_populates="deployment_details"
    )

    __table_args__ = (
        UniqueConstraint("deployment_id", "file_path", name="_deployment_filepath_uc"),
    )

    def __repr__(self):
        return (
            f"<DeploymentDetail(id='{self.id}', deployment_id='{self.deployment_id}', "
            f"file_path='{self.file_path}', status='{self.deployment_status}')>"
        )
