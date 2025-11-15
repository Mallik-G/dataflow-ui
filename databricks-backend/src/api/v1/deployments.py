"""
Simplified Deployment API

Clean REST API for deployment operations:
- POST /deploy - Create new deployment
- POST /resume - Resume failed deployment (auto-detects code changes)
- GET /{deployment_id}/status - Get deployment status with details
- GET /{deployment_id}/details - Get deployment file details
- POST /{deployment_id}/cancel - Cancel running deployment
- GET / - List deployments
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.db import Deployment, DeploymentDetail
from ...services import DeploymentOrchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/deployments", tags=["Deployments"])


# =============================================================================
# Request/Response Models
# =============================================================================


class DeployRequest(BaseModel):
    """Request to create a new deployment."""

    environment_id: str = Field(..., description="Target environment ID")
    git_branch: Optional[str] = Field(None, description="Optional branch override")


class ResumeRequest(BaseModel):
    """Request to resume a failed deployment."""

    deployment_id: str = Field(..., description="Deployment ID to resume")


class DeploymentResponse(BaseModel):
    """Deployment response."""

    id: str
    environment_id: str
    git_branch: str
    git_commit_sha: str
    status: str
    job_run_id: Optional[
        str
    ]  # String to avoid JSON number precision issues with large integers
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]

    class Config:
        from_attributes = True


class DeploymentDetailResponse(BaseModel):
    """Deployment detail response."""

    id: str
    file_path: str
    file_type: str
    git_status: str
    deployment_status: str
    error_message: Optional[str]
    deployed_at: Optional[str]

    class Config:
        from_attributes = True


class DeploymentStatusResponse(BaseModel):
    """Complete deployment status."""

    deployment: DeploymentResponse
    details: list[DeploymentDetailResponse]
    stats: dict


class CancelDeploymentResponse(BaseModel):
    """Response for cancelling a deployment."""

    message: str
    deployment_id: str


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/deploy", response_model=DeploymentResponse)
async def create_deployment(request: DeployRequest, db: Session = Depends(get_db)):
    """
    Create and execute a new deployment.

    Flow:
    1. Compare last successful SHA to current HEAD
    2. Create deployment and details records
    3. Sync repository to workspace
    4. Trigger deployment job

    Returns:
        Deployment record with run_id
    """
    try:
        orchestrator = DeploymentOrchestrator(db)
        deployment = await orchestrator.deploy(
            environment_id=request.environment_id, git_branch=request.git_branch
        )

        return DeploymentResponse(
            id=deployment.id,
            environment_id=deployment.environment_id,
            git_branch=deployment.git_branch,
            git_commit_sha=deployment.git_commit_sha,
            status=deployment.status,
            job_run_id=str(deployment.job_run_id) if deployment.job_run_id else None,
            created_at=deployment.created_at.isoformat(),
            started_at=deployment.started_at.isoformat()
            if deployment.started_at
            else None,
            completed_at=deployment.completed_at.isoformat()
            if deployment.completed_at
            else None,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Deployment failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}")


@router.post("/resume", response_model=DeploymentResponse)
async def resume_deployment(request: ResumeRequest, db: Session = Depends(get_db)):
    """
    Resume a failed deployment.

    Flow:
    1. Validate deployment exists and can be resumed
    2. Retrigger deployment job (no git operations)
    3. Job processes pending/failed items from DB

    Returns:
        Updated deployment record
    """
    try:
        orchestrator = DeploymentOrchestrator(db)
        deployment = await orchestrator.resume(deployment_id=request.deployment_id)

        return DeploymentResponse(
            id=deployment.id,
            environment_id=deployment.environment_id,
            git_branch=deployment.git_branch,
            git_commit_sha=deployment.git_commit_sha,
            status=deployment.status,
            job_run_id=str(deployment.job_run_id) if deployment.job_run_id else None,
            created_at=deployment.created_at.isoformat(),
            started_at=deployment.started_at.isoformat()
            if deployment.started_at
            else None,
            completed_at=deployment.completed_at.isoformat()
            if deployment.completed_at
            else None,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Resume failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Resume failed: {str(e)}")


@router.get("/{deployment_id}/status", response_model=DeploymentStatusResponse)
async def get_deployment_status(deployment_id: str, db: Session = Depends(get_db)):
    """
    Get complete deployment status including all file details.

    Returns:
        Deployment record, file details, and statistics
    """
    try:
        # Expire any cached objects to ensure fresh data from database
        db.expire_all()

        # Get deployment
        deployment = db.query(Deployment).filter_by(id=deployment_id).first()

        if not deployment:
            raise HTTPException(
                status_code=404, detail=f"Deployment {deployment_id} not found"
            )

        # Get details
        details = (
            db.query(DeploymentDetail).filter_by(deployment_id=deployment_id).all()
        )

        # Calculate stats
        stats = {
            "total": len(details),
            "pending": sum(1 for d in details if d.deployment_status == "pending"),
            "in_progress": sum(
                1 for d in details if d.deployment_status == "in_progress"
            ),
            "success": sum(1 for d in details if d.deployment_status == "success"),
            "failed": sum(1 for d in details if d.deployment_status == "failed"),
            "skipped": sum(1 for d in details if d.deployment_status == "skipped"),
        }

        return DeploymentStatusResponse(
            deployment=DeploymentResponse(
                id=deployment.id,
                environment_id=deployment.environment_id,
                git_branch=deployment.git_branch,
                git_commit_sha=deployment.git_commit_sha,
                status=deployment.status,
                job_run_id=str(deployment.job_run_id)
                if deployment.job_run_id
                else None,
                created_at=deployment.created_at.isoformat(),
                started_at=deployment.started_at.isoformat()
                if deployment.started_at
                else None,
                completed_at=deployment.completed_at.isoformat()
                if deployment.completed_at
                else None,
            ),
            details=[
                DeploymentDetailResponse(
                    id=detail.id,
                    file_path=detail.file_path,
                    file_type=detail.file_type,
                    git_status=detail.git_status,
                    deployment_status=detail.deployment_status,
                    error_message=detail.error_message,
                    deployed_at=detail.deployed_at.isoformat()
                    if detail.deployed_at
                    else None,
                )
                for detail in details
            ],
            stats=stats,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get deployment status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.get("/{deployment_id}/details", response_model=list[DeploymentDetailResponse])
async def get_deployment_details(deployment_id: str, db: Session = Depends(get_db)):
    """
    Get deployment file details.

    Returns:
        List of file deployment details
    """
    try:
        # Verify deployment exists
        deployment = db.query(Deployment).filter_by(id=deployment_id).first()
        if not deployment:
            raise HTTPException(
                status_code=404, detail=f"Deployment {deployment_id} not found"
            )

        # Get details
        details = (
            db.query(DeploymentDetail).filter_by(deployment_id=deployment_id).all()
        )

        return [
            DeploymentDetailResponse(
                id=detail.id,
                file_path=detail.file_path,
                file_type=detail.file_type,
                git_status=detail.git_status,
                deployment_status=detail.deployment_status,
                error_message=detail.error_message,
                deployed_at=detail.deployed_at.isoformat()
                if detail.deployed_at
                else None,
            )
            for detail in details
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get deployment details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get details: {str(e)}")


@router.post("/{deployment_id}/cancel", response_model=CancelDeploymentResponse)
async def cancel_deployment(deployment_id: str, db: Session = Depends(get_db)):
    """
    Cancel a running deployment.

    Only deployments in 'pending' or 'running' status can be cancelled.

    Returns:
        Cancellation confirmation
    """
    try:
        # Get deployment
        deployment = db.query(Deployment).filter_by(id=deployment_id).first()
        if not deployment:
            raise HTTPException(
                status_code=404, detail=f"Deployment {deployment_id} not found"
            )

        # Check if cancellable
        if deployment.status not in ["pending", "running"]:
            raise HTTPException(
                status_code=400,
                detail=f"Deployment {deployment_id} cannot be cancelled (status: {deployment.status})",
            )

        # Update status
        deployment.status = "cancelled"
        db.commit()

        return CancelDeploymentResponse(
            message=f"Deployment {deployment_id} has been cancelled",
            deployment_id=deployment_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to cancel: {str(e)}")


@router.get("/", response_model=list[DeploymentResponse])
async def list_deployments(
    environment_id: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)
):
    """
    List recent deployments.

    Args:
        environment_id: Optional filter by environment
        limit: Max number of results

    Returns:
        List of deployments
    """
    try:
        query = db.query(Deployment)

        if environment_id:
            query = query.filter_by(environment_id=environment_id)

        deployments = query.order_by(Deployment.created_at.desc()).limit(limit).all()

        return [
            DeploymentResponse(
                id=deployment.id,
                environment_id=deployment.environment_id,
                git_branch=deployment.git_branch,
                git_commit_sha=deployment.git_commit_sha,
                status=deployment.status,
                job_run_id=str(deployment.job_run_id)
                if deployment.job_run_id
                else None,
                created_at=deployment.created_at.isoformat(),
                started_at=deployment.started_at.isoformat()
                if deployment.started_at
                else None,
                completed_at=deployment.completed_at.isoformat()
                if deployment.completed_at
                else None,
            )
            for deployment in deployments
        ]

    except Exception as e:
        logger.error(f"Failed to list deployments: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to list deployments: {str(e)}"
        )
