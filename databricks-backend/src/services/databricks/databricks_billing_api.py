"""Databricks billing and usage API service, refactored to use Databricks SDK."""

import logging
from datetime import date
from decimal import Decimal
from typing import Any, List, Optional

from databricks.sdk.service.sql import (
    StatementResponse,
    StatementState,
    ExecuteStatementRequestOnWaitTimeout,
)

from .sdk_adapter import DatabricksSDKAdapter
from .base_client import DatabricksAPIError

logger = logging.getLogger(__name__)


class DatabricksBillingAPI(DatabricksSDKAdapter):
    """Databricks billing and usage API client for DBU tracking using the SDK."""

    async def execute_sql_query(
        self, sql_query: str, warehouse_id: str
    ) -> StatementResponse:
        """Execute SQL query against Databricks system tables using the SDK."""
        logger.info(f"Executing billing query: {sql_query[:100]}...")

        # Execute with short timeout, continue async if needed
        response = await self._run_sync_method(
            self.sdk_client.statement_execution.execute_statement,
            statement=sql_query,
            warehouse_id=warehouse_id,
            wait_timeout="50s",  # Maximum allowed timeout (5-50 seconds)
            on_wait_timeout=ExecuteStatementRequestOnWaitTimeout.CONTINUE,  # Continue async if timeout
        )

        # If query is still running, poll for completion
        if response.status.state not in [
            StatementState.SUCCEEDED,
            StatementState.FAILED,
            StatementState.CANCELED,
        ]:
            logger.info(
                f"Query still running (state: {response.status.state}), polling for completion..."
            )
            statement_id = response.statement_id

            # Poll up to 10 times with 30 second intervals (5 minutes total)
            for i in range(10):
                await self._run_sync_method(lambda: __import__("time").sleep(30))
                response = await self._run_sync_method(
                    self.sdk_client.statement_execution.get_statement,
                    statement_id=statement_id,
                )
                logger.info(f"Poll {i + 1}/10: Query state is {response.status.state}")

                if response.status.state in [
                    StatementState.SUCCEEDED,
                    StatementState.FAILED,
                    StatementState.CANCELED,
                ]:
                    break

        return response

    def _parse_sql_response(self, response: StatementResponse) -> List[dict[str, Any]]:
        """Parse SDK's SQL query response into list of dictionaries."""
        try:
            if response.status.state != StatementState.SUCCEEDED:
                error = response.status.error
                raise DatabricksAPIError(
                    f"SQL execution failed: {error.message if error else 'Unknown error'}"
                )

            if not response.result:
                logger.warning("Empty result in SQL response")
                return []

            # Get column names from manifest
            # The manifest might be at response.manifest or response.result.manifest depending on SDK version
            manifest = getattr(response, "manifest", None) or getattr(
                response.result, "manifest", None
            )

            if not manifest or not hasattr(manifest, "schema"):
                logger.warning("Missing manifest or schema in SQL response")
                return []

            column_names = [col.name for col in manifest.schema.columns]
            records = []

            # Get chunks - they might be directly in result or need to be fetched
            chunks = getattr(response.result, "data_array", None)
            if chunks is None:
                # Try getting chunks attribute
                chunks_attr = getattr(response.result, "chunks", None)
                if chunks_attr and len(chunks_attr) > 0:
                    for chunk in chunks_attr:
                        chunk_data = getattr(chunk, "data_array", [])
                        for row in chunk_data:
                            record = {}
                            for i, value in enumerate(row):
                                if i < len(column_names):
                                    col_name = column_names[i]
                                    # Add type conversion logic
                                    if (
                                        col_name
                                        in [
                                            "dbu_consumed",
                                            "dbu_unit_price",
                                            "dbu_cost_usd",
                                        ]
                                        and value
                                    ):
                                        try:
                                            record[col_name] = Decimal(str(value))
                                        except (ValueError, TypeError):
                                            record[col_name] = value
                                    else:
                                        record[col_name] = value
                            records.append(record)
                else:
                    # No chunks means query returned 0 rows - this is valid
                    logger.debug("Query returned 0 rows (no data chunks)")
                    return []
            else:
                # data_array is directly available
                for row in chunks:
                    record = {}
                    for i, value in enumerate(row):
                        if i < len(column_names):
                            col_name = column_names[i]
                            if (
                                col_name
                                in ["dbu_consumed", "dbu_unit_price", "dbu_cost_usd"]
                                and value
                            ):
                                try:
                                    record[col_name] = Decimal(str(value))
                                except (ValueError, TypeError):
                                    record[col_name] = value
                            else:
                                record[col_name] = value
                    records.append(record)

            logger.info(f"Parsed {len(records)} records from SQL response")
            return records

        except Exception as e:
            logger.error(f"Failed to parse SQL response: {e!s}")
            raise DatabricksAPIError(f"Failed to parse SQL response: {e!s}")

    async def get_dbu_usage_by_date(
        self, target_date: date, warehouse_id: str, workspace_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """Get DBU usage for a specific date with enrichment from system tables.

        Enriches usage data with:
        - Pricing from system.billing.list_prices
        - Job metadata from system.lakeflow.jobs (job names, ownership, schedules)
        - Cluster metadata from system.compute.clusters (cluster names, types, ownership)
        - Warehouse metadata from system.compute.warehouses (warehouse names, types, sizes)
        - Pipeline metadata from DLT tables (pipeline names, UC linkage)
        """
        date_str = target_date.strftime("%Y-%m-%d")

        # Enhanced query with enrichment from multiple system tables
        base_query = f"""
        SELECT
            -- Core usage fields
            u.workspace_id,
            u.sku_name,
            u.usage_date,
            u.usage_start_time,
            u.usage_end_time,
            u.usage_unit,
            u.usage_quantity as dbu_consumed,
            COALESCE(p.pricing.effective_list.default, p.pricing.default, 0) as dbu_unit_price,
            u.usage_quantity * COALESCE(p.pricing.effective_list.default, p.pricing.default, 0) as dbu_cost_usd,

            -- Product features
            u.billing_origin_product,
            u.product_features.is_serverless,
            u.product_features.dlt_tier,
            u.cloud as cloud_provider,

            -- Identity and execution
            u.identity_metadata.run_as as executed_by,
            u.custom_tags,

            -- Resource identifiers
            u.usage_metadata.dlt_pipeline_id as pipeline_id,
            u.usage_metadata.job_id,
            u.usage_metadata.job_run_id,
            u.usage_metadata.cluster_id,
            u.usage_metadata.warehouse_id as warehouse_id,
            u.usage_metadata.endpoint_id,
            u.usage_metadata.notebook_id,

            -- Job enrichment (from system.lakeflow.jobs)
            j.job_name,
            j.owner as job_owner,
            j.schedule as job_schedule,
            j.job_type,
            j.created_by as job_created_by,
            j.created_time as job_created_at,

            -- Cluster enrichment (from system.compute.clusters)
            c.cluster_name,
            c.cluster_type,
            c.owned_by as cluster_owner,

            -- Warehouse enrichment (from system.compute.warehouses)
            w.warehouse_name,
            w.warehouse_type,
            w.warehouse_size,
            w.owned_by as warehouse_owner,

            -- Pipeline enrichment (from custom tags or metadata)
            COALESCE(
                u.usage_metadata.dlt_pipeline_id,
                u.custom_tags['pipeline_id'],
                u.custom_tags['dlt_pipeline_id']
            ) as resolved_pipeline_id,
            u.custom_tags['pipeline_name'] as pipeline_name_from_tags,
            u.custom_tags['uc_catalog'] as uc_catalog,
            u.custom_tags['uc_schema'] as uc_schema,
            u.custom_tags['uc_table'] as uc_table_name,
            u.custom_tags['team'] as team_tag

        FROM system.billing.usage u

        -- Pricing join
        LEFT JOIN system.billing.list_prices p
            ON u.sku_name = p.sku_name
            AND u.cloud = p.cloud
            AND u.usage_end_time >= p.price_start_time
            AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)

        -- Job metadata join
        LEFT JOIN system.lakeflow.jobs j
            ON CAST(u.usage_metadata.job_id AS STRING) = CAST(j.job_id AS STRING)
            AND u.workspace_id = j.workspace_id

        -- Cluster metadata join
        LEFT JOIN system.compute.clusters c
            ON u.usage_metadata.cluster_id = c.cluster_id
            AND u.workspace_id = c.workspace_id

        -- Warehouse metadata join
        LEFT JOIN system.compute.warehouses w
            ON u.usage_metadata.warehouse_id = w.warehouse_id
            AND u.workspace_id = w.workspace_id

        WHERE u.usage_date = '{date_str}'
        AND u.usage_unit = 'DBU'
        """

        if workspace_id:
            base_query += f" AND u.workspace_id = '{workspace_id}'"

        try:
            logger.info(
                f"Querying enriched DBU usage for {date_str}, workspace: {workspace_id or 'all'}"
            )
            response = await self.execute_sql_query(base_query, warehouse_id)
            records = self._parse_sql_response(response)
            logger.info(
                f"Found {len(records)} enriched DBU usage records for {date_str}"
            )
            return records
        except DatabricksAPIError as e:
            logger.error(f"Failed to get DBU usage for {date_str}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting DBU usage for {date_str}: {e}")
            raise DatabricksAPIError(f"Failed to query DBU usage: {e}")

    async def get_workspace_info(self, warehouse_id: str) -> list[dict[str, Any]]:
        """Return distinct workspaces observed in billing usage (workspace_id only)."""
        query = """
            SELECT DISTINCT
              CAST(u.workspace_id AS STRING) AS workspace_id
            FROM system.billing.usage u
            WHERE u.usage_unit = 'DBU'
            """
        try:
            resp = await self.execute_sql_query(query, warehouse_id)
            records = self._parse_sql_response(resp)
            return [
                {"workspace_id": str(r.get("workspace_id"))}
                for r in records
                if r.get("workspace_id") is not None
            ]
        except Exception as e:
            logger.error(f"Failed to get workspace info: {e!s}")
            return []

    async def get_pipeline_job_runs(
        self, target_date: date, warehouse_id: str, workspace_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """Get pipeline job runs for correlation with DBU usage.
        Returns empty list - pipeline metadata is included in DBU usage query.
        """
        return []

    async def validate_system_tables_access(self, warehouse_id: str) -> bool:
        """Validate access to Databricks system tables."""
        test_query = "SELECT 1 LIMIT 1"
        try:
            response = await self.execute_sql_query(test_query, warehouse_id)
            return response.status.state == StatementState.SUCCEEDED
        except Exception as e:
            logger.error(f"System tables validation failed: {e!s}")
            return False
