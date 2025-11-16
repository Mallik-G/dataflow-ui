"""Deployment Queue Models."""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field, Index
from sqlalchemy import Text


class DeploymentQueue(SQLModel, table=True):
    """Manages deployment queue per environment (FIFO)."""

    __tablename__ = "deployment_queue"

    id: str = Field(primary_key=True)  # queue-uuid
    deployment_id: str = Field(foreign_key="deployments.id")
    environment_id: str = Field(foreign_key="environments.id")

    # Queue position and status
    position: int  # Queue position (1, 2, 3...)
    status: str  # queued, running, completed, failed, cancelled

    # Metadata
    requested_by: Optional[str] = Field(default=None)
    files_count: int = Field(default=0)  # Number of files in deployment

    # Timing
    queued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)

    # Results
    error_message: Optional[str] = Field(default=None, sa_type=Text)

    def __repr__(self):
        return f"<DeploymentQueue(id='{self.id}', deployment='{self.deployment_id}', env='{self.environment_id}', position={self.position}, status='{self.status}')>"


# Indexes for performance
Index("idx_deployment_queue_env_status", "environment_id", "status")
Index("idx_deployment_queue_env_position", "environment_id", "position")
Index("idx_deployment_queue_deployment", "deployment_id")
