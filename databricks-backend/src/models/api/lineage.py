"""Pydantic models for the Lineage API."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class LineageDirection(str, Enum):
    """Direction for lineage queries."""

    UPSTREAM = "upstream"
    DOWNSTREAM = "downstream"
    BOTH = "both"


class LineageEntityType(str, Enum):
    """Type of lineage entity."""

    TABLE = "table"
    VIEW = "view"
    PIPELINE = "pipeline"
    NOTEBOOK = "notebook"
    COLUMN = "column"


class LineageTableInfo(BaseModel):
    """Table information in lineage."""

    catalog_name: str
    schema_name: str
    table_name: str
    full_name: str


class LineageNode(BaseModel):
    """A node in the lineage graph."""

    entity_name: str
    entity_type: LineageEntityType
    table_info: Optional[LineageTableInfo] = None


class LineageGraph(BaseModel):
    """Complete lineage graph representation."""

    nodes: list[LineageNode]
    edges: list[dict[str, Any]]
    center_node: str
    total_nodes: int
    max_depth: int
    column_lineage: Optional[dict[str, Any]] = None


class TableLineageResponse(BaseModel):
    """Response model for table lineage queries."""

    table_name: str
    upstreams: list[LineageNode]
    downstreams: list[LineageNode]
    total_upstream_count: int
    total_downstream_count: int
    query_timestamp: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    metadata: Optional[dict[str, Any]] = Field(default_factory=dict)


class ColumnLineageResponse(BaseModel):
    """Response model for column lineage queries."""

    table_name: str
    column_name: str
    upstream_columns: list[dict[str, Any]]
    downstream_columns: list[dict[str, Any]]
    total_upstream_count: int
    total_downstream_count: int
    query_timestamp: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class TablePopularityMetrics(BaseModel):
    """Metrics for table popularity and usage."""

    table_name: str
    query_count: int
    unique_users: int
    last_accessed: Optional[datetime] = None
    avg_queries_per_day: float
    popularity_score: float
    rank: Optional[int] = None


class LineageHealthCheck(BaseModel):
    """Health check response for lineage services."""

    status: str
    lineage_api_available: bool
    system_tables_accessible: bool
    last_sync_time: Optional[datetime] = None
    error_message: Optional[str] = None
    total_tables_tracked: Optional[int] = None


class SystemTableQueryRequest(BaseModel):
    """Request model for system table queries."""

    query: str
    catalog: Optional[str] = None
    schema_name: Optional[str] = Field(None, alias="schema")
    limit: Optional[int] = 1000
    include_metadata: bool = True


class SystemTableQueryResponse(BaseModel):
    """Response model for system table queries."""

    query: str
    results: list[dict[str, Any]]
    total_rows: int
    execution_time_ms: float
    query_timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    metadata: Optional[dict[str, Any]] = Field(default_factory=dict)


class LineageQueryRequest(BaseModel):
    """Request model for lineage queries."""

    table_name: str
    include_entity_lineage: bool = True
    max_results: Optional[int] = 100
    direction: LineageDirection = LineageDirection.BOTH
    max_depth: Optional[int] = None


class SystemTableQuery(BaseModel):
    """Request model for system table queries."""

    query: str
    catalog: Optional[str] = None
    schema_name: Optional[str] = Field(None, alias="schema")
    limit: Optional[int] = 1000


# Helper function for parsing lineage responses
def parse_lineage_response(raw_response: dict[str, Any]) -> list[LineageNode]:
    """Parse raw Databricks lineage response into LineageNode objects."""
    nodes = []

    # Handle upstream/downstream responses
    entities = raw_response.get("upstreams", raw_response.get("downstreams", []))

    for entity in entities:
        # Extract entity information
        entity_name = entity.get("name", "")
        entity_type = entity.get("type", "table").lower()

        # Map to our enum
        try:
            mapped_type = LineageEntityType(entity_type)
        except ValueError:
            mapped_type = LineageEntityType.TABLE

        # Extract table information if available
        table_info = None
        if mapped_type in [LineageEntityType.TABLE, LineageEntityType.VIEW]:
            name_parts = entity_name.split(".")
            if len(name_parts) >= 3:
                table_info = LineageTableInfo(
                    catalog_name=name_parts[0],
                    schema_name=name_parts[1],
                    table_name=name_parts[2],
                    full_name=entity_name,
                )

        # Create lineage node
        node = LineageNode(
            entity_name=entity_name,
            entity_type=mapped_type,
            table_info=table_info,
        )

        nodes.append(node)

    return nodes
