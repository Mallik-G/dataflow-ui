"""Databricks Unity Catalog API endpoints for the Nexa Databricks API.

This module provides RESTful API endpoints to interact with Databricks Unity Catalog.
It allows users to browse catalogs, schemas, tables, and execute SQL queries.
"""

import logging
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.database import get_db, get_db_session
from ...models.api.catalog import (
    CatalogListResponse,
    CatalogResponse,
    ColumnResponse,
    HealthCheckResponse,
    SchemaListResponse,
    SchemaResponse,
    SqlExecuteRequest,
    SqlExecuteResponse,
    TableDetailResponse,
    TableListResponse,
    TableResponse,
)
from ...models.db.deployments import Environment
from ...models.db.metadata import CatalogMetadata
from ...services.databricks.databricks_uc_api import DatabricksUCAPI
from ...services.databricks.databricks_warehouse_api import DatabricksWarehouseAPI

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/catalogs", tags=["Data Catalog & Metadata"])


def _convert_timestamp(timestamp_ms: Optional[int]) -> Optional[str]:
    """Convert Unix timestamp in milliseconds to ISO format string."""
    if timestamp_ms is None:
        return None
    try:
        timestamp_sec = timestamp_ms / 1000
        dt = datetime.fromtimestamp(timestamp_sec)
        return dt.isoformat()
    except Exception:
        return None


# =============================================================================
# DEPENDENCIES
# =============================================================================


def get_uc_api(db: Annotated[Session, Depends(get_db)]) -> DatabricksUCAPI:
    """Dependency to get a configured Databricks UC API client."""
    from ...core.config import settings

    # Try to get environment from database, fall back to settings
    host = None
    try:
        environment = db.query(Environment).first()
        if environment:
            host = environment.databricks_host
    except Exception as e:
        logger.warning(f"Could not query Environment from database: {e}")

    # Fall back to settings if not in database
    if not host:
        host = settings.databricks_host

    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Databricks host not configured in database or settings",
        )

    # Ensure host has https:// scheme
    if not host.startswith("http://") and not host.startswith("https://"):
        host = f"https://{host}"

    if not settings.databricks_client_id or not settings.databricks_client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Databricks client credentials not configured",
        )

    return DatabricksUCAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


def get_warehouse_api(
    db: Annotated[Session, Depends(get_db)],
) -> DatabricksWarehouseAPI:
    """Dependency to get a configured Databricks Warehouse API client."""
    from ...core.config import settings

    # Try to get environment from database, fall back to settings
    host = None
    try:
        environment = db.query(Environment).first()
        if environment:
            host = environment.databricks_host
    except Exception as e:
        logger.warning(f"Could not query Environment from database: {e}")

    # Fall back to settings if not in database
    if not host:
        host = settings.databricks_host

    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Databricks host not configured in database or settings",
        )

    # Ensure host has https:// scheme
    if not host.startswith("http://") and not host.startswith("https://"):
        host = f"https://{host}"

    if not settings.databricks_client_id or not settings.databricks_client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Databricks client credentials not configured",
        )

    return DatabricksWarehouseAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


# =============================================================================
# CATALOG ENDPOINTS
# =============================================================================


@router.get(
    "",
    response_model=CatalogListResponse,
    summary="List Databricks catalogs",
)
async def list_catalogs(
    uc_api: Annotated[DatabricksUCAPI, Depends(get_uc_api)],
    max_results: Optional[int] = Query(None, le=1000),
    page_token: Optional[str] = Query(None),
) -> CatalogListResponse:
    """Lists all accessible catalogs in the Databricks workspace."""
    try:
        catalogs = await uc_api.list_catalogs(
            max_results=max_results, page_token=page_token
        )

        catalog_responses = [
            CatalogResponse(
                name=getattr(catalog, "name", None) or "unknown",
                comment=getattr(catalog, "comment", None),
                owner=getattr(catalog, "owner", None),
                created_at=_convert_timestamp(getattr(catalog, "created_at", None)),
                updated_at=_convert_timestamp(getattr(catalog, "updated_at", None)),
                health_status="healthy",
                access_level="full",
            )
            for catalog in catalogs
        ]

        return CatalogListResponse(
            catalogs=catalog_responses, count=len(catalog_responses)
        )

    except Exception as e:
        logger.error(f"Failed to list catalogs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list catalogs: {e!s}",
        )


@router.get(
    "/{catalog_name}/schemas",
    response_model=SchemaListResponse,
    summary="List schemas in catalog",
)
async def list_schemas(
    catalog_name: str,
    uc_api: Annotated[DatabricksUCAPI, Depends(get_uc_api)],
    max_results: Optional[int] = Query(None, le=1000),
    page_token: Optional[str] = Query(None),
):
    """Lists all schemas in the specified Databricks catalog."""
    try:
        schemas_data = await uc_api.list_schemas(
            catalog_name=catalog_name,
            max_results=max_results,
            page_token=page_token,
        )

        schema_responses = [
            SchemaResponse(
                name=getattr(schema, "name", None) or "unknown",
                catalog_name=getattr(schema, "catalog_name", None) or catalog_name,
                comment=getattr(schema, "comment", None),
                owner=getattr(schema, "owner", None),
                created_at=_convert_timestamp(getattr(schema, "created_at", None)),
                updated_at=_convert_timestamp(getattr(schema, "updated_at", None)),
            )
            for schema in schemas_data
        ]

        return SchemaListResponse(
            schemas=schema_responses,
            catalog_name=catalog_name,
            count=len(schema_responses),
        )

    except Exception as e:
        logger.error(f"Failed to list schemas in catalog {catalog_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list schemas: {e!s}",
        )


@router.get(
    "/{catalog_name}/schemas/{schema_name}/tables",
    response_model=TableListResponse,
    summary="List tables in schema",
)
async def list_tables(
    catalog_name: str,
    schema_name: str,
    uc_api: Annotated[DatabricksUCAPI, Depends(get_uc_api)],
    max_results: Optional[int] = Query(None, le=1000),
    page_token: Optional[str] = Query(None),
):
    """Lists all tables in the specified Databricks catalog and schema."""
    try:
        tables_data = await uc_api.list_tables(
            catalog_name=catalog_name,
            schema_name=schema_name,
            max_results=max_results,
            page_token=page_token,
        )

        table_responses = [
            TableResponse(
                name=getattr(table, "name", None) or "unknown",
                catalog_name=getattr(table, "catalog_name", None) or catalog_name,
                schema_name=getattr(table, "schema_name", None) or schema_name,
                table_type=getattr(table, "table_type", "UNKNOWN"),
                data_source_format=getattr(table, "data_source_format", None),
                comment=getattr(table, "comment", None),
                owner=getattr(table, "owner", None),
                created_at=_convert_timestamp(getattr(table, "created_at", None)),
                updated_at=_convert_timestamp(getattr(table, "updated_at", None)),
            )
            for table in tables_data
        ]

        return TableListResponse(
            tables=table_responses,
            catalog_name=catalog_name,
            schema_name=schema_name,
            count=len(table_responses),
        )

    except Exception as e:
        logger.error(f"Failed to list tables in {catalog_name}.{schema_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list tables: {e!s}",
        )


@router.get(
    "/{catalog_name}/schemas/{schema_name}/tables/{table_name}",
    response_model=TableDetailResponse,
    summary="Get table details",
)
async def get_table_details(
    catalog_name: str,
    schema_name: str,
    table_name: str,
    uc_api: Annotated[DatabricksUCAPI, Depends(get_uc_api)],
):
    """Gets detailed information about a specific Databricks table including columns.

    For comprehensive lineage analysis, use:
    - GET /api/v1/lineage/table/{catalog}/{schema}/{table} - Full lineage data
    - GET /api/v1/lineage/graph/{catalog}/{schema}/{table} - Lineage graph for visualization
    """
    try:
        full_table_name = f"{catalog_name}.{schema_name}.{table_name}"
        table_details = await uc_api.get_table(full_table_name)

        if not table_details:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Table not found: {catalog_name}.{schema_name}.{table_name}",
            )

        column_responses = [
            ColumnResponse.model_validate(col.as_dict())
            for col in getattr(table_details, "columns", [])
        ]

        # Add reference to lineage endpoints
        properties = (getattr(table_details, "properties", None) or {}).copy()
        properties["_links"] = {
            "lineage": f"/api/v1/lineage/table/{catalog_name}/{schema_name}/{table_name}",
            "lineage_graph": f"/api/v1/lineage/graph/{catalog_name}/{schema_name}/{table_name}",
            "column_lineage": f"/api/v1/lineage/column/{catalog_name}/{schema_name}/{table_name}/{{column_name}}",
        }

        return TableDetailResponse(
            name=getattr(table_details, "name", None) or table_name,
            catalog_name=getattr(table_details, "catalog_name", None) or catalog_name,
            schema_name=getattr(table_details, "schema_name", None) or schema_name,
            table_type=getattr(table_details, "table_type", None) or "UNKNOWN",
            data_source_format=getattr(table_details, "data_source_format", None),
            comment=getattr(table_details, "comment", None),
            owner=getattr(table_details, "owner", None),
            created_at=_convert_timestamp(getattr(table_details, "created_at", None)),
            updated_at=_convert_timestamp(getattr(table_details, "updated_at", None)),
            columns=column_responses,
            properties=properties,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get table details for {catalog_name}.{schema_name}.{table_name}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get table details: {e!s}",
        )


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================


@router.post(
    "/execute-sql",
    response_model=SqlExecuteResponse,
    summary="Execute SQL statement",
)
async def execute_sql(
    request: SqlExecuteRequest,
    warehouse_api: Annotated[DatabricksWarehouseAPI, Depends(get_warehouse_api)],
    db: Annotated[Session, Depends(get_db)],
):
    """Executes a SQL statement in a Databricks SQL warehouse using environment configuration."""
    try:
        environment = db.query(Environment).first()
        if not environment or not environment.configuration:
            raise ValueError("Environment configuration not found.")

        # Get warehouse_id from environment configuration
        warehouse_id = environment.configuration.get("warehouse_id")
        if not warehouse_id:
            raise ValueError("SQL warehouse ID must be configured in the environment.")

        # Get catalog from environment configuration (optional)
        catalog = environment.configuration.get("catalog")

        # Build kwargs for execute_sql, only include catalog if it's not None/empty
        execute_kwargs = {
            "statement": request.sql,
            "warehouse_id": warehouse_id,
            "wait": True,
        }
        if catalog:
            execute_kwargs["catalog"] = catalog

        result = await warehouse_api.execute_sql(**execute_kwargs)

        return SqlExecuteResponse(sql=request.sql, result=result, status="success")

    except Exception as e:
        logger.error(f"Failed to execute SQL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute SQL: {e!s}",
        )


# =============================================================================
# BULK METADATA ENDPOINTS (Cached from PostgreSQL)
# =============================================================================


@router.get(
    "/metadata",
    summary="Get complete catalog metadata (cached)",
)
async def get_bulk_catalog_metadata(
    catalog: Optional[str] = Query(None, description="Filter by catalog name"),
    schema: Optional[str] = Query(None, description="Filter by schema name"),
    entity_types: Optional[str] = Query(
        None, description="Comma-separated entity types to include"
    ),
    format: str = Query(
        "hierarchical",
        regex="^(hierarchical|flat)$",
        description="Output format: 'hierarchical' or 'flat'",
    ),
    include_inactive: bool = Query(False, description="Include deleted entities"),
    db: Session = Depends(get_db_session),
):
    """
    Get complete Unity Catalog metadata from cached PostgreSQL database.

    **Fast bulk retrieval** - Perfect for:
    - LLM context (complete schema information)
    - Business glossary pages
    - Data catalog exploration
    - Tag and access control queries

    **Includes enriched data:**
    - Tags (catalog, schema, table, column, volume tags)
    - Access privileges (who can read/write/manage tables)
    - Comments/descriptions
    - Ownership information
    - Created/updated timestamps

    **Performance:**
    - Data refreshed every hour via background sync
    - Queries local PostgreSQL (very fast)
    - May be up to 1 hour stale

    **Formats:**
    - `hierarchical`: Nested structure (catalogs > schemas > tables > columns)
    - `flat`: List of all entities with metadata
    """
    try:
        # Build query
        query = db.query(CatalogMetadata)

        if not include_inactive:
            query = query.filter(CatalogMetadata.is_active)

        # Filter by catalog (use JSONB query)
        if catalog:
            query = query.filter(
                CatalogMetadata.metadata_json["catalog_name"].astext == catalog
            )

        # Filter by schema (use JSONB query)
        if schema:
            query = query.filter(
                CatalogMetadata.metadata_json["schema_name"].astext == schema
            )

        if entity_types:
            types = [t.strip() for t in entity_types.split(",")]
            query = query.filter(CatalogMetadata.entity_type.in_(types))

        query = query.order_by(CatalogMetadata.entity_path)

        records = query.all()

        if format == "flat":
            return {
                "synced_at": records[0].synced_at.isoformat() if records else None,
                "total_entities": len(records),
                "entities": [
                    {
                        "entity_type": r.entity_type,
                        "entity_path": r.entity_path,
                        "entity_name": r.entity_name,
                        "parent_path": r.parent_path,
                        "metadata": r.metadata_json,
                    }
                    for r in records
                ],
            }
        else:
            # Hierarchical format
            return _build_hierarchical_metadata(records)

    except Exception as e:
        logger.error(f"Error fetching catalog metadata: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/status",
    summary="Get metadata sync status",
)
async def get_metadata_sync_status():
    """
    Get metadata background sync status.

    Returns information about the last sync including:
    - When it ran
    - How many entities were synced
    - How long it took
    - Whether sync is currently running
    """
    from ...services.background.metadata_background_sync import metadata_sync_service

    if not metadata_sync_service:
        return {"error": "Metadata sync service not initialized"}

    return {
        "is_running": metadata_sync_service.is_running,
        "last_sync_time": (
            metadata_sync_service.last_sync_time.isoformat()
            if metadata_sync_service.last_sync_time
            else None
        ),
        "last_sync_summary": metadata_sync_service.last_sync_summary,
        "last_sync_duration_seconds": metadata_sync_service.last_sync_duration,
        "sync_interval_seconds": metadata_sync_service.sync_interval,
    }


@router.post(
    "/sync",
    summary="Trigger metadata sync",
)
async def trigger_metadata_sync():
    """
    Manually trigger metadata sync.

    Useful for:
    - Testing the sync process
    - Immediate refresh after schema changes
    - On-demand updates before important operations

    **Note:** Sync runs in background automatically every hour.
    Manual trigger is useful for immediate updates.
    """
    from ...services.background.metadata_background_sync import metadata_sync_service

    if not metadata_sync_service:
        raise HTTPException(
            status_code=503, detail="Metadata sync service not initialized"
        )

    try:
        # Trigger sync by calling _perform_sync directly
        await metadata_sync_service._perform_sync()

        return {
            "status": "success",
            "message": "Metadata sync completed",
            "summary": metadata_sync_service.last_sync_summary,
            "duration_seconds": metadata_sync_service.last_sync_duration,
        }
    except Exception as e:
        logger.error(f"Error triggering metadata sync: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _build_hierarchical_metadata(records) -> dict:
    """
    Build hierarchical metadata context from flat records.

    Structure: catalogs > schemas > tables > columns
               catalogs > schemas > volumes
               catalogs > schemas > functions
    """
    catalogs_dict = {}

    for record in records:
        if record.entity_type == "catalog":
            if record.entity_name not in catalogs_dict:
                catalogs_dict[record.entity_name] = {
                    "name": record.entity_name,
                    "metadata": record.metadata,
                    "schemas": {},
                }

        elif record.entity_type == "schema":
            cat_name = record.metadata.get("catalog_name")
            if cat_name not in catalogs_dict:
                catalogs_dict[cat_name] = {"name": cat_name, "schemas": {}}

            catalogs_dict[cat_name]["schemas"][record.entity_name] = {
                "name": record.entity_name,
                "metadata": record.metadata,
                "tables": [],
                "volumes": [],
                "functions": [],
            }

        elif record.entity_type == "table":
            cat_name = record.metadata.get("table_catalog")
            sch_name = record.metadata.get("table_schema")

            if (
                cat_name in catalogs_dict
                and sch_name in catalogs_dict[cat_name]["schemas"]
            ):
                table_data = {
                    "name": record.entity_name,
                    "metadata": record.metadata,
                    "columns": [],
                }
                catalogs_dict[cat_name]["schemas"][sch_name]["tables"].append(
                    table_data
                )

        elif record.entity_type == "column":
            cat_name = record.metadata.get("table_catalog")
            sch_name = record.metadata.get("table_schema")
            tbl_name = record.metadata.get("table_name")

            if (
                cat_name in catalogs_dict
                and sch_name in catalogs_dict[cat_name]["schemas"]
            ):
                for table in catalogs_dict[cat_name]["schemas"][sch_name]["tables"]:
                    if table["name"] == tbl_name:
                        table["columns"].append(
                            {"name": record.entity_name, "metadata": record.metadata}
                        )

        elif record.entity_type == "volume":
            cat_name = record.metadata.get("catalog_name")
            sch_name = record.metadata.get("schema_name")

            if (
                cat_name in catalogs_dict
                and sch_name in catalogs_dict[cat_name]["schemas"]
            ):
                catalogs_dict[cat_name]["schemas"][sch_name]["volumes"].append(
                    {"name": record.entity_name, "metadata": record.metadata}
                )

        elif record.entity_type == "function":
            cat_name = record.metadata.get("routine_catalog")
            sch_name = record.metadata.get("routine_schema")

            if (
                cat_name in catalogs_dict
                and sch_name in catalogs_dict[cat_name]["schemas"]
            ):
                catalogs_dict[cat_name]["schemas"][sch_name]["functions"].append(
                    {"name": record.entity_name, "metadata": record.metadata}
                )

    # Convert to list format
    catalogs_list = []
    for cat_name, cat_data in catalogs_dict.items():
        schemas_list = []
        for sch_name, sch_data in cat_data.get("schemas", {}).items():
            schemas_list.append(sch_data)
        cat_data["schemas"] = schemas_list
        catalogs_list.append(cat_data)

    return {
        "synced_at": records[0].synced_at.isoformat() if records else None,
        "total_entities": len(records),
        "catalogs": catalogs_list,
    }


# =============================================================================
# HEALTH CHECK
# =============================================================================


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health check",
)
async def catalog_health_check(
    uc_api: Annotated[DatabricksUCAPI, Depends(get_uc_api)],
) -> HealthCheckResponse:
    """Checks Databricks Unity Catalog connectivity."""
    try:
        catalogs = await uc_api.list_catalogs(max_results=1)
        catalog_list = list(catalogs)
        catalog_count = len(catalog_list)

        return HealthCheckResponse(
            status="healthy",
            databricks_connection="ok",
            catalogs_accessible=catalog_count,
            message="Unity Catalog connectivity verified",
        )

    except Exception as e:
        logger.error(f"Databricks catalog health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=HealthCheckResponse(
                status="unhealthy",
                databricks_connection="failed",
                error=str(e),
                message="Unity Catalog connectivity failed",
            ).model_dump(),
        )
