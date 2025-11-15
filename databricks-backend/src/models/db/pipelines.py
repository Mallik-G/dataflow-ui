"""Database models for pipeline tracking and sync management."""

import logging
from datetime import datetime, timezone
from typing import Any, List, Optional, ClassVar

from sqlmodel import SQLModel, Field
from sqlalchemy import Index, JSON, Text, UniqueConstraint, BigInteger
from typing import Dict

logger = logging.getLogger(__name__)


class Pipeline(SQLModel, table=True):
    __tablename__ = "pipelines"
    pipeline_id: str = Field(primary_key=True)
    name: str
    target_table: Optional[str] = Field(default=None)
    tags: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    spec: Optional[Dict[str, Any]] = Field(default=None, sa_type=JSON)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        Index("idx_pipelines_name", "name"),
        Index("idx_pipelines_target_table", "target_table"),
    )


class PipelineUpdate(SQLModel, table=True):
    """Model for tracking DLT pipeline updates (runs)."""

    __tablename__: ClassVar[str] = "pipeline_updates"

    # Primary key and Databricks fields
    update_id: str = Field(primary_key=True)  # Update ID from Databricks
    pipeline_id: str  # Pipeline ID from Databricks
    state: str  # Update state: QUEUED, RUNNING, COMPLETED, FAILED, CANCELED
    creation_time: int = Field(
        sa_type=BigInteger
    )  # Unix timestamp (seconds) when update was created
    update_time: Optional[int] = Field(
        default=None, sa_type=BigInteger
    )  # Unix timestamp (seconds) when update was last modified
    cause: Optional[str] = Field(
        default=None
    )  # Update cause: USER_REQUEST, RETRY, etc.

    # Our tracking fields
    synced_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )  # When we synced this update

    # Indexes for performance
    __table_args__ = (
        Index("idx_pipeline_updates_pipeline_id", "pipeline_id"),
        Index("idx_pipeline_updates_state", "state"),
        Index("idx_pipeline_updates_creation_time", "creation_time"),
        Index("idx_pipeline_updates_update_time", "update_time"),
    )

    def __repr__(self):
        return f"<PipelineUpdate(update_id='{self.update_id}', pipeline_id='{self.pipeline_id}', state='{self.state}')>"


class PipelineEvent(SQLModel, table=True):
    """Model for tracking DLT pipeline events (ERROR/WARN only)."""

    __tablename__: ClassVar[str] = "pipeline_events"

    # Primary key and Databricks fields
    event_id: str = Field(primary_key=True)  # Event ID from Databricks
    pipeline_id: str  # Pipeline ID from Databricks
    update_id: Optional[str] = Field(default=None)  # Associated update/run ID
    timestamp: str  # ISO timestamp from Databricks
    level: str  # Event level: ERROR, WARN
    message: str = Field(sa_type=Text)  # Error/warning message
    details: Optional[str] = Field(
        default=None, sa_type=Text
    )  # JSON string of additional event details

    # Our tracking fields
    synced_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )  # When we synced this event

    # Indexes for performance
    __table_args__ = (
        Index("idx_pipeline_events_pipeline_id", "pipeline_id"),
        Index("idx_pipeline_events_level", "level"),
        Index("idx_pipeline_events_timestamp", "timestamp"),
        Index("idx_pipeline_events_update_id", "update_id"),
    )

    def __repr__(self):
        return f"<PipelineEvent(event_id='{self.event_id}', pipeline_id='{self.pipeline_id}', level='{self.level}')>"


class PipelineMetadata(SQLModel, table=True):
    """Model for pipeline metadata including dependencies and configuration."""

    __tablename__: ClassVar[str] = "pipeline_metadata"

    # Primary key
    pipeline_id: str = Field(primary_key=True)  # Pipeline ID from Databricks

    # File and configuration information
    sql_file_path: Optional[str] = Field(
        default=None
    )  # SQL file path in Git repository
    yml_file_path: Optional[str] = Field(
        default=None
    )  # YML config file path in Git repository
    layer: Optional[str] = Field(default=None)  # Data layer: bronze, silver, gold
    table_name: Optional[str] = Field(default=None)  # Target table name
    target_table: Optional[str] = Field(
        default=None
    )  # Full target table name (catalog.layer.table)

    # Dependencies stored as JSON array
    dependencies: Optional[List[str]] = Field(
        default=None, sa_type=JSON
    )  # List of dependent pipeline/table names

    # Configuration tracking
    config_hash: Optional[str] = Field(
        default=None
    )  # Hash of YML configuration for change detection

    # Metadata timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )  # When metadata was created
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )  # Last metadata update

    # Indexes for performance
    __table_args__ = (
        Index("idx_pipeline_metadata_layer", "layer"),
        Index("idx_pipeline_metadata_table_name", "table_name"),
        Index("idx_pipeline_metadata_target_table", "target_table"),
    )

    def __repr__(self):
        return f"<PipelineMetadata(pipeline_id='{self.pipeline_id}', layer='{self.layer}', table_name='{self.table_name}')>"


class PipelineTableMapping(SQLModel, table=True):
    """Model for mapping pipelines to their target tables."""

    __tablename__: ClassVar[str] = "pipeline_table_mapping"

    # Primary key
    id: Optional[int] = Field(default=None, primary_key=True)

    # Pipeline and table information
    pipeline_id: str  # Pipeline ID from deployment
    target_table: str  # Full target table name (catalog.layer.table)
    layer: str  # Data layer: bronze, silver, gold
    file_path: str  # Source file path: layer/type/filename.sql

    # SLA configuration for stale detection
    sla_hours: int = Field(default=24)  # SLA in hours for stale detection

    # Tracking fields
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )  # When mapping was created

    # Constraints and indexes
    __table_args__ = (
        UniqueConstraint(
            "pipeline_id", "target_table", name="uq_pipeline_target_table"
        ),
        Index("idx_pipeline_table_mapping_pipeline_id", "pipeline_id"),
        Index("idx_pipeline_table_mapping_target_table", "target_table"),
        Index("idx_pipeline_table_mapping_layer", "layer"),
        Index("idx_pipeline_table_mapping_sla_hours", "sla_hours"),
    )

    def __repr__(self):
        return f"<PipelineTableMapping(pipeline_id='{self.pipeline_id}', target_table='{self.target_table}')>"


class PipelineSyncStatus(SQLModel, table=True):
    """Model for tracking incremental sync status per pipeline."""

    __tablename__: ClassVar[str] = "pipeline_sync_status"

    # Primary key
    pipeline_id: str = Field(primary_key=True)  # Pipeline ID

    # Sync timestamps for incremental sync
    last_events_sync: Optional[datetime] = Field(
        default=None
    )  # Last time we synced events for this pipeline
    last_updates_sync: Optional[datetime] = Field(
        default=None
    )  # Last time we synced updates for this pipeline
    last_sync_success: Optional[datetime] = Field(
        default=None
    )  # Last successful sync timestamp

    # Error tracking
    sync_attempts: int = Field(default=0)  # Number of failed sync attempts
    last_error: Optional[str] = Field(
        default=None, sa_type=Text
    )  # Last sync error message

    # Tracking fields
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )  # Last update timestamp

    # Indexes for performance
    __table_args__ = (
        Index("idx_pipeline_sync_status_last_events_sync", "last_events_sync"),
        Index("idx_pipeline_sync_status_last_updates_sync", "last_updates_sync"),
    )

    def __repr__(self):
        return f"<PipelineSyncStatus(pipeline_id='{self.pipeline_id}', attempts={self.sync_attempts})>"


# Helper functions for database operations
def get_nexa_pipeline_ids(db_session) -> list[str]:
    """Get all pipeline IDs deployed by Nexa from deployment_details."""
    from .deployment_details import DeploymentDetail
    from sqlalchemy.sql.elements import ColumnElement
    from typing import cast

    dep_col = cast(ColumnElement[str], DeploymentDetail.platform_object_id)

    try:
        result = (
            db_session.query(dep_col)
            .filter(
                DeploymentDetail.file_type == "pipeline",
                dep_col.is_not(None),
            )
            .distinct()
            .all()
        )
    except Exception as e:
        logger.warning(
            "deployment_details.file_type missing; falling back to platform_object_id NOT NULL filter. Error: %s",
            e,
        )
        result = db_session.query(dep_col).filter(dep_col.is_not(None)).distinct().all()

    return [row[0] for row in result if row[0]]


def get_pipelines_with_sync_status(db_session) -> list[dict]:
    """Get pipeline IDs with their sync status for incremental sync."""
    from .deployment_details import DeploymentDetail
    from sqlalchemy.sql.elements import ColumnElement
    from typing import cast

    dep_col = cast(ColumnElement[str], DeploymentDetail.platform_object_id)

    try:
        rows = (
            db_session.query(
                dep_col.label("pipeline_id"),
                PipelineSyncStatus.last_events_sync,
                PipelineSyncStatus.last_updates_sync,
                PipelineSyncStatus.sync_attempts,
            )
            .outerjoin(
                PipelineSyncStatus,
                dep_col == PipelineSyncStatus.pipeline_id,
            )
            .filter(
                DeploymentDetail.file_type == "pipeline",
                dep_col.is_not(None),
            )
            .all()
        )
    except Exception as e:
        logger.warning(
            "deployment_details.file_type missing; falling back to platform_object_id NOT NULL filter. Error: %s",
            e,
        )
        rows = (
            db_session.query(
                dep_col.label("pipeline_id"),
                PipelineSyncStatus.last_events_sync,
                PipelineSyncStatus.last_updates_sync,
                PipelineSyncStatus.sync_attempts,
            )
            .outerjoin(
                PipelineSyncStatus,
                dep_col == PipelineSyncStatus.pipeline_id,
            )
            .filter(dep_col.is_not(None))
            .all()
        )

    results = []
    for row in rows:
        results.append(
            {
                "pipeline_id": row.pipeline_id,
                "last_events_sync": row.last_events_sync,
                "last_updates_sync": row.last_updates_sync,
                "sync_attempts": row.sync_attempts or 0,
            }
        )
    return results


def create_or_update_sync_status(
    db_session,
    pipeline_id: str,
    success: bool = True,
    error: Optional[str] = None,
    events_synced: bool = False,
    updates_synced: bool = False,
):
    """Create or update sync status for a pipeline."""
    sync_status = (
        db_session.query(PipelineSyncStatus)
        .filter(PipelineSyncStatus.pipeline_id == pipeline_id)
        .first()
    )

    if not sync_status:
        sync_status = PipelineSyncStatus(pipeline_id=pipeline_id)
        db_session.add(sync_status)

    # Update sync timestamps
    now = datetime.now(timezone.utc)
    if events_synced:
        sync_status.last_events_sync = now
    if updates_synced:
        sync_status.last_updates_sync = now

    # Update error tracking
    if success:
        sync_status.sync_attempts = 0
        sync_status.last_error = None
    else:
        sync_status.sync_attempts = (sync_status.sync_attempts or 0) + 1
        sync_status.last_error = error

    sync_status.updated_at = now
    db_session.commit()


def get_stale_tables(db_session, current_time: Optional[datetime] = None) -> list[dict]:
    """Get tables that are stale based on their pipeline SLA.

    Note: Only used in CLI. Consider moving to CLI module if not needed in API.
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)

    # Complex query to find stale tables
    from sqlalchemy import case, func

    # Subquery to get the latest successful update for each pipeline
    latest_update_subquery = (
        db_session.query(
            PipelineUpdate.pipeline_id,
            func.max(PipelineUpdate.update_time).label("last_update_time"),
        )
        .filter(PipelineUpdate.state == "COMPLETED")
        .group_by(PipelineUpdate.pipeline_id)
        .subquery()
    )

    # Main query to find stale tables
    query = db_session.query(
        PipelineTableMapping.target_table,
        PipelineTableMapping.layer,
        PipelineTableMapping.file_path,
        PipelineTableMapping.sla_hours,
        latest_update_subquery.c.last_update_time,
        case(
            (
                latest_update_subquery.c.last_update_time.isnot(None),
                (func.strftime("%s", "now") - latest_update_subquery.c.last_update_time)
                / 3600.0,
            ),
            else_=None,
        ).label("hours_since_update"),
    ).outerjoin(
        latest_update_subquery,
        PipelineTableMapping.pipeline_id == latest_update_subquery.c.pipeline_id,
    )

    results = []
    for row in query.all():
        hours_since_update = row.hours_since_update

        # Consider stale if no update ever OR hours since update > SLA
        is_stale = hours_since_update is None or hours_since_update > row.sla_hours

        if is_stale:
            results.append(
                {
                    "target_table": row.target_table,
                    "layer": row.layer,
                    "file_path": row.file_path,
                    "sla_hours": row.sla_hours,
                    "hours_since_update": hours_since_update,
                    "last_update_time": row.last_update_time,
                    "status": "never_updated"
                    if hours_since_update is None
                    else "stale",
                }
            )

    return sorted(
        results, key=lambda x: x["hours_since_update"] or float("inf"), reverse=True
    )


def get_pipelines_with_enhanced_sync_status(db_session) -> list[dict[str, Any]]:
    """Get all deployed pipeline IDs with enhanced sync status including metadata and dependencies."""
    from .deployment_details import DeploymentDetail
    from sqlalchemy.sql.elements import ColumnElement
    from typing import cast

    dep_col = cast(ColumnElement[str], DeploymentDetail.platform_object_id)

    try:
        results = (
            db_session.query(
                dep_col.label("pipeline_id"),
                PipelineTableMapping.layer,
                PipelineTableMapping.target_table,
                PipelineMetadata.dependencies,
                PipelineMetadata.config_hash,
                PipelineMetadata.sql_file_path,
                PipelineMetadata.yml_file_path,
                PipelineSyncStatus.last_events_sync,
                PipelineSyncStatus.last_updates_sync,
                PipelineSyncStatus.last_sync_success,
            )
            .select_from(DeploymentDetail)
            .outerjoin(
                PipelineTableMapping,
                dep_col == PipelineTableMapping.pipeline_id,
            )
            .outerjoin(
                PipelineMetadata,
                dep_col == PipelineMetadata.pipeline_id,
            )
            .outerjoin(
                PipelineSyncStatus,
                dep_col == PipelineSyncStatus.pipeline_id,
            )
            .filter(
                DeploymentDetail.file_type == "pipeline",
                dep_col.is_not(None),
            )
            .distinct()
            .all()
        )
    except Exception as e:
        logger.warning(
            "deployment_details.file_type missing; falling back to platform_object_id NOT NULL filter. Error: %s",
            e,
        )
        results = (
            db_session.query(
                dep_col.label("pipeline_id"),
                PipelineTableMapping.layer,
                PipelineTableMapping.target_table,
                PipelineMetadata.dependencies,
                PipelineMetadata.config_hash,
                PipelineMetadata.sql_file_path,
                PipelineMetadata.yml_file_path,
                PipelineSyncStatus.last_events_sync,
                PipelineSyncStatus.last_updates_sync,
                PipelineSyncStatus.last_sync_success,
            )
            .select_from(DeploymentDetail)
            .outerjoin(
                PipelineTableMapping,
                dep_col == PipelineTableMapping.pipeline_id,
            )
            .outerjoin(
                PipelineMetadata,
                dep_col == PipelineMetadata.pipeline_id,
            )
            .outerjoin(
                PipelineSyncStatus,
                dep_col == PipelineSyncStatus.pipeline_id,
            )
            .filter(dep_col.is_not(None))
            .distinct()
            .all()
        )

    if not results:
        return []

    pipelines_with_enhanced_status: list[dict[str, Any]] = []
    for result in results:
        (
            pipeline_id,
            layer,
            target_table,
            dependencies,
            config_hash,
            sql_file_path,
            yml_file_path,
            last_events_sync,
            last_updates_sync,
            last_sync_success,
        ) = result

        pipelines_with_enhanced_status.append(
            {
                "pipeline_id": pipeline_id,
                "layer": layer or "unknown",
                "target_table": target_table,
                "dependencies": dependencies or [],
                "config_hash": config_hash,
                "sql_file_path": sql_file_path,
                "yml_file_path": yml_file_path,
                "last_events_sync": last_events_sync,
                "last_updates_sync": last_updates_sync,
                "last_sync_success": last_sync_success,
            }
        )

    return pipelines_with_enhanced_status


def create_or_update_pipeline_metadata(
    db_session,
    pipeline_id: str,
    sql_file_path: Optional[str] = None,
    yml_file_path: Optional[str] = None,
    layer: Optional[str] = None,
    table_name: Optional[str] = None,
    target_table: Optional[str] = None,
    dependencies: Optional[list[str]] = None,
    config_hash: Optional[str] = None,
) -> PipelineMetadata:
    """Create or update pipeline metadata."""
    metadata = (
        db_session.query(PipelineMetadata)
        .filter(PipelineMetadata.pipeline_id == pipeline_id)
        .first()
    )

    if not metadata:
        metadata = PipelineMetadata(pipeline_id=pipeline_id)
        db_session.add(metadata)

    # Update fields if provided
    if sql_file_path is not None:
        metadata.sql_file_path = sql_file_path
    if yml_file_path is not None:
        metadata.yml_file_path = yml_file_path
    if layer is not None:
        metadata.layer = layer
    if table_name is not None:
        metadata.table_name = table_name
    if target_table is not None:
        metadata.target_table = target_table
    if dependencies is not None:
        metadata.dependencies = dependencies
    if config_hash is not None:
        metadata.config_hash = config_hash

    metadata.updated_at = datetime.now(timezone.utc)
    db_session.commit()

    return metadata
