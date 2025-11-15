"""SQLModel ORM models for Connectors and Datasets."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, ClassVar

from sqlmodel import SQLModel, Field, Relationship, JSON, Text
from sqlalchemy import Index


class ConnectorStateEnum:
    """Connector state constants."""
    NOT_DEPLOYED = "Not Deployed"
    GENERATED = "Generated"
    DEBUG_DEPLOYED = "Debug Deployed"  # Deployed to dev workspace via /debug endpoint
    COMMITTED = "Committed"
    ACTIVE = "Active"
    PAUSED = "Paused"
    ERROR = "Error"
    DELETED = "Deleted"


class Connector(SQLModel, table=True):
    """Connector configuration and state tracking."""

    __tablename__: ClassVar[str] = "connectors"

    id: str = Field(primary_key=True)  # UUID
    name: str = Field(unique=True, index=True)  # Connector name (must be unique)
    target_type: str  # postgres, mysql, snowflake, etc.
    target_config: Dict[str, Any] = Field(sa_type=JSON)  # Target connection configuration

    # Execution configuration
    execution_mode: str = Field(default="scheduled")  # scheduled or manual
    schedule_cron: Optional[str] = Field(default=None)  # Cron expression for scheduling

    # Compute configuration
    compute_type: str = Field(default="cluster")  # cluster or serverless
    cluster_config: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)  # Cluster configuration

    # State management
    status: str = Field(default=ConnectorStateEnum.NOT_DEPLOYED)  # Current state

    # Git integration
    git_commit_id: Optional[str] = Field(default=None)  # Last committed Git SHA
    git_branch: Optional[str] = Field(default=None)  # Target Git branch

    # Databricks workflow integration
    workflow_id: Optional[str] = Field(default=None)  # Databricks job/workflow ID

    # Generated artifacts tracking
    artifacts_path: Optional[str] = Field(default=None)  # Path to generated code artifacts

    # Error tracking
    error_message: Optional[str] = Field(default=None, sa_type=Text)  # Error details

    # Audit fields
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    updated_by: Optional[str] = Field(default=None)

    # Relationships
    datasets: List["ConnectorDataset"] = Relationship(
        back_populates="connector",
        cascade_delete=True,
        sa_relationship_kwargs={"lazy": "selectin"}
    )
    runs: List["ConnectorRun"] = Relationship(
        back_populates="connector",
        cascade_delete=True
    )

    def __repr__(self):
        return f"<Connector(id='{self.id}', name='{self.name}', status='{self.status}')>"


class ConnectorDataset(SQLModel, table=True):
    """Dataset sync configuration for a connector."""

    __tablename__: ClassVar[str] = "connector_datasets"

    id: str = Field(primary_key=True)  # UUID
    connector_id: str = Field(foreign_key="connectors.id", index=True)

    # Source configuration
    source_dataset: str  # Source table/dataset name (e.g., gold.customer_dim)
    target_name: str  # Target table name in destination

    # Sync strategy
    change_detection: str = Field(default="incremental")  # incremental or full
    write_strategy: str = Field(default="merge")  # merge, append, full_refresh

    # Incremental sync configuration
    watermark_column: Optional[str] = Field(default=None)  # Column for incremental detection
    primary_keys: Optional[List[str]] = Field(default=None, sa_type=JSON)  # Primary key columns

    # Additional configuration
    custom_config: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)  # Custom dataset config

    # Audit fields
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

    # Relationships
    connector: Optional["Connector"] = Relationship(back_populates="datasets")

    def __repr__(self):
        return f"<ConnectorDataset(id='{self.id}', source='{self.source_dataset}', target='{self.target_name}')>"


class ConnectorRun(SQLModel, table=True):
    """Connector execution run tracking."""

    __tablename__: ClassVar[str] = "connector_runs"

    id: str = Field(primary_key=True)  # UUID - run_id
    connector_id: str = Field(foreign_key="connectors.id", index=True)

    # Run identification
    workflow_run_id: Optional[str] = Field(default=None)  # Databricks workflow run ID

    # Run status
    status: str  # running, success, failed, cancelled

    # Timing
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = Field(default=None)
    duration_seconds: Optional[float] = Field(default=None)

    # Results
    records_processed: Optional[int] = Field(default=None)
    error_message: Optional[str] = Field(default=None, sa_type=Text)
    run_log: Optional[str] = Field(default=None, sa_type=Text)

    # Metrics
    metrics: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)

    # Relationships
    connector: Optional["Connector"] = Relationship(back_populates="runs")

    def __repr__(self):
        return f"<ConnectorRun(id='{self.id}', connector_id='{self.connector_id}', status='{self.status}')>"
