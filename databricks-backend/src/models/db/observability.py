"""SQLModel ORM models for Pipeline Observability tables.

Architecture:
- NO BRONZE LAYER: Raw events stay in Databricks (dev.nexa_ops.dlt_raw_logs)
- SILVER LAYER: Aggregated metrics (hourly, daily)
- GOLD LAYER: Product intelligence (health, cost anomalies, recommendations)

All data is sourced from Databricks DLT Gold tables and synced via AggregateExportService.
"""

from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal

from sqlmodel import SQLModel, Field
from sqlalchemy import Text


# ===================================================================
# SILVER LAYER: Aggregated Metrics
# ===================================================================


class PipelineMetricsHourly(SQLModel, table=True):
    """Hourly rollup of pipeline metrics (7-day retention)."""

    __tablename__ = "pipeline_metrics_hourly"
    __table_args__ = {"schema": "nexa_admin"}

    pipeline_id: str = Field(primary_key=True, max_length=255)
    hour_start: datetime = Field(primary_key=True)
    pipeline_name: Optional[str] = Field(default=None, max_length=255)

    # Cost metrics
    cost_dbu: Optional[Decimal] = None
    cost_usd: Optional[Decimal] = None

    # Performance metrics
    update_count: int = Field(default=0)
    success_count: int = Field(default=0)
    failure_count: int = Field(default=0)
    duration_avg_min: Optional[Decimal] = None
    duration_max_min: Optional[Decimal] = None

    # Data quality metrics
    quality_score: Optional[Decimal] = None
    expectations_passed: Optional[int] = None
    expectations_failed: Optional[int] = None

    # Streaming metrics
    backlog_gb: Optional[Decimal] = None
    records_processed: Optional[int] = None

    # Metadata
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PipelineMetricsDaily(SQLModel, table=True):
    """Daily rollup of pipeline metrics (365-day retention)."""

    __tablename__ = "pipeline_metrics_daily"
    __table_args__ = {"schema": "nexa_admin"}

    pipeline_id: str = Field(primary_key=True, max_length=255)
    date: datetime = Field(primary_key=True)
    pipeline_name: Optional[str] = Field(default=None, max_length=255)

    # Cost metrics
    cost_dbu: Optional[Decimal] = None
    cost_usd: Optional[Decimal] = None
    forecast_cost_next_7d: Optional[Decimal] = None

    # Performance metrics
    update_count: int = Field(default=0)
    success_count: int = Field(default=0)
    failure_count: int = Field(default=0)
    success_rate: Optional[Decimal] = None
    duration_avg_min: Optional[Decimal] = None
    duration_p95_min: Optional[Decimal] = None

    # Data quality metrics
    quality_score: Optional[Decimal] = None
    expectations_passed: Optional[int] = None
    expectations_failed: Optional[int] = None

    # Streaming metrics
    backlog_avg_gb: Optional[Decimal] = None
    backlog_max_gb: Optional[Decimal] = None
    records_processed: Optional[int] = None

    # Metadata
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ===================================================================
# GOLD LAYER: Product Intelligence
# ===================================================================


class PipelineHealthCurrent(SQLModel, table=True):
    """Current health status snapshot per pipeline."""

    __tablename__ = "pipeline_health_current"
    __table_args__ = {"schema": "nexa_admin"}

    pipeline_id: str = Field(primary_key=True, max_length=255)
    pipeline_name: str = Field(max_length=255)

    # Status
    status: str = Field(max_length=50)
    health_score: Optional[Decimal] = None

    # Update tracking
    last_update_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    last_failure_time: Optional[datetime] = None
    consecutive_failures: int = Field(default=0)

    # Flags
    is_stale: bool = Field(default=False)
    has_cost_anomaly: bool = Field(default=False)
    has_quality_issues: bool = Field(default=False)
    has_performance_issues: bool = Field(default=False)

    # Metadata
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PipelineCostAnomaly(SQLModel, table=True):
    """ML-detected cost spikes and anomalies."""

    __tablename__ = "pipeline_cost_anomalies"
    __table_args__ = {"schema": "nexa_admin"}

    id: int = Field(primary_key=True)
    pipeline_id: str = Field(index=True, max_length=255)
    pipeline_name: Optional[str] = Field(default=None, max_length=255)

    # Anomaly details
    date: datetime
    actual_cost: Decimal
    expected_cost: Decimal
    anomaly_score: Optional[Decimal] = None
    deviation_pct: Optional[Decimal] = None

    # Classification
    severity: Optional[str] = Field(default=None, max_length=20)

    # Metadata
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OptimizationRecommendation(SQLModel, table=True):
    """AI-generated optimization suggestions."""

    __tablename__ = "optimization_recommendations"
    __table_args__ = {"schema": "nexa_admin"}

    id: int = Field(primary_key=True)
    pipeline_id: str = Field(index=True, max_length=255)
    pipeline_name: Optional[str] = Field(default=None, max_length=255)

    # Recommendation details
    recommendation_type: str = Field(max_length=50)
    title: str = Field(max_length=255)
    description: Optional[str] = Field(default=None, sa_type=Text)

    # Impact analysis
    estimated_savings_monthly: Optional[Decimal] = None
    confidence: Optional[Decimal] = None

    # Priority
    priority: str = Field(max_length=20)

    # Status
    status: str = Field(default="active", max_length=20)

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    applied_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None


class PerformanceBenchmark(SQLModel, table=True):
    """Cross-customer performance comparison."""

    __tablename__ = "performance_benchmarks"
    __table_args__ = {"schema": "nexa_admin"}

    pipeline_id: str = Field(primary_key=True, max_length=255)
    metric_name: str = Field(primary_key=True, max_length=100)
    pipeline_name: Optional[str] = Field(default=None, max_length=255)

    # Customer metrics
    actual_value: Decimal

    # Industry benchmarks
    industry_p50: Optional[Decimal] = None
    industry_p75: Optional[Decimal] = None
    industry_p90: Optional[Decimal] = None

    # Analysis
    relative_performance: Optional[str] = Field(default=None, max_length=20)
    percentile: Optional[Decimal] = None

    # Metadata
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LineageGraph(SQLModel, table=True):
    """Data lineage graph showing dataset dependencies."""

    __tablename__ = "lineage_graph"
    __table_args__ = {"schema": "nexa_admin"}

    pipeline_id: str = Field(primary_key=True, max_length=255)
    flow_name: str = Field(primary_key=True, max_length=255)
    output_dataset: str = Field(primary_key=True, max_length=500)
    input_dataset: Optional[str] = Field(primary_key=True, max_length=500)

    pipeline_name: Optional[str] = Field(default=None, max_length=255)
    flow_type: Optional[str] = Field(default=None, max_length=50)

    # Metadata
    last_seen: Optional[datetime] = None
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AutoLoaderSummary(SQLModel, table=True):
    """Daily summary of Auto Loader file processing metrics."""

    __tablename__ = "autoloader_summary"
    __table_args__ = {"schema": "nexa_admin"}

    pipeline_id: str = Field(primary_key=True, max_length=255)
    flow_name: str = Field(primary_key=True, max_length=255)
    event_date: datetime = Field(primary_key=True)

    pipeline_name: Optional[str] = Field(default=None, max_length=255)

    # Auto Loader metrics
    total_files_listed: Optional[int] = None
    total_files_added: Optional[int] = None
    total_gb_processed: Optional[Decimal] = None
    failed_operations: Optional[int] = None
    avg_duration_sec: Optional[Decimal] = None

    # Metadata
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SourceBacklogSummary(SQLModel, table=True):
    """Per-source backlog metrics for detailed streaming monitoring."""

    __tablename__ = "source_backlog_summary"
    __table_args__ = {"schema": "nexa_admin"}

    pipeline_id: str = Field(primary_key=True, max_length=255)
    flow_name: str = Field(primary_key=True, max_length=255)
    source_name: str = Field(primary_key=True, max_length=500)
    event_date: datetime = Field(primary_key=True)

    pipeline_name: Optional[str] = Field(default=None, max_length=255)

    # Backlog metrics per source (Kafka topic, S3 path, etc.)
    max_backlog_gb: Optional[Decimal] = None
    avg_backlog_gb: Optional[Decimal] = None
    max_backlog_records: Optional[int] = None
    max_backlog_hours: Optional[Decimal] = None
    avg_backlog_hours: Optional[Decimal] = None

    # Metadata
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
