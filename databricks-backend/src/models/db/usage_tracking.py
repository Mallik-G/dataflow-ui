"""Database models for cost and usage tracking."""

from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Index, Text


class PipelineUsage(SQLModel, table=True):
    """Track DLT pipeline usage and costs."""

    __tablename__ = "pipeline_usage"

    id: Optional[int] = Field(default=None, primary_key=True)
    pipeline_id: str = Field(max_length=100, index=True)
    pipeline_name: Optional[str] = Field(default=None, max_length=200)

    # Time dimensions
    usage_date: date = Field(index=True)
    execution_start_time: Optional[datetime] = Field(default=None)
    execution_end_time: Optional[datetime] = Field(default=None)

    # Usage metrics
    execution_duration_minutes: Optional[int] = Field(default=None)  # Total runtime
    dbu_consumed: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=4
    )  # Databricks Units consumed
    cluster_size: Optional[str] = Field(
        default=None, max_length=50
    )  # e.g., "Small", "Medium", "Large"
    node_count: Optional[int] = Field(default=None)

    # Cost calculations
    compute_cost_usd: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=4
    )  # Compute costs in USD
    storage_cost_usd: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=4
    )  # Storage costs in USD
    total_cost_usd: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=4
    )  # Total cost in USD

    # Metadata
    workspace_id: Optional[str] = Field(default=None, max_length=50, index=True)
    environment: Optional[str] = Field(default=None, max_length=50, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Add indexes for common queries (ensure globally unique names in SQLite)
    __table_args__ = (
        Index("idx_usage_pipeline_usage_date", "pipeline_id", "usage_date"),
        Index("idx_usage_workspace_usage_date", "workspace_id", "usage_date"),
        Index("idx_usage_environment_usage_date", "environment", "usage_date"),
    )


class UsageAggregates(SQLModel, table=True):
    """Pre-computed usage aggregations for fast querying."""

    __tablename__ = "usage_aggregates"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Aggregation dimensions
    aggregation_level: str = Field(max_length=20)  # 'daily', 'weekly', 'monthly'
    aggregation_date: date
    pipeline_id: Optional[str] = Field(default=None, max_length=100, index=True)
    workspace_id: Optional[str] = Field(default=None, max_length=50, index=True)
    environment: Optional[str] = Field(default=None, max_length=50, index=True)

    # Aggregated metrics
    total_executions: int = Field(default=0)
    total_duration_minutes: int = Field(default=0)
    total_dbu_consumed: Decimal = Field(
        default=Decimal("0"), max_digits=12, decimal_places=4
    )
    total_compute_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )
    total_storage_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )
    total_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )

    # Statistics
    avg_execution_duration: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=2
    )
    max_execution_duration: Optional[int] = Field(default=None)
    min_execution_duration: Optional[int] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_usage_agg_level_date", "aggregation_level", "aggregation_date"),
        Index(
            "idx_usage_pipeline_agg",
            "pipeline_id",
            "aggregation_level",
            "aggregation_date",
        ),
    )


class CostingRules(SQLModel, table=True):
    """Configuration for cost calculations and pricing."""

    __tablename__ = "costing_rules"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Rule identification
    rule_name: str = Field(max_length=100)
    rule_type: str = Field(max_length=50)  # 'dbu_pricing', 'storage_pricing', etc.

    # Pricing parameters
    region: Optional[str] = Field(default=None, max_length=50)
    instance_type: Optional[str] = Field(default=None, max_length=50)
    tier: Optional[str] = Field(
        default=None, max_length=50
    )  # 'standard', 'premium', etc.

    # Cost values
    unit_cost: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=6
    )  # Cost per unit (DBU, GB, etc.)
    currency: str = Field(default="USD", max_length=3)

    # Validity period
    effective_date: date
    end_date: Optional[date] = Field(default=None)

    # Configuration
    is_active: str = Field(default="true", max_length=10)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("idx_usage_rule_type_date", "rule_type", "effective_date"),)


class MonthlyInvoice(SQLModel, table=True):
    """Monthly cost summaries for invoicing."""

    __tablename__ = "monthly_invoices"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Invoice identification
    invoice_month: date  # First day of month
    workspace_id: str = Field(max_length=50, index=True)
    environment: Optional[str] = Field(default=None, max_length=50, index=True)

    # Summary metrics
    total_pipelines: int = Field(default=0)
    total_executions: int = Field(default=0)
    total_dbu_consumed: Decimal = Field(
        default=Decimal("0"), max_digits=12, decimal_places=4
    )
    total_compute_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )
    total_storage_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )
    total_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )

    # Invoice metadata
    invoice_status: str = Field(default="draft", max_length=20)  # draft, final, sent
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    invoice_data: Optional[str] = Field(
        default=None, sa_type=Text
    )  # JSON with detailed breakdown

    __table_args__ = (
        Index("idx_usage_invoice_month_workspace", "invoice_month", "workspace_id"),
    )


class UsageSyncStatus(SQLModel, table=True):
    """Track sync status for incremental data loading."""

    __tablename__ = "usage_sync_status"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Sync identification
    sync_type: str = Field(max_length=50)  # 'pipeline_usage', 'billing_usage'
    workspace_id: str = Field(max_length=50)

    # Sync status
    last_sync_date: Optional[date] = Field(default=None)
    last_successful_sync: Optional[datetime] = Field(default=None)
    last_sync_status: Optional[str] = Field(
        default=None, max_length=20
    )  # 'success', 'failed', 'in_progress'

    # Sync statistics
    records_processed: int = Field(default=0)
    sync_duration_seconds: Optional[int] = Field(default=None)
    error_message: Optional[str] = Field(default=None, sa_type=Text)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_usage_sync_type_workspace", "sync_type", "workspace_id"),
    )
