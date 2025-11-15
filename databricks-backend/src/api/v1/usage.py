"""FastAPI router for compute usage and cost tracking endpoints.

This module provides RESTful API endpoints to track and analyze compute unit
consumption and costs for data pipelines.
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.config import settings
from ...models.api.compute_usage import (
    DBUCostBreakdown,
    DBUHealthCheck,
    DBUManualSyncRequest,
    DBUManualSyncResponse,
    DBUPricingRule,
    DBUSyncStatusResponse,
    DBUTrendData,
    DBUTrendResponse,
    DBUUsageSummary,
    MonthlyDBUInvoice,
)
from ...models.db.compute_tracking import (
    DBUPricingRules,
    DBUSyncStatus,
    PipelineDBUUsage,
)
from ...services.background.usage_background_sync import dbu_background_sync_service
from ...services.invoice_service import dbu_invoice_service
from ...services.databricks.databricks_warehouse_api import DatabricksWarehouseAPI

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/usage", tags=["Compute Usage & Cost Tracking"])


@router.get("/pipelines", summary="Pipelines usage summary")
async def get_pipelines_usage(
    db: Annotated[Session, Depends(get_db)],
    start_date: date = Query(...),
    end_date: date = Query(...),
    limit: int = Query(100, ge=1, le=1000),
):
    try:
        items = (
            db.query(
                PipelineDBUUsage.pipeline_id,
                func.count(PipelineDBUUsage.id).label("executions"),
                func.sum(PipelineDBUUsage.dbu_consumed).label("dbu"),
                func.sum(PipelineDBUUsage.dbu_cost_usd).label("cost_usd"),
            )
            .filter(
                PipelineDBUUsage.usage_date >= start_date,
                PipelineDBUUsage.usage_date <= end_date,
            )
            .group_by(PipelineDBUUsage.pipeline_id)
            .order_by(desc("cost_usd"))
            .limit(limit)
            .all()
        )
        return [
            {
                "pipeline_id": pid,
                "executions": execs,
                "dbu": str(dbu or 0),
                "cost_usd": str(cost or 0),
            }
            for pid, execs, dbu, cost in items
        ]
    except Exception as e:
        logger.error(f"Failed to get pipelines usage: {e!s}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs", summary="Jobs run usage summary")
async def get_jobs_usage(
    db: Annotated[Session, Depends(get_db)],
    start_date: date = Query(...),
    end_date: date = Query(...),
    limit: int = Query(100, ge=1, le=1000),
):
    try:
        from ...models.db import JobRun

        q = [
            JobRun.job_id,
            func.count(JobRun.run_id).label("runs"),
            func.sum(JobRun.execution_duration).label("total_ms"),
        ]
        items = (
            db.query(*q)
            .filter(JobRun.start_time >= start_date, JobRun.start_time <= end_date)
            .group_by(JobRun.job_id)
            .order_by(desc("runs"))
            .limit(limit)
            .all()
        )
        return [
            {"job_id": job_id, "runs": runs, "total_exec_ms": total_ms}
            for job_id, runs, total_ms in items
        ]
    except Exception as e:
        logger.error(f"Failed to get jobs usage: {e!s}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wh", summary="SQL Warehouse query usage summary")
async def get_sql_warehouse_usage(
    start_date: date = Query(...),
    end_date: date = Query(...),
    warehouse_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    try:
        wh = warehouse_id or settings.databricks_warehouse_id
        if not wh:
            raise HTTPException(status_code=400, detail="warehouse_id not configured")
        dwh = DatabricksWarehouseAPI(
            host=settings.databricks_host or "",
            client_id=settings.databricks_client_id or "",
            client_secret=settings.databricks_client_secret or "",
        )
        s = start_date.strftime("%Y-%m-%d")
        e = end_date.strftime("%Y-%m-%d")
        query = f"""
        SELECT
          user_identity.email AS user_email,
          COUNT(*) AS query_count,
          SUM(COALESCE(metrics.executed_time_ms, 0)) AS total_exec_ms
        FROM system.access.query_history
        WHERE event_date >= '{s}' AND event_date <= '{e}'
        GROUP BY 1
        ORDER BY query_count DESC
        LIMIT {limit}
        """
        res = await dwh.execute_sql(statement=query, warehouse_id=wh, wait=True)
        return {
            "columns": res.get("columns"),
            "rows": res.get("rows"),
            "start_date": s,
            "end_date": e,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get SQL Warehouse usage: {e!s}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/by-service",
    summary="Get usage by service (jobs, pipelines, sql, model serving, vector search, apps, lakehouse)",
)
async def get_usage_by_service(
    db: Annotated[Session, Depends(get_db)],
    start_date: date = Query(...),
    end_date: date = Query(...),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get usage breakdown by service type.

    Automatically filters by workspace_id from environment configuration.
    """
    try:
        # Get workspace_id from environment configuration
        from ...models.db import Environment

        environment_config = db.query(Environment).first()

        workspace_id = None
        if environment_config and environment_config.configuration:
            workspace_id = environment_config.configuration.get("workspace_id")

        # Query system.billing.usage for sku/service grouping
        wh = settings.databricks_warehouse_id
        if not wh:
            raise HTTPException(
                status_code=400, detail="DATABRICKS_WAREHOUSE_ID not configured"
            )
        dwh = DatabricksWarehouseAPI(
            host=settings.databricks_host or "",
            client_id=settings.databricks_client_id or "",
            client_secret=settings.databricks_client_secret or "",
        )
        s = start_date.strftime("%Y-%m-%d")
        e = end_date.strftime("%Y-%m-%d")
        ws_filter = f"AND workspace_id = '{workspace_id}'" if workspace_id else ""
        query = f"""
        SELECT
          sku_name,
          usage_unit,
          SUM(usage_quantity) AS total_units,
          SUM(COALESCE(cost_usd, 0)) AS total_cost_usd
        FROM system.billing.usage
        WHERE usage_date >= '{s}' AND usage_date <= '{e}' {ws_filter}
        GROUP BY 1,2
        ORDER BY total_cost_usd DESC
        LIMIT {limit}
        """
        res = await dwh.execute_sql(statement=query, warehouse_id=wh, wait=True)
        cols = res.get("columns", []) or []
        rows = res.get("rows", []) or []
        idx = {name: i for i, name in enumerate(cols)}
        out = [
            {
                "service": r[idx.get("sku_name", 0)]
                if isinstance(r, (list, tuple))
                else None,
                "unit": r[idx.get("usage_unit", 1)]
                if isinstance(r, (list, tuple))
                else None,
                "total_units": r[idx.get("total_units", 2)]
                if isinstance(r, (list, tuple))
                else None,
                "total_cost_usd": r[idx.get("total_cost_usd", 3)]
                if isinstance(r, (list, tuple))
                else None,
            }
            for r in rows
        ]
        return {"items": out, "count": len(out), "start_date": s, "end_date": e}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get usage by service: {e!s}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pipelines/{pipeline_id}", response_model=DBUUsageSummary)
async def get_pipeline_dbu_usage(
    db: Annotated[Session, Depends(get_db)],
    pipeline_id: str = Path(..., description="Pipeline identifier"),
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    include_daily_breakdown: bool = Query(False, description="Include daily breakdown"),
):
    """Get DBU usage summary for a specific pipeline.

    Args:
        pipeline_id: The ID of the pipeline to get usage for.
        start_date: The start date of the period.
        end_date: The end date of the period.
        include_daily_breakdown: Whether to include a daily breakdown.
        db: The database session.

    Returns:
        The DBU usage summary for the specified pipeline.
    """
    try:
        logger.info(
            f"Getting DBU usage for pipeline {pipeline_id} from {start_date} to {end_date}"
        )

        # Query pipeline usage data
        usage_query = db.query(PipelineDBUUsage).filter(
            and_(
                PipelineDBUUsage.pipeline_id == pipeline_id,
                PipelineDBUUsage.usage_date >= start_date,
                PipelineDBUUsage.usage_date <= end_date,
            )
        )

        usage_records = usage_query.all()

        if not usage_records:
            return DBUUsageSummary(
                pipeline_id=pipeline_id,
                pipeline_name=None,
                period_start=start_date,
                period_end=end_date,
                total_executions=0,
                total_duration_minutes=0,
                total_dbu_consumed=Decimal("0"),
                total_dbu_cost_usd=Decimal("0"),
            )

        # Calculate totals
        pipeline_name = usage_records[0].pipeline_name
        total_executions = len(usage_records)
        total_duration_minutes = sum(
            r.execution_duration_minutes or 0 for r in usage_records
        )
        total_dbu_consumed = sum(r.dbu_consumed or Decimal("0") for r in usage_records)
        total_dbu_cost_usd = sum(r.dbu_cost_usd or Decimal("0") for r in usage_records)

        # Daily breakdown if requested
        daily_breakdown = None
        if include_daily_breakdown:
            daily_data = {}
            for record in usage_records:
                date_key = record.usage_date
                if date_key not in daily_data:
                    daily_data[date_key] = {
                        "executions": 0,
                        "duration_minutes": 0,
                        "dbu_consumed": Decimal("0"),
                        "dbu_cost_usd": Decimal("0"),
                    }
                daily_data[date_key]["executions"] += 1
                daily_data[date_key]["duration_minutes"] += (
                    record.execution_duration_minutes or 0
                )
                daily_data[date_key]["dbu_consumed"] += record.dbu_consumed or Decimal(
                    "0"
                )
                daily_data[date_key]["dbu_cost_usd"] += record.dbu_cost_usd or Decimal(
                    "0"
                )

            daily_breakdown = [
                {
                    "date": date_key,
                    "executions": data["executions"],
                    "duration_minutes": data["duration_minutes"],
                    "dbu_consumed": data["dbu_consumed"],
                    "dbu_cost_usd": data["dbu_cost_usd"],
                }
                for date_key, data in sorted(daily_data.items())
            ]

        return DBUUsageSummary(
            pipeline_id=pipeline_id,
            pipeline_name=pipeline_name,
            period_start=start_date,
            period_end=end_date,
            total_executions=total_executions,
            total_duration_minutes=total_duration_minutes,
            total_dbu_consumed=total_dbu_consumed,
            total_dbu_cost_usd=total_dbu_cost_usd,
            daily_breakdown=daily_breakdown,
        )

    except Exception as e:
        logger.error(f"Failed to get pipeline DBU usage: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve pipeline usage: {e!s}"
        )


@router.get("/summary", response_model=DBUUsageSummary)
async def get_dbu_usage_summary(
    db: Annotated[Session, Depends(get_db)],
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
):
    """Get aggregated DBU usage summary across all pipelines.

    Automatically filters by workspace_id and environment from environment configuration.
    """
    try:
        # Get workspace_id and environment from environment configuration
        from ...models.db import Environment

        environment_config = db.query(Environment).first()

        workspace_id = None
        environment = None
        if environment_config and environment_config.configuration:
            workspace_id = environment_config.configuration.get("workspace_id")
            environment = environment_config.name  # Use environment name

        logger.info(
            f"Getting DBU usage summary from {start_date} to {end_date} "
            f"(workspace: {workspace_id or 'all'}, env: {environment or 'all'})"
        )

        # Build filter conditions
        filters = [
            PipelineDBUUsage.usage_date >= start_date,
            PipelineDBUUsage.usage_date <= end_date,
        ]

        if workspace_id:
            filters.append(PipelineDBUUsage.workspace_id == workspace_id)
        if environment:
            filters.append(PipelineDBUUsage.environment == environment)

        # Get aggregated data
        summary_data = (
            db.query(
                func.count(func.distinct(PipelineDBUUsage.pipeline_id)).label(
                    "total_pipelines"
                ),
                func.count(PipelineDBUUsage.id).label("total_executions"),
                func.sum(PipelineDBUUsage.execution_duration_minutes).label(
                    "total_duration_minutes"
                ),
                func.sum(PipelineDBUUsage.dbu_consumed).label("total_dbu_consumed"),
                func.sum(PipelineDBUUsage.dbu_cost_usd).label("total_dbu_cost_usd"),
            )
            .filter(and_(*filters))
            .first()
        )

        return DBUUsageSummary(
            pipeline_id="all",
            pipeline_name="All Pipelines",
            period_start=start_date,
            period_end=end_date,
            total_executions=summary_data.total_executions or 0,
            total_duration_minutes=summary_data.total_duration_minutes or 0,
            total_dbu_consumed=summary_data.total_dbu_consumed or Decimal("0"),
            total_dbu_cost_usd=summary_data.total_dbu_cost_usd or Decimal("0"),
        )

    except Exception as e:
        logger.error(f"Failed to get DBU usage summary: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve usage summary: {e!s}"
        )


@router.get("/trends", response_model=DBUTrendResponse)
async def get_dbu_trends(
    db: Annotated[Session, Depends(get_db)],
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    pipeline_id: Optional[str] = Query(None, description="Filter by pipeline"),
):
    """Get DBU usage trends over time.

    Automatically filters by workspace_id and environment from environment configuration.
    """
    try:
        # Get workspace_id and environment from environment configuration
        from ...models.db import Environment

        environment_config = db.query(Environment).first()

        workspace_id = None
        environment = None
        if environment_config and environment_config.configuration:
            workspace_id = environment_config.configuration.get("workspace_id")
            environment = environment_config.name

        logger.info(
            f"Getting DBU trends from {start_date} to {end_date} "
            f"(workspace: {workspace_id or 'all'}, env: {environment or 'all'}, "
            f"pipeline: {pipeline_id or 'all'})"
        )

        # Build filter conditions
        filters = [
            PipelineDBUUsage.usage_date >= start_date,
            PipelineDBUUsage.usage_date <= end_date,
        ]

        if pipeline_id:
            filters.append(PipelineDBUUsage.pipeline_id == pipeline_id)
        if workspace_id:
            filters.append(PipelineDBUUsage.workspace_id == workspace_id)
        if environment:
            filters.append(PipelineDBUUsage.environment == environment)

        # Get daily aggregated data
        daily_data = (
            db.query(
                PipelineDBUUsage.usage_date,
                func.count(PipelineDBUUsage.id).label("executions"),
                func.sum(PipelineDBUUsage.dbu_consumed).label("dbu_consumed"),
                func.sum(PipelineDBUUsage.dbu_cost_usd).label("dbu_cost_usd"),
            )
            .filter(and_(*filters))
            .group_by(PipelineDBUUsage.usage_date)
            .order_by(PipelineDBUUsage.usage_date)
            .all()
        )

        trend_data = [
            DBUTrendData(
                date=row.usage_date,
                executions=row.executions or 0,
                dbu_consumed=row.dbu_consumed or Decimal("0"),
                dbu_cost_usd=row.dbu_cost_usd or Decimal("0"),
            )
            for row in daily_data
        ]

        return DBUTrendResponse(
            period_start=start_date,
            period_end=end_date,
            trend_data=trend_data,
        )

    except Exception as e:
        logger.error(f"Failed to get DBU trends: {e!s}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve trends: {e!s}")


@router.get("/costs", response_model=DBUCostBreakdown)
async def get_dbu_cost_breakdown(
    db: Annotated[Session, Depends(get_db)],
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
):
    """Get DBU cost breakdown by pipeline and SKU.

    Automatically filters by workspace_id and environment from environment configuration.
    """
    try:
        # Get workspace_id and environment from environment configuration
        from ...models.db import Environment

        environment_config = db.query(Environment).first()

        workspace_id = None
        environment = None
        if environment_config and environment_config.configuration:
            workspace_id = environment_config.configuration.get("workspace_id")
            environment = environment_config.name

        logger.info(
            f"Getting DBU cost breakdown from {start_date} to {end_date} "
            f"(workspace: {workspace_id or 'all'}, env: {environment or 'all'})"
        )

        # Build filter conditions
        filters = [
            PipelineDBUUsage.usage_date >= start_date,
            PipelineDBUUsage.usage_date <= end_date,
        ]

        if workspace_id:
            filters.append(PipelineDBUUsage.workspace_id == workspace_id)
        if environment:
            filters.append(PipelineDBUUsage.environment == environment)

        # Get pipeline breakdown
        pipeline_breakdown = (
            db.query(
                PipelineDBUUsage.pipeline_id,
                func.max(PipelineDBUUsage.pipeline_name).label("pipeline_name"),
                func.sum(PipelineDBUUsage.dbu_consumed).label("dbu_consumed"),
                func.sum(PipelineDBUUsage.dbu_cost_usd).label("dbu_cost_usd"),
            )
            .filter(and_(*filters))
            .group_by(PipelineDBUUsage.pipeline_id)
            .order_by(func.sum(PipelineDBUUsage.dbu_cost_usd).desc())
            .all()
        )

        # Get SKU breakdown
        sku_breakdown = (
            db.query(
                PipelineDBUUsage.sku_name,
                func.sum(PipelineDBUUsage.dbu_consumed).label("dbu_consumed"),
                func.sum(PipelineDBUUsage.dbu_cost_usd).label("dbu_cost_usd"),
            )
            .filter(and_(*filters))
            .group_by(PipelineDBUUsage.sku_name)
            .all()
        )

        # Calculate totals
        total_cost = sum(row.dbu_cost_usd or Decimal("0") for row in pipeline_breakdown)
        total_dbu = sum(row.dbu_consumed or Decimal("0") for row in pipeline_breakdown)

        return DBUCostBreakdown(
            period_start=start_date,
            period_end=end_date,
            total_dbu_consumed=total_dbu,
            total_dbu_cost_usd=total_cost,
            pipeline_costs=[
                {
                    "pipeline_id": row.pipeline_id,
                    "pipeline_name": row.pipeline_name,
                    "dbu_consumed": row.dbu_consumed or Decimal("0"),
                    "dbu_cost_usd": row.dbu_cost_usd or Decimal("0"),
                }
                for row in pipeline_breakdown
            ],
            sku_costs=[
                {
                    "sku_name": row.sku_name,
                    "dbu_consumed": row.dbu_consumed or Decimal("0"),
                    "dbu_cost_usd": row.dbu_cost_usd or Decimal("0"),
                }
                for row in sku_breakdown
            ],
        )

    except Exception as e:
        logger.error(f"Failed to get cost breakdown: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve cost breakdown: {e!s}"
        )


# Monthly invoice endpoints
@router.get("/invoices/monthly/{year}/{month}", response_model=MonthlyDBUInvoice)
async def get_monthly_invoice(
    db: Annotated[Session, Depends(get_db)],
    year: int = Path(..., description="Invoice year"),
    month: int = Path(..., description="Invoice month (1-12)"),
    force_regenerate: bool = Query(False, description="Force regenerate invoice"),
):
    """Get monthly DBU invoice for a workspace.

    Automatically uses workspace_id and environment from environment configuration.
    """
    try:
        # Get workspace_id and environment from environment configuration
        from ...models.db import Environment

        environment_config = db.query(Environment).first()

        if not environment_config or not environment_config.configuration:
            raise HTTPException(
                status_code=400,
                detail="Environment configuration required for invoice generation",
            )

        workspace_id = environment_config.configuration.get("workspace_id")
        environment = environment_config.name

        if not workspace_id:
            raise HTTPException(
                status_code=400, detail="workspace_id not configured in environment"
            )

        logger.info(f"Getting monthly invoice for {workspace_id} - {year}-{month:02d}")

        invoice = await dbu_invoice_service.generate_monthly_invoice(
            year=year,
            month=month,
            workspace_id=workspace_id,
            environment=environment,
            force_regenerate=force_regenerate,
        )

        return invoice

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get monthly invoice: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve monthly invoice: {e!s}"
        )


@router.post("/invoices/generate", response_model=MonthlyDBUInvoice)
async def generate_invoice(
    db: Annotated[Session, Depends(get_db)],
    year: int = Query(..., description="Invoice year"),
    month: int = Query(..., description="Invoice month (1-12)"),
):
    """Generate a new invoice for the specified period.

    Automatically uses workspace_id and environment from environment configuration.
    """
    try:
        # Get workspace_id and environment from environment configuration
        from ...models.db import Environment

        environment_config = db.query(Environment).first()

        if not environment_config or not environment_config.configuration:
            raise HTTPException(
                status_code=400,
                detail="Environment configuration required for invoice generation",
            )

        workspace_id = environment_config.configuration.get("workspace_id")
        environment = environment_config.name

        if not workspace_id:
            raise HTTPException(
                status_code=400, detail="workspace_id not configured in environment"
            )

        logger.info(f"Generating invoice for {workspace_id} - {year}-{month:02d}")

        invoice = await dbu_invoice_service.generate_monthly_invoice(
            year=year,
            month=month,
            workspace_id=workspace_id,
            environment=environment,
            force_regenerate=True,
        )

        return invoice

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate invoice: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate invoice: {e!s}"
        )


@router.get("/invoices/history", response_model=list[MonthlyDBUInvoice])
async def get_invoice_history(
    db: Annotated[Session, Depends(get_db)],
    year: Optional[int] = Query(None, description="Filter by year"),
    limit: int = Query(50, description="Maximum number of invoices to return"),
):
    """Get historical invoices.

    Automatically filters by workspace_id and environment from environment configuration.
    """
    try:
        # Get workspace_id and environment from environment configuration
        from ...models.db import Environment

        environment_config = db.query(Environment).first()

        workspace_id = None
        environment = None
        if environment_config and environment_config.configuration:
            workspace_id = environment_config.configuration.get("workspace_id")
            environment = environment_config.name

        logger.info(
            f"Getting invoice history - workspace: {workspace_id or 'all'}, "
            f"env: {environment or 'all'}, year: {year or 'all'}"
        )

        invoices = await dbu_invoice_service.list_invoices(
            workspace_id=workspace_id,
            environment=environment,
            year=year,
            limit=limit,
        )

        return invoices

    except Exception as e:
        logger.error(f"Failed to get invoice history: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve invoice history: {e!s}"
        )


# Sync status and management endpoints
@router.get("/sync/status", response_model=list[DBUSyncStatusResponse])
async def get_sync_status(
    db: Annotated[Session, Depends(get_db)],
):
    """Get DBU sync status for workspaces.

    Automatically filters by workspace_id from environment configuration.
    """
    try:
        # Get workspace_id from environment configuration
        from ...models.db import Environment

        environment_config = db.query(Environment).first()

        workspace_id = None
        if environment_config and environment_config.configuration:
            workspace_id = environment_config.configuration.get("workspace_id")

        logger.info(f"Getting sync status for workspace: {workspace_id or 'all'}")

        query = db.query(DBUSyncStatus)
        if workspace_id:
            query = query.filter(DBUSyncStatus.workspace_id == workspace_id)

        sync_records = query.order_by(desc(DBUSyncStatus.last_sync_attempt)).all()

        return [
            DBUSyncStatusResponse(
                workspace_id=record.workspace_id,
                last_sync_date=record.last_sync_date,
                last_sync_status=record.last_sync_status,
                last_sync_attempt=record.last_sync_attempt,
                last_successful_sync=record.last_successful_sync,
                records_processed=record.records_processed,
                retry_count=record.retry_count,
                error_message=record.error_message,
                sync_batch_id=record.sync_batch_id,
            )
            for record in sync_records
        ]

    except Exception as e:
        logger.error(f"Failed to get sync status: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve sync status: {e!s}"
        )


@router.post("/sync/trigger", response_model=DBUManualSyncResponse)
async def trigger_manual_sync(
    request: DBUManualSyncRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Trigger manual DBU sync.

    Supports multiple sync modes:
    1. Single date: Provide `sync_date`
    2. Whole month: Provide `sync_month` (e.g., "2025-10")
    3. Date range: Provide `start_date` and `end_date`
    4. Latest/yesterday: Don't provide any date parameter

    Note: The 'organization_id' field is deprecated. Use 'workspace_id' instead.
    Both fields are accepted for backward compatibility.
    """
    try:
        # Validate mutually exclusive date parameters
        date_params = [
            request.sync_date,
            request.sync_month,
            (request.start_date and request.end_date),
        ]
        if sum(bool(p) for p in date_params) > 1:
            raise HTTPException(
                status_code=400,
                detail="Only one of sync_date, sync_month, or start_date/end_date can be specified",
            )

        # Parse date range based on input
        start_date = None
        end_date = None

        if request.sync_date:
            # Single date sync
            start_date = end_date = request.sync_date
            logger.info(f"Single date sync requested: {request.sync_date}")

        elif request.sync_month:
            # Month sync
            from calendar import monthrange

            year, month = map(int, request.sync_month.split("-"))
            start_date = date(year, month, 1)
            _, last_day = monthrange(year, month)
            end_date = date(year, month, last_day)
            logger.info(
                f"Month sync requested: {request.sync_month} ({start_date} to {end_date})"
            )

        elif request.start_date and request.end_date:
            # Date range sync
            if request.start_date > request.end_date:
                raise HTTPException(
                    status_code=400,
                    detail="start_date must be before or equal to end_date",
                )
            start_date = request.start_date
            end_date = request.end_date
            logger.info(f"Date range sync requested: {start_date} to {end_date}")

        logger.info(
            f"Manual sync triggered - "
            f"workspace: {request.workspace_id or 'all'}, "
            f"date range: {start_date or 'latest'} to {end_date or 'latest'}, "
            f"force_resync: {request.force_resync}"
        )

        # Get workspace_id from environment if not provided
        workspace_id = request.workspace_id
        if not workspace_id:
            from ...models.db import Environment

            environment_config = db.query(Environment).first()
            if environment_config and environment_config.configuration:
                workspace_id = environment_config.configuration.get("workspace_id")

        # Validate workspace_id is configured
        if not workspace_id:
            raise HTTPException(
                status_code=400,
                detail="workspace_id not configured in environment. Please set it in the environment configuration or provide it in the request.",
            )

        logger.info(f"Using workspace_id: {workspace_id} for sync")

        start_time = datetime.now(timezone.utc)

        result = await dbu_background_sync_service.trigger_manual_sync(
            workspace_id=workspace_id,
            force_resync=request.force_resync,
            start_date=start_date,
            end_date=end_date,
        )

        end_time = datetime.now(timezone.utc)

        # Calculate days synced
        days_synced = None
        if start_date and end_date:
            days_synced = (end_date - start_date).days + 1

        return DBUManualSyncResponse(
            status=result.get("status", "success"),
            message=result.get("message", "Manual sync completed successfully"),
            sync_batch_id=result.get("sync_batch_id"),
            workspace_id=result.get("workspace_id") or workspace_id,
            records_processed=result.get("records_processed", 0),
            started_at=start_time,
            completed_at=end_time,
            sync_start_date=start_date,
            sync_end_date=end_date,
            days_synced=days_synced,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger manual sync: {e!s}")
        return DBUManualSyncResponse(
            status="failed",
            message=f"Failed to trigger sync: {e!s}",
            error=str(e),
            sync_batch_id="error",
            started_at=datetime.now(timezone.utc),
            records_processed=0,
        )


# Pricing rules endpoint
@router.get("/pricing", response_model=list[DBUPricingRule])
async def get_pricing_rules(
    db: Annotated[Session, Depends(get_db)],
    sku_name: Optional[str] = Query(None, description="Filter by SKU name"),
    is_active: bool = Query(True, description="Filter by active status"),
):
    """Get current DBU pricing rules."""
    try:
        logger.info(f"Getting pricing rules - SKU: {sku_name or 'all'}")

        query = db.query(DBUPricingRules)
        if sku_name:
            query = query.filter(DBUPricingRules.sku_name == sku_name)
        if is_active:
            query = query.filter(DBUPricingRules.is_active)

        pricing_records = query.order_by(desc(DBUPricingRules.effective_date)).all()

        return [
            DBUPricingRule(
                id=record.id,
                sku_name=record.sku_name,
                region=record.region,
                pricing_tier=record.pricing_tier,
                dbu_unit_price=record.dbu_unit_price,
                currency=record.currency,
                effective_date=record.effective_date,
                end_date=record.end_date,
                is_active=record.is_active,
            )
            for record in pricing_records
        ]

    except Exception as e:
        logger.error(f"Failed to get pricing rules: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve pricing rules: {e!s}"
        )


# Health check endpoint
@router.get("/health", response_model=DBUHealthCheck)
async def get_dbu_service_health(
    db: Annotated[Session, Depends(get_db)],
):
    """Check DBU service health."""
    try:
        # Check database connectivity
        db.execute("SELECT 1")

        # Check recent sync status
        recent_sync = (
            db.query(DBUSyncStatus)
            .order_by(desc(DBUSyncStatus.last_sync_attempt))
            .first()
        )

        sync_healthy = True
        sync_status = "No sync records found"

        if recent_sync:
            # Consider sync healthy if last successful sync was within 2 days
            if recent_sync.last_successful_sync:
                days_since_sync = (
                    datetime.now(timezone.utc) - recent_sync.last_successful_sync
                ).days
                sync_healthy = days_since_sync <= 2
                sync_status = f"Last successful sync: {days_since_sync} days ago"
            else:
                sync_healthy = False
                sync_status = "No successful syncs found"

        return DBUHealthCheck(
            service_healthy=True,
            database_connected=True,
            sync_service_healthy=sync_healthy,
            last_sync_status=sync_status,
            timestamp=datetime.now(timezone.utc),
        )

    except Exception as e:
        logger.error(f"Health check failed: {e!s}")
        return DBUHealthCheck(
            service_healthy=False,
            database_connected=False,
            sync_service_healthy=False,
            last_sync_status=f"Health check failed: {e!s}",
            timestamp=datetime.now(timezone.utc),
        )
