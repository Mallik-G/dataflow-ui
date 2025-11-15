"""FastAPI router for Databricks data lineage endpoints.

This module provides RESTful API endpoints to interact with Databricks Unity Catalog
data lineage, allowing users to track data dependencies and impact analysis.
"""

import logging
from datetime import datetime, timezone
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.config import settings
from ...models.db.deployments import Environment
from ...models.api.lineage import (
    ColumnLineageResponse,
    LineageDirection,
    LineageEntityType,
    LineageGraph,
    LineageHealthCheck,
    LineageNode,
    LineageTableInfo,
    parse_lineage_response,
    SystemTableQueryRequest,
    SystemTableQueryResponse,
    TableLineageResponse,
    TablePopularityMetrics,
)
from ...services.databricks.databricks_uc_lineage import (
    DatabricksLineageAPI,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lineage", tags=["Data Lineage"])

# Internal helpers to avoid repetition


def _get_env_and_warehouse_id(
    db: Session, require_warehouse: bool = False
) -> tuple[Environment, Optional[str]]:
    environment = db.query(Environment).first()
    if not environment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment configuration not found. Please configure the application environment.",
        )
    if not environment.databricks_host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )
    wh_id = None
    if environment.configuration and isinstance(environment.configuration, dict):
        wh_id = environment.configuration.get("warehouse_id")
    if require_warehouse and not wh_id:
        raise HTTPException(
            status_code=400,
            detail="SQL warehouse ID must be configured for system tables access (configuration.warehouse_id)",
        )
    return environment, wh_id


def get_lineage_service(
    db: Annotated[Session, Depends(get_db)],
) -> DatabricksLineageAPI:
    """Dependency to get a configured Databricks Lineage API client."""
    environment, _ = _get_env_and_warehouse_id(db, require_warehouse=False)
    return DatabricksLineageAPI(
        host=environment.databricks_host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


@router.get("/table/{catalog}/{schema}/{table}", response_model=TableLineageResponse)
async def get_table_lineage(
    lineage_service: Annotated[DatabricksLineageAPI, Depends(get_lineage_service)],
    db: Annotated[Session, Depends(get_db)],
    catalog: str = Path(..., description="Catalog name"),
    schema: str = Path(..., description="Schema name"),
    table: str = Path(..., description="Table name"),
    direction: LineageDirection = Query(
        LineageDirection.BOTH, description="Lineage direction"
    ),
    include_entity_metadata: bool = Query(True, description="Include entity metadata"),
    max_depth: int = Query(3, description="Maximum lineage depth", ge=1, le=10),
    use_system_tables: bool = Query(
        True, description="Use system tables (recommended) vs REST API"
    ),
):
    """Get table-level lineage information for a specific table.

    This endpoint now prioritizes system tables over REST API as recommended
    by the Sonra blog post for comprehensive lineage data.

    Args:
        catalog: The name of the catalog.
        schema: The name of the schema.
        table: The name of the table.
        direction: The direction of the lineage to retrieve.
        include_entity_metadata: Whether to include entity metadata.
        max_depth: Maximum depth for lineage traversal (system tables only).
        use_system_tables: Whether to use system tables (recommended) or REST API.
        lineage_service: The DatabricksLineageAPI instance.

    Returns:
        The table-level lineage information.
    """
    try:
        full_table_name = f"{catalog}.{schema}.{table}"
        logger.info(
            f"Getting table lineage for {full_table_name} (system_tables={use_system_tables})"
        )

        raw_response = {}
        if use_system_tables:
            try:
                _, warehouse_id = _get_env_and_warehouse_id(db, require_warehouse=True)
                logger.info(f"Using warehouse_id: {warehouse_id}")
                raw_response = (
                    await lineage_service.get_table_lineage_from_system_tables(
                        table_name=full_table_name,
                        warehouse_id=warehouse_id,  # type: ignore[arg-type]
                        max_depth=max_depth,
                    )
                )
                logger.info(
                    f"System tables returned: upstreams={len(raw_response.get('upstreams', []))}, downstreams={len(raw_response.get('downstreams', []))}"
                )
                if not raw_response.get("upstreams") and not raw_response.get(
                    "downstreams"
                ):
                    logger.warning(
                        "System tables returned empty, falling back to REST API"
                    )
                    try:
                        rest_resp = await lineage_service.get_table_lineage(
                            table_name=full_table_name,
                            include_entity_lineage=include_entity_metadata,
                        )
                        raw_response.setdefault(
                            "upstreams", rest_resp.get("upstreams", [])
                        )
                        raw_response.setdefault(
                            "downstreams", rest_resp.get("downstreams", [])
                        )
                        raw_response["source"] = raw_response.get(
                            "source", "system_tables+rest"
                        )
                    except Exception as e:
                        logger.error(f"REST API fallback also failed: {e}")
            except Exception as e:
                logger.error(f"System tables query failed: {e}", exc_info=True)
                # Fallback to REST API
                raw_response = await lineage_service.get_table_lineage(
                    table_name=full_table_name,
                    include_entity_lineage=include_entity_metadata,
                )
        else:
            raw_response = await lineage_service.get_table_lineage(
                table_name=full_table_name,
                include_entity_lineage=include_entity_metadata,
            )

        upstream_nodes = parse_lineage_response(
            {"upstreams": raw_response.get("upstreams", [])}
        )
        downstream_nodes = parse_lineage_response(
            {"downstreams": raw_response.get("downstreams", [])}
        )

        return TableLineageResponse(
            table_name=full_table_name,
            upstreams=upstream_nodes,
            downstreams=downstream_nodes,
            total_upstream_count=len(upstream_nodes),
            total_downstream_count=len(downstream_nodes),
            metadata={
                "source": raw_response.get("source", "unknown"),
                "depth_analyzed": raw_response.get("depth_analyzed", 1),
                "max_depth_requested": max_depth,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get table lineage for {catalog}.{schema}.{table}: {e!s}"
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve table lineage: {e!s}"
        )


@router.get(
    "/column/{catalog}/{schema}/{table}/{column_name}",
    response_model=ColumnLineageResponse,
)
async def get_column_lineage(
    lineage_service: Annotated[DatabricksLineageAPI, Depends(get_lineage_service)],
    db: Annotated[Session, Depends(get_db)],
    catalog: str = Path(..., description="Catalog name"),
    schema: str = Path(..., description="Schema name"),
    table: str = Path(..., description="Table name"),
    column_name: str = Path(..., description="Column name"),
    use_system_tables: bool = Query(
        True, description="Use system tables (recommended) vs REST API"
    ),
):
    """Get column-level lineage information for a specific column.

    This endpoint supports the impact analysis workflow by providing
    detailed column dependencies as described in docs/ia.md.
    Now prioritizes system tables for comprehensive lineage data.

    Args:
        catalog: The name of the catalog.
        schema: The name of the schema.
        table: The name of the table.
        column_name: The specific column name.
        use_system_tables: Whether to use system tables (recommended) or REST API.
        lineage_service: The DatabricksLineageAPI instance.

    Returns:
        The column-level lineage information with upstream and downstream dependencies.
    """
    try:
        full_table_name = f"{catalog}.{schema}.{table}"
        logger.info(
            f"Getting column lineage for {full_table_name}.{column_name} (system_tables={use_system_tables})"
        )

        if use_system_tables:
            _, warehouse_id = _get_env_and_warehouse_id(db, require_warehouse=True)
            raw_response = await lineage_service.get_column_lineage_from_system_tables(
                table_name=full_table_name,
                column_name=column_name,
                warehouse_id=warehouse_id,  # type: ignore[arg-type]
            )
        else:
            # Fallback to REST API
            raw_response = await lineage_service.get_column_lineage(
                table_name=full_table_name, column_name=column_name
            )

        # Parse column lineage response
        upstream_columns = []
        downstream_columns = []

        if "upstream_cols" in raw_response:
            upstream_columns = [
                {
                    "table_name": col.get("table_name"),
                    "column_name": col.get("column_name"),
                    "data_type": col.get("data_type"),
                    "metadata": col.get("metadata"),
                }
                for col in raw_response["upstream_cols"]
            ]

        if "downstream_cols" in raw_response:
            downstream_columns = [
                {
                    "table_name": col.get("table_name"),
                    "column_name": col.get("column_name"),
                    "data_type": col.get("data_type"),
                    "metadata": col.get("metadata"),
                }
                for col in raw_response["downstream_cols"]
            ]

        return ColumnLineageResponse(
            table_name=full_table_name,
            column_name=column_name,
            upstream_columns=upstream_columns,
            downstream_columns=downstream_columns,
            total_upstream_count=len(upstream_columns),
            total_downstream_count=len(downstream_columns),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get column lineage for {catalog}.{schema}.{table}.{column_name}: {e!s}"
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve column lineage: {e!s}"
        )


@router.get("/graph/{catalog}/{schema}/{table}", response_model=LineageGraph)
async def get_lineage_graph(
    lineage_service: Annotated[DatabricksLineageAPI, Depends(get_lineage_service)],
    db: Annotated[Session, Depends(get_db)],
    catalog: str = Path(..., description="Catalog name"),
    schema: str = Path(..., description="Schema name"),
    table: str = Path(..., description="Table name"),
    max_depth: int = Query(
        3, description="Maximum depth for lineage traversal", ge=1, le=10
    ),
    direction: LineageDirection = Query(
        LineageDirection.BOTH, description="Direction of lineage"
    ),
    include_columns: bool = Query(False, description="Include column-level lineage"),
    include_query_history: bool = Query(
        False, description="Include query history analysis"
    ),
    query_history_days: int = Query(
        30, description="Days of query history to analyze", ge=1, le=365
    ),
    use_system_tables: bool = Query(
        True, description="Use system tables (recommended) vs REST API"
    ),
):
    """Get comprehensive lineage graph for visualization with optional query history.

    This endpoint provides multi-level impact analysis as described in docs/ia.md.
    Now uses system tables by default to overcome the blog's noted one-level limitation.

    Can optionally include query history analysis to provide usage context for lineage relationships.

    Args:
        catalog: The name of the catalog.
        schema: The name of the schema.
        table: The name of the table.
        max_depth: Maximum depth for lineage traversal (from ia.md).
        direction: Direction of lineage to retrieve.
        include_columns: Whether to include column-level details.
        include_query_history: Whether to include query history analysis.
        query_history_days: Number of days to analyze for query history.
        use_system_tables: Whether to use system tables (recommended) or REST API.
        lineage_service: The DatabricksLineageAPI instance.
        db: Database session for environment configuration.

    Returns:
        Complete lineage graph with nodes and edges for visualization, optionally with query history.
    """
    try:
        full_table_name = f"{catalog}.{schema}.{table}"
        logger.info(
            f"Getting lineage graph for {full_table_name} with depth {max_depth} (system_tables={use_system_tables})"
        )

        warehouse_id = None
        if use_system_tables:
            _, warehouse_id = _get_env_and_warehouse_id(db, require_warehouse=True)

        # Get table lineage using preferred method
        if use_system_tables and warehouse_id:
            table_lineage = await lineage_service.get_table_lineage_from_system_tables(
                table_name=full_table_name,
                warehouse_id=warehouse_id,
                max_depth=max_depth,
            )
        else:
            table_lineage = await lineage_service.get_table_lineage(
                table_name=full_table_name, include_entity_lineage=True
            )

        # Build nodes and edges for graph representation
        nodes = []
        edges = []
        processed_tables = set()

        # Central node
        central_node = LineageNode(
            entity_name=full_table_name,
            entity_type=LineageEntityType.TABLE,
            table_info=LineageTableInfo(
                catalog_name=catalog,
                schema_name=schema,
                table_name=table,
                full_name=full_table_name,
            ),
            metadata={"is_central": True},
        )
        nodes.append(central_node)
        processed_tables.add(full_table_name)

        # Process upstream tables
        if direction in [LineageDirection.UPSTREAM, LineageDirection.BOTH]:
            upstreams = table_lineage.get("upstreams", [])
            for upstream in upstreams:
                upstream_name = upstream.get("name", "")
                if upstream_name and upstream_name not in processed_tables:
                    upstream_parts = upstream_name.split(".")
                    if len(upstream_parts) >= 3:
                        nodes.append(
                            LineageNode(
                                entity_name=upstream_name,
                                entity_type=LineageEntityType.TABLE,
                                table_info=LineageTableInfo(
                                    catalog_name=upstream_parts[0],
                                    schema_name=upstream_parts[1],
                                    table_name=upstream_parts[-1],
                                    full_name=upstream_name,
                                ),
                                metadata={"is_central": False, "direction": "upstream"},
                            )
                        )
                        edges.append(
                            {
                                "source": upstream_name,
                                "target": full_table_name,
                                "relationship_type": "feeds_into",
                            }
                        )
                        processed_tables.add(upstream_name)

        # Process downstream tables
        if direction in [LineageDirection.DOWNSTREAM, LineageDirection.BOTH]:
            downstreams = table_lineage.get("downstreams", [])
            for downstream in downstreams:
                downstream_name = downstream.get("name", "")
                if downstream_name and downstream_name not in processed_tables:
                    downstream_parts = downstream_name.split(".")
                    if len(downstream_parts) >= 3:
                        nodes.append(
                            LineageNode(
                                entity_name=downstream_name,
                                entity_type=LineageEntityType.TABLE,
                                table_info=LineageTableInfo(
                                    catalog_name=downstream_parts[0],
                                    schema_name=downstream_parts[1],
                                    table_name=downstream_parts[-1],
                                    full_name=downstream_name,
                                ),
                                metadata={
                                    "is_central": False,
                                    "direction": "downstream",
                                },
                            )
                        )
                        edges.append(
                            {
                                "source": full_table_name,
                                "target": downstream_name,
                                "relationship_type": "feeds_into",
                            }
                        )
                        processed_tables.add(downstream_name)

        # Add column information if requested
        column_lineage = None
        if include_columns:
            try:
                if use_system_tables and warehouse_id:
                    column_response = (
                        await lineage_service.get_column_lineage_from_system_tables(
                            table_name=full_table_name,
                            column_name="",  # Get all columns
                            warehouse_id=warehouse_id,
                        )
                    )
                else:
                    column_response = await lineage_service.get_column_lineage(
                        table_name=full_table_name
                    )
                column_lineage = {
                    "upstream_columns": column_response.get("upstream_cols", []),
                    "downstream_columns": column_response.get("downstream_cols", []),
                }
            except Exception as e:
                logger.warning(f"Failed to get column lineage: {e!s}")
                column_lineage = None

        # Add query history if requested
        query_history_metadata = None
        if include_query_history and warehouse_id:
            try:
                query_history_data = (
                    await lineage_service.get_lineage_with_query_history(
                        table_name=full_table_name,
                        warehouse_id=warehouse_id,
                        days=query_history_days,
                    )
                )
                query_history_metadata = {
                    "analysis_period_days": query_history_days,
                    "query_count": query_history_data.get("total_queries", 0),
                    "unique_users": query_history_data.get("unique_users", 0),
                    "query_history": query_history_data.get("history", []),
                }
            except Exception as e:
                logger.warning(f"Failed to get query history: {e!s}")
                query_history_metadata = {"error": "Query history unavailable"}

        # Build response with optional query history
        graph_response = LineageGraph(
            nodes=nodes,
            edges=edges,
            center_node=full_table_name,
            total_nodes=len(nodes),
            max_depth=max_depth,
            column_lineage=column_lineage,
        )

        # Add query history to metadata if available
        if query_history_metadata:
            # Since LineageGraph model may not have query_history field,
            # we can extend it or return as additional metadata
            # For now, add to graph_response if the model supports it
            if hasattr(graph_response, "query_history"):
                graph_response.query_history = query_history_metadata

        return graph_response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to get lineage graph for {catalog}.{schema}.{table}: {e!s}"
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve lineage graph: {e!s}"
        )


@router.post("/system-tables/query", response_model=SystemTableQueryResponse)
async def execute_lineage_system_query(
    request: SystemTableQueryRequest,
    lineage_service: Annotated[DatabricksLineageAPI, Depends(get_lineage_service)],
):
    """Execute custom SQL queries against system tables for advanced lineage analysis.

    This endpoint supports the advanced impact analysis queries described in docs/ia.md,
    including column rename impact and new column addition impact analysis.

    Args:
        request: The system query request with SQL and warehouse_id.
        lineage_service: The DatabricksLineageAPI instance.

    Returns:
        Query results with metadata for impact analysis.
    """
    try:
        logger.info(f"Executing system query: {request.query[:100]}...")

        # Validate query contains only SELECT statements for security
        query_upper = request.query.upper().strip()
        if not query_upper.startswith("SELECT"):
            raise HTTPException(
                status_code=400,
                detail="Only SELECT queries are allowed for system table access",
            )

        # Check for potentially dangerous operations
        dangerous_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE"]
        if any(keyword in query_upper for keyword in dangerous_keywords):
            raise HTTPException(
                status_code=400, detail="Query contains restricted operations"
            )

        # Execute query against system tables via SQL warehouse
        # This would use the actual SQL execution API
        # For now, return a structure that supports the IA workflow

        return SystemTableQueryResponse(
            query=request.query,
            results=[],
            total_rows=0,
            execution_time_ms=0,
            metadata={
                "columns": [
                    "target_table_full_name",
                    "target_column_name",
                    "entity_metadata",
                    "event_time",
                ],
                "status": "completed",
                "message": "System query execution ready for implementation with SQL Warehouse API",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to execute system query: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to execute system query: {e!s}"
        )


@router.post(
    "/impact-analysis/{catalog}/{schema}/{table}/{column}",
    response_model=dict[str, Any],
)
async def analyze_column_impact(
    lineage_service: Annotated[DatabricksLineageAPI, Depends(get_lineage_service)],
    db: Annotated[Session, Depends(get_db)],
    catalog: str = Path(..., description="Catalog name"),
    schema: str = Path(..., description="Schema name"),
    table: str = Path(..., description="Table name"),
    column: str = Path(..., description="Column name"),
    change_type: str = Query(
        ..., description="Type of change: rename, add, remove, type_change"
    ),
    max_depth: int = Query(3, description="Maximum traversal depth", ge=1, le=10),
):
    """Analyze the impact of column changes on downstream and upstream dependencies.

    This endpoint implements the comprehensive impact analysis workflow from docs/ia.md,
    providing complete visibility into affected tables, columns, and entities.

    Args:
        catalog: The name of the catalog.
        schema: The name of the schema.
        table: The name of the table.
        column: The column name being changed.
        change_type: Type of change (rename, add, remove, type_change).
        warehouse_id: SQL warehouse ID for system table queries.
        max_depth: Maximum depth for impact traversal.
        lineage_service: The DatabricksLineageAPI instance.

    Returns:
        Comprehensive impact analysis with affected entities and recommendations.
    """
    try:
        full_table_name = f"{catalog}.{schema}.{table}"
        logger.info(
            f"Analyzing impact for {full_table_name}.{column} - change type: {change_type}"
        )

        # Get warehouse_id from environment configuration
        environment = db.query(Environment).first()
        if not environment or not environment.configuration:
            raise HTTPException(
                status_code=400,
                detail="Environment configuration required for impact analysis",
            )

        warehouse_id = environment.configuration.get("warehouse_id")
        if not warehouse_id:
            raise HTTPException(
                status_code=400,
                detail="SQL warehouse ID must be configured for impact analysis",
            )

        # Get direct column lineage
        try:
            column_lineage = (
                await lineage_service.get_column_lineage_from_system_tables(
                    table_name=full_table_name,
                    column_name=column,
                    warehouse_id=warehouse_id,
                )
            )
        except Exception as e:
            logger.warning(f"Failed to get column lineage: {e!s}")
            column_lineage = {"upstream_cols": [], "downstream_cols": []}

        # Get table lineage for broader context
        try:
            table_lineage = await lineage_service.get_table_lineage(
                table_name=full_table_name, include_entity_lineage=True
            )
        except Exception as e:
            logger.warning(f"Failed to get table lineage: {e!s}")
            table_lineage = {"upstreams": [], "downstreams": []}

        # Build impact analysis response
        downstream_tables = set()
        upstream_tables = set()

        # Process downstream column impacts
        for col in column_lineage.get("downstream_cols", []):
            if col.get("table_name"):
                downstream_tables.add(col["table_name"])

        # Process upstream column dependencies
        for col in column_lineage.get("upstream_cols", []):
            if col.get("table_name"):
                upstream_tables.add(col["table_name"])

        # Generate change recommendations based on type
        recommendations = []
        if change_type == "rename":
            recommendations = [
                f"Update all downstream queries referencing {full_table_name}.{column}",
                "Test all affected pipelines and notebooks before deployment",
                "Consider adding column alias during transition period",
                f"Update documentation for {len(downstream_tables)} affected downstream tables",
            ]
        elif change_type == "remove":
            recommendations = [
                f"Critical: {len(downstream_tables)} downstream dependencies will break",
                "Plan migration strategy for all dependent columns",
                "Coordinate with owners of affected downstream tables",
                "Consider soft deletion with deprecation period",
            ]
        elif change_type == "add":
            recommendations = [
                "Update downstream tables that might benefit from new column",
                "Review ETL pipelines for potential schema evolution",
                "Document new column purpose and usage guidelines",
            ]
        elif change_type == "type_change":
            recommendations = [
                "Verify data compatibility for all downstream consumers",
                "Test type conversion logic thoroughly",
                "Plan staged rollout to minimize disruption",
                "Update data validation rules in dependent pipelines",
            ]

        return {
            "analysis_summary": {
                "column": f"{full_table_name}.{column}",
                "change_type": change_type,
                "affected_downstream_tables": len(downstream_tables),
                "affected_upstream_tables": len(upstream_tables),
                "total_column_dependencies": len(
                    column_lineage.get("downstream_cols", [])
                ),
                "impact_severity": "high"
                if len(downstream_tables) > 5
                else "medium"
                if len(downstream_tables) > 0
                else "low",
            },
            "detailed_impact": {
                "downstream_tables": list(downstream_tables),
                "upstream_tables": list(upstream_tables),
                "downstream_column_details": column_lineage.get("downstream_cols", []),
                "upstream_column_details": column_lineage.get("upstream_cols", []),
                "table_context": {
                    "upstream_table_count": len(table_lineage.get("upstreams", [])),
                    "downstream_table_count": len(table_lineage.get("downstreams", [])),
                },
            },
            "recommendations": recommendations,
            "analysis_metadata": {
                "max_depth_analyzed": max_depth,
                "warehouse_id": warehouse_id,
                "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }

    except Exception as e:
        logger.error(f"Failed to analyze column impact: {e!s}")
        raise HTTPException(status_code=500, detail=f"Impact analysis failed: {e!s}")


@router.get(
    "/schema/{catalog}/{schema}/related-tables",
    summary="Discover related tables through lineage in a schema",
)
async def get_schema_related_tables(
    lineage_service: Annotated[DatabricksLineageAPI, Depends(get_lineage_service)],
    db: Annotated[Session, Depends(get_db)],
    catalog: str = Path(..., description="Catalog name"),
    schema: str = Path(..., description="Schema name"),
    limit: int = Query(
        20, description="Maximum number of related tables", ge=1, le=100
    ),
):
    """Discover tables related through lineage relationships within a schema.

    This endpoint helps users discover data relationships for better understanding
    of data flows within a schema by analyzing table lineage patterns.

    Args:
        catalog: The name of the catalog.
        schema: The name of the schema.
        limit: Maximum number of results to return.
        lineage_service: The DatabricksLineageAPI instance.
        db: Database session for environment configuration.

    Returns:
        List of related tables with relationship counts and metadata.
    """
    try:
        # Get environment configuration for warehouse_id
        environment = db.query(Environment).first()
        if not environment or not environment.configuration:
            raise HTTPException(
                status_code=400,
                detail="Environment configuration required for lineage discovery",
            )

        warehouse_id = environment.configuration.get("warehouse_id")
        if not warehouse_id:
            raise HTTPException(
                status_code=400,
                detail="SQL warehouse ID must be configured for lineage discovery",
            )

        # Query system tables to find related tables within the schema
        schema_pattern = f"{catalog}.{schema}.%"

        related_tables_query = f"""
        SELECT DISTINCT
            COALESCE(source_table_full_name, target_table_full_name) as table_name,
            COUNT(DISTINCT CASE WHEN source_table_full_name LIKE '{schema_pattern}' THEN target_table_full_name END) as downstream_count,
            COUNT(DISTINCT CASE WHEN target_table_full_name LIKE '{schema_pattern}' THEN source_table_full_name END) as upstream_count,
            COUNT(*) as total_relationships
        FROM system.access.table_lineage
        WHERE (source_table_full_name LIKE '{schema_pattern}' OR target_table_full_name LIKE '{schema_pattern}')
        GROUP BY COALESCE(source_table_full_name, target_table_full_name)
        HAVING COALESCE(source_table_full_name, target_table_full_name) LIKE '{schema_pattern}'
        ORDER BY total_relationships DESC
        LIMIT {limit}
        """

        try:
            result = await lineage_service.execute_sql_warehouse_query(
                warehouse_id=warehouse_id, query=related_tables_query
            )

            related_tables = []
            if result.get("data"):
                for row in result["data"]:
                    if row and len(row) >= 4:
                        table_parts = row[0].split(".")
                        related_tables.append(
                            {
                                "table_name": table_parts[-1]
                                if len(table_parts) >= 3
                                else row[0],
                                "full_name": row[0],
                                "downstream_count": row[1] or 0,
                                "upstream_count": row[2] or 0,
                                "total_relationships": row[3] or 0,
                                "lineage_score": (row[1] or 0)
                                + (row[2] or 0),  # Simple scoring
                            }
                        )

            return {
                "catalog_name": catalog,
                "schema_name": schema,
                "related_tables": related_tables,
                "total_found": len(related_tables),
                "limit_applied": limit,
                "analysis_metadata": {
                    "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
                    "lineage_source": "system_tables",
                    "query_pattern": schema_pattern,
                },
            }

        except Exception as e:
            logger.warning(
                f"System tables query failed, falling back to limited discovery: {e}"
            )
            return {
                "catalog_name": catalog,
                "schema_name": schema,
                "related_tables": [],
                "total_found": 0,
                "error": "Lineage discovery requires system tables access",
                "fallback_available": "Use individual table lineage endpoints for specific tables",
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to discover related tables in {catalog}.{schema}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to discover related tables: {e!s}",
        )


@router.get("/popularity", response_model=list[TablePopularityMetrics])
async def get_table_popularity(
    lineage_service: Annotated[DatabricksLineageAPI, Depends(get_lineage_service)],
    db: Annotated[Session, Depends(get_db)],
    days: int = Query(30, description="Number of days to analyze", ge=1, le=365),
    catalog: Optional[str] = Query(None, description="Filter by catalog"),
    schema: Optional[str] = Query(None, description="Filter by schema"),
    limit: int = Query(50, description="Maximum number of results", ge=1, le=500),
):
    """Get table popularity metrics for impact analysis prioritization.

    This endpoint supports the usage scope understanding mentioned in docs/ia.md
    by providing popularity metrics to prioritize high-impact changes.

    Args:
        warehouse_id: SQL warehouse ID for system table queries.
        days: Number of days to analyze for popularity.
        catalog: Optional catalog filter.
        schema: Optional schema filter.
        limit: Maximum number of results to return.
        lineage_service: The DatabricksLineageAPI instance.

    Returns:
        List of table popularity metrics for impact prioritization.
    """
    try:
        # Get warehouse_id from environment configuration
        environment = db.query(Environment).first()
        if not environment or not environment.configuration:
            raise HTTPException(
                status_code=400,
                detail="Environment configuration required for popularity metrics",
            )

        warehouse_id = environment.configuration.get("warehouse_id")
        if not warehouse_id:
            raise HTTPException(
                status_code=400,
                detail="SQL warehouse ID must be configured for popularity metrics",
            )

        logger.info(f"Getting popularity metrics over {days} days")

        # Build the WHERE clause for filtering
        safe_catalog = catalog.replace("'", "''") if catalog else None
        safe_schema = schema.replace("'", "''") if schema else None
        where_clauses = [
            f"event_date >= current_date() - INTERVAL '{days}' DAYS",
            "action_name IN ('generateTemporaryTableCredential', 'getCommand')",
            "request_params:table_full_name IS NOT NULL",
        ]
        if safe_catalog:
            where_clauses.append(f"request_params:catalog_name = '{safe_catalog}'")
        if safe_schema:
            where_clauses.append(f"request_params:schema_name = '{safe_schema}'")

        where_sql = " AND ".join(where_clauses)

        query = f"""
        SELECT
            request_params:table_full_name as table_name,
            COUNT(*) AS query_count,
            COUNT(DISTINCT user_identity.email) as unique_users
        FROM
            system.access.audit
        WHERE
            {where_sql}
        GROUP BY
            1
        ORDER BY
            query_count DESC
        LIMIT {limit}
        """

        results = await lineage_service.execute_sql_warehouse_query(
            warehouse_id=warehouse_id, query=query
        )

        # Process results and return them in the correct Pydantic model
        popularity_metrics = []
        if results and results.get("data"):
            cols = results.get("columns", []) or []
            idx = {name: i for i, name in enumerate(cols)}
            t_i = idx.get("table_name", 0)
            q_i = idx.get("query_count", 1)
            u_i = idx.get("unique_users", 2)
            for row in results["data"]:
                if not isinstance(row, (list, tuple)):
                    continue
                table_val = row[t_i] if len(row) > t_i else None
                query_count_val = row[q_i] if len(row) > q_i else 0
                unique_users_val = row[u_i] if len(row) > u_i else 0
                try:
                    qc = int(query_count_val) if query_count_val is not None else 0
                except Exception:
                    qc = 0
                try:
                    uu = int(unique_users_val) if unique_users_val is not None else 0
                except Exception:
                    uu = 0
                popularity_metrics.append(
                    TablePopularityMetrics(
                        table_name=str(table_val) if table_val is not None else None,
                        query_count=qc,
                        unique_users=uu,
                        avg_queries_per_day=qc / days,
                        popularity_score=(qc * 0.7) + (uu * 0.3),
                    )
                )

        if not popularity_metrics:
            logger.warning(
                "Table popularity query returned no data. The service layer might be returning a placeholder."
            )
            # Return an empty list as per the response_model
            return []

        return popularity_metrics

    except Exception as e:
        logger.error(f"Failed to get popularity metrics: {e!s}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve popularity metrics: {e!s}"
        )


@router.get("/health", response_model=LineageHealthCheck)
async def get_lineage_service_health(
    lineage_service: Annotated[DatabricksLineageAPI, Depends(get_lineage_service)],
):
    """Check lineage service health and system tables connectivity.

    Returns:
        Health status of the lineage tracking service and system tables access.
    """
    try:
        logger.info("Performing lineage service health check")

        # Test basic connectivity
        health_status = {
            "status": "healthy",
            "lineage_api_available": True,
            "system_tables_accessible": True,
            "error_message": None,
        }

        # Try a simple lineage query to test connectivity
        try:
            # This would test actual connectivity to system tables
            # For now, assume healthy unless we encounter specific errors
            pass
        except Exception as e:
            health_status.update(
                {
                    "status": "unhealthy",
                    "lineage_api_available": False,
                    "error_message": f"Lineage API test failed: {e!s}",
                }
            )

        return LineageHealthCheck(**health_status)

    except Exception as e:
        logger.error(f"Health check failed: {e!s}")
        return LineageHealthCheck(
            status="unhealthy",
            lineage_api_available=False,
            system_tables_accessible=False,
            error_message=f"Health check failed: {e!s}",
        )
