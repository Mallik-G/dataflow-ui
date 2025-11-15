"""SQLModel ORM models for Apps and App Deployments."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Index, JSON


class App(SQLModel, table=True):
    """Apps in the system."""

    __tablename__ = "apps"

    # Primary identifiers
    app_id: str = Field(primary_key=True)  # UUID
    name: str = Field(nullable=False)  # App name
    description: Optional[str] = Field(default=None)  # App description

    # Source code information
    source_code_path: Optional[str] = Field(default=None)  # Path to app source code

    # Configuration and metadata
    config: Optional[Dict[str, Any]] = Field(
        default_factory=dict, sa_type=JSON
    )  # App configuration
    status: str = Field(default="ACTIVE")  # ACTIVE, INACTIVE, DELETED

    # Audit fields
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str  # User who created the app

    # Relationships
    deployments: List["AppDeployment"] = Relationship(
        back_populates="app", cascade_delete=True
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_apps_name", "name"),
        Index("idx_apps_status", "status"),
        Index("idx_apps_created_by", "created_by"),
        Index("idx_apps_created_at", "created_at"),
    )

    def __repr__(self):
        return (
            f"<App(app_id='{self.app_id}', name='{self.name}', status='{self.status}')>"
        )


class AppDeployment(SQLModel, table=True):
    """App deployments in the system."""

    __tablename__ = "app_deployments"

    # Primary identifiers
    deployment_id: str = Field(primary_key=True)  # UUID
    app_id: str = Field(foreign_key="apps.app_id")  # Foreign key to apps

    # Deployment information
    version: Optional[str] = Field(default=None)  # Deployment version
    description: Optional[str] = Field(default=None)  # Deployment description
    source_code_path: Optional[str] = Field(
        default=None
    )  # Path to deployment source code

    # Configuration and runtime information
    config: Optional[Dict[str, Any]] = Field(
        default_factory=dict, sa_type=JSON
    )  # Deployment configuration
    environment_vars: Optional[Dict[str, Any]] = Field(
        default_factory=dict, sa_type=JSON
    )  # Environment variables
    url: Optional[str] = Field(default=None)  # URL to access the deployed app

    # Status and lifecycle
    status: str = Field(
        default="PENDING"
    )  # PENDING, BUILDING, ACTIVE, INACTIVE, FAILED, STOPPING

    # Audit fields
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str  # User who created the deployment

    # Relationships
    app: Optional["App"] = Relationship(back_populates="deployments")

    # Indexes for performance
    __table_args__ = (
        Index("idx_app_deployments_app_id", "app_id"),
        Index("idx_app_deployments_status", "status"),
        Index("idx_app_deployments_version", "version"),
        Index("idx_app_deployments_created_by", "created_by"),
        Index("idx_app_deployments_created_at", "created_at"),
    )

    def __repr__(self):
        return f"<AppDeployment(deployment_id='{self.deployment_id}', app_id='{self.app_id}', status='{self.status}')>"
