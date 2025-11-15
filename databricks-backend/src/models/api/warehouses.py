"""Pydantic models for Databricks SQL Warehouse API endpoints."""

from typing import Any, Optional

from pydantic import BaseModel, Field


# Request Models
class CreateWarehouseRequest(BaseModel):
    """Request model for creating a SQL warehouse - aligned with Databricks API."""

    name: str = Field(
        description="Logical name for the warehouse (unique within org, <100 chars)"
    )
    cluster_size: str = Field(
        description="Size: 2X-Small, X-Small, Small, Medium, Large, X-Large, 2X-Large, 3X-Large, 4X-Large"
    )
    min_num_clusters: Optional[int] = Field(
        1, description="Minimum clusters (>0, <=30)", ge=1, le=30
    )
    max_num_clusters: Optional[int] = Field(
        None, description="Maximum clusters (>=min_num_clusters, <=30)", ge=1, le=30
    )
    auto_stop_mins: Optional[int] = Field(
        120, description="Auto-stop timeout in minutes (>=0)", ge=0
    )
    enable_photon: Optional[bool] = Field(
        False, description="Enable Photon optimized clusters"
    )
    enable_serverless_compute: Optional[bool] = Field(
        False, description="Enable serverless compute"
    )
    warehouse_type: Optional[str] = Field(
        None, description="Warehouse type (PRO, CLASSIC)"
    )
    spot_instance_policy: Optional[str] = Field(
        None, description="Spot instance policy"
    )
    tags: Optional[dict[str, str]] = Field(
        None, description="Tags for warehouse resources (<45 tags)"
    )
    creator_name: Optional[str] = Field(None, description="Warehouse creator name")


class EditWarehouseRequest(BaseModel):
    """Request model for editing a SQL warehouse - aligned with Databricks API."""

    name: Optional[str] = Field(None, description="Logical name for the warehouse")
    cluster_size: Optional[str] = Field(None, description="Warehouse cluster size")
    min_num_clusters: Optional[int] = Field(
        None, description="Minimum number of clusters", ge=1, le=30
    )
    max_num_clusters: Optional[int] = Field(
        None, description="Maximum number of clusters", ge=1, le=30
    )
    auto_stop_mins: Optional[int] = Field(
        None, description="Auto-stop timeout in minutes", ge=0
    )
    enable_photon: Optional[bool] = Field(
        None, description="Enable Photon optimized clusters"
    )
    enable_serverless_compute: Optional[bool] = Field(
        None, description="Enable serverless compute"
    )
    warehouse_type: Optional[str] = Field(None, description="Warehouse type")
    spot_instance_policy: Optional[str] = Field(
        None, description="Spot instance policy"
    )
    tags: Optional[dict[str, str]] = Field(
        None, description="Tags for warehouse resources"
    )


class WarehouseOperationRequest(BaseModel):
    """Request to perform warehouse operations (start/stop)."""

    timeout_seconds: Optional[int] = Field(
        default=300,
        description="Timeout in seconds to wait for operation completion",
        ge=30,
        le=3600,
    )


# Response Models
class WarehouseInfo(BaseModel):
    """Warehouse information model - aligned with Databricks GetWarehouseResponse."""

    id: str = Field(description="Warehouse ID")
    name: str = Field(description="Warehouse name")
    state: str = Field(
        description="Current warehouse state (RUNNING, STOPPED, STARTING, STOPPING, etc.)"
    )
    cluster_size: str = Field(description="Size of the warehouse cluster")
    min_num_clusters: int = Field(description="Minimum number of clusters")
    max_num_clusters: int = Field(description="Maximum number of clusters")
    auto_stop_mins: int = Field(description="Auto-stop timeout in minutes")
    creator_name: Optional[str] = Field(None, description="Creator of the warehouse")
    enable_photon: bool = Field(description="Whether Photon is enabled")
    enable_serverless_compute: Optional[bool] = Field(
        None, description="Whether serverless compute is enabled"
    )
    warehouse_type: Optional[str] = Field(
        None, description="Warehouse type (PRO, CLASSIC)"
    )
    spot_instance_policy: Optional[str] = Field(
        None, description="Spot instance policy"
    )
    tags: Optional[dict[str, str]] = Field(None, description="Warehouse tags")
    jdbc_url: Optional[str] = Field(None, description="JDBC connection URL")
    odbc_params: Optional[dict[str, Any]] = Field(
        None, description="ODBC connection parameters"
    )
    num_clusters: Optional[int] = Field(
        None, description="Current number of active clusters"
    )
    num_active_sessions: Optional[int] = Field(
        None, description="Number of active sessions"
    )
    health: Optional[dict[str, Any]] = Field(
        None, description="Health status information"
    )


class WarehouseStatusResponse(BaseModel):
    """Response model for warehouse status - backwards compatible."""

    id: str = Field(description="Warehouse ID")
    name: Optional[str] = Field(None, description="Warehouse name")
    state: str = Field(description="Current warehouse state (RUNNING, STOPPED, etc.)")
    cluster_size: Optional[str] = Field(
        None, description="Size of the warehouse cluster"
    )
    min_num_clusters: Optional[int] = Field(
        None, description="Minimum number of clusters"
    )
    max_num_clusters: Optional[int] = Field(
        None, description="Maximum number of clusters"
    )
    auto_stop_mins: Optional[int] = Field(
        None, description="Auto-stop timeout in minutes"
    )
    creator_name: Optional[str] = Field(None, description="Creator of the warehouse")
    jdbc_url: Optional[str] = Field(None, description="JDBC connection URL")
    odbc_params: Optional[dict[str, Any]] = Field(
        None, description="ODBC connection parameters"
    )
    num_clusters: Optional[int] = Field(None, description="Current number of clusters")
    num_active_sessions: Optional[int] = Field(
        None, description="Number of active sessions"
    )
    tags: Optional[dict[str, str]] = Field(None, description="Warehouse tags")


class GetWarehouseResponse(BaseModel):
    """Response model for getting single warehouse - aligned with Databricks API."""

    warehouse: WarehouseInfo = Field(description="Warehouse information")


class CreateWarehouseResponse(BaseModel):
    """Response model for creating warehouse - aligned with Databricks API."""

    id: str = Field(description="Created warehouse ID")
    name: str = Field(description="Warehouse name")
    state: str = Field(description="Initial warehouse state")
    cluster_size: str = Field(description="Warehouse cluster size")
    min_num_clusters: int = Field(description="Minimum number of clusters")
    max_num_clusters: int = Field(description="Maximum number of clusters")
    auto_stop_mins: int = Field(description="Auto-stop timeout in minutes")
    enable_photon: bool = Field(description="Whether Photon is enabled")
    enable_serverless_compute: Optional[bool] = Field(
        None, description="Whether serverless compute is enabled"
    )
    warehouse_type: Optional[str] = Field(None, description="Warehouse type")
    creator_name: Optional[str] = Field(None, description="Creator name")
    tags: Optional[dict[str, str]] = Field(None, description="Warehouse tags")


class WarehouseListResponse(BaseModel):
    """Response model for listing warehouses."""

    warehouses: list[WarehouseStatusResponse] = Field(description="List of warehouses")
    count: int = Field(description="Total number of warehouses")


class WarehouseOperationResponse(BaseModel):
    """Response model for warehouse operations."""

    status: str = Field(description="Operation status (success, error, timeout)")
    message: str = Field(description="Status message")
    warehouse_id: str = Field(description="Warehouse ID")
    state: Optional[str] = Field(None, description="Current warehouse state")
    startup_time_seconds: Optional[float] = Field(
        None, description="Time taken for operation"
    )


class WarehouseHealthCheckResponse(BaseModel):
    """Response model for warehouse health check."""

    status: str = Field(description="Health status (healthy, unhealthy)")
    message: str = Field(description="Health check message")
    warehouses_accessible: int = Field(description="Number of accessible warehouses")
    databricks_connection: str = Field(description="Databricks connection status")
    error: Optional[str] = Field(None, description="Error message if unhealthy")
