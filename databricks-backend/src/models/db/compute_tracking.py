"""Database models for DBU cost tracking."""

from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import Index, Text, BigInteger


class PipelineDBUUsage(SQLModel, table=True):
    """Track DBU usage and costs for DLT pipelines."""

    __tablename__ = "pipeline_dbu_usage"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Pipeline identification
    pipeline_id: str = Field(max_length=100, index=True)
    pipeline_name: Optional[str] = Field(default=None, max_length=200)

    # Time dimensions
    usage_date: date = Field(index=True)
    execution_start_time: Optional[datetime] = Field(default=None)
    execution_end_time: Optional[datetime] = Field(default=None)
    execution_duration_minutes: Optional[int] = Field(default=None)

    # DBU metrics
    dbu_consumed: Decimal = Field(max_digits=10, decimal_places=4)  # DBU units consumed
    dbu_unit_price: Optional[Decimal] = Field(
        default=None, max_digits=8, decimal_places=6
    )  # Price per DBU
    dbu_cost_usd: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=4
    )  # Total DBU cost in USD

    # Databricks metadata
    workspace_id: str = Field(max_length=50, index=True)
    environment: Optional[str] = Field(default=None, max_length=50, index=True)
    sku_name: Optional[str] = Field(
        default=None, max_length=100
    )  # e.g., 'DELTA_LIVE_TABLES_PREMIUM'
    job_id: Optional[int] = Field(
        default=None, sa_type=BigInteger
    )  # Databricks job ID if available
    run_id: Optional[int] = Field(
        default=None, sa_type=BigInteger
    )  # Databricks run ID if available

    # Official system.billing.usage fields
    usage_start_time: Optional[datetime] = Field(default=None)  # From usage_start_time
    usage_end_time: Optional[datetime] = Field(default=None)  # From usage_end_time
    billing_origin_product: Optional[str] = Field(
        default=None, max_length=50
    )  # 'DLT', 'JOBS', 'SQL', etc.
    executed_by: Optional[str] = Field(
        default=None, max_length=100
    )  # From identity_metadata.run_as
    dlt_tier: Optional[str] = Field(
        default=None, max_length=20
    )  # From product_features.dlt_tier ('CORE', 'PRO', 'ADVANCED')
    is_serverless: Optional[bool] = Field(
        default=None
    )  # From product_features.is_serverless
    usage_unit: Optional[str] = Field(default=None, max_length=10)  # Should be 'DBU'
    cloud_provider: Optional[str] = Field(
        default=None, max_length=10
    )  # 'AWS', 'AZURE', 'GCP'
    record_type: str = Field(
        default="ORIGINAL", max_length=20
    )  # For corrections tracking

    # Sync metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sync_batch_id: Optional[str] = Field(
        default=None, max_length=50
    )  # Track which sync batch created this record

    # Indexes for common queries
    __table_args__ = (
        Index("idx_pipeline_usage_date", "pipeline_id", "usage_date"),
        Index("idx_workspace_usage_date", "workspace_id", "usage_date"),
        Index("idx_environment_usage_date", "environment", "usage_date"),
        Index("idx_sku_usage_date", "sku_name", "usage_date"),
    )


class DBUAggregates(SQLModel, table=True):
    """Pre-computed DBU usage aggregations for fast querying."""

    __tablename__ = "dbu_aggregates"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Aggregation dimensions
    aggregation_level: str = Field(max_length=20)  # 'daily', 'weekly', 'monthly'
    aggregation_date: date
    pipeline_id: Optional[str] = Field(default=None, max_length=100, index=True)
    workspace_id: Optional[str] = Field(default=None, max_length=50, index=True)
    environment: Optional[str] = Field(default=None, max_length=50, index=True)

    # Aggregated DBU metrics
    total_executions: int = Field(default=0)
    total_duration_minutes: int = Field(default=0)
    total_dbu_consumed: Decimal = Field(
        default=Decimal("0"), max_digits=12, decimal_places=4
    )
    total_dbu_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )

    # Statistical metrics
    avg_execution_duration: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=2
    )
    avg_dbu_per_execution: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=4
    )
    max_execution_duration: Optional[int] = Field(default=None)
    min_execution_duration: Optional[int] = Field(default=None)
    max_dbu_consumption: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=4
    )
    min_dbu_consumption: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=4
    )

    # Sync metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_agg_level_date", "aggregation_level", "aggregation_date"),
        Index(
            "idx_pipeline_agg", "pipeline_id", "aggregation_level", "aggregation_date"
        ),
        Index(
            "idx_workspace_agg", "workspace_id", "aggregation_level", "aggregation_date"
        ),
    )


class DBUPricingRules(SQLModel, table=True):
    """DBU pricing rules and configuration."""

    __tablename__ = "dbu_pricing_rules"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Pricing identification
    sku_name: str = Field(max_length=100)  # e.g., 'DELTA_LIVE_TABLES_PREMIUM'
    region: Optional[str] = Field(
        default=None, max_length=50
    )  # e.g., 'us-west-2', 'eu-west-1'
    pricing_tier: Optional[str] = Field(
        default=None, max_length=50
    )  # e.g., 'standard', 'premium'

    # Pricing details
    dbu_unit_price: Decimal = Field(max_digits=8, decimal_places=6)  # Price per DBU
    currency: str = Field(default="USD", max_length=3)

    # Validity period
    effective_date: date
    end_date: Optional[date] = Field(default=None)  # NULL means currently active

    # Configuration
    is_active: bool = Field(default=True)
    description: Optional[str] = Field(default=None, sa_type=Text)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_sku_date", "sku_name", "effective_date"),
        Index("idx_region_sku", "region", "sku_name"),
    )


class MonthlyDBUInvoice(SQLModel, table=True):
    """Monthly DBU cost summaries for invoicing."""

    __tablename__ = "monthly_dbu_invoices"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Invoice identification
    invoice_month: date  # First day of month (e.g., 2024-01-01)
    workspace_id: str = Field(max_length=50, index=True)
    environment: Optional[str] = Field(default=None, max_length=50, index=True)

    # Summary metrics
    total_pipelines: int = Field(default=0)
    total_executions: int = Field(default=0)
    total_duration_minutes: int = Field(default=0)
    total_dbu_consumed: Decimal = Field(
        default=Decimal("0"), max_digits=12, decimal_places=4
    )
    total_dbu_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )

    # Cost breakdown by SKU
    premium_dlt_dbu: Decimal = Field(
        default=Decimal("0"), max_digits=12, decimal_places=4
    )
    premium_dlt_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )
    standard_dlt_dbu: Decimal = Field(
        default=Decimal("0"), max_digits=12, decimal_places=4
    )
    standard_dlt_cost_usd: Decimal = Field(
        default=Decimal("0"), max_digits=15, decimal_places=4
    )

    # Invoice metadata
    invoice_status: str = Field(default="draft", max_length=20)  # draft, final, sent
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    invoice_data: Optional[str] = Field(
        default=None, sa_type=Text
    )  # JSON with detailed breakdown per pipeline

    # Cost analysis
    avg_daily_cost: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=4
    )
    cost_vs_previous_month: Optional[Decimal] = Field(
        default=None, max_digits=8, decimal_places=2
    )  # Percentage change

    __table_args__ = (
        Index("idx_invoice_month_workspace", "invoice_month", "workspace_id"),
        Index("idx_invoice_status", "invoice_status"),
    )


class DBUSyncStatus(SQLModel, table=True):
    """Track DBU sync status for incremental data loading."""

    __tablename__ = "dbu_sync_status"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Sync identification
    workspace_id: str = Field(max_length=50)
    environment: Optional[str] = Field(default=None, max_length=50)

    # Sync status
    last_sync_date: Optional[date] = Field(
        default=None
    )  # Last date successfully synced
    last_successful_sync: Optional[datetime] = Field(default=None)
    last_sync_attempt: Optional[datetime] = Field(default=None)
    last_sync_status: Optional[str] = Field(
        default=None, max_length=20
    )  # 'success', 'failed', 'in_progress'

    # Sync statistics
    records_processed: int = Field(default=0)
    dbu_records_found: int = Field(default=0)
    sync_duration_seconds: Optional[int] = Field(default=None)
    sync_batch_id: Optional[str] = Field(default=None, max_length=50)

    # Error handling
    error_message: Optional[str] = Field(default=None, sa_type=Text)
    retry_count: int = Field(default=0)
    max_retries: int = Field(default=3)

    # Next sync planning
    next_sync_date: Optional[date] = Field(default=None)  # Next date to sync
    sync_enabled: bool = Field(default=True)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_workspace_sync_status", "workspace_id", "last_sync_status"),
        Index("idx_last_sync_date", "last_sync_date"),
    )


class DBUCostAlert(SQLModel, table=True):
    """DBU cost alerts and anomaly detection."""

    __tablename__ = "dbu_cost_alerts"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Alert identification
    alert_type: str = Field(
        max_length=50
    )  # 'cost_spike', 'usage_anomaly', 'budget_exceeded'
    pipeline_id: Optional[str] = Field(default=None, max_length=100, index=True)
    workspace_id: Optional[str] = Field(default=None, max_length=50, index=True)
    environment: Optional[str] = Field(default=None, max_length=50, index=True)

    # Alert details
    alert_date: date
    alert_message: Optional[str] = Field(default=None, sa_type=Text)
    severity: Optional[str] = Field(
        default=None, max_length=20
    )  # 'low', 'medium', 'high', 'critical'

    # Metrics that triggered alert
    current_value: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=4
    )
    threshold_value: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=4
    )
    baseline_value: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=4
    )
    percentage_change: Optional[Decimal] = Field(
        default=None, max_digits=8, decimal_places=2
    )

    # Alert status
    alert_status: str = Field(
        default="open", max_length=20
    )  # 'open', 'acknowledged', 'resolved'
    acknowledged_at: Optional[datetime] = Field(default=None)
    resolved_at: Optional[datetime] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_alert_date_type", "alert_date", "alert_type"),
        Index("idx_pipeline_alerts", "pipeline_id", "alert_status"),
    )
