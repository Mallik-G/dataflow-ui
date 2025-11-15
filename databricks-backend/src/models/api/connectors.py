"""Pydantic models for Connector API requests and responses."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, validator


class ConnectorTargetConfig(BaseModel):
    """Target database connection configuration."""
    host: str
    port: int
    database: str
    schema_: str = Field(alias="schema")
    ssm_secret_path: Optional[str] = None

    class Config:
        populate_by_name = True


class ConnectorClusterConfig(BaseModel):
    """Cluster configuration for connector execution."""
    cluster_id: Optional[str] = None
    node_type_id: Optional[str] = None
    num_workers: Optional[int] = None
    spark_version: Optional[str] = None


class ConnectorCreateRequest(BaseModel):
    """Request to create a new connector."""
    name: str = Field(..., description="Unique connector name")
    target_type: str = Field(..., description="Target database type (postgres, mysql, etc.)")
    target_config: Dict[str, Any] = Field(..., description="Target connection configuration")
    execution_mode: str = Field(default="scheduled", description="Execution mode: scheduled or manual")
    schedule_cron: Optional[str] = Field(None, description="Cron schedule expression")
    compute_type: str = Field(default="cluster", description="Compute type: cluster or serverless")
    cluster_config: Optional[Dict[str, Any]] = Field(None, description="Cluster configuration")
    created_by: str = Field(..., description="User creating the connector")


class ConnectorDatasetConfig(BaseModel):
    """Dataset sync configuration."""
    source_dataset: str = Field(..., description="Source dataset name (e.g., gold.customer_dim)")
    target_name: str = Field(..., description="Target table name")
    change_detection: str = Field(default="incremental", description="Change detection: incremental or full")
    write_strategy: str = Field(default="merge", description="Write strategy: merge, append, full_refresh")
    watermark_column: Optional[str] = Field(None, description="Watermark column for incremental sync")
    primary_keys: Optional[List[str]] = Field(None, description="Primary key columns")
    custom_config: Optional[Dict[str, Any]] = Field(None, description="Additional custom configuration")


class ConnectorDatasetsAddRequest(BaseModel):
    """Request to add datasets to a connector."""
    datasets: List[ConnectorDatasetConfig] = Field(..., description="List of dataset configurations")
    created_by: str = Field(..., description="User adding the datasets")


class ConnectorDatasetResponse(BaseModel):
    """Response for a connector dataset."""
    id: str
    connector_id: str
    source_dataset: str
    target_name: str
    change_detection: str
    write_strategy: str
    watermark_column: Optional[str] = None
    primary_keys: Optional[List[str]] = None
    custom_config: Optional[Dict[str, Any]] = None
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class ConnectorResponse(BaseModel):
    """Response for a connector."""
    id: str
    name: str
    target_type: str
    target_config: Dict[str, Any]
    execution_mode: str
    schedule_cron: Optional[str] = None
    compute_type: str
    cluster_config: Optional[Dict[str, Any]] = None
    status: str
    git_commit_id: Optional[str] = None
    git_branch: Optional[str] = None
    workflow_id: Optional[str] = None
    artifacts_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: Optional[str] = None
    datasets: Optional[List[ConnectorDatasetResponse]] = None

    class Config:
        from_attributes = True


class ConnectorListResponse(BaseModel):
    """Response for listing connectors."""
    connectors: List[ConnectorResponse]
    total: int


class ConnectorGenerateRequest(BaseModel):
    """Request to generate code artifacts for a connector."""
    force_regenerate: bool = Field(default=False, description="Force regeneration even if artifacts exist")


class ConnectorArtifactsResponse(BaseModel):
    """Response containing generated artifacts."""
    connector_id: str
    artifacts_path: str
    files: List[Dict[str, str]] = Field(..., description="List of generated files with paths and content")
    generated_at: datetime


class ConnectorCommitRequest(BaseModel):
    """Request to commit generated artifacts to Git."""
    commit_message: Optional[str] = Field(None, description="Custom commit message")
    target_branch: Optional[str] = Field(None, description="Target Git branch (defaults to connector config)")
    committed_by: str = Field(..., description="User committing the artifacts")


class ConnectorCommitResponse(BaseModel):
    """Response after committing artifacts to Git."""
    connector_id: str
    git_commit_id: str
    git_branch: str
    committed_at: datetime


class ConnectorActivateRequest(BaseModel):
    """Request to activate a connector."""
    activated_by: str = Field(..., description="User activating the connector")


class ConnectorRunResponse(BaseModel):
    """Response for a connector run."""
    id: str
    connector_id: str
    workflow_run_id: Optional[str] = None
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    records_processed: Optional[int] = None
    error_message: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class ConnectorRunsListResponse(BaseModel):
    """Response for listing connector runs."""
    runs: List[ConnectorRunResponse]
    total: int


class ConnectorRunDetailResponse(BaseModel):
    """Detailed response for a specific connector run."""
    id: str
    connector_id: str
    workflow_run_id: Optional[str] = None
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    records_processed: Optional[int] = None
    error_message: Optional[str] = None
    run_log: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
