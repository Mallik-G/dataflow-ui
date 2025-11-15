"""Pydantic models for API request/response validation related to Environments."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field
from pydantic.config import ConfigDict


class EnvironmentCreateRequest(BaseModel):
    """Request to create a new environment."""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., description="Unique name for the environment")
    description: Optional[str] = Field(
        None, description="A brief description of the environment"
    )
    protected: bool = Field(
        False, description="If true, UI editing is disabled for this env"
    )
    platform: Optional[str] = Field(
        default="databricks", description="Target platform (databricks/snowflake/...)"
    )
    git_provider: Optional[str] = Field(
        default=None,
        alias="gitProvider",
        description="VCS provider (github/gitlab/bitbucket/azure-devops)",
    )
    git_repository: Optional[str] = Field(
        default=None, alias="gitRepository", description="Repository URL or owner/repo"
    )
    target_git_branch: Optional[str] = Field(
        default=None, alias="targetGitBranch", description="Default target branch"
    )
    configuration: dict[str, Any] = Field(
        default_factory=dict,
        description="Key-value configuration for the environment (e.g., Databricks, Snowflake credentials)",
    )
    is_active: Optional[bool] = Field(
        default=True,
        alias="isActive",
        description="Set to false to deactivate the environment",
    )
    created_by: Optional[str] = Field(default=None, alias="createdBy")


class EnvironmentUpdateRequest(BaseModel):
    """Request to update an environment."""

    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = Field(None, description="New name for the environment")
    description: Optional[str] = Field(None, description="Updated description")
    protected: Optional[bool] = Field(
        None, description="Protect/unprotect the environment"
    )
    platform: Optional[str] = Field(None, description="Updated target platform")
    git_provider: Optional[str] = Field(
        default=None, alias="gitProvider", description="Updated VCS provider"
    )
    git_repository: Optional[str] = Field(
        default=None, alias="gitRepository", description="Updated repository"
    )
    target_git_branch: Optional[str] = Field(
        default=None, alias="targetGitBranch", description="Updated target branch"
    )
    configuration: Optional[dict[str, Any]] = Field(
        None, description="Updated key-value configuration"
    )
    is_active: Optional[bool] = Field(
        None, alias="isActive", description="Set to false to deactivate the environment"
    )
    updated_by: Optional[str] = Field(default=None, alias="updatedBy")


class EnvironmentResponse(BaseModel):
    """Environment response model."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    name: str
    description: Optional[str]
    protected: bool = Field(alias="protected")
    platform: str
    git_provider: Optional[str] = Field(default=None, alias="gitProvider")
    git_repository: Optional[str] = Field(default=None, alias="gitRepository")
    target_git_branch: Optional[str] = Field(default=None, alias="targetGitBranch")
    configuration: dict[str, Any]
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: Optional[str] = Field(default=None, alias="createdBy")
    updated_by: Optional[str] = Field(default=None, alias="updatedBy")
