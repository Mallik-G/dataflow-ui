"""Pydantic models for DBU usage and cost tracking API responses."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class DBUUsageStatus(str, Enum):
    """Status of compute usage tracking."""

    ACTIVE = "active"
    SYNCING = "syncing"
    ERROR = "error"
    DISABLED = "disabled"


class SyncStatus(str, Enum):
    """Sync operation status."""

    SUCCESS = "success"
    FAILED = "failed"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DBUUsageRecord(BaseModel):
    """Individual compute usage record."""

    model_config = {"title": "ComputeUsageRecord"}

    pipeline_id: str = Field(..., description="Pipeline identifier")
    pipeline_name: Optional[str] = Field(None, description="Pipeline name")
    usage_date: date = Field(..., description="Usage date")
    execution_start_time: Optional[datetime] = Field(
        None, description="Execution start time"
    )
    execution_end_time: Optional[datetime] = Field(
        None, description="Execution end time"
    )
    execution_duration_minutes: Optional[int] = Field(
        None, description="Execution duration in minutes"
    )
    dbu_consumed: Decimal = Field(
        ..., description="Compute units consumed", alias="compute_units_consumed"
    )
    dbu_unit_price: Optional[Decimal] = Field(
        None, description="Compute unit price in USD", alias="compute_unit_price"
    )
    dbu_cost_usd: Optional[Decimal] = Field(
        None, description="Total compute cost in USD", alias="compute_cost_usd"
    )
    workspace_id: str = Field(
        ..., description="Organization identifier", alias="organization_id"
    )
    environment: Optional[str] = Field(None, description="Environment name")
    sku_name: Optional[str] = Field(None, description="Platform SKU name")


class DBUUsageSummary(BaseModel):
    """Summary of compute usage over a period."""

    model_config = {"title": "ComputeUsageSummary"}

    pipeline_id: Optional[str] = Field(
        None, description="Pipeline ID (null for aggregated)"
    )
    pipeline_name: Optional[str] = Field(None, description="Pipeline name")
    workspace_id: Optional[str] = Field(
        None, description="Organization ID", alias="organization_id"
    )
    environment: Optional[str] = Field(None, description="Environment")
    period_start: date = Field(..., description="Period start date")
    period_end: date = Field(..., description="Period end date")
    total_executions: int = Field(0, description="Total number of executions")
    total_duration_minutes: int = Field(0, description="Total execution duration")
    total_dbu_consumed: Decimal = Field(
        Decimal("0"),
        description="Total compute units consumed",
        alias="total_compute_units_consumed",
    )
    total_dbu_cost_usd: Decimal = Field(
        Decimal("0"),
        description="Total compute cost in USD",
        alias="total_compute_cost_usd",
    )
    avg_execution_duration: Optional[float] = Field(
        None, description="Average execution duration"
    )
    avg_dbu_per_execution: Optional[Decimal] = Field(
        None,
        description="Average compute units per execution",
        alias="avg_compute_units_per_execution",
    )
    avg_daily_cost: Optional[Decimal] = Field(None, description="Average daily cost")


class DBUCostBreakdown(BaseModel):
    """Cost breakdown by different dimensions."""

    model_config = {"title": "ComputeCostBreakdown"}

    period_start: date = Field(..., description="Period start date")
    period_end: date = Field(..., description="Period end date")
    total_dbu_consumed: Decimal = Field(
        Decimal("0"),
        description="Total compute units consumed",
        alias="total_compute_units_consumed",
    )
    total_dbu_cost_usd: Decimal = Field(
        Decimal("0"),
        description="Total compute cost in USD",
        alias="total_compute_cost_usd",
    )

    # Cost by pipeline
    by_pipeline: list[dict[str, Any]] = Field(
        default_factory=list, description="Cost breakdown by pipeline"
    )

    # Cost by SKU type
    by_sku: list[dict[str, Any]] = Field(
        default_factory=list, description="Cost breakdown by SKU"
    )

    # Cost by environment
    by_environment: list[dict[str, Any]] = Field(
        default_factory=list, description="Cost breakdown by environment"
    )

    # Daily cost trend
    daily_costs: list[dict[str, Any]] = Field(
        default_factory=list, description="Daily cost trend"
    )


class DBUTrendData(BaseModel):
    """Compute usage trend over time."""

    model_config = {"title": "ComputeTrendData"}

    date_: date = Field(
        ...,
        description="Date",
        alias="date",
        serialization_alias="date",
        validation_alias="date",
    )
    dbu_consumed: Decimal = Field(
        Decimal("0"),
        description="Compute units consumed",
        alias="compute_units_consumed",
    )
    dbu_cost_usd: Decimal = Field(
        Decimal("0"), description="Compute cost in USD", alias="compute_cost_usd"
    )
    executions: int = Field(0, description="Number of executions")


class DBUTrendResponse(BaseModel):
    """Compute trends response."""

    model_config = {"title": "ComputeTrendResponse"}

    pipeline_id: Optional[str] = Field(
        None, description="Pipeline ID (null for aggregated)"
    )
    workspace_id: Optional[str] = Field(
        None, description="Organization ID", alias="organization_id"
    )
    period_start: date = Field(..., description="Period start date")
    period_end: date = Field(..., description="Period end date")
    trend_data: list[DBUTrendData] = Field(
        default_factory=list, description="Trend data points"
    )
    summary: DBUUsageSummary = Field(..., description="Period summary")


class MonthlyInvoiceLineItem(BaseModel):
    """Line item in monthly invoice."""

    model_config = {"json_encoders": {Decimal: lambda v: float(v) if v else 0.0}}

    pipeline_id: str = Field(..., description="Pipeline identifier")
    pipeline_name: Optional[str] = Field(None, description="Pipeline name")
    total_executions: int = Field(0, description="Total executions")
    total_dbu_consumed: Decimal = Field(
        Decimal("0"),
        description="Total compute units consumed",
        alias="total_compute_units_consumed",
    )
    total_dbu_cost_usd: Decimal = Field(
        Decimal("0"),
        description="Total compute cost in USD",
        alias="total_compute_cost_usd",
    )
    avg_dbu_per_execution: Optional[Decimal] = Field(
        None,
        description="Average compute units per execution",
        alias="avg_compute_units_per_execution",
    )
    sku_breakdown: Optional[dict[str, Any]] = Field(
        None, description="Breakdown by SKU"
    )


class MonthlyDBUInvoice(BaseModel):
    """Monthly compute invoice response."""

    model_config = {"title": "MonthlyComputeInvoice"}

    invoice_month: str = Field(..., description="Invoice month (YYYY-MM)")
    workspace_id: str = Field(
        ..., description="Organization identifier", alias="organization_id"
    )
    environment: Optional[str] = Field(None, description="Environment name")

    # Summary totals
    total_pipelines: int = Field(0, description="Total number of pipelines")
    total_executions: int = Field(0, description="Total executions")
    total_duration_minutes: int = Field(0, description="Total execution duration")
    total_dbu_consumed: Decimal = Field(
        Decimal("0"),
        description="Total compute units consumed",
        alias="total_compute_units_consumed",
    )
    total_dbu_cost_usd: Decimal = Field(
        Decimal("0"),
        description="Total compute cost in USD",
        alias="total_compute_cost_usd",
    )

    # Cost comparison
    avg_daily_cost: Optional[Decimal] = Field(None, description="Average daily cost")
    cost_vs_previous_month: Optional[float] = Field(
        None, description="Cost change vs previous month (%)"
    )

    # Line items
    line_items: list[MonthlyInvoiceLineItem] = Field(
        default_factory=list, description="Invoice line items"
    )

    # SKU breakdown
    premium_dlt_dbu: Decimal = Field(
        Decimal("0"),
        description="Premium streaming compute units consumed",
        alias="premium_streaming_compute_units",
    )
    premium_dlt_cost_usd: Decimal = Field(
        Decimal("0"),
        description="Premium streaming cost in USD",
        alias="premium_streaming_cost_usd",
    )
    standard_dlt_dbu: Decimal = Field(
        Decimal("0"),
        description="Standard streaming compute units consumed",
        alias="standard_streaming_compute_units",
    )
    standard_dlt_cost_usd: Decimal = Field(
        Decimal("0"),
        description="Standard streaming cost in USD",
        alias="standard_streaming_cost_usd",
    )

    # Metadata
    invoice_status: str = Field("draft", description="Invoice status")
    generated_at: datetime = Field(..., description="Invoice generation timestamp")


class DBUPricingRule(BaseModel):
    """Compute pricing rule."""

    model_config = {"title": "ComputePricingRule"}

    sku_name: str = Field(..., description="Platform SKU name")
    region: Optional[str] = Field(None, description="Cloud region")
    pricing_tier: Optional[str] = Field(None, description="Pricing tier")
    dbu_unit_price: Decimal = Field(
        ..., description="Compute unit price in USD", alias="compute_unit_price"
    )
    currency: str = Field("USD", description="Currency")
    effective_date: date = Field(..., description="Effective date")
    end_date: Optional[date] = Field(
        None, description="End date (null = currently active)"
    )
    is_active: bool = Field(True, description="Whether rule is active")
    description: Optional[str] = Field(None, description="Rule description")


class DBUSyncStatusResponse(BaseModel):
    """Compute sync status response."""

    model_config = {"title": "ComputeSyncStatusResponse"}

    workspace_id: str = Field(
        ..., description="Organization identifier", alias="organization_id"
    )
    environment: Optional[str] = Field(None, description="Environment name")
    last_sync_date: Optional[date] = Field(
        None, description="Last successfully synced date"
    )
    last_successful_sync: Optional[datetime] = Field(
        None, description="Last successful sync timestamp"
    )
    last_sync_attempt: Optional[datetime] = Field(
        None, description="Last sync attempt timestamp"
    )
    last_sync_status: Optional[SyncStatus] = Field(None, description="Last sync status")
    records_processed: int = Field(0, description="Records processed in last sync")
    dbu_records_found: int = Field(
        0,
        description="Compute records found in last sync",
        alias="compute_records_found",
    )
    sync_duration_seconds: Optional[int] = Field(None, description="Last sync duration")
    sync_batch_id: Optional[str] = Field(None, description="Last sync batch ID")
    error_message: Optional[str] = Field(None, description="Last error message")
    retry_count: int = Field(0, description="Current retry count")
    max_retries: int = Field(3, description="Maximum retries allowed")
    next_sync_date: Optional[date] = Field(None, description="Next planned sync date")
    sync_enabled: bool = Field(True, description="Whether sync is enabled")


class DBUCostAlert(BaseModel):
    """Compute cost alert."""

    model_config = {"title": "ComputeCostAlert"}

    id: int = Field(..., description="Alert ID")
    alert_type: str = Field(..., description="Alert type")
    pipeline_id: Optional[str] = Field(None, description="Pipeline ID")
    workspace_id: Optional[str] = Field(
        None, description="Organization ID", alias="organization_id"
    )
    environment: Optional[str] = Field(None, description="Environment")
    alert_date: date = Field(..., description="Alert date")
    alert_message: Optional[str] = Field(None, description="Alert message")
    severity: AlertSeverity = Field(..., description="Alert severity")
    current_value: Optional[Decimal] = Field(None, description="Current value")
    threshold_value: Optional[Decimal] = Field(None, description="Threshold value")
    baseline_value: Optional[Decimal] = Field(None, description="Baseline value")
    percentage_change: Optional[float] = Field(None, description="Percentage change")
    alert_status: str = Field("open", description="Alert status")
    created_at: datetime = Field(..., description="Alert creation time")


class DBUManualSyncRequest(BaseModel):
    """Request model for manual compute sync."""

    model_config = {"title": "ComputeManualSyncRequest"}

    workspace_id: Optional[str] = Field(
        None,
        description="Specific workspace ID to sync (deprecated: organization_id)",
        alias="organization_id",
    )
    force_resync: bool = Field(
        False, description="Force resync even if recently synced"
    )
    sync_date: Optional[date] = Field(
        None, description="Specific date to sync (mutually exclusive with sync_month)"
    )
    sync_month: Optional[str] = Field(
        None,
        description="Sync entire month in YYYY-MM format (e.g., '2025-10')",
        pattern=r"^\d{4}-\d{2}$",
    )
    start_date: Optional[date] = Field(
        None, description="Start date for date range sync"
    )
    end_date: Optional[date] = Field(None, description="End date for date range sync")


class DBUManualSyncResponse(BaseModel):
    """Response model for manual compute sync."""

    model_config = {"title": "ComputeManualSyncResponse"}

    status: str = Field(..., description="Sync status")
    workspace_id: Optional[str] = Field(
        None,
        description="Workspace ID synced (deprecated: organization_id)",
        alias="organization_id",
    )
    records_processed: int = Field(0, description="Records processed")
    sync_batch_id: str = Field(..., description="Sync batch identifier")
    message: Optional[str] = Field(None, description="Status message")
    error: Optional[str] = Field(None, description="Error message if failed")
    started_at: datetime = Field(..., description="Sync start time")
    completed_at: Optional[datetime] = Field(None, description="Sync completion time")
    sync_start_date: Optional[date] = Field(
        None, description="Start date of sync range"
    )
    sync_end_date: Optional[date] = Field(None, description="End date of sync range")
    days_synced: Optional[int] = Field(None, description="Number of days synced")


class DBUHealthCheck(BaseModel):
    """Health check response for compute service."""

    model_config = {"title": "ComputeHealthCheck"}

    service_name: str = Field("compute-tracking", description="Service name")
    status: str = Field(..., description="Service status")
    platform_host: Optional[str] = Field(
        None, description="Platform host", alias="platform_host"
    )
    system_tables_available: bool = Field(
        False, description="Whether system tables are accessible"
    )
    last_sync_time: Optional[datetime] = Field(
        None, description="Last successful sync time"
    )
    active_organizations: int = Field(
        0, description="Number of active organizations", alias="active_organizations"
    )
    total_pipelines_tracked: int = Field(0, description="Total pipelines being tracked")
    sync_service_running: bool = Field(
        False, description="Whether sync service is running"
    )
    response_time_ms: Optional[float] = Field(
        None, description="Health check response time"
    )


class DBUUsageQueryRequest(BaseModel):
    """Request model for compute usage queries."""

    model_config = {"title": "ComputeUsageQueryRequest"}

    pipeline_id: Optional[str] = Field(None, description="Filter by pipeline ID")
    workspace_id: Optional[str] = Field(
        None, description="Filter by organization ID", alias="organization_id"
    )
    environment: Optional[str] = Field(None, description="Filter by environment")
    start_date: date = Field(..., description="Start date for query")
    end_date: date = Field(..., description="End date for query")
    aggregation_level: str = Field(
        "daily", description="Aggregation level: daily, weekly, monthly"
    )
    include_details: bool = Field(False, description="Include detailed records")
    limit: int = Field(100, description="Maximum number of results", ge=1, le=1000)
    offset: int = Field(0, description="Offset for pagination", ge=0)


class DBUError(BaseModel):
    """Error response model for compute API."""

    model_config = {"title": "ComputeError"}

    error_code: str = Field(..., description="Error code")
    message: str = Field(..., description="Error message")
    details: Optional[dict[str, Any]] = Field(
        None, description="Additional error details"
    )
    pipeline_id: Optional[str] = Field(None, description="Pipeline ID if applicable")
    workspace_id: Optional[str] = Field(
        None, description="Organization ID if applicable", alias="organization_id"
    )
    timestamp: datetime = Field(..., description="Error timestamp")
