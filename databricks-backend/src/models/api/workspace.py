""" ""Pydantic models for Databricks workspace operations."""

from typing import Optional

from pydantic import BaseModel, Field


class WorkspaceObject(BaseModel):
    """Represents an object in the Databricks workspace."""

    path: str
    object_type: str
    object_id: Optional[int] = None
    language: Optional[str] = None
    size: Optional[int] = None


class ListResponse(BaseModel):
    """Response for workspace list operations - aligned with Databricks API."""

    objects: Optional[list[WorkspaceObject]] = Field(
        None, description="Array of objects in the directory"
    )


class StatusResponse(BaseModel):
    """Response model for getting the status of a workspace object."""

    path: str
    object_type: str
    object_id: Optional[int] = None
    language: Optional[str] = None


class ImportRequest(BaseModel):
    """Request model for importing workspace objects - aligned with Databricks API."""

    path: str = Field(description="Absolute path of the object or directory")
    format: Optional[str] = Field(
        "SOURCE",
        description="Import format: AUTO, SOURCE, HTML, JUPYTER, DBC, R_MARKDOWN",
    )
    content: Optional[str] = Field(
        None, description="Base64-encoded content (10MB limit)"
    )
    language: Optional[str] = Field(
        None, description="Language for NOTEBOOK objects: PYTHON, SCALA, SQL, R"
    )
    overwrite: Optional[bool] = Field(
        False, description="Overwrite existing object (not supported for DBC)"
    )


class ImportResponse(BaseModel):
    """Response for workspace import operations - aligned with Databricks API."""

    # Note: Import operation returns empty response on success
    pass


class ExportRequest(BaseModel):
    """Request model for exporting a file from the workspace."""

    source_path: str = Field(description="Workspace path to export")
    target_path: str = Field(description="Local target path (for reference)")


class ExportResponse(BaseModel):
    """Response for workspace export operations - aligned with Databricks API."""

    content: Optional[str] = Field(
        None, description="Base64-encoded content of the exported object"
    )


# Request Models
class WorkspacePathRequest(BaseModel):
    """Request model for workspace path operations."""

    path: str = Field(description="Workspace path")


class WorkspaceMkdirsRequest(BaseModel):
    """Request model for creating workspace directories."""

    path: str = Field(description="Directory path to create")


class WorkspaceDeleteRequest(BaseModel):
    """Request model for deleting workspace objects."""

    path: str = Field(description="Path to delete")
    recursive: bool = Field(default=True, description="Delete recursively")


class WorkspaceExportRequest(BaseModel):
    """Request model for exporting workspace objects."""

    path: str = Field(description="Path to export")
    format: str = Field(
        default="SOURCE", description="Export format (SOURCE, HTML, JUPYTER, DBC)"
    )
    direct_download: bool = Field(default=False, description="Direct download flag")


class WorkspaceImportRequest(BaseModel):
    """Legacy request model for backwards compatibility."""

    path: str = Field(description="Destination path")
    format: str = Field(description="Import format (SOURCE, HTML, JUPYTER, DBC)")
    content_base64: str = Field(description="Base64-encoded content")
    language: Optional[str] = Field(None, description="Programming language")
    overwrite: bool = Field(default=True, description="Overwrite existing object")


# Response Models
class ObjectInfo(BaseModel):
    """Workspace object information - aligned with Databricks API."""

    object_id: Optional[int] = Field(
        None, description="Unique identifier for the object"
    )
    object_type: str = Field(
        description="Object type: NOTEBOOK, DIRECTORY, LIBRARY, FILE"
    )
    path: str = Field(description="Absolute path of the object")
    language: Optional[str] = Field(
        None, description="Programming language (for NOTEBOOK objects)"
    )
    created_at: Optional[int] = Field(
        None, description="Creation timestamp (Unix time)"
    )
    modified_at: Optional[int] = Field(
        None, description="Last modification timestamp (Unix time)"
    )
    size: Optional[int] = Field(None, description="Size in bytes")


class WorkspaceObjectResponse(BaseModel):
    """Legacy response model for backwards compatibility."""

    path: str = Field(description="Object path")
    object_type: str = Field(
        description="Object type (NOTEBOOK, DIRECTORY, LIBRARY, FILE)"
    )
    object_id: Optional[int] = Field(None, description="Object ID")
    language: Optional[str] = Field(None, description="Programming language")
    created_at: Optional[int] = Field(None, description="Creation timestamp")
    modified_at: Optional[int] = Field(None, description="Last modification timestamp")
    size: Optional[int] = Field(None, description="Size in bytes")


class WorkspaceListResponse(BaseModel):
    """Legacy response model for workspace listing."""

    objects: list[WorkspaceObjectResponse] = Field(
        description="List of workspace objects"
    )
    path: str = Field(description="Listed directory path")
    count: int = Field(description="Number of objects")


class WorkspaceStatusResponse(BaseModel):
    """Response model for workspace object status."""

    path: str = Field(description="Object path")
    object_type: str = Field(description="Object type")
    object_id: Optional[int] = Field(None, description="Object ID")
    language: Optional[str] = Field(None, description="Programming language")


class WorkspaceExportResponse(BaseModel):
    """Response model for workspace export."""

    content: str = Field(description="Exported content (base64 for binary formats)")
    format: str = Field(description="Export format")
    path: str = Field(description="Exported path")
    file_type: Optional[str] = Field(None, description="File type")


class WorkspaceOperationResponse(BaseModel):
    """Response model for workspace operations."""

    success: bool = Field(description="Operation success status")
    message: str = Field(description="Operation result message")
    path: str = Field(description="Path that was operated on")


class WorkspaceHealthCheckResponse(BaseModel):
    """Response model for workspace health check."""

    status: str = Field(description="Health status (healthy, unhealthy)")
    message: str = Field(description="Health check message")
    workspace_accessible: bool = Field(description="Whether workspace is accessible")
    databricks_connection: str = Field(description="Databricks connection status")
    error: Optional[str] = Field(None, description="Error message if unhealthy")
