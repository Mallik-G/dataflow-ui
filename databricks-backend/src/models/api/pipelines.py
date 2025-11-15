"""Pydantic models for API request/response validation related to Pipelines."""

from typing import Any, Optional

from pydantic import BaseModel, Field


class PipelineLibrary(BaseModel):
    """DLT Pipeline library configuration.

    All fields are optional as only one library type should be specified per entry.
    """

    notebook: Optional[dict[str, str]] = None
    file: Optional[dict[str, str]] = None
    jar: Optional[str] = None
    maven: Optional[dict[str, str]] = None
    pypi: Optional[dict[str, str]] = None
    whl: Optional[str] = None


class PipelineCluster(BaseModel):
    """DLT Pipeline cluster configuration.

    All fields are optional to allow flexible cluster configuration.
    Databricks will use defaults for unspecified values.
    """

    label: Optional[str] = None
    node_type_id: Optional[str] = None
    driver_node_type_id: Optional[str] = None
    num_workers: Optional[int] = None
    autoscale: Optional[dict[str, int]] = None
    custom_tags: Optional[dict[str, str]] = None
    spark_conf: Optional[dict[str, str]] = None
    spark_env_vars: Optional[dict[str, str]] = None
    enable_local_disk_encryption: Optional[bool] = None
    instance_pool_id: Optional[str] = None


class PipelineSpec(BaseModel):
    """DLT Pipeline specification."""

    id: Optional[str] = None
    name: str = Field(..., description="Pipeline name")
    storage: Optional[str] = Field(None, description="Storage location")
    configuration: Optional[dict[str, str]] = Field(default_factory=dict)
    clusters: Optional[list[PipelineCluster]] = Field(default_factory=list)
    libraries: list[PipelineLibrary] = Field(..., description="Pipeline libraries")
    target: Optional[str] = Field(None, description="Target database/catalog")
    schema_name: Optional[str] = Field(
        None, alias="schema", description="Target schema for Unity Catalog"
    )
    continuous: Optional[bool] = Field(True, description="Continuous processing mode")
    development: Optional[bool] = Field(False, description="Development mode")
    photon: Optional[bool] = Field(False, description="Enable Photon")
    channel: Optional[str] = Field("CURRENT", description="Runtime channel")
    edition: Optional[str] = Field("ADVANCED", description="Pipeline edition")
    catalog: Optional[str] = Field(None, description="Unity Catalog name")
    notifications: Optional[list[dict[str, Any]]] = Field(default_factory=list)
    serverless: Optional[bool] = Field(None, description="Enable serverless compute")
    root_path: Optional[str] = Field(
        None, description="Root path for pipeline workspace files"
    )


class PipelineUpdate(BaseModel):
    """DLT Pipeline update (run) information from Databricks API.

    Note: This is the API model. See src.models.db.pipelines.PipelineUpdate for DB model.
    """

    update_id: str
    pipeline_id: str
    state: str
    creation_time: int
    update_time: Optional[int] = None
    cause: Optional[str] = None


class PipelineEvent(BaseModel):
    """DLT Pipeline event information from Databricks API.

    Note: This is the API model. See src.models.db.pipelines.PipelineEvent for DB model.
    """

    id: str
    sequence: dict[str, int]
    origin: dict[str, Any]
    timestamp: str
    message: str
    level: str
    details: Optional[dict[str, Any]] = None


class PipelineBase(BaseModel):
    """Base pipeline information."""

    pipeline_id: str = Field(..., description="Unique identifier for the pipeline")
    name: str = Field(..., description="Name of the pipeline")
    state: Optional[str] = Field(None, description="Current state of the pipeline")
    cluster_id: Optional[str] = Field(
        None, description="Cluster ID where pipeline runs"
    )
    creator_user_name: Optional[str] = Field(
        None, description="User who created the pipeline"
    )
    health: Optional[str] = Field(
        "UNKNOWN", description="Health status of the pipeline"
    )


class PipelineResponse(PipelineBase):
    """Response model for a single pipeline - aligned with Databricks API."""

    spec: Optional[dict[str, Any]] = Field(None, description="Pipeline specification")
    latest_updates: Optional[list[dict[str, Any]]] = Field(
        None, description="Recent update information"
    )
    run_as_user_name: Optional[str] = Field(
        None, description="User context for pipeline execution"
    )

    class Config:
        from_attributes = True


class PipelinesListResponse(BaseModel):
    """Response model for a list of pipelines - aligned with Databricks API."""

    statuses: list[PipelineResponse] = Field(
        ..., description="List of pipeline statuses"
    )
    next_page_token: Optional[str] = Field(None, description="Token for next page")
    prev_page_token: Optional[str] = Field(None, description="Token for previous page")


class PipelineEventsResponse(BaseModel):
    """Response model for pipeline events - aligned with Databricks API."""

    events: list[PipelineEvent] = Field(..., description="List of pipeline events")
    next_page_token: Optional[str] = Field(None, description="Token for next page")
    prev_page_token: Optional[str] = Field(None, description="Token for previous page")


class PipelineUpdatesResponse(BaseModel):
    """Response model for pipeline updates - aligned with Databricks API."""

    updates: list[PipelineUpdate] = Field(..., description="List of pipeline updates")
    next_page_token: Optional[str] = Field(None, description="Token for next page")
    prev_page_token: Optional[str] = Field(None, description="Token for previous page")


class PipelineUpdateResponse(BaseModel):
    """Response model for a single pipeline update - aligned with Databricks API."""

    update_id: str = Field(..., description="Update ID")
    pipeline_id: str = Field(..., description="Pipeline ID")
    state: str = Field(..., description="Update state")
    creation_time: Optional[int] = Field(None, description="Creation timestamp")
    update_time: Optional[int] = Field(None, description="Update timestamp")
    cause: Optional[str] = Field(None, description="Update cause")
    config: Optional[dict[str, Any]] = Field(None, description="Update configuration")


class StartPipelineUpdateRequest(BaseModel):
    """Request model for starting pipeline update."""

    full_refresh: Optional[bool] = Field(False, description="Perform full refresh")
    refresh_selection: Optional[list[str]] = Field(
        None, description="Tables to refresh"
    )
    full_refresh_selection: Optional[list[str]] = Field(
        None, description="Tables to full refresh"
    )
    validate_only: Optional[bool] = Field(
        False, description="Validate only, don't execute"
    )


class StartPipelineUpdateResponse(BaseModel):
    """Response model for starting pipeline update."""

    update_id: str = Field(..., description="Update ID")
    pipeline_id: str = Field(..., description="Pipeline ID")
    state: str = Field(..., description="Update state")
    request_id: Optional[str] = Field(None, description="Request ID")
