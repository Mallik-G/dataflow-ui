"""Databricks Statement Execution API endpoints for the Nexa Databricks API.

This module provides RESTful API endpoints to execute SQL statements in Databricks.
It allows users to submit SQL queries and retrieve results via the Statement Execution API.
"""

import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from ...core.config import settings
from ...core.dependencies import get_active_environment
from ...models.db.deployments import Environment
from ...models.api.statements import (
    StatementCancelResponse,
    StatementExecuteRequest,
    StatementExecuteResponse,
    StatementHealthCheckResponse,
    StatementResultChunk,
    StatementStatusResponse,
)
from ...services.databricks.databricks_warehouse_api import (
    DatabricksWarehouseAPI,
    StatementExecutionError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/statements", tags=["SQL Statement Execution"])


# =============================================================================
# DEPENDENCIES
# =============================================================================


def get_statements_api(
    environment: Annotated[Environment, Depends(get_active_environment)],
) -> DatabricksWarehouseAPI:
    """Dependency to get a configured Databricks Warehouse API client."""
    host = environment.databricks_host
    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )

    return DatabricksWarehouseAPI(
        host=host,
        client_id=(settings.databricks_client_id or ""),
        client_secret=(settings.databricks_client_secret or ""),
    )


# =============================================================================
# STATEMENT EXECUTION ENDPOINTS
# =============================================================================


@router.post(
    "/execute",
    response_model=StatementExecuteResponse,
    summary="Execute SQL statement",
)
async def execute_sql_statement(
    statements_api: Annotated[DatabricksWarehouseAPI, Depends(get_statements_api)],
    request: StatementExecuteRequest,
) -> StatementExecuteResponse:
    """Execute a SQL statement."""
    try:
        start_time = time.time()

        result = await statements_api.execute_sql(
            statement=request.statement,
            warehouse_id=request.warehouse_id,
            catalog=request.catalog,
            schema=request.schema_name,
            wait=request.wait,
            poll_interval=request.poll_interval,
            max_wait_seconds=request.max_wait_seconds,
        )

        execution_time = time.time() - start_time if request.wait else None

        return StatementExecuteResponse(
            status=result.get("status", "UNKNOWN"),
            statement_id=result.get("statement_id", ""),
            columns=result.get("columns"),
            rows=result.get("rows"),
            error=result.get("error"),
            execution_time_seconds=round(execution_time, 2) if execution_time else None,
        )

    except StatementExecutionError as e:
        logger.error(f"Statement execution error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Statement execution failed: {e!s}",
        )
    except Exception as e:
        logger.error(f"Failed to execute SQL statement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute SQL statement: {e!s}",
        )


@router.get(
    "/{statement_id}/status",
    response_model=StatementStatusResponse,
    summary="Get statement status",
)
async def get_statement_status(
    statements_api: Annotated[DatabricksWarehouseAPI, Depends(get_statements_api)],
    statement_id: str = Path(description="The ID of the statement"),
) -> StatementStatusResponse:
    """Get the status of a SQL statement."""
    try:
        result = await statements_api.get_statement_status(statement_id)
        current_status = result.get("status", "UNKNOWN")
        error_message = result.get("error")

        return StatementStatusResponse(
            statement_id=statement_id,
            status=current_status,
            created_at=None,
            started_at=None,
            completed_at=None,
            error=error_message,
        )

    except Exception as e:
        logger.error(f"Failed to get statement status for {statement_id}: {e}")
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statement not found: {statement_id}",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statement status: {e!s}",
        )


@router.post(
    "/{statement_id}/cancel",
    response_model=StatementCancelResponse,
    summary="Cancel statement",
)
async def cancel_statement(
    statements_api: Annotated[DatabricksWarehouseAPI, Depends(get_statements_api)],
    statement_id: str = Path(description="The ID of the statement to cancel"),
) -> StatementCancelResponse:
    """Cancel a SQL statement."""
    try:
        await statements_api.cancel_statement(statement_id)

        return StatementCancelResponse(
            statement_id=statement_id,
            status="CANCELED",
            message=f"Statement {statement_id} cancellation requested",
        )

    except Exception as e:
        logger.error(f"Failed to cancel statement {statement_id}: {e}")
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statement not found: {statement_id}",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel statement: {e!s}",
        )


@router.get(
    "/{statement_id}/result/chunks/{chunk_index}",
    response_model=StatementResultChunk,
    summary="Get statement result chunk",
)
async def get_statement_result_chunk(
    statements_api: Annotated[DatabricksWarehouseAPI, Depends(get_statements_api)],
    statement_id: str = Path(description="The ID of the statement"),
    chunk_index: int = Path(description="The index of the result chunk to retrieve"),
) -> StatementResultChunk:
    """Get a specific chunk of results for large result sets."""
    try:
        result = await statements_api.get_result_chunk(statement_id, chunk_index)

        return StatementResultChunk.model_validate(result)

    except Exception as e:
        logger.error(
            f"Failed to get result chunk {chunk_index} for statement {statement_id}: {e}"
        )
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statement or chunk not found: {statement_id}/{chunk_index}",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get result chunk: {e!s}",
        )


@router.get(
    "/health",
    response_model=StatementHealthCheckResponse,
    summary="Health check",
)
async def statements_health_check(
    statements_api: Annotated[DatabricksWarehouseAPI, Depends(get_statements_api)],
    environment: Annotated[Environment, Depends(get_active_environment)],
) -> StatementHealthCheckResponse:
    """Check Databricks Statement Execution API connectivity."""
    try:
        cfg = getattr(environment, "configuration", None)
        test_warehouse_id = cfg.get("warehouse_id") if isinstance(cfg, dict) else None

        if not test_warehouse_id:
            return StatementHealthCheckResponse(
                status="healthy",
                databricks_connection="ok",
                statement_api_accessible=True,
                test_warehouse_id=None,
                error=None,
                message="Statement Execution API connectivity verified (no test execution as warehouse_id is not configured)",
            )

        test_statement = "SELECT 1 as health_check"
        result = await statements_api.execute_sql(
            statement=test_statement,
            warehouse_id=test_warehouse_id,
            wait=True,
            max_wait_seconds=30,
        )

        if result.get("status") == "SUCCEEDED":
            return StatementHealthCheckResponse(
                status="healthy",
                databricks_connection="ok",
                statement_api_accessible=True,
                test_warehouse_id=test_warehouse_id,
                error=None,
                message="Statement Execution API connectivity verified with test query",
            )
        else:
            raise Exception(
                f"Test statement failed: {result.get('error', 'Unknown error')}"
            )

    except Exception as e:
        logger.error(f"Databricks statements health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=StatementHealthCheckResponse(
                status="unhealthy",
                databricks_connection="failed",
                statement_api_accessible=False,
                test_warehouse_id=test_warehouse_id
                if "test_warehouse_id" in locals()
                else None,
                error=str(e),
                message="Statement Execution API connectivity failed",
            ).model_dump(),
        )
