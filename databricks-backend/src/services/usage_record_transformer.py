"""Platform-agnostic usage record transformation service.

This service transforms platform-specific usage records (Databricks, Snowflake, etc.)
into a normalized format for the star schema.

Design principles:
- Platform-agnostic transformation
- Type-safe with proper validation
- Handles missing/null enrichment data gracefully
- Extracts dimension data and usage facts separately
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple, List

logger = logging.getLogger(__name__)


class UsageRecordTransformer:
    """Transforms platform-specific usage records to star schema format."""

    def __init__(self, platform: str = "databricks"):
        """Initialize transformer for specific platform.

        Args:
            platform: Platform name ('databricks', 'snowflake', 'bigquery')
        """
        self.platform = platform.lower()

    def transform_databricks_record(
        self, record: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
        """Transform a Databricks usage record to star schema format.

        Returns:
            Tuple of (usage_fact_data, dimension_data)
            - usage_fact_data: Dict for usage_facts table
            - dimension_data: Dict for appropriate dimension table (or None)
        """
        # Determine resource type from billing_origin_product and available IDs
        resource_type, dimension_data = self._extract_dimension_data(record)

        # Build usage fact record
        usage_fact = self._build_usage_fact(record, resource_type)

        return usage_fact, dimension_data

    def _extract_dimension_data(
        self, record: Dict[str, Any]
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """Extract resource type and dimension data from record.

        Returns:
            Tuple of (resource_type, dimension_dict)
        """
        billing_product = record.get("billing_origin_product", "").upper()

        # Pipeline (DLT)
        resolved_pipeline_id = record.get("resolved_pipeline_id")
        if billing_product == "DLT" or resolved_pipeline_id:
            return "pipeline", self._extract_pipeline_dimension(record)

        # Job
        job_id = record.get("job_id")
        if job_id or billing_product in ["JOBS", "WORKFLOWS"]:
            return "job", self._extract_job_dimension(record)

        # Warehouse (SQL)
        warehouse_id = record.get("warehouse_id")
        if warehouse_id or billing_product == "SQL":
            return "warehouse", self._extract_warehouse_dimension(record)

        # Cluster
        cluster_id = record.get("cluster_id")
        if cluster_id or billing_product in ["ALL_PURPOSE_COMPUTE", "INTERACTIVE"]:
            return "cluster", self._extract_cluster_dimension(record)

        # Model Serving Endpoint
        endpoint_id = record.get("endpoint_id")
        if endpoint_id or billing_product in ["MODEL_SERVING", "SERVING_ENDPOINTS"]:
            return "endpoint", self._extract_endpoint_dimension(record)

        # Notebook (fallback for interactive usage)
        notebook_id = record.get("notebook_id")
        if notebook_id:
            return "notebook", None  # No dedicated dimension table for notebooks yet

        # Unknown/Other
        logger.warning(
            f"Unknown resource type for billing_product={billing_product}, "
            f"available IDs: pipeline={resolved_pipeline_id}, job={job_id}, "
            f"warehouse={warehouse_id}, cluster={cluster_id}, endpoint={endpoint_id}"
        )
        return "unknown", None

    def _extract_pipeline_dimension(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Extract pipeline dimension data."""
        pipeline_id = record.get("resolved_pipeline_id") or record.get("pipeline_id")

        return {
            "platform": self.platform,
            "workspace_id": str(record.get("workspace_id", "")),
            "pipeline_id": str(pipeline_id) if pipeline_id else "unknown",
            "pipeline_name": record.get("pipeline_name_from_tags"),
            "dlt_tier": record.get("dlt_tier"),
            "is_serverless": record.get("is_serverless"),
            "uc_catalog": record.get("uc_catalog"),
            "uc_schema": record.get("uc_schema"),
            "uc_table_name": record.get("uc_table_name"),
            "uc_full_name": self._build_uc_full_name(record),
            "owned_by": record.get("executed_by"),  # Fallback to executor
        }

    def _extract_job_dimension(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Extract job dimension data."""
        return {
            "platform": self.platform,
            "workspace_id": str(record.get("workspace_id", "")),
            "job_id": str(record.get("job_id", "unknown")),
            "job_name": record.get("job_name"),
            "job_type": record.get("job_type"),
            "job_schedule": record.get("job_schedule"),
            "owned_by": record.get("job_owner"),
            "created_by": record.get("job_created_by"),
            "is_on_all_purpose_compute": self._is_all_purpose_compute(record),
            "created_at_timestamp": self._parse_timestamp(record.get("job_created_at")),
        }

    def _extract_warehouse_dimension(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Extract warehouse dimension data."""
        return {
            "platform": self.platform,
            "workspace_id": str(record.get("workspace_id", "")),
            "warehouse_id": str(record.get("warehouse_id", "unknown")),
            "warehouse_name": record.get("warehouse_name"),
            "warehouse_type": record.get("warehouse_type"),
            "warehouse_size": record.get("warehouse_size"),
            "owned_by": record.get("warehouse_owner"),
        }

    def _extract_cluster_dimension(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Extract cluster dimension data."""
        return {
            "platform": self.platform,
            "workspace_id": str(record.get("workspace_id", "")),
            "cluster_id": str(record.get("cluster_id", "unknown")),
            "cluster_name": record.get("cluster_name"),
            "cluster_type": record.get("cluster_type"),
            "owned_by": record.get("cluster_owner"),
        }

    def _extract_endpoint_dimension(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Extract endpoint dimension data."""
        return {
            "platform": self.platform,
            "workspace_id": str(record.get("workspace_id", "")),
            "endpoint_id": str(record.get("endpoint_id", "unknown")),
            "endpoint_name": None,  # Not available in current enrichment
            "endpoint_type": None,
            "owned_by": record.get("executed_by"),
        }

    def _build_usage_fact(
        self, record: Dict[str, Any], resource_type: str
    ) -> Dict[str, Any]:
        """Build usage fact record."""
        usage_date = self._parse_date(record.get("usage_date"))
        year_month = usage_date.strftime("%Y-%m") if usage_date else None

        # Extract team tag from custom_tags
        custom_tags = record.get("custom_tags", {})
        team_tag = None
        if isinstance(custom_tags, dict):
            team_tag = custom_tags.get("team")

        # Extract resource ID for later mapping to dimension ID
        resource_id = self._extract_resource_id(record, resource_type)

        return {
            # Core dimensions
            "platform": self.platform,
            "workspace_id": str(record.get("workspace_id", "")),
            "environment": self._extract_environment(record),
            "usage_date": usage_date,
            "usage_start_time": self._parse_timestamp(record.get("usage_start_time")),
            "usage_end_time": self._parse_timestamp(record.get("usage_end_time")),
            "year_month": year_month,
            # Product/SKU
            "billing_origin_product": record.get("billing_origin_product", "UNKNOWN"),
            "sku_name": record.get("sku_name", "UNKNOWN"),
            "usage_unit": record.get("usage_unit", "DBU"),
            "cloud_provider": record.get("cloud_provider"),
            # Resource
            "resource_type": resource_type,
            "_resource_id": resource_id,  # Temporary field for ID mapping
            # Note: resource_dimension_id will be set after dimension upsert
            # Ownership
            "executed_by": record.get("executed_by"),
            "team_tag": team_tag,
            # Metrics
            "usage_quantity": self._to_decimal(record.get("dbu_consumed")),
            "unit_price": self._to_decimal(record.get("dbu_unit_price")),
            "list_cost": self._to_decimal(record.get("dbu_cost_usd")),
            # Metadata
            "custom_tags": custom_tags,
            "record_type": "ORIGINAL",
            "sync_batch_id": None,  # Will be set by sync service
        }

    def _extract_resource_id(
        self, record: Dict[str, Any], resource_type: str
    ) -> Optional[str]:
        """Extract the resource ID based on resource type."""
        if resource_type == "pipeline":
            pipeline_id = record.get("resolved_pipeline_id") or record.get(
                "pipeline_id"
            )
            return str(pipeline_id) if pipeline_id else "unknown"
        elif resource_type == "job":
            job_id = record.get("job_id")
            return str(job_id) if job_id else "unknown"
        elif resource_type == "warehouse":
            warehouse_id = record.get("warehouse_id")
            return str(warehouse_id) if warehouse_id else "unknown"
        elif resource_type == "cluster":
            cluster_id = record.get("cluster_id")
            return str(cluster_id) if cluster_id else "unknown"
        elif resource_type == "endpoint":
            endpoint_id = record.get("endpoint_id")
            return str(endpoint_id) if endpoint_id else "unknown"
        return None

    def _build_uc_full_name(self, record: Dict[str, Any]) -> Optional[str]:
        """Build Unity Catalog full table name."""
        catalog = record.get("uc_catalog")
        schema = record.get("uc_schema")
        table = record.get("uc_table_name")

        if catalog and schema and table:
            return f"{catalog}.{schema}.{table}"
        return None

    def _is_all_purpose_compute(self, record: Dict[str, Any]) -> Optional[bool]:
        """Determine if job runs on all-purpose compute (cost optimization flag)."""
        cluster_type = record.get("cluster_type")
        if cluster_type:
            return cluster_type.upper() == "ALL_PURPOSE"

        billing_product = record.get("billing_origin_product", "")
        if "ALL_PURPOSE" in billing_product.upper():
            return True

        return None

    def _extract_environment(self, record: Dict[str, Any]) -> Optional[str]:
        """Extract environment from custom tags or infer from data."""
        custom_tags = record.get("custom_tags", {})
        if isinstance(custom_tags, dict):
            env = custom_tags.get("environment") or custom_tags.get("env")
            if env:
                return env

        # Could infer from workspace_id or other metadata
        return None

    def _parse_date(self, value: Any) -> Optional[datetime]:
        """Parse date value to datetime.date."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except ValueError:
                logger.warning(f"Failed to parse date: {value}")
                return None
        return None

    def _parse_timestamp(self, value: Any) -> Optional[datetime]:
        """Parse timestamp value to datetime."""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                # Try ISO format first
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                try:
                    # Try standard format
                    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    logger.warning(f"Failed to parse timestamp: {value}")
                    return None
        return None

    def _to_decimal(self, value: Any) -> Optional[Decimal]:
        """Convert value to Decimal safely."""
        if value is None:
            return None
        if isinstance(value, Decimal):
            return value
        try:
            return Decimal(str(value))
        except (ValueError, TypeError):
            logger.warning(f"Failed to convert to Decimal: {value}")
            return None

    def transform_batch(
        self, records: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], Dict[str, List[Dict[str, Any]]]]:
        """Transform a batch of records.

        Returns:
            Tuple of (usage_facts, dimensions_by_type)
            - usage_facts: List of usage fact dicts
            - dimensions_by_type: Dict mapping resource_type to list of dimension dicts
        """
        usage_facts = []
        dimensions_by_type: Dict[str, List[Dict[str, Any]]] = {
            "pipeline": [],
            "job": [],
            "warehouse": [],
            "cluster": [],
            "endpoint": [],
        }

        for record in records:
            try:
                usage_fact, dimension_data = self.transform_databricks_record(record)
                usage_facts.append(usage_fact)

                if dimension_data:
                    resource_type = usage_fact["resource_type"]
                    if resource_type in dimensions_by_type:
                        dimensions_by_type[resource_type].append(dimension_data)

            except Exception as e:
                logger.error(f"Failed to transform record: {e}", exc_info=True)
                continue

        logger.info(
            f"Transformed {len(usage_facts)} usage facts and "
            f"{sum(len(dims) for dims in dimensions_by_type.values())} dimension records"
        )

        return usage_facts, dimensions_by_type
