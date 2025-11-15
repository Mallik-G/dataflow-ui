"""Pydantic models for API request/response validation related to Repos."""

from typing import Optional

from pydantic import BaseModel, Field


class RepoBase(BaseModel):
    """Base repo information."""

    id: int = Field(..., description="Unique identifier for the repo")
    path: str = Field(..., description="Workspace path of the repo")
    url: str = Field(..., description="Git remote URL")
    provider: str = Field(..., description="Git provider (GitHub, GitLab, etc.)")
    head_commit_id: Optional[str] = Field(None, description="Current HEAD commit ID")
    branch: Optional[str] = Field(None, description="Current branch")


class RepoResponse(RepoBase):
    """Response model for a single repo."""

    status: Optional[str] = Field(None, description="Repository status")


class RepoListResponse(BaseModel):
    """Response model for a list of repos."""

    repos: list[RepoResponse] = Field(..., description="List of repositories")
    total_count: int = Field(..., description="Total number of repositories")
