"""
Deployment Promotion Service

Manages promotion of deployments across environments with approval workflows.
Enables controlled progression: Ephemeral → Dev → Staging → Prod
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models.db.deployment_promotions import (
    DeploymentPromotion,
    PromotionApproval,
    EnvironmentPromotionRule,
)
from ..models.db.deployments import Deployment, Environment
from ..core.exceptions import (
    ValidationError,
    DeploymentError,
    NotFoundError,
    PermissionError,
)

logger = logging.getLogger(__name__)


class DeploymentPromotionService:
    """Service for managing deployment promotions across environments."""

    def __init__(self, db: Session):
        self.db = db

    def promote_deployment(
        self,
        source_deployment_id: str,
        target_environment_id: str,
        requested_by: str,
        promotion_type: str = "manual",
    ) -> DeploymentPromotion:
        """
        Initiate promotion of deployment to target environment.

        Args:
            source_deployment_id: Source deployment ID
            target_environment_id: Target environment ID
            requested_by: User requesting promotion
            promotion_type: manual, automatic, or scheduled

        Returns:
            DeploymentPromotion record

        Raises:
            NotFoundError: If deployment or environment not found
            ValidationError: If promotion not allowed by rules
        """
        logger.info(
            f"Initiating promotion: deployment {source_deployment_id} → env {target_environment_id}"
        )

        # Get source deployment
        source_deployment = (
            self.db.query(Deployment).filter_by(id=source_deployment_id).first()
        )

        if not source_deployment:
            raise NotFoundError(f"Source deployment {source_deployment_id} not found")

        # Get target environment
        target_env = (
            self.db.query(Environment).filter_by(id=target_environment_id).first()
        )

        if not target_env:
            raise NotFoundError(f"Target environment {target_environment_id} not found")

        # Check promotion eligibility
        is_eligible, reason = self._check_promotion_eligibility(
            source_deployment.environment_id, target_environment_id
        )

        if not is_eligible:
            raise ValidationError(f"Promotion not allowed: {reason}")

        # Get promotion rules for target environment
        rules = self._get_promotion_rules(target_environment_id)

        # Create promotion record
        promotion = DeploymentPromotion(
            id=f"promotion-{uuid.uuid4()}",
            source_deployment_id=source_deployment_id,
            source_environment_id=source_deployment.environment_id,
            target_environment_id=target_environment_id,
            git_commit_sha=source_deployment.git_commit_sha,
            git_branch=source_deployment.git_branch,
            promotion_type=promotion_type,
            requested_by=requested_by,
            requested_at=datetime.now(timezone.utc),
            requires_approval=rules.requires_approval if rules else False,
            status="pending_approval" if (rules and rules.requires_approval) else "pending",
        )

        self.db.add(promotion)
        self.db.commit()
        self.db.refresh(promotion)

        logger.info(f"Created promotion {promotion.id} (status: {promotion.status})")

        # If requires approval, create approval requests
        if rules and rules.requires_approval:
            self._create_approval_requests(promotion.id, rules)

        # If auto-promote enabled and no approval needed, start deployment
        if rules and rules.auto_promote and not rules.requires_approval:
            logger.info(f"Auto-promoting {promotion.id} (no approval required)")
            # This would trigger actual deployment
            # For now, just mark as approved
            promotion.status = "approved"
            self.db.commit()

        return promotion

    def approve_promotion(
        self,
        promotion_id: str,
        approver_id: str,
        approver_email: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Tuple[PromotionApproval, DeploymentPromotion]:
        """
        Approve a promotion request.

        Args:
            promotion_id: Promotion ID
            approver_id: User ID approving
            approver_email: Approver email (optional)
            notes: Approval notes (optional)

        Returns:
            Tuple of (PromotionApproval, updated DeploymentPromotion)

        Raises:
            NotFoundError: If promotion not found
            PermissionError: If user not authorized to approve
            ValidationError: If promotion not in approvable state
        """
        logger.info(f"Processing approval for promotion {promotion_id} by {approver_id}")

        # Get promotion
        promotion = (
            self.db.query(DeploymentPromotion).filter_by(id=promotion_id).first()
        )

        if not promotion:
            raise NotFoundError(f"Promotion {promotion_id} not found")

        # Validate state
        if promotion.status not in ["pending_approval"]:
            raise ValidationError(
                f"Promotion cannot be approved in status: {promotion.status}"
            )

        # Get pending approval for this approver
        approval = (
            self.db.query(PromotionApproval)
            .filter(
                and_(
                    PromotionApproval.promotion_id == promotion_id,
                    PromotionApproval.approver_id == approver_id,
                    PromotionApproval.decision == "pending",
                )
            )
            .first()
        )

        if not approval:
            raise PermissionError(f"User {approver_id} not authorized to approve this promotion")

        # Update approval
        approval.decision = "approved"
        approval.decision_at = datetime.now(timezone.utc)
        approval.notes = notes

        self.db.commit()

        logger.info(f"Approval recorded for {promotion_id} by {approver_id}")

        # Check if all required approvals received
        if self._has_sufficient_approvals(promotion_id):
            promotion.status = "approved"
            promotion.approved_by = approver_id
            promotion.approved_at = datetime.now(timezone.utc)
            promotion.approval_notes = notes

            self.db.commit()

            logger.info(f"Promotion {promotion_id} fully approved - ready for deployment")

        self.db.refresh(promotion)

        return approval, promotion

    def reject_promotion(
        self,
        promotion_id: str,
        approver_id: str,
        notes: Optional[str] = None,
    ) -> Tuple[PromotionApproval, DeploymentPromotion]:
        """
        Reject a promotion request.

        Args:
            promotion_id: Promotion ID
            approver_id: User ID rejecting
            notes: Rejection notes (optional)

        Returns:
            Tuple of (PromotionApproval, updated DeploymentPromotion)

        Raises:
            NotFoundError: If promotion not found
            PermissionError: If user not authorized to reject
        """
        logger.info(f"Processing rejection for promotion {promotion_id} by {approver_id}")

        # Get promotion
        promotion = (
            self.db.query(DeploymentPromotion).filter_by(id=promotion_id).first()
        )

        if not promotion:
            raise NotFoundError(f"Promotion {promotion_id} not found")

        # Get pending approval for this approver
        approval = (
            self.db.query(PromotionApproval)
            .filter(
                and_(
                    PromotionApproval.promotion_id == promotion_id,
                    PromotionApproval.approver_id == approver_id,
                    PromotionApproval.decision == "pending",
                )
            )
            .first()
        )

        if not approval:
            raise PermissionError(f"User {approver_id} not authorized to reject this promotion")

        # Update approval
        approval.decision = "rejected"
        approval.decision_at = datetime.now(timezone.utc)
        approval.notes = notes

        # Reject entire promotion (one rejection is enough)
        promotion.status = "rejected"

        self.db.commit()
        self.db.refresh(promotion)

        logger.info(f"Promotion {promotion_id} rejected by {approver_id}")

        return approval, promotion

    def execute_promotion(
        self, promotion_id: str, deployment_service
    ) -> DeploymentPromotion:
        """
        Execute approved promotion (actually deploy to target environment).

        Args:
            promotion_id: Promotion ID
            deployment_service: DeploymentService instance to execute deployment

        Returns:
            Updated promotion record

        Raises:
            NotFoundError: If promotion not found
            ValidationError: If promotion not approved
            DeploymentError: If deployment fails
        """
        logger.info(f"Executing promotion {promotion_id}")

        promotion = (
            self.db.query(DeploymentPromotion).filter_by(id=promotion_id).first()
        )

        if not promotion:
            raise NotFoundError(f"Promotion {promotion_id} not found")

        # Validate approved status
        if promotion.status not in ["approved", "pending"]:
            raise ValidationError(
                f"Promotion must be approved before execution (current status: {promotion.status})"
            )

        # Update status to deploying
        promotion.status = "deploying"
        promotion.deployed_at = datetime.now(timezone.utc)
        self.db.commit()

        try:
            # Execute deployment to target environment
            # Use same git commit SHA to ensure consistency
            target_deployment = deployment_service.deploy(
                environment_id=promotion.target_environment_id,
                git_branch=promotion.git_branch,
                git_commit_sha=promotion.git_commit_sha,
            )

            # Update promotion with target deployment ID
            promotion.target_deployment_id = target_deployment.id
            promotion.status = "deployed"
            promotion.completed_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(promotion)

            logger.info(
                f"Promotion {promotion_id} completed successfully (deployment: {target_deployment.id})"
            )

            return promotion

        except Exception as e:
            logger.error(f"Promotion {promotion_id} failed: {e}")

            promotion.status = "failed"
            promotion.error_message = str(e)
            promotion.completed_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(promotion)

            raise DeploymentError(f"Promotion failed: {e}")

    def get_promotion(self, promotion_id: str) -> DeploymentPromotion:
        """
        Get promotion by ID.

        Args:
            promotion_id: Promotion ID

        Returns:
            DeploymentPromotion record

        Raises:
            NotFoundError: If promotion not found
        """
        promotion = (
            self.db.query(DeploymentPromotion).filter_by(id=promotion_id).first()
        )

        if not promotion:
            raise NotFoundError(f"Promotion {promotion_id} not found")

        return promotion

    def get_promotion_approvals(self, promotion_id: str) -> List[PromotionApproval]:
        """
        Get all approvals for a promotion.

        Args:
            promotion_id: Promotion ID

        Returns:
            List of PromotionApproval records
        """
        approvals = (
            self.db.query(PromotionApproval)
            .filter_by(promotion_id=promotion_id)
            .all()
        )

        return approvals

    def list_promotions(
        self,
        environment_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[DeploymentPromotion]:
        """
        List promotions with optional filters.

        Args:
            environment_id: Filter by source or target environment
            status: Filter by status
            limit: Maximum number to return

        Returns:
            List of DeploymentPromotion records
        """
        query = self.db.query(DeploymentPromotion)

        if environment_id:
            query = query.filter(
                or_(
                    DeploymentPromotion.source_environment_id == environment_id,
                    DeploymentPromotion.target_environment_id == environment_id,
                )
            )

        if status:
            query = query.filter(DeploymentPromotion.status == status)

        promotions = query.order_by(DeploymentPromotion.requested_at.desc()).limit(limit).all()

        return promotions

    def get_promotion_chain(self, deployment_id: str) -> List[DeploymentPromotion]:
        """
        Get full promotion chain for a deployment.

        Traces deployment through: Ephemeral → Dev → Staging → Prod

        Args:
            deployment_id: Starting deployment ID

        Returns:
            List of promotions in chronological order
        """
        promotions = []

        # Find promotions where this deployment is source
        current_promotions = (
            self.db.query(DeploymentPromotion)
            .filter_by(source_deployment_id=deployment_id)
            .order_by(DeploymentPromotion.requested_at.asc())
            .all()
        )

        promotions.extend(current_promotions)

        # Recursively find promotions of target deployments
        for promotion in current_promotions:
            if promotion.target_deployment_id:
                chain = self.get_promotion_chain(promotion.target_deployment_id)
                promotions.extend(chain)

        return promotions

    # -------------------------------------------------------------------------
    # Private Helper Methods
    # -------------------------------------------------------------------------

    def _get_promotion_rules(
        self, environment_id: str
    ) -> Optional[EnvironmentPromotionRule]:
        """Get promotion rules for environment."""
        rules = (
            self.db.query(EnvironmentPromotionRule)
            .filter_by(environment_id=environment_id)
            .first()
        )

        return rules

    def _check_promotion_eligibility(
        self, source_environment_id: str, target_environment_id: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if promotion is allowed from source to target environment.

        Returns:
            Tuple of (is_eligible, reason_if_not)
        """
        # Get target environment rules
        rules = self._get_promotion_rules(target_environment_id)

        if not rules:
            # No rules defined - allow by default
            return True, None

        # Check if source environment is in allowed list
        if rules.allowed_source_environments:
            if source_environment_id not in rules.allowed_source_environments:
                return (
                    False,
                    f"Source environment {source_environment_id} not in allowed list: {rules.allowed_source_environments}",
                )

        # Check deployment window
        if rules.deployment_window_enabled:
            is_in_window, window_reason = self._check_deployment_window(rules)
            if not is_in_window:
                return False, window_reason

        return True, None

    def _check_deployment_window(
        self, rules: EnvironmentPromotionRule
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if current time is within deployment window.

        Returns:
            Tuple of (is_in_window, reason_if_not)
        """
        now = datetime.now(timezone.utc)

        # Check day of week
        day_name = now.strftime("%a")  # Mon, Tue, Wed, etc.

        if rules.deployment_window_days and day_name not in rules.deployment_window_days:
            return False, f"Deployments only allowed on: {', '.join(rules.deployment_window_days)}"

        # Check time window
        if rules.deployment_window_hours:
            # Parse hours (format: "09:00-17:00")
            try:
                start_str, end_str = rules.deployment_window_hours.split("-")
                start_hour, start_min = map(int, start_str.split(":"))
                end_hour, end_min = map(int, end_str.split(":"))

                current_hour = now.hour
                current_min = now.minute

                # Convert to minutes for easier comparison
                current_minutes = current_hour * 60 + current_min
                start_minutes = start_hour * 60 + start_min
                end_minutes = end_hour * 60 + end_min

                if not (start_minutes <= current_minutes <= end_minutes):
                    return False, f"Deployments only allowed during: {rules.deployment_window_hours} UTC"

            except Exception as e:
                logger.error(f"Failed to parse deployment window hours: {e}")

        return True, None

    def _create_approval_requests(
        self, promotion_id: str, rules: EnvironmentPromotionRule
    ) -> None:
        """
        Create approval requests for required approvers.

        Args:
            promotion_id: Promotion ID
            rules: Promotion rules with approver list
        """
        if not rules.required_approvers:
            logger.warning(
                f"No approvers configured for promotion {promotion_id} (min_approvals: {rules.min_approvals})"
            )
            return

        for approver_id in rules.required_approvers:
            approval = PromotionApproval(
                id=f"approval-{uuid.uuid4()}",
                promotion_id=promotion_id,
                approver_id=approver_id,
                decision="pending",
                requested_at=datetime.now(timezone.utc),
            )

            self.db.add(approval)

        self.db.commit()

        logger.info(
            f"Created {len(rules.required_approvers)} approval requests for promotion {promotion_id}"
        )

    def _has_sufficient_approvals(self, promotion_id: str) -> bool:
        """
        Check if promotion has received sufficient approvals.

        Returns:
            True if enough approvals received
        """
        promotion = (
            self.db.query(DeploymentPromotion).filter_by(id=promotion_id).first()
        )

        if not promotion:
            return False

        # Get promotion rules
        rules = self._get_promotion_rules(promotion.target_environment_id)

        if not rules or not rules.requires_approval:
            return True

        # Count approved approvals
        approved_count = (
            self.db.query(PromotionApproval)
            .filter(
                and_(
                    PromotionApproval.promotion_id == promotion_id,
                    PromotionApproval.decision == "approved",
                )
            )
            .count()
        )

        min_required = rules.min_approvals or 1

        logger.debug(
            f"Promotion {promotion_id}: {approved_count}/{min_required} approvals received"
        )

        return approved_count >= min_required
