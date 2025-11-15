"""Compatibility shim: legacy SQL Warehouse API wrapper for system tables clients.

Provides DatabricksSQLWarehouseAPI with execute_sql_query to match older code paths,
using the newer DatabricksWarehouseAPI under the hood.
"""

from __future__ import annotations

from typing import Any, Optional

from .databricks_warehouse_api import DatabricksWarehouseAPI


class DatabricksSQLWarehouseAPI(DatabricksWarehouseAPI):
    """Shim class to maintain backward compatibility with existing imports.

    Stores a default warehouse_id and exposes execute_sql_query(query) that returns
    a dict with 'columns' (list of {name: str}) and 'data_array' matching legacy callers.
    """

    def __init__(
        self,
        host: str,
        client_id: str,
        client_secret: str,
        warehouse_id: Optional[str] = None,
    ):
        super().__init__(host, client_id, client_secret)
        self._default_warehouse_id: Optional[str] = warehouse_id

    async def execute_sql_query(
        self, query: str, catalog: Optional[str] = None
    ) -> dict[str, Any]:
        if not self._default_warehouse_id:
            raise ValueError(
                "Default warehouse_id not configured for DatabricksSQLWarehouseAPI"
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
