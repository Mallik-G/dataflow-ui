"""SQLModel definitions for star schema usage tracking.

This module defines the star schema for platform-agnostic billing/usage tracking.
The schema consists of:
- Fact table: usage_facts (core usage metrics)
- Dimension tables: dim_pipelines, dim_jobs, dim_warehouses, dim_clusters, dim_endpoints

Design principles:
- Platform-agnostic (works for Databricks, Snowflake, BigQuery, etc.)
- No NULL proliferation - each dimension table has only relevant columns
- Type-safe with proper constraints
- Efficient querying with proper indexes
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Index, BigInteger
from sqlalchemy.dialects.postgresql import JSONB


# ========== DIMENSION TABLES ==========


class DimPipeline(SQLModel, table=True):
    """Dimension table for DLT pipeline metadata."""

    __tablename__ = "dim_pipelines"
    __table_args__ = {"schema": "nexa_admin"}

    id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger, primary_key=True, autoincrement=True)
    )

    # Platform and workspace
    platform: str = Field(max_length=20, nullable=False)
    workspace_id: str = Field(max_length=100, nullable=False, index=True)

    # Pipeline identification
    pipeline_id: str = Field(max_length=200, nullable=False, index=True)
    pipeline_name: Optional[str] = Field(default=None, max_length=500)

    # Pipeline metadata
    dlt_tier: Optional[str] = Field(
        default=None, max_length=30
    )  # 'CORE', 'PRO', 'ADVANCED'
    is_serverless: Optional[bool] = Field(default=None)

    # Unity Catalog linkage
    uc_catalog: Optional[str] = Field(default=None, max_length=200)
    uc_schema: Optional[str] = Field(default=None, max_length=200)
    uc_table_name: Optional[str] = Field(default=None, max_length=200)
    uc_full_name: Optional[str] = Field(default=None, max_length=600)

    # Ownership
    owned_by: Optional[str] = Field(default=None, max_length=200)

    # DLT-specific
    pipeline_update_id: Optional[str] = Field(default=None, max_length=200)
    pipeline_maintenance_id: Optional[str] = Field(default=None, max_length=200)

    # Audit
    first_seen: datetime = Field(default_factory=datetime.now)
    last_seen: datetime = Field(default_factory=datetime.now)
    is_active: bool = Field(default=True)


class DimJob(SQLModel, table=True):
    """Dimension table for job metadata."""

    __tablename__ = "dim_jobs"
    __table_args__ = {"schema": "nexa_admin"}

    id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger, primary_key=True, autoincrement=True)
    )

    # Platform and workspace
    platform: str = Field(max_length=20, nullable=False)
    workspace_id: str = Field(max_length=100, nullable=False, index=True)

    # Job identification
    job_id: str = Field(max_length=100, nullable=False, index=True)
    job_name: Optional[str] = Field(default=None, max_length=500)

    # Job metadata
    job_type: Optional[str] = Field(
        default=None, max_length=50
    )  # 'scheduled', 'interactive', 'adhoc'
    job_schedule: Optional[str] = Field(default=None, max_length=200)
    owned_by: Optional[str] = Field(default=None, max_length=200)
    created_by: Optional[str] = Field(default=None, max_length=200)

    # Audit flags
    is_on_all_purpose_compute: Optional[bool] = Field(
        default=None
    )  # Cost optimization flag
    created_at_timestamp: Optional[datetime] = Field(default=None)
    deleted_at_timestamp: Optional[datetime] = Field(default=None)

    first_seen: datetime = Field(default_factory=datetime.now)
    last_seen: datetime = Field(default_factory=datetime.now)
    is_active: bool = Field(default=True)


class DimWarehouse(SQLModel, table=True):
    """Dimension table for SQL warehouse metadata."""

    __tablename__ = "dim_warehouses"
    __table_args__ = {"schema": "nexa_admin"}

    id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger, primary_key=True, autoincrement=True)
    )

    # Platform and workspace
    platform: str = Field(max_length=20, nullable=False)
    workspace_id: str = Field(max_length=100, nullable=False, index=True)

    warehouse_id: str = Field(max_length=200, nullable=False, index=True)
    warehouse_name: Optional[str] = Field(default=None, max_length=500)
    warehouse_type: Optional[str] = Field(
        default=None, max_length=50
    )  # 'CLASSIC', 'PRO', 'SERVERLESS'
    warehouse_size: Optional[str] = Field(
        default=None, max_length=20
    )  # 'XSMALL', 'SMALL', etc.
    owned_by: Optional[str] = Field(default=None, max_length=200)

    first_seen: datetime = Field(default_factory=datetime.now)
    last_seen: datetime = Field(default_factory=datetime.now)
    is_active: bool = Field(default=True)


class DimCluster(SQLModel, table=True):
    """Dimension table for cluster metadata."""

    __tablename__ = "dim_clusters"
    __table_args__ = {"schema": "nexa_admin"}

    id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger, primary_key=True, autoincrement=True)
    )

    # Platform and workspace
    platform: str = Field(max_length=20, nullable=False)
    workspace_id: str = Field(max_length=100, nullable=False, index=True)

    cluster_id: str = Field(max_length=200, nullable=False, index=True)
    cluster_name: Optional[str] = Field(default=None, max_length=500)
    cluster_type: Optional[str] = Field(
        default=None, max_length=50
    )  # 'ALL_PURPOSE', 'JOB'
    owned_by: Optional[str] = Field(default=None, max_length=200)

    first_seen: datetime = Field(default_factory=datetime.now)
    last_seen: datetime = Field(default_factory=datetime.now)
    is_active: bool = Field(default=True)


class DimEndpoint(SQLModel, table=True):
    """Dimension table for model serving endpoint metadata."""

    __tablename__ = "dim_endpoints"
    __table_args__ = {"schema": "nexa_admin"}

    id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger, primary_key=True, autoincrement=True)
    )

    # Platform and workspace
    platform: str = Field(max_length=20, nullable=False)
    workspace_id: str = Field(max_length=100, nullable=False, index=True)

    endpoint_id: str = Field(max_length=200, nullable=False, index=True)
    endpoint_name: Optional[str] = Field(default=None, max_length=500)
    endpoint_type: Optional[str] = Field(
        default=None, max_length=50
    )  # 'MODEL', 'GPU_MODEL', 'FOUNDATION_MODEL', 'FEATURE'
    owned_by: Optional[str] = Field(default=None, max_length=200)

    first_seen: datetime = Field(default_factory=datetime.now)
    last_seen: datetime = Field(default_factory=datetime.now)
    is_active: bool = Field(default=True)


# ========== FACT TABLE ==========


class UsageFact(SQLModel, table=True):
    """Fact table for usage metrics - narrow table with no NULLs for common dimensions."""

    __tablename__ = "usage_facts"
    __table_args__ = (
        Index("idx_facts_platform_date", "platform", "usage_date"),
        Index("idx_facts_workspace_date", "workspace_id", "usage_date"),
        Index("idx_facts_product_date", "billing_origin_product", "usage_date"),
        Index(
            "idx_facts_resource", "resource_type", "resource_dimension_id", "usage_date"
        ),
        Index("idx_facts_year_month", "year_month"),
        {"schema": "nexa_admin"},
    )

    id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger, primary_key=True, autoincrement=True)
    )

    # Core dimensions (present in ALL records)
    platform: str = Field(
        max_length=20, nullable=False
    )  # 'databricks', 'snowflake', 'bigquery'
    workspace_id: str = Field(max_length=100, nullable=False, index=True)
    environment: Optional[str] = Field(default=None, max_length=50)
    usage_date: date = Field(nullable=False, index=True)
    usage_start_time: datetime = Field(nullable=False)
    usage_end_time: Optional[datetime] = Field(default=None)
    year_month: str = Field(max_length=7, nullable=False)  # Format: 'YYYY-MM'

    # Product/SKU (present in ALL records)
    billing_origin_product: str = Field(
        max_length=50, nullable=False
    )  # 'DLT', 'JOBS', 'SQL', etc.
    sku_name: str = Field(max_length=150, nullable=False)
    usage_unit: str = Field(max_length=20, nullable=False)  # 'DBU', 'GB', 'HOURS'
    cloud_provider: Optional[str] = Field(
        default=None, max_length=20
    )  # 'AWS', 'AZURE', 'GCP'

    # Resource identification (ONE will be populated based on resource_type)
    resource_type: str = Field(
        max_length=50, nullable=False
    )  # 'pipeline', 'job', 'warehouse', 'cluster', 'endpoint', 'notebook'
    resource_dimension_id: Optional[int] = Field(
        default=None, sa_column=Column(BigInteger)
    )  # FK to specific dimension table

    # Ownership (common across all resource types)
    executed_by: Optional[str] = Field(default=None, max_length=200)
    team_tag: Optional[str] = Field(default=None, max_length=100)

    # Metrics (present in ALL records)
    usage_quantity: Decimal = Field(nullable=False, max_digits=18, decimal_places=6)
    unit_price: Optional[Decimal] = Field(default=None, max_digits=12, decimal_places=6)
    list_cost: Optional[Decimal] = Field(default=None, max_digits=18, decimal_places=4)

    # Metadata (sparse data goes here as JSON)
    custom_tags: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSONB))

    # Record management
    record_type: str = Field(
        default="ORIGINAL", max_length=20
    )  # 'ORIGINAL', 'CORRECTED', 'ESTIMATED'
    sync_batch_id: Optional[str] = Field(default=None, max_length=50)
    created_at: datetime = Field(default_factory=datetime.now)
