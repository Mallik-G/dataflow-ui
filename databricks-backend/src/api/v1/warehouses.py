"""Databricks SQL Warehouse API endpoints for the Nexa Databricks API.

This module provides RESTful API endpoints to manage Databricks SQL Warehouses.
It allows users to start, stop, monitor warehouse status and list available warehouses.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from ...core.config import settings
from ...core.dependencies import get_active_environment
from ...models.db.deployments import Environment
from ...models.api.warehouses import (
    WarehouseHealthCheckResponse,
    WarehouseListResponse,
    WarehouseOperationRequest,
    WarehouseOperationResponse,
    WarehouseStatusResponse,
)
from ...services.databricks.databricks_warehouse_api import DatabricksWarehouseAPI

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/warehouses", tags=["Compute Warehouse Management"])


# =============================================================================
# DEPENDENCIES
# =============================================================================


def get_warehouse_api(
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
# WAREHOUSE ENDPOINTS
# =============================================================================


@router.get(
    "/",
    response_model=WarehouseListResponse,
    summary="List SQL warehouses",
)
async def list_warehouses(
    warehouse_api: Annotated[DatabricksWarehouseAPI, Depends(get_warehouse_api)],
) -> WarehouseListResponse:
    """List all SQL warehouses in the workspace."""
    try:
        result = await warehouse_api.list_warehouses()
        if "error" in result:
            raise RuntimeError(result["error"])
        warehouses = result.get("warehouses", [])
        return WarehouseListResponse(
            warehouses=[
                WarehouseStatusResponse(
                    id=str(w.get("id", "")),
                    name=w.get("name"),
                    state=str(w.get("state", "UNKNOWN")),
                    cluster_size=w.get("size"),
                    min_num_clusters=None,
                    max_num_clusters=None,
                    auto_stop_mins=None,
                    creator_name=None,
                    jdbc_url=None,
                    odbc_params=None,
                    num_clusters=None,
                    num_active_sessions=None,
                    tags=None,
                )
                for w in warehouses
            ],
            count=len(warehouses),
        )

    except Exception as e:
        logger.error(f"Failed to list warehouses: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list warehouses: {e!s}",
        )


@router.get(
    "/{warehouse_id}/status",
    response_model=WarehouseStatusResponse,
    summary="Get warehouse status",
)
async def get_warehouse_status(
    warehouse_api: Annotated[DatabricksWarehouseAPI, Depends(get_warehouse_api)],
    warehouse_id: str = Path(description="The ID of the warehouse"),
) -> WarehouseStatusResponse:
    """Get the current status of a SQL warehouse."""
    try:
        result = await warehouse_api.get_warehouse_status(warehouse_id)
        if "error" in result:
            raise RuntimeError(result["error"])
        return WarehouseStatusResponse(
            id=str(result.get("id", "")),
            name=result.get("name"),
            state=str(result.get("state", "UNKNOWN")),
            cluster_size=result.get("size"),
            min_num_clusters=None,
            max_num_clusters=None,
            auto_stop_mins=None,
            creator_name=None,
            jdbc_url=None,
            odbc_params=None,
            num_clusters=result.get("num_clusters"),
            num_active_sessions=None,
            tags=None,
        )

    except Exception as e:
        logger.error(f"Failed to get warehouse status for {warehouse_id}: {e}")
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Warehouse not found: {warehouse_id}",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get warehouse status: {e!s}",
        )


@router.post(
    "/{warehouse_id}/start",
    response_model=WarehouseOperationResponse,
    summary="Start SQL warehouse",
)
async def start_warehouse(
    warehouse_api: Annotated[DatabricksWarehouseAPI, Depends(get_warehouse_api)],
    warehouse_id: str = Path(description="The ID of the warehouse"),
    request: WarehouseOperationRequest = WarehouseOperationRequest(),
) -> WarehouseOperationResponse:
    """Start a SQL warehouse."""
    try:
        timeout = (
            request.timeout_seconds if request.timeout_seconds is not None else 300
        )
        result = await warehouse_api.ensure_warehouse_running(warehouse_id, timeout)
        if result.get("status") == "error":
            raise RuntimeError(result.get("message"))

        return WarehouseOperationResponse(
            status=result.get("status") or "success",
            message=result.get("message") or "",
            warehouse_id=warehouse_id,
            state=result.get("state"),
            startup_time_seconds=result.get("startup_time_seconds"),
        )

    except Exception as e:
        logger.error(f"Failed to start warehouse {warehouse_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start warehouse: {e!s}",
        )


@router.post(
    "/{warehouse_id}/stop",
    response_model=WarehouseOperationResponse,
    summary="Stop SQL warehouse",
)
async def stop_warehouse(
    warehouse_api: Annotated[DatabricksWarehouseAPI, Depends(get_warehouse_api)],
    warehouse_id: str = Path(description="The ID of the warehouse"),
) -> WarehouseOperationResponse:
    """Stop a SQL warehouse."""
    try:
        result = await warehouse_api.stop_warehouse(warehouse_id)
        if result.get("status") == "error":
            raise RuntimeError(result.get("message"))

        return WarehouseOperationResponse(
            status=result.get("status") or "success",
            message=result.get("message") or "",
            warehouse_id=warehouse_id,
            state="STOPPED",
            startup_time_seconds=None,
        )

    except Exception as e:
        logger.error(f"Failed to stop warehouse {warehouse_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop warehouse: {e!s}",
        )


@router.get(
    "/health",
    response_model=WarehouseHealthCheckResponse,
    summary="Health check",
)
async def warehouse_health_check(
    warehouse_api: Annotated[DatabricksWarehouseAPI, Depends(get_warehouse_api)],
) -> WarehouseHealthCheckResponse:
    """Check Databricks SQL Warehouse connectivity."""
    try:
        result = await warehouse_api.list_warehouses()
        if "error" in result:
            return WarehouseHealthCheckResponse(
                status="unhealthy",
                databricks_connection="error",
                warehouses_accessible=0,
                message="SQL Warehouse connectivity failed",
                error=result["error"],
            )

        warehouses = result.get("warehouses", [])
        return WarehouseHealthCheckResponse(
            status="healthy",
            databricks_connection="ok",
            warehouses_accessible=len(warehouses),
            message="SQL Warehouse connectivity verified",
            error=None,
        )

    except Exception as e:
        logger.error(f"Databricks warehouse health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Warehouse health check failed: {e!s}",
        )
