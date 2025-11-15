"""Pydantic models for Databricks Statement Execution API endpoints."""

from typing import Any, Optional

from pydantic import BaseModel, Field


# Request Models
class StatementParameter(BaseModel):
    """SQL statement parameter - aligned with Databricks API."""

    name: str = Field(description="Parameter name (without ':' prefix)")
    value: Optional[str] = Field(
        None, description="Parameter value (null for NULL values)"
    )
    type: Optional[str] = Field(
        None, description="Parameter type (BIGINT, STRING, DATE, etc.)"
    )


class ExecuteStatementRequest(BaseModel):
    """Request model for executing SQL statements - aligned with Databricks API."""

    statement: str = Field(description="SQL statement to execute (max 16 MiB)")
    warehouse_id: str = Field(description="SQL warehouse ID to use for execution")
    catalog: Optional[str] = Field(
        None, description="Default catalog for statement execution"
    )
    schema_name: Optional[str] = Field(
        None, alias="schema", description="Default schema for statement execution"
    )
    parameters: Optional[list[StatementParameter]] = Field(
        None, description="Named parameters for statement"
    )
    wait_timeout: Optional[str] = Field(
        "10s", description="Wait timeout as string (0s, 5s-50s)"
    )
    on_wait_timeout: Optional[str] = Field(
        "CONTINUE", description="Action on timeout: CONTINUE or CANCEL"
    )
    disposition: Optional[str] = Field(
        "INLINE", description="Result disposition: INLINE or EXTERNAL_LINKS"
    )
    format: Optional[str] = Field(
        "JSON_ARRAY", description="Result format: JSON_ARRAY, ARROW_STREAM, CSV"
    )
    byte_limit: Optional[int] = Field(None, description="Result byte limit")
    row_limit: Optional[int] = Field(None, description="Result row limit")


class StatementExecuteRequest(BaseModel):
    """Legacy request model for backwards compatibility."""

    statement: str = Field(description="SQL statement to execute")
    warehouse_id: str = Field(description="SQL warehouse ID to use for execution")
    catalog: Optional[str] = Field(None, description="Catalog name to use")
    schema_name: Optional[str] = Field(
        None, alias="schema", description="Schema name to use"
    )
    wait: bool = Field(default=True, description="Wait for statement completion")
    poll_interval: float = Field(default=1.5, description="Polling interval in seconds")
    max_wait_seconds: int = Field(
        default=600, description="Maximum wait time in seconds"
    )


# Response Models
class StatementStatus(BaseModel):
    """Statement execution status - aligned with Databricks API."""

    state: str = Field(
        description="Statement state: PENDING, RUNNING, SUCCEEDED, FAILED, CANCELED"
    )
    error: Optional[dict] = Field(None, description="Error details if state is FAILED")


class StatementColumn(BaseModel):
    """Statement result column metadata - aligned with Databricks API."""

    name: str = Field(description="Column name")
    position: int = Field(description="Column position (0-indexed)")
    type_name: str = Field(description="Column type name (LONG, STRING, etc.)")
    type_text: str = Field(description="Column type text (BIGINT, VARCHAR, etc.)")


class StatementSchema(BaseModel):
    """Statement result schema - aligned with Databricks API."""

    column_count: int = Field(description="Total number of columns")
    columns: list[StatementColumn] = Field(description="Column metadata")


class StatementManifest(BaseModel):
    """Statement result manifest - aligned with Databricks API."""

    format: str = Field(description="Result format: JSON_ARRAY, ARROW_STREAM, CSV")
    result_schema: StatementSchema = Field(alias="schema", description="Result schema")
    total_chunk_count: Optional[int] = Field(None, description="Total number of chunks")
    total_row_count: Optional[int] = Field(None, description="Total number of rows")
    total_byte_count: Optional[int] = Field(None, description="Total bytes in result")
    chunks: Optional[list[dict]] = Field(
        None, description="Chunk metadata for external links"
    )


class StatementResultInline(BaseModel):
    """Inline statement result - aligned with Databricks API."""

    chunk_index: int = Field(description="Chunk index (0-based)")
    row_offset: int = Field(description="Row offset within result set")
    row_count: int = Field(description="Number of rows in this chunk")
    data_array: list[list[Optional[str]]] = Field(
        description="Result data as array of arrays"
    )


class StatementResultExternalLinks(BaseModel):
    """External links result - aligned with Databricks API."""

    external_links: list[dict] = Field(description="List of external download links")


class StatementResponse(BaseModel):
    """Statement execution response - aligned with Databricks API."""

    statement_id: str = Field(description="Unique statement identifier")
    status: StatementStatus = Field(description="Statement execution status")
    manifest: Optional[StatementManifest] = Field(None, description="Result manifest")
    result: Optional[dict] = Field(
        None, description="Result data (inline or external links)"
    )


class StatementExecuteResponse(BaseModel):
    """Legacy response model for backwards compatibility."""

    status: str = Field(
        description="Execution status (SUBMITTED, SUCCEEDED, FAILED, CANCELED)"
    )
    statement_id: str = Field(description="Unique identifier for the statement")
    columns: Optional[list[str]] = Field(None, description="Column names in result set")
    rows: Optional[list[list[Any]]] = Field(None, description="Result data rows")
    error: Optional[str] = Field(None, description="Error message if execution failed")
    execution_time_seconds: Optional[float] = Field(
        None, description="Total execution time"
    )


class StatementStatusResponse(BaseModel):
    """Response model for statement status check."""

    statement_id: str = Field(description="Statement ID")
    status: str = Field(description="Current status")
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    started_at: Optional[str] = Field(None, description="Start timestamp")
    completed_at: Optional[str] = Field(None, description="Completion timestamp")
    error: Optional[str] = Field(None, description="Error message if failed")


class StatementHealthCheckResponse(BaseModel):
    """Response model for statement execution health check."""

    status: str = Field(description="Health status (healthy, unhealthy)")
    message: str = Field(description="Health check message")
    statement_api_accessible: bool = Field(
        description="Whether statement API is accessible"
    )
    databricks_connection: str = Field(description="Databricks connection status")
    test_warehouse_id: Optional[str] = Field(
        None, description="Test warehouse used for health check"
    )
    error: Optional[str] = Field(None, description="Error message if unhealthy")


class StatementCancelResponse(BaseModel):
    """Response model for statement cancellation."""

    statement_id: str = Field(description="Statement ID that was cancelled")
    status: str = Field(description="Status after cancellation")
    message: str = Field(description="Cancellation result message")


class StatementResultChunk(BaseModel):
    """Response model for statement result chunks."""

    statement_id: str = Field(description="Statement ID")
    chunk_index: int = Field(description="Index of this chunk")
    total_chunks: Optional[int] = Field(
        None, description="Total number of chunks available"
    )
    columns: Optional[list[str]] = Field(None, description="Column names")
    rows: list[list[Any]] = Field(description="Result data rows in this chunk")
    next_chunk_index: Optional[int] = Field(
        None, description="Index of next chunk if available"
    )
    is_final_chunk: bool = Field(description="Whether this is the final chunk")
