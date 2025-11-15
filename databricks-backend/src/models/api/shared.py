"""Pydantic models for API request/response validation related to shared concepts."""

from typing import Any, Literal, Optional

from pydantic import BaseModel


# Error Models
class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str
    message: str
    details: Optional[dict[str, Any]] = None


# Bulk Operations Models
class BulkJobOperation(BaseModel):
    """Bulk operation on multiple jobs."""

    job_ids: list[int]
    operation: Literal["retry", "cancel", "delete", "enable", "disable"]


class BulkOperationResult(BaseModel):
    """Result of bulk operation."""

    successful: list[int] = []
    failed: list[dict[str, Any]] = []
    total_attempted: int = 0
