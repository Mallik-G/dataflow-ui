"""Pydantic models for the Catalog API."""

from typing import Any, Optional

from pydantic import BaseModel, Field


class CatalogResponse(BaseModel):
    """Databricks catalog information."""

    name: str
    comment: Optional[str] = None
    owner: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # New enhanced metadata fields
    health_status: Optional[str] = "unknown"
    table_count: Optional[int] = None
    schema_count: Optional[int] = None
    # Permission-aware browsing
    access_level: Optional[str] = "full"  # "full" or "browse"


class CatalogListResponse(BaseModel):
    """Response for listing catalogs."""

    catalogs: list[CatalogResponse]
    count: int
    next_page_token: Optional[str] = None


class SchemaResponse(BaseModel):
    """Databricks schema information."""

    name: str
    catalog_name: str
    comment: Optional[str] = None
    owner: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # New enhanced metadata fields
    table_count: Optional[int] = None
    view_count: Optional[int] = None
    # Permission-aware browsing
    access_level: Optional[str] = "full"  # "full" or "browse"


class SchemaListResponse(BaseModel):
    """Response for listing schemas."""

    schemas: list[SchemaResponse]
    catalog_name: str
    count: int
    next_page_token: Optional[str] = None


class TableResponse(BaseModel):
    """Databricks table information."""

    name: str
    catalog_name: str
    schema_name: str
    table_type: str
    data_source_format: Optional[str] = None
    comment: Optional[str] = None
    owner: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # New enhanced metadata fields
    location: Optional[str] = None
    size_bytes: Optional[int] = None
    row_count: Optional[int] = None
    # Permission-aware browsing
    access_level: Optional[str] = "full"  # "full" or "browse"


class TableListResponse(BaseModel):
    """Response for listing tables."""

    tables: list[TableResponse]
    catalog_name: str
    schema_name: str
    count: int
    next_page_token: Optional[str] = None


class ColumnResponse(BaseModel):
    """Databricks table column information."""

    name: str
    type_name: str
    type_text: str
    comment: Optional[str] = None
    nullable: bool = True
    partition_index: Optional[int] = None


class TableDetailResponse(BaseModel):
    """Detailed Databricks table information with columns."""

    name: str
    catalog_name: str
    schema_name: str
    table_type: str
    data_source_format: Optional[str] = None
    comment: Optional[str] = None
    owner: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    columns: list[ColumnResponse]
    properties: dict[str, Any] = {}


class SqlExecuteRequest(BaseModel):
    """Request to execute a SQL statement."""

    sql: str = Field(..., description="SQL statement to execute")


class SqlExecuteResponse(BaseModel):
    """Response from executing a SQL statement."""

    sql: str
    result: Any
    status: str


class HealthCheckResponse(BaseModel):
    """Response for health check."""

    status: str
    databricks_connection: str
    catalogs_accessible: Optional[int] = None
    message: str
    error: Optional[str] = None
