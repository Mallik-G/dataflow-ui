"""Databricks Unity Catalog Data Lineage API client."""

import json
import logging
from typing import Any, List, Optional

from .sdk_adapter import DatabricksSDKAdapter

logger = logging.getLogger(__name__)


class DatabricksLineageAPIError(Exception):
    """Specific exception for Databricks Lineage API errors."""

    pass


class DatabricksLineageAPI(DatabricksSDKAdapter):
    """Databricks Unity Catalog Data Lineage API client with async operations.

    Implements both REST API fallback and system tables queries as recommended
    by the Sonra blog post on Databricks lineage best practices.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        super().__init__(host, client_id, client_secret)
        self.lineage_base_url = f"{self.host.rstrip('/')}/api/2.0/lineage-tracking/"
        self.sql_base_url = f"{self.host.rstrip('/')}/api/2.0/sql/statements/"
        self._warehouse_api = None  # Cache for warehouse API instance

    # =============================================================================
    # SYSTEM TABLES METHODS (Primary approach per blog recommendations)
    # =============================================================================

    async def execute_sql_warehouse_query(
        self, warehouse_id: str, query: str, catalog: Optional[str] = None
    ) -> dict[str, Any]:
        """Execute SQL via our shared DatabricksWarehouseAPI for consistency (ID normalization, polling)."""
        from .databricks_warehouse_api import DatabricksWarehouseAPI

        try:
            # Cache the warehouse API instance to avoid re-initialization
            if self._warehouse_api is None:
                self._warehouse_api = DatabricksWarehouseAPI(
                    self.host,
                    self.sdk_client.config.client_id,
                    self.sdk_client.config.client_secret,
                )
            api = self._warehouse_api
            # Optional: ensure running could be added if needed
            result = await api.execute_sql(
                statement=query, warehouse_id=warehouse_id, catalog=catalog, wait=True
            )
            cols = result.get("columns") or []
            rows = result.get("rows") or []
            return {
                "status": result.get("status", "success"),
                "columns": cols,
                "data": rows,
                "row_count": len(rows),
            }
        except Exception as e:
            logger.error(f"Failed to execute warehouse query: {e}")
            raise DatabricksLineageAPIError(f"System table query failed: {e}")

    async def get_table_lineage_from_system_tables(
        self, table_name: str, warehouse_id: str, max_depth: int = 3
    ) -> dict[str, Any]:
        """Get table lineage using system tables - recommended approach.

        Addresses the blog's concern about REST API only returning immediate dependencies
        by implementing iterative queries to build complete lineage chains.
        """
        try:
            # Quote table name safely
            safe_table = table_name.replace("'", "''") if table_name else ""
            catalog = table_name.split(".")[0] if table_name else None
            schema = (
                table_name.split(".")[1]
                if table_name and table_name.count(".") >= 1
                else None
            )
            safe_catalog = catalog.replace("'", "''") if catalog else None
            safe_schema = schema.replace("'", "''") if schema else None
            schema_filter_up = (
                f" AND source_table_full_name LIKE '{safe_catalog}.%.%'"
                if safe_catalog
                else ""
            )
            schema_filter_down = (
                f" AND target_table_full_name LIKE '{safe_catalog}.%.%'"
                if safe_catalog
                else ""
            )
            if safe_schema:
                schema_filter_up = (
                    f" AND source_table_full_name LIKE '{safe_catalog}.{safe_schema}.%'"
                )
                schema_filter_down = (
                    f" AND target_table_full_name LIKE '{safe_catalog}.{safe_schema}.%'"
                )
            # Get direct upstream dependencies (deduplicated to show only latest lineage event per unique source table)
            upstream_query = f"""
            SELECT
                source_table_full_name,
                entity_metadata
            FROM system.access.table_lineage
            WHERE target_table_full_name = '{safe_table}'{schema_filter_up}
            AND source_table_full_name != '{safe_table}'
            QUALIFY ROW_NUMBER() OVER (PARTITION BY source_table_full_name ORDER BY event_time DESC) = 1
            """

            # Get direct downstream dependencies (deduplicated to show only latest lineage event per unique target table)
            downstream_query = f"""
            SELECT
                target_table_full_name,
                entity_metadata
            FROM system.access.table_lineage
            WHERE source_table_full_name = '{safe_table}'{schema_filter_down}
            AND target_table_full_name != '{safe_table}'
            QUALIFY ROW_NUMBER() OVER (PARTITION BY target_table_full_name ORDER BY event_time DESC) = 1
            """

            upstream_result = await self.execute_sql_warehouse_query(
                warehouse_id, upstream_query
            )
            downstream_result = await self.execute_sql_warehouse_query(
                warehouse_id, downstream_query
            )

            # Process results to build lineage chains iteratively (overcoming CTE limitation)
            upstream_tables = set()
            downstream_tables = set()

            if upstream_result.get("data"):
                for row in upstream_result["data"]:
                    if row and len(row) > 0 and row[0]:  # Filter out None values
                        upstream_tables.add(row[0])

            if downstream_result.get("data"):
                for row in downstream_result["data"]:
                    if row and len(row) > 0 and row[0]:  # Filter out None values
                        downstream_tables.add(row[0])

            # Iteratively expand lineage to overcome one-level limitation
            all_upstream, depth_up = await self._expand_lineage_iteratively(
                list(upstream_tables), warehouse_id, "upstream", max_depth - 1
            )
            all_downstream, depth_down = await self._expand_lineage_iteratively(
                list(downstream_tables), warehouse_id, "downstream", max_depth - 1
            )

            result = {
                "table_name": table_name,
                "upstreams": [
                    {"name": table, "type": "table"} for table in all_upstream
                ],
                "downstreams": [
                    {"name": table, "type": "table"} for table in all_downstream
                ],
                "depth_analyzed": 1 + max(depth_up, depth_down),
                "source": "system_tables",
            }
            logger.info(
                f"Successfully built table lineage: {len(result['upstreams'])} upstreams, {len(result['downstreams'])} downstreams"
            )
            return result

        except Exception as e:
            logger.error(
                f"Failed to get table lineage from system tables: {e}", exc_info=True
            )
            # Fallback to REST API
            return await self.get_table_lineage(table_name, include_entity_lineage=True)

    async def _expand_lineage_iteratively(
        self,
        initial_tables: List[str],
        warehouse_id: str,
        direction: str,
        remaining_depth: int,
    ) -> tuple[set[str], int]:
        """Iteratively expand lineage to overcome Databricks CTE limitations.
        Returns set of tables and actual depth traversed.
        """
        all_tables = set(initial_tables)
        current_tables = initial_tables
        depth_reached = 0

        for depth in range(remaining_depth):
            if not current_tables:
                break
            # Build query for current level, quote strings safely
            safe_list = [t.replace("'", "''") if t else "" for t in current_tables if t]
            table_list = "', '".join(safe_list)
            if direction == "upstream":
                query = f"""
                SELECT DISTINCT source_table_full_name
                FROM system.access.table_lineage
                WHERE target_table_full_name IN ('{table_list}')
                """
            else:
                query = f"""
                SELECT DISTINCT target_table_full_name
                FROM system.access.table_lineage
                WHERE source_table_full_name IN ('{table_list}')
                """
            try:
                result = await self.execute_sql_warehouse_query(warehouse_id, query)
                next_level_tables = []
                if result.get("data"):
                    for row in result["data"]:
                        if (
                            row and len(row) > 0 and row[0] and row[0] not in all_tables
                        ):  # Filter out None
                            next_level_tables.append(row[0])
                            all_tables.add(row[0])
                current_tables = next_level_tables
                if next_level_tables:
                    depth_reached += 1
            except Exception as e:
                logger.warning(f"Failed to expand lineage at depth {depth}: {e}")
                break

        return all_tables, depth_reached

    async def get_column_lineage_from_system_tables(
        self, table_name: str, column_name: str, warehouse_id: str
    ) -> dict[str, Any]:
        """Get column lineage using system tables - recommended approach."""
        try:
            safe_table = table_name.replace("'", "''")
            safe_column = column_name.replace("'", "''")
            # Get upstream column dependencies (deduplicated to show only latest lineage event per unique source column)
            # Join with information_schema to enrich with data types
            upstream_query = f"""
            SELECT
                cl.source_table_full_name,
                cl.source_column_name,
                cl.entity_metadata,
                isc.data_type
            FROM system.access.column_lineage cl
            LEFT JOIN information_schema.columns isc
                ON SPLIT_PART(cl.source_table_full_name, '.', 1) = isc.table_catalog
                AND SPLIT_PART(cl.source_table_full_name, '.', 2) = isc.table_schema
                AND SPLIT_PART(cl.source_table_full_name, '.', 3) = isc.table_name
                AND cl.source_column_name = isc.column_name
            WHERE cl.target_table_full_name = '{safe_table}'
            AND cl.target_column_name = '{safe_column}'
            AND cl.source_table_full_name != '{safe_table}'
            QUALIFY ROW_NUMBER() OVER (PARTITION BY cl.source_table_full_name, cl.source_column_name ORDER BY cl.event_time DESC) = 1
            """

            # Get downstream column dependencies (deduplicated to show only latest lineage event per unique target column)
            # Join with information_schema to enrich with data types
            downstream_query = f"""
            SELECT
                cl.target_table_full_name,
                cl.target_column_name,
                cl.entity_metadata,
                isc.data_type
            FROM system.access.column_lineage cl
            LEFT JOIN information_schema.columns isc
                ON SPLIT_PART(cl.target_table_full_name, '.', 1) = isc.table_catalog
                AND SPLIT_PART(cl.target_table_full_name, '.', 2) = isc.table_schema
                AND SPLIT_PART(cl.target_table_full_name, '.', 3) = isc.table_name
                AND cl.target_column_name = isc.column_name
            WHERE cl.source_table_full_name = '{safe_table}'
            AND cl.source_column_name = '{safe_column}'
            AND cl.target_table_full_name != '{safe_table}'
            QUALIFY ROW_NUMBER() OVER (PARTITION BY cl.target_table_full_name, cl.target_column_name ORDER BY cl.event_time DESC) = 1
            """

            upstream_result = await self.execute_sql_warehouse_query(
                warehouse_id, upstream_query
            )
            downstream_result = await self.execute_sql_warehouse_query(
                warehouse_id, downstream_query
            )

            # Helper function to parse metadata JSON
            def parse_metadata(metadata_str):
                """Parse metadata JSON string, return dict or original string on error."""
                if metadata_str is None:
                    return None
                if isinstance(metadata_str, dict):
                    return metadata_str
                try:
                    return json.loads(metadata_str)
                except (json.JSONDecodeError, TypeError):
                    return metadata_str

            upstream_columns = []
            downstream_columns = []

            if upstream_result.get("data"):
                upstream_columns = [
                    {
                        "table_name": row[0],
                        "column_name": row[1] if len(row) > 1 else None,
                        "data_type": row[3] if len(row) > 3 else None,
                        "metadata": parse_metadata(row[2]) if len(row) > 2 else None,
                    }
                    for row in upstream_result["data"]
                    if row
                    and row[0] is not None
                    and (len(row) <= 1 or row[1] is not None)
                ]

            if downstream_result.get("data"):
                downstream_columns = [
                    {
                        "table_name": row[0],
                        "column_name": row[1] if len(row) > 1 else None,
                        "data_type": row[3] if len(row) > 3 else None,
                        "metadata": parse_metadata(row[2]) if len(row) > 2 else None,
                    }
                    for row in downstream_result["data"]
                    if row
                    and row[0] is not None
                    and (len(row) <= 1 or row[1] is not None)
                ]

            return {
                "table_name": table_name,
                "column_name": column_name,
                "upstream_cols": upstream_columns,
                "downstream_cols": downstream_columns,
                "source": "system_tables",
            }

        except Exception as e:
            logger.error(f"Failed to get column lineage from system tables: {e}")
            # Fallback to REST API
            return await self.get_column_lineage(table_name, column_name)

    async def get_lineage_with_query_history(
        self, table_name: str, warehouse_id: str, days: int = 30
    ) -> dict[str, Any]:
        """Get lineage data joined with query history for enhanced analysis.

        Implements the blog's recommendation to join lineage with query_history
        system table for additional insights.
        """
        try:
            safe_table = table_name.replace("'", "''")
            query = f"""
            SELECT DISTINCT
                tl.source_table_full_name,
                tl.target_table_full_name,
                qh.statement_text,
                qh.user_identity.email as user_email,
                qh.execution_duration_ms,
                tl.event_time
            FROM system.access.table_lineage tl
            JOIN system.access.query_history qh ON tl.entity_run_id = qh.statement_id
            WHERE (tl.source_table_full_name = '{safe_table}' OR tl.target_table_full_name = '{safe_table}')
            AND qh.event_date >= current_date() - INTERVAL '{days}' DAYS
            ORDER BY tl.event_time DESC
            LIMIT 100
            """

            result = await self.execute_sql_warehouse_query(warehouse_id, query)

            return {
                "table_name": table_name,
                "query_history_data": result.get("data", []),
                "columns": result.get("columns", []),
                "analysis_period_days": days,
                "source": "system_tables_with_history",
            }

        except Exception as e:
            logger.warning(f"Failed to get lineage with query history: {e}")
            return {"error": str(e), "table_name": table_name}

    # =============================================================================
    # REST API METHODS (Fallback approach)
    # =============================================================================

    async def get_table_lineage(
        self, table_name: str, include_entity_lineage: bool = True
    ) -> dict[str, Any]:
        """Retrieve table lineage information using Unity Catalog REST API.

        Note: This method only returns immediate dependencies as noted in the blog.
        Prefer system tables methods for comprehensive lineage.
        """
        try:
            # Use SDK's lineage client if available; otherwise call REST API directly
            if hasattr(self.sdk_client, "lineage"):
                result = await self._run_sync_method(
                    self.sdk_client.lineage.get_table_lineage,
                    table_name=table_name,
                    include_entity_lineage=include_entity_lineage,
                )
                return self._convert_sdk_lineage_result(result)
            # Direct REST fallback due to SDK issue https://github.com/databricks/databricks-sdk-py/issues/588
            try:
                params = {
                    "table_name": table_name,
                    "include_entity_lineage": str(include_entity_lineage).lower(),
                }
                data = await self._run_sync_method(
                    self.sdk_client.api_client.do,
                    "GET",
                    "/api/2.0/lineage-tracking/table-lineage",
                    query=params,
                )
                return {
                    "upstreams": data.get("upstreams", []),
                    "downstreams": data.get("downstreams", []),
                    "source": "rest_api",
                }
            except Exception as e2:
                logger.warning(
                    "SDK lineage client not available, lineage data may be limited: %s",
                    e2,
                )
                return {
                    "upstreams": [],
                    "downstreams": [],
                    "table_name": table_name,
                    "warning": "Limited lineage data - SDK lineage client not available",
                }
        except Exception as e:
            logger.error(f"Failed to get table lineage via REST API: {e}")
            return {
                "upstreams": [],
                "downstreams": [],
                "table_name": table_name,
                "error": str(e),
            }

    async def get_column_lineage(
        self, table_name: str, column_name: Optional[str] = None
    ) -> dict[str, Any]:
        """Retrieve column lineage information using Unity Catalog REST API.

        Note: This method only returns immediate dependencies as noted in the blog.
        Prefer system tables methods for comprehensive lineage.
        """
        try:
            # Use SDK's lineage client if available; otherwise call REST API directly
            if hasattr(self.sdk_client, "lineage"):
                result = await self._run_sync_method(
                    self.sdk_client.lineage.get_column_lineage,
                    table_name=table_name,
                    column_name=column_name,
                )
                return self._convert_sdk_column_lineage_result(result)
            # Direct REST fallback due to SDK issue https://github.com/databricks/databricks-sdk-py/issues/588
            try:
                params = {"table_name": table_name}
                if column_name:
                    params["column_name"] = column_name
                data = await self._run_sync_method(
                    self.sdk_client.api_client.do,
                    "GET",
                    "/api/2.0/lineage-tracking/column-lineage",
                    query=params,
                )
                return {
                    "upstream_cols": data.get("upstream_cols", []),
                    "downstream_cols": data.get("downstream_cols", []),
                    "source": "rest_api",
                }
            except Exception as e2:
                logger.warning(
                    "SDK lineage client not available, column lineage data may be limited: %s",
                    e2,
                )
                return {
                    "upstream_cols": [],
                    "downstream_cols": [],
                    "table_name": table_name,
                    "column_name": column_name,
                    "warning": "Limited lineage data - SDK lineage client not available",
                }
        except Exception as e:
            logger.error(f"Failed to get column lineage via REST API: {e}")
            return {
                "upstream_cols": [],
                "downstream_cols": [],
                "table_name": table_name,
                "column_name": column_name,
                "error": str(e),
            }

    def _convert_sdk_lineage_result(self, result: Any) -> dict[str, Any]:
        """Convert SDK lineage result to our expected format."""
        try:
            upstreams = []
            downstreams = []

            if hasattr(result, "upstreams") and result.upstreams:
                upstreams = [
                    {
                        "name": getattr(upstream, "table_full_name", ""),
                        "type": "table",
                        "metadata": getattr(upstream, "metadata", {}),
                    }
                    for upstream in result.upstreams
                ]

            if hasattr(result, "downstreams") and result.downstreams:
                downstreams = [
                    {
                        "name": getattr(downstream, "table_full_name", ""),
                        "type": "table",
                        "metadata": getattr(downstream, "metadata", {}),
                    }
                    for downstream in result.downstreams
                ]

            return {
                "upstreams": upstreams,
                "downstreams": downstreams,
                "source": "rest_api",
            }
        except Exception as e:
            logger.error(f"Failed to convert SDK lineage result: {e}")
            return {"upstreams": [], "downstreams": [], "error": str(e)}

    def _convert_sdk_column_lineage_result(self, result: Any) -> dict[str, Any]:
        """Convert SDK column lineage result to our expected format."""
        try:
            upstream_cols = []
            downstream_cols = []

            if hasattr(result, "upstream_cols") and result.upstream_cols:
                upstream_cols = [
                    {
                        "table_name": getattr(col, "table_full_name", ""),
                        "column_name": getattr(col, "column_name", ""),
                        "data_type": getattr(col, "data_type", None),
                    }
                    for col in result.upstream_cols
                ]

            if hasattr(result, "downstream_cols") and result.downstream_cols:
                downstream_cols = [
                    {
                        "table_name": getattr(col, "table_full_name", ""),
                        "column_name": getattr(col, "column_name", ""),
                        "data_type": getattr(col, "data_type", None),
                    }
                    for col in result.downstream_cols
                ]

            return {
                "upstream_cols": upstream_cols,
                "downstream_cols": downstream_cols,
                "source": "rest_api",
            }
        except Exception as e:
            logger.error(f"Failed to convert SDK column lineage result: {e}")
            return {"upstream_cols": [], "downstream_cols": [], "error": str(e)}
