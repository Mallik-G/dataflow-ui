"""FastAPI router for Databricks Unity Catalog Tags (Governed Tags) management."""

import logging
from typing import Annotated, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.config import settings
from ...models.db.deployments import Environment
from ...services.databricks.databricks_uc_api import DatabricksUCAPI
from ...services.databricks.base_client import DatabricksAPIError

router = APIRouter(prefix="/tags", tags=["Unity Catalog Tags & Governance"])
logger = logging.getLogger(__name__)


def get_databricks_uc_client(
    db: Annotated[Session, Depends(get_db)],
) -> DatabricksUCAPI:
    """Dependency to get a configured Databricks Unity Catalog API client."""
    environment = db.query(Environment).first()
    if not environment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Environment configuration not found. Please configure the application environment.",
        )

    host = environment.databricks_host
    if not host:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )

    return DatabricksUCAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


def handle_databricks_error(e: Exception, operation: str):
    """Map Databricks SDK errors to HTTP exceptions."""
    msg = str(e)
    if isinstance(e, DatabricksAPIError):
        status_code = e.status_code or http_status.HTTP_500_INTERNAL_SERVER_ERROR
        raise HTTPException(
            status_code=status_code, detail={"message": f"{operation}: {msg}"}
        ) from e
    raise HTTPException(
        status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"error_code": "INTERNAL_ERROR", "message": f"{operation}: {msg}"},
    ) from e


@router.get(
    "/governed",
    summary="Get governed tags from Unity Catalog",
    description="Retrieves both system-governed and user-governed tags and their metadata from Unity Catalog. "
    "System tags are managed by Databricks, while user tags are created and managed by users. "
    "Both types are used for data governance, compliance, and classification.",
)
async def get_governed_tags(
    uc_client: Annotated[DatabricksUCAPI, Depends(get_databricks_uc_client)],
    catalog: Optional[str] = Query(
        None, description="Filter tags by catalog (includes both system and user catalogs)"
    ),
    tag_type: Optional[str] = Query(
        "all",
        description="Filter by tag type: 'system' for system-managed tags, 'user' for user-created tags, 'all' for both"
    ),
):
    """
    Get governed tags from Unity Catalog.

    Supports two types of tags:
    1. System-governed tags: Managed by Databricks, typically in system catalog
    2. User-governed tags: Custom tags created by users in Unity Catalog

    Tags can be applied at multiple levels:
    - Catalog level
    - Schema level
    - Table/View level
    - Column level
    """
    try:
        # List catalogs to get tag information
        catalogs_iter = await uc_client.list_catalogs()
        catalogs = [c.as_dict() if hasattr(c, 'as_dict') else c for c in catalogs_iter]

        tags_info = []

        # Get tags from catalogs
        for cat in catalogs:
            cat_name = cat.get("name", "") if isinstance(cat, dict) else getattr(cat, "name", "")

            # Determine if this is a system or user catalog
            is_system_catalog = cat_name == "system" or (isinstance(cat, dict) and cat.get("catalog_type") == "SYSTEM_CATALOG")

            # Skip based on tag_type filter
            if tag_type == "system" and not is_system_catalog:
                continue
            if tag_type == "user" and is_system_catalog:
                continue

            # Skip if filtering by specific catalog and this isn't it
            if catalog and cat_name != catalog:
                continue

            # Get catalog details which may include tags
            try:
                catalog_details = await uc_client.get_catalog(cat_name)
                catalog_dict = catalog_details.as_dict() if hasattr(catalog_details, 'as_dict') else catalog_details

                if isinstance(catalog_dict, dict):
                    # Check for tags in properties or direct tags field
                    catalog_tags = catalog_dict.get("properties", {})
                    direct_tags = catalog_dict.get("tags", {})

                    if catalog_tags or direct_tags:
                        tags_info.append({
                            "securable_type": "CATALOG",
                            "securable_name": cat_name,
                            "tags": {**catalog_tags, **direct_tags},
                            "tag_source": "system" if is_system_catalog else "user",
                            "catalog_type": catalog_dict.get("catalog_type"),
                            "owner": catalog_dict.get("owner"),
                            "comment": catalog_dict.get("comment"),
                        })

                    # List schemas in this catalog to get their tags
                    try:
                        schemas_iter = await uc_client.list_schemas(cat_name)
                        schemas = [s.as_dict() if hasattr(s, 'as_dict') else s for s in schemas_iter]

                        for schema in schemas:
                            schema_name = schema.get("name", "") if isinstance(schema, dict) else getattr(schema, "name", "")
                            schema_tags = schema.get("properties", {}) if isinstance(schema, dict) else {}

                            if schema_tags:
                                tags_info.append({
                                    "securable_type": "SCHEMA",
                                    "securable_name": f"{cat_name}.{schema_name}",
                                    "tags": schema_tags,
                                    "tag_source": "system" if is_system_catalog else "user",
                                    "owner": schema.get("owner") if isinstance(schema, dict) else None,
                                    "comment": schema.get("comment") if isinstance(schema, dict) else None,
                                })
                    except Exception as e:
                        logger.warning(f"Could not list schemas for catalog {cat_name}: {e}")

            except Exception as e:
                logger.warning(f"Could not get details for catalog {cat_name}: {e}")
                continue

        # Separate system and user tags
        system_tags = [t for t in tags_info if t.get("tag_source") == "system"]
        user_tags = [t for t in tags_info if t.get("tag_source") == "user"]

        return {
            "tags": tags_info,
            "total_count": len(tags_info),
            "system_tags_count": len(system_tags),
            "user_tags_count": len(user_tags),
            "note": "Governed tags are metadata properties applied to securables for governance. "
                    "System tags are managed by Databricks, user tags are custom-created by users."
        }

    except Exception as e:
        logger.error(f"Failed to get governed tags: {e!s}")
        handle_databricks_error(e, "get governed tags")


@router.get(
    "/catalog/{catalog_name}/tags",
    summary="Get tags for a specific catalog",
    description="Retrieves all tags associated with a specific catalog in Unity Catalog.",
)
async def get_catalog_tags(
    catalog_name: str,
    uc_client: Annotated[DatabricksUCAPI, Depends(get_databricks_uc_client)],
):
    """Get all tags for a specific catalog."""
    try:
        catalog_details = await uc_client.get_catalog(catalog_name)
        catalog_dict = catalog_details.as_dict() if hasattr(catalog_details, 'as_dict') else catalog_details

        if isinstance(catalog_dict, dict):
            tags = catalog_dict.get("properties", {})
            direct_tags = catalog_dict.get("tags", {})

            return {
                "catalog_name": catalog_name,
                "tags": {**tags, **direct_tags},
                "owner": catalog_dict.get("owner"),
                "comment": catalog_dict.get("comment"),
                "created_at": catalog_dict.get("created_at"),
                "created_by": catalog_dict.get("created_by"),
            }
        else:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Catalog {catalog_name} not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get tags for catalog {catalog_name}: {e!s}")
        handle_databricks_error(e, f"get tags for catalog {catalog_name}")


@router.get(
    "/schema/{full_schema_name}/tags",
    summary="Get tags for a specific schema",
    description="Retrieves all tags associated with a specific schema in Unity Catalog. "
    "Schema name should be in the format: catalog.schema",
)
async def get_schema_tags(
    full_schema_name: str,
    uc_client: Annotated[DatabricksUCAPI, Depends(get_databricks_uc_client)],
):
    """Get all tags for a specific schema."""
    try:
        schema_details = await uc_client.get_schema(full_schema_name)
        schema_dict = schema_details.as_dict() if hasattr(schema_details, 'as_dict') else schema_details

        if isinstance(schema_dict, dict):
            tags = schema_dict.get("properties", {})

            return {
                "schema_name": full_schema_name,
                "tags": tags,
                "owner": schema_dict.get("owner"),
                "comment": schema_dict.get("comment"),
                "created_at": schema_dict.get("created_at"),
                "created_by": schema_dict.get("created_by"),
            }
        else:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Schema {full_schema_name} not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get tags for schema {full_schema_name}: {e!s}")
        handle_databricks_error(e, f"get tags for schema {full_schema_name}")


@router.get(
    "/table/{full_table_name}/tags",
    summary="Get tags for a specific table",
    description="Retrieves all tags associated with a specific table in Unity Catalog. "
    "Table name should be in the format: catalog.schema.table",
)
async def get_table_tags(
    full_table_name: str,
    uc_client: Annotated[DatabricksUCAPI, Depends(get_databricks_uc_client)],
):
    """Get all tags for a specific table."""
    try:
        table_details = await uc_client.get_table(full_table_name)
        table_dict = table_details.as_dict() if hasattr(table_details, 'as_dict') else table_details

        if isinstance(table_dict, dict):
            tags = table_dict.get("properties", {})

            return {
                "table_name": full_table_name,
                "tags": tags,
                "owner": table_dict.get("owner"),
                "comment": table_dict.get("comment"),
                "created_at": table_dict.get("created_at"),
                "created_by": table_dict.get("created_by"),
                "table_type": table_dict.get("table_type"),
            }
        else:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Table {full_table_name} not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get tags for table {full_table_name}: {e!s}")
        handle_databricks_error(e, f"get tags for table {full_table_name}")
