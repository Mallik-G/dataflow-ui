"""Common FastAPI dependency providers used across the project."""

from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from ..models.db.deployments import Environment


async def get_active_environment(
    db: Annotated[Session, Depends(get_db)],
    x_environment_id: Optional[str] = Header(default=None, alias="X-Environment-Id"),
) -> Environment:
    """Resolve the active Environment for this request.

    - If X-Environment-Id header is provided, fetch that Environment.
    - Otherwise, return the single configured Environment (first()).
    """
    env: Optional[Environment]
    if x_environment_id:
        env = db.query(Environment).filter_by(id=x_environment_id).first()
        if not env:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment not found: {x_environment_id}",
            )
        return env

    env = db.query(Environment).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment configuration not found. Please configure the application environment.",
        )
    return env
