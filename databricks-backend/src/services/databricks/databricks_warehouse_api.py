"""Databricks SQL Warehouse API client for warehouse management and SQL execution."""

import asyncio
import logging
import time
from typing import Any, Optional, Callable

from .sdk_adapter import DatabricksSDKAdapter

logger = logging.getLogger(__name__)


class StatementExecutionError(Exception):
    """Raised when a statement execution fails or times out."""

    pass


class DatabricksWarehouseAPI(DatabricksSDKAdapter):
    """SDK-based client for Databricks SQL Warehouse API operations and SQL execution."""

    def __init__(
        self,
        host: str,
        client_id: str,
        client_secret: str,
        default_warehouse_id: Optional[str] = None,
    ):
        super().__init__(host, client_id, client_secret)
        self._default_warehouse_id: Optional[str] = default_warehouse_id

    async def get_warehouse_status(self, warehouse_id: str) -> dict[str, Any]:
        """Get the current status of a SQL warehouse."""
        try:
            warehouse = self.sdk_client.warehouses.get(warehouse_id)
            return {
                "id": warehouse.id,
                "name": warehouse.name,
                "state": getattr(warehouse, "state", None)
                or getattr(warehouse, "health", None),
                "size": getattr(warehouse, "cluster_size", None),
                "num_clusters": getattr(warehouse, "num_clusters", None),
            }
        except Exception as e:
            return {"error": str(e)}

    async def start_warehouse(self, warehouse_id: str) -> dict[str, Any]:
        """Start a SQL warehouse."""
        try:
            self.sdk_client.warehouses.start(warehouse_id)
            return {"status": "success", "message": "Warehouse start initiated"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def stop_warehouse(self, warehouse_id: str) -> dict[str, Any]:
        """Stop a SQL warehouse."""
        try:
            self.sdk_client.warehouses.stop(warehouse_id)
            return {"status": "success", "message": "Warehouse stop initiated"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def wait_for_warehouse_ready(
        self, warehouse_id: str, timeout_seconds: int = 300
    ) -> dict[str, Any]:
        """Wait for a warehouse to be in RUNNING state."""
        start_time = time.time()

        while (time.time() - start_time) < timeout_seconds:
            status_info = await self.get_warehouse_status(warehouse_id)

            if "error" in status_info:
                return {
                    "status": "error",
                    "message": f"Failed to get status: {status_info['error']}",
                }

            state = status_info.get("state", "UNKNOWN")

            if state == "RUNNING":
                return {
                    "status": "success",
                    "message": "Warehouse is running",
                    "state": state,
                    "startup_time_seconds": round(time.time() - start_time, 2),
                }
            elif state in ["STOPPED", "STOPPING"]:
                start_result = await self.start_warehouse(warehouse_id)
                if start_result.get("status") == "error":
                    return start_result
            elif state in ["STARTING"]:
                pass
            elif state in ["DELETING", "DELETED"]:
                return {
                    "status": "error",
                    "message": f"Warehouse is being deleted or deleted (state: {state})",
                }

            await asyncio.sleep(30)

        final_status = await self.get_warehouse_status(warehouse_id)
        return {
            "status": "timeout",
            "message": f"Warehouse did not become ready within {timeout_seconds} seconds",
            "final_state": final_status.get("state", "UNKNOWN"),
        }

    async def ensure_warehouse_running(
        self, warehouse_id: str, timeout_seconds: int = 300
    ) -> dict[str, Any]:
        """Ensure a warehouse is running, starting it if necessary."""
        logger.info(f"Ensuring warehouse {warehouse_id} is running...")

        status_info = await self.get_warehouse_status(warehouse_id)
        if "error" in status_info:
            return {
                "status": "error",
                "message": f"Failed to check warehouse status: {status_info['error']}",
            }

        current_state = status_info.get("state", "UNKNOWN")
        logger.info(f"Warehouse {warehouse_id} current state: {current_state}")

        if current_state == "RUNNING":
            return {
                "status": "success",
                "message": "Warehouse is already running",
                "state": current_state,
                "startup_time_seconds": 0,
            }

        return await self.wait_for_warehouse_ready(warehouse_id, timeout_seconds)

    async def list_warehouses(self) -> dict[str, Any]:
        """List all SQL warehouses in the workspace using the SDK."""
        try:
            items = [
                {
                    "id": w.id,
                    "name": w.name,
                    "state": getattr(w, "state", None) or getattr(w, "health", None),
                    "size": getattr(w, "cluster_size", None),
                }
                for w in self.sdk_client.warehouses.list()
            ]
            return {"warehouses": items}
        except Exception as e:
            return {"error": str(e)}

    # =============================================================================
    # SQL EXECUTION METHODS
    # =============================================================================

    def _state_to_str(self, state_obj: Any) -> str:
        """Return a string for StatementState that works across SDK versions."""
        if state_obj is None:
            return "UNKNOWN"
        if hasattr(state_obj, "value"):
            try:
                return str(state_obj.value)
            except Exception:
                pass
        return str(state_obj)

    def _extract_result(self, result_obj: Any) -> tuple[list[str], list[list[Any]]]:
        """Extract column names and rows from a statement result object across SDK versions."""
        rows: list[list[Any]] = []
        col_names: list[str] = []
        res = getattr(result_obj, "result", None)
        if res is not None and getattr(res, "data_array", None) is not None:
            rows = res.data_array
        elif getattr(result_obj, "data_array", None) is not None:
            rows = getattr(result_obj, "data_array")

        manifest = getattr(result_obj, "manifest", None) or (
            getattr(res, "manifest", None) if res else None
        )
        schema_obj = getattr(manifest, "schema", None) if manifest else None
        columns = getattr(schema_obj, "columns", None) if schema_obj else None
        if columns:
            try:
                col_names = [col.name for col in columns]
            except Exception:
                # Fallback if columns are dict-like
                try:
                    names: list[str] = []
                    for c in columns:
                        if isinstance(c, dict):
                            name_val = c.get("name")
                            if name_val is not None:
                                names.append(str(name_val))
                    col_names = names
                except Exception:
                    col_names = []
        return col_names, rows

    async def execute_sql(
        self,
        statement: str,
        warehouse_id: str,
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
        wait: bool = True,
        poll_interval: float = 1.5,
        max_wait_seconds: int = 600,
    ) -> dict[str, Any]:
        """Submit a SQL statement and optionally wait for completion using SDK.
        Avoids passing enum parameters to prevent version mismatches; polls explicitly when wait=True.
        """
        try:
            # Normalize warehouse id: support '/sql/1.0/warehouses/<id>' or '<id>'
            wh_id = warehouse_id
            if "/warehouses/" in wh_id:
                try:
                    wh_id = wh_id.split("/warehouses/")[-1]
                except Exception:
                    pass

            exec_method: Optional[Callable[..., Any]] = getattr(
                self.sdk_client.statement_execution, "execute", None
            )
            if exec_method is None:
                exec_method = getattr(
                    self.sdk_client.statement_execution, "execute_statement"
                )

            # Submit without wait-related parameters to avoid enum issues
            submit_result = await self._run_sync_method(
                exec_method,
                statement=statement,
                warehouse_id=wh_id,
                catalog=catalog,
                schema=schema,
            )

            statement_id = getattr(submit_result, "statement_id", None)
            status_obj = getattr(submit_result, "status", None)
            state_val = (
                self._state_to_str(getattr(status_obj, "state", None))
                if status_obj
                else None
            )

            if not wait:
                return {
                    "status": state_val or "SUBMITTED",
                    "statement_id": statement_id,
                }

            # Poll for completion
            deadline = time.time() + max_wait_seconds
            get_stmt = self.sdk_client.statement_execution.get_statement

            current = submit_result
            while True:
                # Check current status first
                status_obj = getattr(current, "status", None)
                state_val = (
                    self._state_to_str(getattr(status_obj, "state", None))
                    if status_obj
                    else "UNKNOWN"
                )
                if state_val in ("SUCCEEDED", "FAILED", "CANCELED"):
                    break
                if time.time() >= deadline:
                    # Best-effort cancel
                    try:
                        await self._run_sync_method(
                            self.sdk_client.statement_execution.cancel_execution,
                            statement_id,
                        )
                    except Exception:
                        pass
                    return {
                        "status": "TIMEOUT",
                        "statement_id": statement_id,
                        "error": f"Timed out after {max_wait_seconds}s",
                    }
                await asyncio.sleep(poll_interval)
                current = await self._run_sync_method(get_stmt, statement_id)

            # Final state reached, extract results or error
            final_status = getattr(current, "status", None)
            final_state = (
                self._state_to_str(getattr(final_status, "state", None))
                if final_status
                else "UNKNOWN"
            )
            if final_state != "SUCCEEDED":
                error_obj = getattr(final_status, "error", None)
                error_msg = (
                    getattr(error_obj, "message", None)
                    if error_obj
                    else "Unknown error"
                )
                return {
                    "status": final_state,
                    "statement_id": statement_id,
                    "error": error_msg,
                }

            columns, rows = self._extract_result(current)
            return {
                "status": final_state,
                "statement_id": statement_id,
                "columns": columns,
                "rows": rows,
            }

        except Exception as e:
            logger.error(f"Error executing SQL statement: {e}")
            raise

    async def execute_sql_query(
        self, query: str, catalog: Optional[str] = None
    ) -> dict[str, Any]:
        """Backward-compatible helper: run SQL using default warehouse and return legacy shape.
        Requires default_warehouse_id to be set on this instance.
        """
        if not self._default_warehouse_id:
            raise ValueError(
                "Default warehouse_id not configured for DatabricksWarehouseAPI"
            )
        res = await self.execute_sql(
            statement=query,
            warehouse_id=self._default_warehouse_id,
            catalog=catalog,
            wait=True,
        )
        cols = res.get("columns") or []
        rows = res.get("rows") or []
        columns = [
            {"name": c}
            if isinstance(c, str)
            else (c if isinstance(c, dict) else {"name": str(c)})
            for c in cols
        ]
        return {"columns": columns, "data_array": rows}

    async def get_statement_status(self, statement_id: str) -> dict[str, Any]:
        """Get the status of a previously submitted SQL statement using SDK."""
        try:
            result = await self._run_sync_method(
                self.sdk_client.statement_execution.get_statement, statement_id
            )
            status_obj = getattr(result, "status", None)
            state_val = (
                self._state_to_str(getattr(status_obj, "state", None))
                if status_obj
                else "UNKNOWN"
            )
            error_obj = getattr(status_obj, "error", None)
            error_msg = getattr(error_obj, "message", None) if error_obj else None
            return {
                "statement_id": getattr(result, "statement_id", None),
                "status": state_val,
                "error": error_msg,
            }
        except Exception as e:
            return {"error": str(e)}

    async def cancel_statement(self, statement_id: str) -> dict[str, Any]:
        """Cancel a running SQL statement using SDK."""
        try:
            await self._run_sync_method(
                self.sdk_client.statement_execution.cancel_execution, statement_id
            )
            return {"status": "success", "message": "Statement cancellation requested"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def _parse_sql_statements(self, file_content: str) -> list[str]:
        """Parse a SQL file into a list of statements."""
        statements = [stmt.strip() for stmt in file_content.split(";") if stmt.strip()]
        return statements

    async def execute_ddl_file(
        self, file_content: str, warehouse_id: str, catalog: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """Execute all DDL statements in a file."""
        statements = self._parse_sql_statements(file_content)
        results = []

        for stmt in statements:
            result = await self.execute_sql(
                statement=stmt, warehouse_id=warehouse_id, catalog=catalog
            )
            results.append(result)

        return results

    async def get_result_chunk(
        self, statement_id: str, chunk_index: int
    ) -> dict[str, Any]:
        """Retrieve a result chunk for a given statement using the SDK."""
        try:
            get_chunk = getattr(
                self.sdk_client.statement_execution, "get_result_chunk", None
            )
            if get_chunk is None:
                get_chunk = getattr(
                    self.sdk_client.statement_execution,
                    "get_result_chunk_by_index",
                    None,
                )
            if get_chunk is None:
                raise AttributeError(
                    "StatementExecutionAPI does not support result chunk retrieval in this SDK version"
                )

            chunk = await self._run_sync_method(
                get_chunk,
                statement_id,
                chunk_index,
            )
            rows: list[list[Any]] = []
            res = getattr(chunk, "result", None)
            if res is not None and getattr(res, "data_array", None) is not None:
                rows = res.data_array
            elif getattr(chunk, "data_array", None) is not None:
                rows = getattr(chunk, "data_array")

            col_names: list[str] = []
            manifest = getattr(chunk, "manifest", None) or (
                getattr(res, "manifest", None) if res else None
            )
            schema_obj = getattr(manifest, "schema", None) if manifest else None
            columns = getattr(schema_obj, "columns", None) if schema_obj else None
            if columns:
                col_names = [col.name for col in columns]

            total_chunks = (
                getattr(manifest, "total_chunk_count", None) if manifest else None
            )
            next_index = (
                chunk_index + 1
                if (isinstance(total_chunks, int) and (chunk_index + 1) < total_chunks)
                else None
            )
            is_final = bool(
                isinstance(total_chunks, int) and (chunk_index + 1) >= total_chunks
            )

            return {
                "statement_id": statement_id,
                "chunk_index": chunk_index,
                "total_chunks": total_chunks,
                "columns": col_names if col_names else None,
                "rows": rows or [],
                "next_chunk_index": next_index,
                "is_final_chunk": is_final,
            }
        except Exception as e:
            return {"error": str(e)}
