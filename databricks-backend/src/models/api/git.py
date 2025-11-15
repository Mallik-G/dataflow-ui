"""Pydantic models for the Git API."""

from typing import Optional

from pydantic import BaseModel, Field


class CreateBranchRequest(BaseModel):
    """Request to create a new branch."""

    name: str = Field(..., description="New branch name")
    source: str = Field("main", description="Source branch to create from")


class CreateBranchResponse(BaseModel):
    """Response after creating a branch."""

    branch: str
    source: str
    sha: Optional[str]
    message: str


class CommitFile(BaseModel):
    """A single file to be included in a commit."""

    path: str = Field(..., description="The full path of the file in the repository")
    content: str = Field(
        ..., description="The content of the file, either plain text or base64 encoded"
    )
    is_base64: bool = Field(
        False, description="Set to true if the content is base64 encoded"
    )


class CommitFilesRequest(BaseModel):
    """Request to commit one or more files to a branch."""

    branch: str = Field(..., description="The branch to commit to")
    message: str = Field(..., description="The commit message")
    files: list[CommitFile] = Field(..., min_length=1)


class CommitFilesResponse(BaseModel):
    """Response after committing files."""

    branch: str
    commit_sha: Optional[str]
    files_count: int
    message: str


class CreatePRRequest(BaseModel):
    """Request to create a pull request."""

    from_branch: str = Field(..., description="The source branch of the pull request")
    to_branch: str = Field(..., description="The target branch of the pull request")
    title: str = Field(..., description="The title of the pull request")
    body: Optional[str] = Field(
        "", description="The body/description of the pull request"
    )


class CreatePRResponse(BaseModel):
    """Response after creating a pull request."""

    pr_id: int
    url: str
    from_branch: str
    to_branch: str
    title: str
    message: str


class MergePRRequest(BaseModel):
    """Request to merge a pull request."""

    commit_title: Optional[str] = Field(None, description="Title for the merge commit")
    commit_message: Optional[str] = Field(
        None, description="Message for the merge commit"
    )


class MergePRResponse(BaseModel):
    """Response after merging a pull request."""

    pr_id: int
    merged: bool
    sha: Optional[str]
    message: str


class BranchListResponse(BaseModel):
    """Response for listing branches."""

    items: list[str]
    count: int


class DiffFile(BaseModel):
    """Detailed diff metadata for a single file between two commits or branches."""

    path: str
    status: str  # e.g., 'added', 'modified', 'removed', 'renamed'
    additions: int = 0
    deletions: int = 0
    patch: Optional[str] = None


class DiffResponse(BaseModel):
    """Response for a branch or commit diff."""

    files: list[DiffFile]
    total_files: int
    total_additions: int
    total_deletions: int


class RepoFileResponse(BaseModel):
    """Response containing the content of a repository file."""

    path: str
    content: str
    encoding: str
    sha: str
