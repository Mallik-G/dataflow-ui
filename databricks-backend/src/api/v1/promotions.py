"""
Promotion API Endpoints

Manages deployment promotions across environments with approval workflows.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.exceptions import (
    NotFoundError,
    ValidationError,
    PermissionError,
    DeploymentError,
)
from ...services.deployment_promotion_service import DeploymentPromotionService
from ...services.deployment_service import DeploymentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/promotions", tags=["promotions"])


# -------------------------------------------------------------------------
# Request/Response Models
# -------------------------------------------------------------------------


class PromoteDeploymentRequest(BaseModel):
    """Request to promote deployment to target environment."""

    source_deployment_id: str = Field(..., description="Source deployment ID")
    target_environment_id: str = Field(..., description="Target environment ID")
    requested_by: str = Field(..., description="User requesting promotion")
    promotion_type: str = Field(
        default="manual", description="Promotion type: manual, automatic, or scheduled"
    )


class ApprovePromotionRequest(BaseModel):
    """Request to approve promotion."""

    approver_id: str = Field(..., description="User ID approving")
    approver_email: Optional[str] = Field(None, description="Approver email")
    notes: Optional[str] = Field(None, description="Approval notes")


class RejectPromotionRequest(BaseModel):
    """Request to reject promotion."""

    approver_id: str = Field(..., description="User ID rejecting")
    notes: Optional[str] = Field(None, description="Rejection reason")


class PromotionApprovalResponse(BaseModel):
    """Promotion approval details."""

    id: str
    promotion_id: str
    approver_id: str
    approver_email: Optional[str]
    approver_role: Optional[str]
    decision: str
    decision_at: Optional[str]
    notes: Optional[str]
    requested_at: str

    class Config:
        from_attributes = True


class PromotionResponse(BaseModel):
    """Promotion details."""

    id: str
    source_deployment_id: str
    source_environment_id: str
    target_deployment_id: Optional[str]
    target_environment_id: str
    git_commit_sha: str
    git_branch: str
    promotion_type: str
    requested_by: str
    requested_at: str
    requires_approval: bool
    approved_by: Optional[str]
    approved_at: Optional[str]
    approval_notes: Optional[str]
    status: str
    deployed_at: Optional[str]
    completed_at: Optional[str]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class PromotionWithApprovalsResponse(BaseModel):
    """Promotion with approval details."""

    promotion: PromotionResponse
    approvals: List[PromotionApprovalResponse]


# -------------------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------------------


@router.post("/promote", response_model=PromotionResponse, status_code=status.HTTP_201_CREATED)
async def promote_deployment(
    request: PromoteDeploymentRequest,
    db: Session = Depends(get_db),
):
    """
    Promote deployment to target environment.

    Creates promotion request. If approval required, creates approval requests.
    If no approval required, promotion is automatically approved.

    Returns:
        Promotion record
    """
    try:
        service = DeploymentPromotionService(db)

        promotion = service.promote_deployment(
            source_deployment_id=request.source_deployment_id,
            target_environment_id=request.target_environment_id,
            requested_by=request.requested_by,
            promotion_type=request.promotion_type,
        )

        return PromotionResponse.model_validate(promotion)

    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to promote deployment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Promotion failed: {str(e)}",
        )


@router.post("/{promotion_id}/approve", response_model=PromotionWithApprovalsResponse)
async def approve_promotion(
    promotion_id: str,
    request: ApprovePromotionRequest,
    db: Session = Depends(get_db),
):
    """
    Approve promotion request.

    If sufficient approvals received, promotion status changes to 'approved'.
    Multiple approvals may be required for production environments.

    Returns:
        Promotion with all approval details
    """
    try:
        service = DeploymentPromotionService(db)

        approval, promotion = service.approve_promotion(
            promotion_id=promotion_id,
            approver_id=request.approver_id,
            approver_email=request.approver_email,
            notes=request.notes,
        )

        # Get all approvals
        approvals = service.get_promotion_approvals(promotion_id)

        return PromotionWithApprovalsResponse(
            promotion=PromotionResponse.model_validate(promotion),
            approvals=[
                PromotionApprovalResponse.model_validate(a) for a in approvals
            ],
        )

    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to approve promotion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Approval failed: {str(e)}",
        )


@router.post("/{promotion_id}/reject", response_model=PromotionWithApprovalsResponse)
async def reject_promotion(
    promotion_id: str,
    request: RejectPromotionRequest,
    db: Session = Depends(get_db),
):
    """
    Reject promotion request.

    One rejection is sufficient to reject entire promotion.

    Returns:
        Promotion with all approval details
    """
    try:
        service = DeploymentPromotionService(db)

        approval, promotion = service.reject_promotion(
            promotion_id=promotion_id,
            approver_id=request.approver_id,
            notes=request.notes,
        )

        # Get all approvals
        approvals = service.get_promotion_approvals(promotion_id)

        return PromotionWithApprovalsResponse(
            promotion=PromotionResponse.model_validate(promotion),
            approvals=[
                PromotionApprovalResponse.model_validate(a) for a in approvals
            ],
        )

    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to reject promotion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rejection failed: {str(e)}",
        )


@router.post("/{promotion_id}/execute", response_model=PromotionResponse)
async def execute_promotion(
    promotion_id: str,
    db: Session = Depends(get_db),
):
    """
    Execute approved promotion (deploy to target environment).

    Promotion must be in 'approved' or 'pending' status.
    Creates new deployment in target environment with same git commit SHA.

    Returns:
        Updated promotion record with target deployment ID
    """
    try:
        promotion_service = DeploymentPromotionService(db)
        deployment_service = DeploymentService(db)

        promotion = promotion_service.execute_promotion(
            promotion_id=promotion_id,
            deployment_service=deployment_service,
        )

        return PromotionResponse.model_validate(promotion)

    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except DeploymentError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to execute promotion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Execution failed: {str(e)}",
        )


@router.get("/{promotion_id}", response_model=PromotionWithApprovalsResponse)
async def get_promotion(
    promotion_id: str,
    db: Session = Depends(get_db),
):
    """
    Get promotion details with approvals.

    Returns:
        Promotion with all approval details
    """
    try:
        service = DeploymentPromotionService(db)

        promotion = service.get_promotion(promotion_id)
        approvals = service.get_promotion_approvals(promotion_id)

        return PromotionWithApprovalsResponse(
            promotion=PromotionResponse.model_validate(promotion),
            approvals=[
                PromotionApprovalResponse.model_validate(a) for a in approvals
            ],
        )

    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get promotion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve promotion: {str(e)}",
        )


@router.get("", response_model=List[PromotionResponse])
async def list_promotions(
    environment_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    List promotions with optional filters.

    Args:
        environment_id: Filter by source or target environment
        status: Filter by status
        limit: Maximum number to return (default 50)

    Returns:
        List of promotions
    """
    try:
        service = DeploymentPromotionService(db)

        promotions = service.list_promotions(
            environment_id=environment_id,
            status=status,
            limit=limit,
        )

        return [PromotionResponse.model_validate(p) for p in promotions]

    except Exception as e:
        logger.error(f"Failed to list promotions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list promotions: {str(e)}",
        )


@router.get("/deployments/{deployment_id}/promotion-chain", response_model=List[PromotionResponse])
async def get_promotion_chain(
    deployment_id: str,
    db: Session = Depends(get_db),
):
    """
    Get full promotion chain for deployment.

    Traces deployment through environments:
    Ephemeral → Dev → Staging → Prod

    Returns:
        List of promotions in chronological order
    """
    try:
        service = DeploymentPromotionService(db)

        promotions = service.get_promotion_chain(deployment_id)

        return [PromotionResponse.model_validate(p) for p in promotions]

    except Exception as e:
        logger.error(f"Failed to get promotion chain: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve promotion chain: {str(e)}",
        )
