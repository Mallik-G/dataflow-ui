"""Client for querying Databricks system information schema tables."""

import logging
from typing import Dict, List

from ..databricks.databricks_warehouse_api import DatabricksWarehouseAPI

logger = logging.getLogger(__name__)


# System tables to sync from Databricks
SYSTEM_TABLES = {
    "catalogs": "system.information_schema.catalogs",
    "schemas": "system.information_schema.schemata",
    "tables": "system.information_schema.tables",
    "columns": "system.information_schema.columns",
    "volumes": "system.information_schema.volumes",
    "functions": "system.information_schema.routines",
}


class SystemTablesClient:
    """
    Client for querying Databricks system information schema tables.

    Provides methods to fetch metadata about catalogs, schemas, tables, columns, etc.
    for use in workspace metadata context.
    """

    def __init__(self, sql_warehouse_api: DatabricksWarehouseAPI):
        """
        Initialize the system tables client.

        Args:
            sql_warehouse_api: Databricks SQL Warehouse API client
        """
        self.sql_api = sql_warehouse_api

    async def fetch_catalogs(self) -> List[Dict]:
        """
        Fetch all catalogs from system.information_schema.catalogs.

        Returns:
            List of catalog records as dicts
        """
        query = """
            SELECT
                catalog_name,
                catalog_owner,
                comment
            FROM system.information_schema.catalogs
            WHERE catalog_name NOT IN ('system', '__databricks_internal')
            ORDER BY catalog_name
        """

        logger.info("Fetching catalogs from system.information_schema.catalogs")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No catalog data returned")
            return []

        # Transform to list of dicts
        return self._transform_to_dict_list(result)

    async def fetch_schemas(self) -> List[Dict]:
        """
        Fetch all schemas from system.information_schema.schemata.

        Returns:
            List of schema records as dicts
        """
        query = """
            SELECT
                catalog_name,
                schema_name,
                schema_owner,
                comment
            FROM system.information_schema.schemata
            WHERE catalog_name NOT IN ('system', '__databricks_internal')
            ORDER BY catalog_name, schema_name
        """

        logger.info("Fetching schemas from system.information_schema.schemata")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No schema data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_tables(self) -> List[Dict]:
        """
        Fetch all tables from system.information_schema.tables.

        Returns:
            List of table records as dicts
        """
        query = """
            SELECT
                table_catalog,
                table_schema,
                table_name,
                table_type,
                table_owner,
                comment,
                data_source_format,
                location
            FROM system.information_schema.tables
            WHERE table_catalog NOT IN ('system', '__databricks_internal')
            ORDER BY table_catalog, table_schema, table_name
        """

        logger.info("Fetching tables from system.information_schema.tables")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No table data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_columns(self) -> List[Dict]:
        """
        Fetch all columns from system.information_schema.columns.

        Returns:
            List of column records as dicts
        """
        query = """
            SELECT
                table_catalog,
                table_schema,
                table_name,
                column_name,
                ordinal_position,
                is_nullable,
                data_type,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                column_default,
                comment AS column_comment
            FROM system.information_schema.columns
            WHERE table_catalog NOT IN ('system', '__databricks_internal')
            ORDER BY table_catalog, table_schema, table_name, ordinal_position
        """

        logger.info("Fetching columns from system.information_schema.columns")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No column data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_volumes(self) -> List[Dict]:
        """
        Fetch all volumes from system.information_schema.volumes.

        Returns:
            List of volume records as dicts
        """
        query = """
            SELECT
                catalog_name,
                schema_name,
                volume_name,
                volume_type,
                volume_owner,
                comment,
                storage_location
            FROM system.information_schema.volumes
            WHERE catalog_name NOT IN ('system', '__databricks_internal')
            ORDER BY catalog_name, schema_name, volume_name
        """

        logger.info("Fetching volumes from system.information_schema.volumes")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No volume data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_functions(self) -> List[Dict]:
        """
        Fetch all functions from system.information_schema.routines.

        Returns:
            List of function records as dicts
        """
        query = """
            SELECT
                routine_catalog,
                routine_schema,
                routine_name,
                routine_type,
                data_type,
                routine_body,
                routine_definition,
                comment
            FROM system.information_schema.routines
            WHERE routine_catalog NOT IN ('system', '__databricks_internal')
            ORDER BY routine_catalog, routine_schema, routine_name
        """

        logger.info("Fetching functions from system.information_schema.routines")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No function data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_catalog_tags(self) -> List[Dict]:
        """
        Fetch all catalog tags from INFORMATION_SCHEMA.

        Returns:
            List of catalog tag records as dicts
        """
        query = """
            SELECT
                catalog_name,
                tag_name,
                tag_value
            FROM system.information_schema.catalog_tags
            WHERE catalog_name NOT IN ('system', '__databricks_internal')
            ORDER BY catalog_name, tag_name
        """

        logger.info("Fetching catalog tags from system.information_schema.catalog_tags")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No catalog tag data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_schema_tags(self) -> List[Dict]:
        """
        Fetch all schema tags from INFORMATION_SCHEMA.

        Returns:
            List of schema tag records as dicts
        """
        query = """
            SELECT
                catalog_name,
                schema_name,
                tag_name,
                tag_value
            FROM system.information_schema.schema_tags
            WHERE catalog_name NOT IN ('system', '__databricks_internal')
            ORDER BY catalog_name, schema_name, tag_name
        """

        logger.info("Fetching schema tags from system.information_schema.schema_tags")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No schema tag data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_table_tags(self) -> List[Dict]:
        """
        Fetch all table tags from INFORMATION_SCHEMA.

        Returns:
            List of table tag records as dicts
        """
        query = """
            SELECT
                catalog_name,
                schema_name,
                table_name,
                tag_name,
                tag_value
            FROM system.information_schema.table_tags
            WHERE catalog_name NOT IN ('system', '__databricks_internal')
            ORDER BY catalog_name, schema_name, table_name, tag_name
        """

        logger.info("Fetching table tags from system.information_schema.table_tags")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No table tag data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_column_tags(self) -> List[Dict]:
        """
        Fetch all column tags from INFORMATION_SCHEMA.

        Returns:
            List of column tag records as dicts
        """
        query = """
            SELECT
                catalog_name,
                schema_name,
                table_name,
                column_name,
                tag_name,
                tag_value
            FROM system.information_schema.column_tags
            WHERE catalog_name NOT IN ('system', '__databricks_internal')
            ORDER BY catalog_name, schema_name, table_name, column_name, tag_name
        """

        logger.info("Fetching column tags from system.information_schema.column_tags")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No column tag data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_volume_tags(self) -> List[Dict]:
        """
        Fetch all volume tags from INFORMATION_SCHEMA.

        Returns:
            List of volume tag records as dicts
        """
        query = """
            SELECT
                catalog_name,
                schema_name,
                volume_name,
                tag_name,
                tag_value
            FROM system.information_schema.volume_tags
            WHERE catalog_name NOT IN ('system', '__databricks_internal')
            ORDER BY catalog_name, schema_name, volume_name, tag_name
        """

        logger.info("Fetching volume tags from system.information_schema.volume_tags")
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No volume tag data returned")
            return []

        return self._transform_to_dict_list(result)

    async def fetch_table_privileges(self) -> List[Dict]:
        """
        Fetch table access privileges from INFORMATION_SCHEMA.

        Returns:
            List of privilege records as dicts
        """
        query = """
            SELECT
                table_catalog,
                table_schema,
                table_name,
                grantee,
                privilege_type,
                is_grantable,
                inherited_from
            FROM system.information_schema.table_privileges
            WHERE table_catalog NOT IN ('system', '__databricks_internal')
            ORDER BY table_catalog, table_schema, table_name, grantee, privilege_type
        """

        logger.info(
            "Fetching table privileges from system.information_schema.table_privileges"
        )
        result = await self.sql_api.execute_sql_query(query)

        if not result or "data_array" not in result:
            logger.warning("No table privilege data returned")
            return []

        return self._transform_to_dict_list(result)

    def _transform_to_dict_list(self, result: Dict) -> List[Dict]:
        """
        Transform SQL result with columns and data_array to list of dicts.

        Args:
            result: Result dict from SQL Warehouse API with 'columns' and 'data_array'

        Returns:
            List of dicts where each dict represents a row
        """
        columns = [col["name"] for col in result.get("columns", [])]
        data_array = result.get("data_array", [])

        return [dict(zip(columns, row)) for row in data_array]
