"""Models for artifact upload to Databricks Files/DBFS/Volumes."""

from pydantic import BaseModel, Field
from typing import Optional


class ArtifactUploadResponse(BaseModel):
    path: str = Field(..., description="Target path where artifact is stored")
    size_bytes: Optional[int] = Field(None, description="Size of uploaded content")
