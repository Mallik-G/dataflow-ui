"""Service to export DLT silver/gold aggregates from Databricks to PostgreSQL.

This replaces raw event sync. It queries Databricks aggregate tables and upserts
into Nexa's product DB on a periodic schedule (15-min default).

Architecture:
- Source: Databricks Gold tables (dev.nexa_ops.dlt_pipeline_*)
- Destination: PostgreSQL nexa_admin schema (silver + gold tables)
- Filtering: None needed - all data in dlt_raw_logs is from pipelines we deployed
- Sync window: Last 2 hours for hourly, last 2 days for daily (idempotency)
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert

from ..core.database import get_db_session
from ..models.db.observability import (
    PipelineMetricsHourly,
    PipelineMetricsDaily,
    PipelineHealthCurrent,
    LineageGraph,
    AutoLoaderSummary,
    SourceBacklogSummary,
)
from .databricks.databricks_warehouse_api import DatabricksWarehouseAPI
from .retry_decorator import async_retry

logger = logging.getLogger(__name__)


class PipelineMetricExportService:
    """Export aggregated metrics from Databricks DLT Gold tables to PostgreSQL."""

    def __init__(
        self,
        *,
        host: str,
        client_id: str,
        client_secret: str,
        warehouse_id: str,
        catalog: str,
    ) -> None:
        self.host = host
        self.client_id = client_id
        self.client_secret = client_secret
        self.warehouse_id = warehouse_id

        # Validate catalog name to prevent SQL injection
        # Only allow alphanumeric characters, underscores, and hyphens
        if not re.match(r"^[a-zA-Z0-9_-]+$", catalog):
            raise ValueError(
                f"Invalid catalog name '{catalog}'. "
                "Catalog names must contain only alphanumeric characters, underscores, and hyphens."
            )
        self.catalog = catalog

        # Initialize Databricks Warehouse API client
        self.warehouse_api = DatabricksWarehouseAPI(
            host=host, client_id=client_id, client_secret=client_secret
        )

    @staticmethod
    def fq_table(catalog: str, schema: str, table: str) -> str:
        """Build fully-qualified table name safely (catalog validated upstream)."""
        return f"{catalog}.{schema}.{table}"

    # =========================================================================
    # Databricks Query Helper with Retry Logic
    # =========================================================================

    @async_retry(
        max_attempts=3,
        backoff_base=2.0,
        backoff_max=30.0,
        exceptions=(RuntimeError, ConnectionError, TimeoutError),
    )
    async def _execute_databricks_query(
        self, query: str, operation_name: str = "query"
    ) -> Dict[str, Any]:
        """Execute Databricks SQL query with automatic retry on transient failures.

        Args:
            query: SQL query to execute
            operation_name: Human-readable operation name for logging

        Returns:
            Query result dictionary with 'status' and 'rows' keys

        Raises:
            RuntimeError: If query fails after all retries
        """
        try:
            result = await self.warehouse_api.execute_sql(
                statement=query,
                warehouse_id=self.warehouse_id,
                catalog=self.catalog,
                wait=True,
            )

            if result.get("status") != "SUCCEEDED":
                error_msg = result.get("error") or result.get("status")
                raise RuntimeError(f"{operation_name} query failed: {error_msg}")

            return result

        except Exception as e:
            logger.error(f"Failed to execute {operation_name} query: {e}")
            raise

    # =========================================================================
    # Generic Bulk Upsert Helper
    # =========================================================================

    def _bulk_upsert(
        self,
        rows: List[List[Any]],
        model: type,
        row_mapper: callable,
        conflict_columns: List[str],
        skip_row_predicate: Optional[callable] = None,
        operation_name: str = "records",
        batch_size: int = 500,
    ) -> int:
        """Generic bulk upsert helper with batch processing for optimal performance.

        Args:
            rows: List of rows from Databricks query result
            model: SQLAlchemy model class to insert into
            row_mapper: Function that converts a row (list) to dict of field values
            conflict_columns: Column names for ON CONFLICT clause (index_elements)
            skip_row_predicate: Optional function to skip rows (returns True to skip)
            operation_name: Name for logging (e.g., "hourly metrics")
            batch_size: Number of rows to process per batch (default: 500)

        Returns:
            Number of rows upserted
        """
        with get_db_session() as db:
            try:
                # Filter and map rows
                values_list = []
                for row in rows:
                    # Skip rows based on predicate
                    if skip_row_predicate and skip_row_predicate(row):
                        continue
                    # Map row to field values
                    field_values = row_mapper(row)
                    values_list.append(field_values)

                if not values_list:
                    return 0

                total_inserted = 0

                # Process in batches for optimal performance
                for i in range(0, len(values_list), batch_size):
                    batch = values_list[i : i + batch_size]

                    # Create batch insert statement
                    stmt = insert(model).values(batch)

                    # Build update set (all fields except conflict columns)
                    # Use the first item to get field names (all items have same structure)
                    update_fields = {
                        key: stmt.excluded[key]
                        for key in batch[0].keys()
                        if key not in conflict_columns
                    }

                    # Add conflict resolution
                    stmt = stmt.on_conflict_do_update(
                        index_elements=conflict_columns, set_=update_fields
                    )

                    db.execute(stmt)
                    total_inserted += len(batch)

                    logger.debug(
                        f"Batch upserted {len(batch)} {operation_name} rows (total: {total_inserted}/{len(values_list)})"
                    )

                db.commit()
                logger.info(
                    f"Successfully upserted {total_inserted} {operation_name} rows in {(len(values_list) + batch_size - 1) // batch_size} batches"
                )
                return total_inserted

            except Exception as e:
                logger.error(f"Failed to upsert {operation_name}: {e}")
                db.rollback()
                raise

    # =========================================================================
    # Main Export Method
    # =========================================================================

    async def export_all(self) -> Dict[str, Any]:
        """Export aggregates for all pipelines.

        NOTE: No filtering by deployment_details needed - all data in
        dlt_raw_logs is from pipelines we deployed.

        Returns:
            Summary dict with sync statistics
        """
        start_time = datetime.now(timezone.utc)

        summary = {
            "status": "success",
            "pipelines_synced": 0,
            "total_events_synced": 0,  # kept for compatibility; represents rows upserted
            "tables_exported": 0,
            "rows_upserted": 0,
            "errors": [],
        }

        try:
            logger.info("Starting aggregate export from Databricks...")

            # Export each aggregate table (no filtering - all data is ours)
            hourly_rows = await self._export_hourly_metrics()
            summary["rows_upserted"] += hourly_rows
            summary["tables_exported"] += 1 if hourly_rows > 0 else 0

            daily_rows = await self._export_daily_metrics()
            summary["rows_upserted"] += daily_rows
            summary["tables_exported"] += 1 if daily_rows > 0 else 0

            health_rows = await self._export_health_summary()
            summary["rows_upserted"] += health_rows
            summary["tables_exported"] += 1 if health_rows > 0 else 0

            # Export new enhancement tables
            # Auto Loader - every 15 min (operational)
            autoloader_rows = await self._export_autoloader_summary()
            summary["rows_upserted"] += autoloader_rows
            summary["tables_exported"] += 1 if autoloader_rows > 0 else 0

            # Source backlog - every 15 min (operational)
            backlog_rows = await self._export_source_backlog()
            summary["rows_upserted"] += backlog_rows
            summary["tables_exported"] += 1 if backlog_rows > 0 else 0

            # Lineage - daily sync (changes infrequently)
            lineage_rows = await self._export_lineage_graph()
            summary["rows_upserted"] += lineage_rows
            summary["tables_exported"] += 1 if lineage_rows > 0 else 0

            # Set total_events_synced for compatibility
            summary["total_events_synced"] = summary["rows_upserted"]

            # Count distinct pipelines from the synced data
            summary["pipelines_synced"] = await self._count_distinct_pipelines()

            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(
                f"Aggregate export completed in {duration:.2f}s: "
                f"{summary['pipelines_synced']} pipelines, "
                f"{summary['rows_upserted']} rows, {summary['tables_exported']} tables"
            )

        except Exception as e:
            logger.error(f"Aggregate export failed: {e}", exc_info=True)
            summary["status"] = "error"
            summary["errors"].append(str(e))

        return summary

    # =========================================================================
    # Helper: Count Distinct Pipelines
    # =========================================================================

    async def _count_distinct_pipelines(self) -> int:
        """Count distinct pipelines in synced data."""
        with get_db_session() as db:
            try:
                from sqlalchemy import func

                count = db.query(
                    func.count(func.distinct(PipelineHealthCurrent.pipeline_id))
                ).scalar()
                return count or 0
            except Exception as e:
                logger.warning(f"Could not count pipelines: {e}")
                return 0

    # =========================================================================
    # Export: Hourly Metrics
    # =========================================================================

    async def _export_hourly_metrics(self) -> int:
        """Export hourly metrics from Databricks to Postgres.

        Sync window: Last 2 hours (for idempotency with late-arriving data).
        """
        logger.info("Exporting hourly metrics...")

        # Build SQL query (no filtering - all data is ours)
        query = f"""
            SELECT
                pipeline_id,
                pipeline_name,
                hour_start,
                update_count,
                success_count,
                failure_count,
                duration_avg_min,
                duration_max_min,
                backlog_gb,
                records_processed,
                computed_at
            FROM {self.fq_table(self.catalog, "nexa_ops", "dlt_pipeline_metrics_hourly")}
            WHERE hour_start >= current_timestamp() - INTERVAL 2 HOURS
            ORDER BY hour_start DESC
        """

        try:
            # Execute query with automatic retry
            result = await self._execute_databricks_query(query, "hourly metrics")

            rows = result.get("rows", [])
            if not rows:
                logger.info("No new hourly metrics to sync")
                return 0

            # Upsert to Postgres
            rows_upserted = self._upsert_hourly_metrics(rows)
            logger.info(f"Upserted {rows_upserted} hourly metric rows")
            return rows_upserted

        except Exception as e:
            logger.error(f"Failed to export hourly metrics: {e}")
            raise

    def _upsert_hourly_metrics(self, rows: List[List[Any]]) -> int:
        """Upsert hourly metrics rows to Postgres."""
        return self._bulk_upsert(
            rows=rows,
            model=PipelineMetricsHourly,
            row_mapper=lambda row: {
                "pipeline_id": row[0],
                "pipeline_name": row[1],
                "hour_start": row[2],
                "update_count": row[3] or 0,
                "success_count": row[4] or 0,
                "failure_count": row[5] or 0,
                "duration_avg_min": row[6],
                "duration_max_min": row[7],
                "backlog_gb": row[8],
                "records_processed": row[9],
                "computed_at": row[10] or datetime.now(timezone.utc),
            },
            conflict_columns=["pipeline_id", "hour_start"],
            operation_name="hourly metrics",
        )

    # =========================================================================
    # Export: Daily Metrics
    # =========================================================================

    async def _export_daily_metrics(self) -> int:
        """Export daily metrics from Databricks to Postgres.

        Sync window: Last 2 days (for idempotency).
        """
        logger.info("Exporting daily metrics...")

        # Build SQL query (no filtering - all data is ours)
        query = f"""
            SELECT
                pipeline_id,
                pipeline_name,
                date,
                update_count,
                success_count,
                failure_count,
                success_rate,
                duration_avg_min,
                duration_p95_min,
                backlog_avg_gb,
                backlog_max_gb,
                records_processed,
                computed_at
            FROM {self.fq_table(self.catalog, "nexa_ops", "dlt_pipeline_metrics_daily")}
            WHERE date >= current_date() - INTERVAL 2 DAYS
            ORDER BY date DESC
        """

        try:
            # Execute query with automatic retry
            result = await self._execute_databricks_query(query, "daily metrics")

            rows = result.get("rows", [])
            if not rows:
                logger.info("No new daily metrics to sync")
                return 0

            rows_upserted = self._upsert_daily_metrics(rows)
            logger.info(f"Upserted {rows_upserted} daily metric rows")
            return rows_upserted

        except Exception as e:
            logger.error(f"Failed to export daily metrics: {e}")
            raise

    def _upsert_daily_metrics(self, rows: List[List[Any]]) -> int:
        """Upsert daily metrics rows to Postgres."""
        return self._bulk_upsert(
            rows=rows,
            model=PipelineMetricsDaily,
            row_mapper=lambda row: {
                "pipeline_id": row[0],
                "pipeline_name": row[1],
                "date": row[2],
                "update_count": row[3] or 0,
                "success_count": row[4] or 0,
                "failure_count": row[5] or 0,
                "success_rate": row[6],
                "duration_avg_min": row[7],
                "duration_p95_min": row[8],
                "backlog_avg_gb": row[9],
                "backlog_max_gb": row[10],
                "records_processed": row[11],
                "computed_at": row[12] or datetime.now(timezone.utc),
            },
            conflict_columns=["pipeline_id", "date"],
            operation_name="daily metrics",
        )

    # =========================================================================
    # Export: Current Health Summary
    # =========================================================================

    async def _export_health_summary(self) -> int:
        """Export current pipeline health from Databricks to Postgres.

        This is a snapshot table (latest state per pipeline).
        """
        logger.info("Exporting pipeline health summary...")

        # Build SQL query (no filtering - all data is ours)
        query = f"""
            SELECT
                pipeline_id,
                pipeline_name,
                status,
                health_score,
                last_update_time,
                last_success_time,
                last_failure_time,
                consecutive_failures,
                is_stale,
                has_cost_anomaly,
                has_quality_issues,
                has_performance_issues,
                updated_at
            FROM {self.fq_table(self.catalog, "nexa_ops", "dlt_pipeline_health_current")}
        """

        try:
            # Execute query with automatic retry
            result = await self._execute_databricks_query(query, "health summary")

            rows = result.get("rows", [])
            if not rows:
                logger.info("No health summary data to sync")
                return 0

            rows_upserted = self._upsert_health_summary(rows)
            logger.info(f"Upserted {rows_upserted} health summary rows")
            return rows_upserted

        except Exception as e:
            logger.error(f"Failed to export health summary: {e}")
            raise

    def _upsert_health_summary(self, rows: List[List[Any]]) -> int:
        """Upsert health summary rows to Postgres."""

        def to_bool(value) -> bool:
            """Convert Databricks boolean value (string or bool) to Python bool."""
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ("true", "1", "t", "yes")
            return bool(value)

        return self._bulk_upsert(
            rows=rows,
            model=PipelineHealthCurrent,
            row_mapper=lambda row: {
                "pipeline_id": row[0],
                "pipeline_name": row[1],
                "status": row[2] or "unknown",
                "health_score": row[3],
                "last_update_time": row[4],
                "last_success_time": row[5],
                "last_failure_time": row[6],
                "consecutive_failures": row[7] or 0,
                "is_stale": to_bool(row[8]),
                "has_cost_anomaly": to_bool(row[9]),
                "has_quality_issues": to_bool(row[10]),
                "has_performance_issues": to_bool(row[11]),
                "updated_at": row[12] or datetime.now(timezone.utc),
            },
            conflict_columns=["pipeline_id"],
            operation_name="health summary",
        )

    # =========================================================================
    # Export: Lineage Graph (Daily Sync)
    # =========================================================================

    async def _export_lineage_graph(self) -> int:
        """Export lineage graph from Databricks to Postgres.

        Sync window: All current lineage (full snapshot, changes infrequently).
        """
        logger.info("Exporting lineage graph...")

        query = f"""
            SELECT
                pipeline_id,
                pipeline_name,
                flow_name,
                output_dataset,
                input_dataset,
                flow_type,
                last_seen,
                computed_at
            FROM {self.fq_table(self.catalog, "nexa_ops", "dlt_lineage_graph")}
        """

        try:
            # Execute query with automatic retry
            result = await self._execute_databricks_query(query, "lineage graph")

            rows = result.get("rows", [])
            if not rows:
                logger.info("No lineage data to sync")
                return 0

            rows_upserted = self._upsert_lineage_graph(rows)
            logger.info(f"Upserted {rows_upserted} lineage graph rows")
            return rows_upserted

        except Exception as e:
            logger.error(f"Failed to export lineage graph: {e}")
            raise

    def _upsert_lineage_graph(self, rows: List[List[Any]]) -> int:
        """Upsert lineage graph rows to Postgres."""
        return self._bulk_upsert(
            rows=rows,
            model=LineageGraph,
            row_mapper=lambda row: {
                "pipeline_id": row[0],
                "pipeline_name": row[1],
                "flow_name": row[2],
                "output_dataset": row[3],
                "input_dataset": row[4],
                "flow_type": row[5],
                "last_seen": row[6],
                "computed_at": row[7] or datetime.now(timezone.utc),
            },
            conflict_columns=[
                "pipeline_id",
                "flow_name",
                "output_dataset",
                "input_dataset",
            ],
            skip_row_predicate=lambda row: not row[3]
            or not row[4],  # Skip NULL datasets
            operation_name="lineage graph",
        )

    # =========================================================================
    # Export: Auto Loader Summary (15-min Sync)
    # =========================================================================

    async def _export_autoloader_summary(self) -> int:
        """Export Auto Loader summary from Databricks to Postgres.

        Sync window: Last 2 days (for idempotency).
        """
        logger.info("Exporting Auto Loader summary...")

        query = f"""
            SELECT
                pipeline_id,
                pipeline_name,
                flow_name,
                event_date,
                total_files_listed,
                total_files_added,
                total_gb_processed,
                failed_operations,
                avg_duration_sec,
                computed_at
            FROM {self.fq_table(self.catalog, "nexa_ops", "dlt_autoloader_summary")}
            WHERE event_date >= current_date() - INTERVAL 2 DAYS
            ORDER BY event_date DESC
        """

        try:
            # Execute query with automatic retry
            result = await self._execute_databricks_query(query, "Auto Loader summary")

            rows = result.get("rows", [])
            if not rows:
                logger.info("No Auto Loader data to sync")
                return 0

            rows_upserted = self._upsert_autoloader_summary(rows)
            logger.info(f"Upserted {rows_upserted} Auto Loader summary rows")
            return rows_upserted

        except Exception as e:
            logger.error(f"Failed to export Auto Loader summary: {e}")
            raise

    def _upsert_autoloader_summary(self, rows: List[List[Any]]) -> int:
        """Upsert Auto Loader summary rows to Postgres."""
        return self._bulk_upsert(
            rows=rows,
            model=AutoLoaderSummary,
            row_mapper=lambda row: {
                "pipeline_id": row[0],
                "pipeline_name": row[1],
                "flow_name": row[2],
                "event_date": row[3],
                "total_files_listed": row[4],
                "total_files_added": row[5],
                "total_gb_processed": row[6],
                "failed_operations": row[7],
                "avg_duration_sec": row[8],
                "computed_at": row[9] or datetime.now(timezone.utc),
            },
            conflict_columns=["pipeline_id", "flow_name", "event_date"],
            operation_name="Auto Loader summary",
        )

    # =========================================================================
    # Export: Source-Level Backlog (15-min Sync)
    # =========================================================================

    async def _export_source_backlog(self) -> int:
        """Export source-level backlog from Databricks to Postgres.

        Sync window: Last 2 days (for idempotency).
        """
        logger.info("Exporting source backlog summary...")

        query = f"""
            SELECT
                pipeline_id,
                pipeline_name,
                flow_name,
                source_name,
                event_date,
                max_backlog_gb,
                avg_backlog_gb,
                max_backlog_records,
                max_backlog_hours,
                avg_backlog_hours,
                computed_at
            FROM {self.fq_table(self.catalog, "nexa_ops", "dlt_source_backlog_summary")}
            WHERE event_date >= current_date() - INTERVAL 2 DAYS
            ORDER BY event_date DESC
        """

        try:
            # Execute query with automatic retry
            result = await self._execute_databricks_query(query, "source backlog")

            rows = result.get("rows", [])
            if not rows:
                logger.info("No source backlog data to sync")
                return 0

            rows_upserted = self._upsert_source_backlog(rows)
            logger.info(f"Upserted {rows_upserted} source backlog rows")
            return rows_upserted

        except Exception as e:
            logger.error(f"Failed to export source backlog: {e}")
            raise

    def _upsert_source_backlog(self, rows: List[List[Any]]) -> int:
        """Upsert source backlog rows to Postgres."""
        return self._bulk_upsert(
            rows=rows,
            model=SourceBacklogSummary,
            row_mapper=lambda row: {
                "pipeline_id": row[0],
                "pipeline_name": row[1],
                "flow_name": row[2],
                "source_name": row[3],
                "event_date": row[4],
                "max_backlog_gb": row[5],
                "avg_backlog_gb": row[6],
                "max_backlog_records": row[7],
                "max_backlog_hours": row[8],
                "avg_backlog_hours": row[9],
                "computed_at": row[10] or datetime.now(timezone.utc),
            },
            conflict_columns=["pipeline_id", "flow_name", "source_name", "event_date"],
            operation_name="source backlog",
        )
