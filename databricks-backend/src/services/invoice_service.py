"""Service for generating monthly DBU invoices."""

import json
import logging
from calendar import monthrange
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, cast, Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.api.compute_usage import (
    MonthlyDBUInvoice as MonthlyDBUInvoiceResponse,
    MonthlyInvoiceLineItem,
)
from ..models.db.compute_tracking import MonthlyDBUInvoice, PipelineDBUUsage

logger = logging.getLogger(__name__)


class DBUInvoiceService:
    """Provides services for generating and managing monthly DBU invoices.

    This service class encapsulates the business logic for creating, retrieving,
    and exporting monthly invoices based on DBU (Databricks Unit) consumption
    data stored in the database. It can calculate usage, aggregate costs, and
    format the data into structured invoice responses or exportable formats like
    JSON and CSV.
    """

    async def generate_monthly_invoice(
        self,
        year: int,
        month: int,
        workspace_id: str,
        environment: Optional[str] = None,
        force_regenerate: bool = False,
    ) -> MonthlyDBUInvoiceResponse:
        """Generate or retrieve monthly DBU invoice.

        Args:
            year: Invoice year
            month: Invoice month (1-12)
            workspace_id: Workspace identifier
            environment: Optional environment filter
            force_regenerate: Force regeneration even if invoice exists

        Returns:
            Monthly invoice response
        """
        db = next(get_db())
        try:
            invoice_month = date(year, month, 1)
            logger.info(
                f"Generating monthly invoice for {workspace_id} - {year}-{month:02d}"
            )

            # Check if invoice already exists (build filters conditionally)
            filters = [
                MonthlyDBUInvoice.invoice_month == invoice_month,
                MonthlyDBUInvoice.workspace_id == workspace_id,
            ]
            if environment is not None:
                filters.append(MonthlyDBUInvoice.environment == environment)

            existing_invoice = db.query(MonthlyDBUInvoice).filter(*filters).first()

            if existing_invoice and not force_regenerate:
                logger.info(
                    f"Found existing invoice for {workspace_id} - {year}-{month:02d}"
                )
                return await self._convert_to_response(existing_invoice, db)

            # Generate new invoice
            invoice_data = await self._calculate_monthly_usage(
                year, month, workspace_id, environment, db
            )

            # Create or update invoice record
            if existing_invoice:
                invoice_record = existing_invoice
                logger.info("Updating existing invoice record")
            else:
                invoice_record = MonthlyDBUInvoice(
                    invoice_month=invoice_month,
                    workspace_id=workspace_id,
                    environment=environment,
                )
                db.add(invoice_record)
                logger.info("Creating new invoice record")

            # Update invoice fields
            self._update_invoice_record(invoice_record, invoice_data)

            db.commit()
            db.refresh(invoice_record)

            # Fix log key to total_dbu_cost_usd
            logger.info(
                f"Generated invoice: ${invoice_data['total_dbu_cost_usd']} for {invoice_data['total_pipelines']} pipelines"
            )
            return await self._convert_to_response(invoice_record, db)

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to generate monthly invoice: {e!s}")
            raise
        finally:
            db.close()

    async def _calculate_monthly_usage(
        self,
        year: int,
        month: int,
        workspace_id: str,
        environment: Optional[str],
        db: Session,
    ) -> dict[str, Any]:
        """Calculate monthly usage metrics."""
        # Get month date range
        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])

        logger.info(f"Calculating usage for {first_day} to {last_day}")

        # Base query for the month
        base_query = db.query(PipelineDBUUsage).filter(
            and_(
                PipelineDBUUsage.workspace_id == workspace_id,
                PipelineDBUUsage.usage_date >= first_day,
                PipelineDBUUsage.usage_date <= last_day,
            )
        )

        if environment:
            base_query = base_query.filter(PipelineDBUUsage.environment == environment)

        # Total summary metrics
        summary_data = base_query.with_entities(
            func.count(func.distinct(PipelineDBUUsage.pipeline_id)).label(
                "total_pipelines"
            ),
            func.count(PipelineDBUUsage.id).label("total_executions"),
            func.sum(PipelineDBUUsage.execution_duration_minutes).label(
                "total_duration_minutes"
            ),
            func.sum(PipelineDBUUsage.dbu_consumed).label("total_dbu_consumed"),
            func.sum(PipelineDBUUsage.dbu_cost_usd).label("total_dbu_cost_usd"),
        ).first()

        # Guard against None and extract totals to locals for type safety
        if summary_data is None:
            total_pipelines = 0
            total_executions = 0
            total_duration_minutes = 0
            total_dbu_consumed = Decimal("0")
            total_dbu_cost_usd = Decimal("0")
        else:
            total_pipelines = int(getattr(summary_data, "total_pipelines", 0) or 0)
            total_executions = int(getattr(summary_data, "total_executions", 0) or 0)
            total_duration_minutes = int(
                getattr(summary_data, "total_duration_minutes", 0) or 0
            )
            total_dbu_consumed = getattr(
                summary_data, "total_dbu_consumed", None
            ) or Decimal("0")
            total_dbu_cost_usd = getattr(
                summary_data, "total_dbu_cost_usd", None
            ) or Decimal("0")

        # Per-pipeline breakdown (replace non-portable func.first with max)
        pipeline_breakdown = (
            base_query.with_entities(
                PipelineDBUUsage.pipeline_id,
                func.max(PipelineDBUUsage.pipeline_name).label("pipeline_name"),
                func.count(PipelineDBUUsage.id).label("executions"),
                func.sum(PipelineDBUUsage.execution_duration_minutes).label(
                    "duration_minutes"
                ),
                func.sum(PipelineDBUUsage.dbu_consumed).label("dbu_consumed"),
                func.sum(PipelineDBUUsage.dbu_cost_usd).label("dbu_cost_usd"),
            )
            .group_by(PipelineDBUUsage.pipeline_id)
            .order_by(func.sum(PipelineDBUUsage.dbu_cost_usd).desc())
            .all()
        )

        # SKU breakdown (overall)
        sku_breakdown = (
            base_query.with_entities(
                PipelineDBUUsage.sku_name,
                func.sum(PipelineDBUUsage.dbu_consumed).label("dbu_consumed"),
                func.sum(PipelineDBUUsage.dbu_cost_usd).label("dbu_cost_usd"),
            )
            .group_by(PipelineDBUUsage.sku_name)
            .all()
        )

        # Calculate SKU-specific totals
        premium_dlt_dbu = Decimal("0")
        premium_dlt_cost = Decimal("0")
        standard_dlt_dbu = Decimal("0")
        standard_dlt_cost = Decimal("0")

        for sku in sku_breakdown:
            if "PREMIUM" in str(sku.sku_name or "").upper():
                premium_dlt_dbu += sku.dbu_consumed or Decimal("0")
                premium_dlt_cost += sku.dbu_cost_usd or Decimal("0")
            else:
                standard_dlt_dbu += sku.dbu_consumed or Decimal("0")
                standard_dlt_cost += sku.dbu_cost_usd or Decimal("0")

        # Batch SKU breakdown per pipeline to avoid N+1 queries
        per_pipeline_sku_rows = (
            base_query.with_entities(
                PipelineDBUUsage.pipeline_id,
                PipelineDBUUsage.sku_name,
                func.sum(PipelineDBUUsage.dbu_consumed).label("dbu_consumed"),
                func.sum(PipelineDBUUsage.dbu_cost_usd).label("dbu_cost_usd"),
            )
            .group_by(PipelineDBUUsage.pipeline_id, PipelineDBUUsage.sku_name)
            .all()
        )

        sku_by_pipeline: dict[str, dict[str, dict[str, float]]] = {}
        for row in per_pipeline_sku_rows:
            pid = row.pipeline_id
            sku_name = row.sku_name or "unknown"
            sku_by_pipeline.setdefault(pid, {})[sku_name] = {
                "dbu_consumed": float(row.dbu_consumed or 0),
                "cost_usd": float(row.dbu_cost_usd or 0),
            }

        # Calculate comparison with previous month
        cost_vs_previous = await self._calculate_cost_comparison(
            year, month, workspace_id, environment, db
        )

        # Build line items using precomputed per-pipeline SKU breakdown
        line_items = []
        for pipeline in pipeline_breakdown:
            avg_dbu_per_execution = None
            if pipeline.executions and pipeline.executions > 0:
                avg_dbu_per_execution = (
                    pipeline.dbu_consumed or Decimal("0")
                ) / pipeline.executions

            line_items.append(
                {
                    "pipeline_id": pipeline.pipeline_id,
                    "pipeline_name": pipeline.pipeline_name,
                    "total_executions": pipeline.executions or 0,
                    "total_dbu_consumed": pipeline.dbu_consumed or Decimal("0"),
                    "total_dbu_cost_usd": pipeline.dbu_cost_usd or Decimal("0"),
                    "avg_dbu_per_execution": avg_dbu_per_execution,
                    "sku_breakdown": sku_by_pipeline.get(pipeline.pipeline_id, {}),
                }
            )

        # Calculate daily average
        days_in_month = monthrange(year, month)[1]
        avg_daily_cost = None
        if total_dbu_cost_usd:
            avg_daily_cost = total_dbu_cost_usd / days_in_month

        return {
            "total_pipelines": total_pipelines,
            "total_executions": total_executions,
            "total_duration_minutes": total_duration_minutes,
            "total_dbu_consumed": total_dbu_consumed,
            "total_dbu_cost_usd": total_dbu_cost_usd,
            "premium_dlt_dbu": premium_dlt_dbu,
            "premium_dlt_cost_usd": premium_dlt_cost,
            "standard_dlt_dbu": standard_dlt_dbu,
            "standard_dlt_cost_usd": standard_dlt_cost,
            "avg_daily_cost": cast("Optional[Decimal]", avg_daily_cost),
            "cost_vs_previous_month": cost_vs_previous,
            "line_items": line_items,
        }

    async def _calculate_cost_comparison(
        self,
        year: int,
        month: int,
        workspace_id: str,
        environment: Optional[str],
        db: Session,
    ) -> Optional[float]:
        """Calculate cost comparison with previous month."""
        try:
            # Get previous month
            if month == 1:
                prev_year, prev_month = year - 1, 12
            else:
                prev_year, prev_month = year, month - 1

            # Check if previous month invoice exists (conditional filter)
            prev_invoice_month = date(prev_year, prev_month, 1)
            prev_filters = [
                MonthlyDBUInvoice.invoice_month == prev_invoice_month,
                MonthlyDBUInvoice.workspace_id == workspace_id,
            ]
            if environment is not None:
                prev_filters.append(MonthlyDBUInvoice.environment == environment)

            prev_invoice = db.query(MonthlyDBUInvoice).filter(*prev_filters).first()

            if prev_invoice:
                prev_cost = cast("Optional[Decimal]", prev_invoice.total_dbu_cost_usd)
                if prev_cost is not None and prev_cost > 0:
                    current_cost = await self._get_current_month_cost(
                        year, month, workspace_id, environment, db
                    )
                    if current_cost is not None and current_cost > 0:
                        percentage_change = (
                            (current_cost - prev_cost) / prev_cost
                        ) * 100
                        return float(percentage_change)

            return None

        except Exception as e:
            logger.error(f"Failed to calculate cost comparison: {e!s}")
            return None

    async def _get_current_month_cost(
        self,
        year: int,
        month: int,
        workspace_id: str,
        environment: Optional[str],
        db: Session,
    ) -> Optional[Decimal]:
        """Get current month total cost."""
        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])

        query = db.query(func.sum(PipelineDBUUsage.dbu_cost_usd)).filter(
            and_(
                PipelineDBUUsage.workspace_id == workspace_id,
                PipelineDBUUsage.usage_date >= first_day,
                PipelineDBUUsage.usage_date <= last_day,
            )
        )

        if environment:
            query = query.filter(PipelineDBUUsage.environment == environment)

        return query.scalar()

    def _update_invoice_record(
        self, invoice_record: MonthlyDBUInvoice, invoice_data: dict[str, Any]
    ):
        """Update invoice database record with calculated data."""
        # Use setattr to avoid static type checker issues with ORM mapped attributes
        invoice_record.total_pipelines = invoice_data["total_pipelines"]
        invoice_record.total_executions = invoice_data["total_executions"]
        invoice_record.total_duration_minutes = invoice_data["total_duration_minutes"]
        invoice_record.total_dbu_consumed = invoice_data["total_dbu_consumed"]
        invoice_record.total_dbu_cost_usd = invoice_data["total_dbu_cost_usd"]
        invoice_record.premium_dlt_dbu = invoice_data["premium_dlt_dbu"]
        invoice_record.premium_dlt_cost_usd = invoice_data["premium_dlt_cost_usd"]
        invoice_record.standard_dlt_dbu = invoice_data["standard_dlt_dbu"]
        invoice_record.standard_dlt_cost_usd = invoice_data["standard_dlt_cost_usd"]
        invoice_record.avg_daily_cost = invoice_data["avg_daily_cost"]
        invoice_record.cost_vs_previous_month = invoice_data["cost_vs_previous_month"]
        invoice_record.invoice_data = json.dumps(
            invoice_data["line_items"], default=str
        )
        invoice_record.invoice_status = "final"
        invoice_record.generated_at = datetime.now(timezone.utc)

    async def _convert_to_response(
        self, invoice_record: MonthlyDBUInvoice, db: Session
    ) -> MonthlyDBUInvoiceResponse:
        """Convert database record to API response."""
        # Parse line items from JSON
        line_items: list[MonthlyInvoiceLineItem] = []
        data_str_opt = cast("Optional[str]", invoice_record.invoice_data)
        if data_str_opt:
            try:
                parsed_line_items = json.loads(data_str_opt)
                line_items = [
                    MonthlyInvoiceLineItem(
                        pipeline_id=item["pipeline_id"],
                        pipeline_name=item["pipeline_name"],
                        total_executions=item["total_executions"],
                        total_dbu_consumed=Decimal(str(item["total_dbu_consumed"])),
                        total_dbu_cost_usd=Decimal(str(item["total_dbu_cost_usd"])),
                        avg_dbu_per_execution=Decimal(
                            str(item["avg_dbu_per_execution"])
                        )
                        if item.get("avg_dbu_per_execution")
                        else None,
                        sku_breakdown=item.get("sku_breakdown"),
                    )
                    for item in parsed_line_items
                ]
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Failed to parse invoice line items: {e!s}")

        invoice_month = cast("date", invoice_record.invoice_month).strftime("%Y-%m")

        return MonthlyDBUInvoiceResponse(
            invoice_month=invoice_month,
            workspace_id=cast("str", invoice_record.workspace_id),
            environment=cast("Optional[str]", invoice_record.environment),
            total_pipelines=cast("Optional[int]", invoice_record.total_pipelines) or 0,
            total_executions=cast("Optional[int]", invoice_record.total_executions)
            or 0,
            total_duration_minutes=cast(
                "Optional[int]", invoice_record.total_duration_minutes
            )
            or 0,
            total_dbu_consumed=cast(
                "Optional[Decimal]", invoice_record.total_dbu_consumed
            )
            or Decimal("0"),
            total_dbu_cost_usd=cast(
                "Optional[Decimal]", invoice_record.total_dbu_cost_usd
            )
            or Decimal("0"),
            avg_daily_cost=cast("Optional[Decimal]", invoice_record.avg_daily_cost),
            cost_vs_previous_month=cast(
                "Optional[float]", invoice_record.cost_vs_previous_month
            ),
            line_items=line_items,
            premium_dlt_dbu=cast("Optional[Decimal]", invoice_record.premium_dlt_dbu)
            or Decimal("0"),
            premium_dlt_cost_usd=cast(
                "Optional[Decimal]", invoice_record.premium_dlt_cost_usd
            )
            or Decimal("0"),
            standard_dlt_dbu=cast("Optional[Decimal]", invoice_record.standard_dlt_dbu)
            or Decimal("0"),
            standard_dlt_cost_usd=cast(
                "Optional[Decimal]", invoice_record.standard_dlt_cost_usd
            )
            or Decimal("0"),
            invoice_status=cast("Optional[str]", invoice_record.invoice_status)
            or "draft",
            generated_at=cast("Optional[datetime]", invoice_record.generated_at)
            or datetime.now(timezone.utc),
        )

    async def list_invoices(
        self,
        workspace_id: Optional[str] = None,
        environment: Optional[str] = None,
        year: Optional[int] = None,
        limit: int = 50,
    ) -> list[MonthlyDBUInvoiceResponse]:
        """List historical invoices."""
        db = next(get_db())
        try:
            query = db.query(MonthlyDBUInvoice)

            if workspace_id:
                query = query.filter(MonthlyDBUInvoice.workspace_id == workspace_id)

            if environment:
                query = query.filter(MonthlyDBUInvoice.environment == environment)

            if year:
                start_date = date(year, 1, 1)
                end_date = date(year, 12, 31)
                query = query.filter(
                    and_(
                        MonthlyDBUInvoice.invoice_month >= start_date,
                        MonthlyDBUInvoice.invoice_month <= end_date,
                    )
                )

            invoices = (
                query.order_by(MonthlyDBUInvoice.invoice_month.desc())
                .limit(limit)
                .all()
            )

            results = []
            for invoice in invoices:
                response = await self._convert_to_response(invoice, db)
                results.append(response)

            return results

        except Exception as e:
            logger.error(f"Failed to list invoices: {e!s}")
            raise
        finally:
            db.close()

    async def export_invoice_data(
        self, year: int, month: int, workspace_id: str, format: str = "json"
    ) -> dict[str, Any]:
        """Export invoice data in various formats."""
        invoice = await self.generate_monthly_invoice(year, month, workspace_id)

        if format.lower() == "json":
            return invoice.dict()
        elif format.lower() == "csv":
            # Convert to CSV format (simplified)
            csv_data = []
            csv_data.append(
                [
                    "Pipeline ID",
                    "Pipeline Name",
                    "Executions",
                    "DBU Consumed",
                    "Cost USD",
                ]
            )

            for line_item in invoice.line_items:
                csv_data.append(
                    [
                        line_item.pipeline_id,
                        line_item.pipeline_name or "",
                        line_item.total_executions,
                        float(line_item.total_dbu_consumed),
                        float(line_item.total_dbu_cost_usd),
                    ]
                )

            return {"csv_data": csv_data, "headers": csv_data[0]}
        else:
            raise ValueError(f"Unsupported export format: {format}")


# Create global instance
dbu_invoice_service = DBUInvoiceService()
