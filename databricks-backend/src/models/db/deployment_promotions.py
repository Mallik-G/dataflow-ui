"""Deployment Promotion Models."""

from datetime import datetime, timezone
from typing import Optional, List

from sqlmodel import SQLModel, Field, Index, JSON
from sqlalchemy import Text


class DeploymentPromotion(SQLModel, table=True):
    """
    Tracks deployment promotions across environments.

    Enables environment progression: Ephemeral → Dev → Staging → Prod
    """

    __tablename__ = "deployment_promotions"

    id: str = Field(primary_key=True)  # promotion-uuid

    # Source deployment (what we're promoting)
    source_deployment_id: str = Field(foreign_key="deployments.id")
    source_environment_id: str = Field(foreign_key="environments.id")

    # Target deployment (where we're promoting to)
    target_deployment_id: Optional[str] = Field(
        default=None, foreign_key="deployments.id"
    )
    target_environment_id: str = Field(foreign_key="environments.id")

    # Git tracking (same SHA across environments)
    git_commit_sha: str  # Ensures same code deployed everywhere
    git_branch: str  # Source branch

    # Promotion metadata
    promotion_type: str = Field(
        default="manual"
    )  # manual, automatic, scheduled
    requested_by: str  # User who requested promotion
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Approval workflow
    requires_approval: bool = Field(default=False)
    approved_by: Optional[str] = Field(default=None)
    approved_at: Optional[datetime] = Field(default=None)
    approval_notes: Optional[str] = Field(default=None, sa_type=Text)

    # Status tracking
    status: str = Field(
        default="pending"
    )  # pending, pending_approval, approved, rejected, deploying, deployed, failed, cancelled

    # Deployment timing
    deployed_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)

    # Results
    error_message: Optional[str] = Field(default=None, sa_type=Text)
    deployment_log: Optional[str] = Field(default=None, sa_type=Text)

    def __repr__(self):
        return f"<DeploymentPromotion(id='{self.id}', {self.source_environment_id}→{self.target_environment_id}, status='{self.status}')>"


class PromotionApproval(SQLModel, table=True):
    """
    Tracks individual approvals for multi-approver promotions.

    Some environments (like prod) may require multiple approvers.
    """

    __tablename__ = "promotion_approvals"

    id: str = Field(primary_key=True)
    promotion_id: str = Field(foreign_key="deployment_promotions.id")

    # Approver info
    approver_id: str  # User ID
    approver_email: Optional[str] = Field(default=None)
    approver_role: Optional[str] = Field(default=None)  # manager, tech_lead, admin

    # Approval decision
    decision: str  # approved, rejected, pending
    decision_at: Optional[datetime] = Field(default=None)
    notes: Optional[str] = Field(default=None, sa_type=Text)

    # Requested
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<PromotionApproval(promotion='{self.promotion_id}', approver='{self.approver_id}', decision='{self.decision}')>"


class EnvironmentPromotionRule(SQLModel, table=True):
    """
    Defines promotion rules per environment.

    Specifies which environments can promote to this environment,
    approval requirements, and constraints.
    """

    __tablename__ = "environment_promotion_rules"

    id: str = Field(primary_key=True)
    environment_id: str = Field(foreign_key="environments.id", unique=True)

    # Promotion sources (which environments can promote here)
    allowed_source_environments: List[str] = Field(
        default_factory=list, sa_type=JSON
    )  # ["dev", "ephemeral"]

    # Approval requirements
    requires_approval: bool = Field(default=False)
    min_approvals: int = Field(default=1)  # Minimum number of approvals needed
    required_approvers: List[str] = Field(
        default_factory=list, sa_type=JSON
    )  # List of user IDs who can approve

    # Git branch requirements
    target_git_branch: Optional[str] = Field(default=None)  # main, release, develop
    require_pr: bool = Field(default=False)  # Require PR before promotion
    require_pr_approval: bool = Field(default=False)  # PR must be approved

    # Deployment window constraints
    deployment_window_enabled: bool = Field(default=False)
    deployment_window_days: List[str] = Field(
        default_factory=lambda: ["Mon", "Tue", "Wed", "Thu", "Fri"], sa_type=JSON
    )  # Days allowed
    deployment_window_hours: Optional[str] = Field(
        default=None
    )  # "09:00-17:00" (24hr format)

    # Auto-promotion
    auto_promote: bool = Field(default=False)  # Auto-promote after source deployment
    auto_promote_delay_minutes: int = Field(
        default=0
    )  # Wait before auto-promoting

    # Constraints
    require_tests_pass: bool = Field(default=False)  # All tests must pass
    require_clean_build: bool = Field(default=False)  # No build errors

    def __repr__(self):
        return f"<EnvironmentPromotionRule(env='{self.environment_id}', requires_approval={self.requires_approval})>"


# Indexes for performance
Index("idx_promotions_source_env", "source_environment_id")
Index("idx_promotions_target_env", "target_environment_id")
Index("idx_promotions_status", "status")
Index("idx_promotions_source_deployment", "source_deployment_id")
Index("idx_promotion_approvals_promotion", "promotion_id")
Index("idx_promotion_approvals_approver", "approver_id")
