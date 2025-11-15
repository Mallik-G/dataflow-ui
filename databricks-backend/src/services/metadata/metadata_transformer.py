"""Transform Databricks system table records to flat catalog metadata format."""

from typing import Dict, List


class MetadataTransformer:
    """Transform system table records to CatalogMetadata format."""

    def transform_catalogs(self, catalogs: List[Dict]) -> List[Dict]:
        """Transform catalog records to flat format."""
        return [
            {
                "entity_type": "catalog",
                "entity_path": cat["catalog_name"],
                "entity_name": cat["catalog_name"],
                "parent_path": None,
                "metadata_json": cat,
                "is_active": True,
            }
            for cat in catalogs
        ]

    def transform_schemas(self, schemas: List[Dict]) -> List[Dict]:
        """Transform schema records to flat format."""
        return [
            {
                "entity_type": "schema",
                "entity_path": f"{sch['catalog_name']}.{sch['schema_name']}",
                "entity_name": sch["schema_name"],
                "parent_path": sch["catalog_name"],
                "metadata_json": sch,
                "is_active": True,
            }
            for sch in schemas
        ]

    def transform_tables(self, tables: List[Dict]) -> List[Dict]:
        """Transform table records to flat format."""
        return [
            {
                "entity_type": "table",
                "entity_path": f"{tbl['table_catalog']}.{tbl['table_schema']}.{tbl['table_name']}",
                "entity_name": tbl["table_name"],
                "parent_path": f"{tbl['table_catalog']}.{tbl['table_schema']}",
                "metadata_json": tbl,
                "is_active": True,
            }
            for tbl in tables
        ]

    def transform_columns(self, columns: List[Dict]) -> List[Dict]:
        """Transform column records to flat format."""
        return [
            {
                "entity_type": "column",
                "entity_path": f"{col['table_catalog']}.{col['table_schema']}.{col['table_name']}.{col['column_name']}",
                "entity_name": col["column_name"],
                "parent_path": f"{col['table_catalog']}.{col['table_schema']}.{col['table_name']}",
                "metadata_json": col,
                "is_active": True,
            }
            for col in columns
        ]

    def transform_volumes(self, volumes: List[Dict]) -> List[Dict]:
        """Transform volume records to flat format."""
        return [
            {
                "entity_type": "volume",
                "entity_path": f"{vol['catalog_name']}.{vol['schema_name']}.{vol['volume_name']}",
                "entity_name": vol["volume_name"],
                "parent_path": f"{vol['catalog_name']}.{vol['schema_name']}",
                "metadata_json": vol,
                "is_active": True,
            }
            for vol in volumes
        ]

    def transform_functions(self, functions: List[Dict]) -> List[Dict]:
        """Transform function records to flat format."""
        return [
            {
                "entity_type": "function",
                "entity_path": f"{fn['routine_catalog']}.{fn['routine_schema']}.{fn['routine_name']}",
                "entity_name": fn["routine_name"],
                "parent_path": f"{fn['routine_catalog']}.{fn['routine_schema']}",
                "metadata_json": fn,
                "is_active": True,
            }
            for fn in functions
        ]
