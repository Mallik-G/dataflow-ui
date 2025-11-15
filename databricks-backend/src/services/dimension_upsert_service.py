"""Dimension table upsert service for star schema.

This service handles upserting dimension records and returning their IDs
for linking to the usage_facts table.

Design principles:
- Upsert behavior: Update if exists, insert if new
- Returns dimension IDs for fact table linking
- Updates last_seen timestamp on each upsert
- Handles batch operations efficiently
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, update

from models.db.usage_star_schema import (
    DimPipeline,
    DimJob,
    DimWarehouse,
    DimCluster,
    DimEndpoint,
)

logger = logging.getLogger(__name__)


class DimensionUpsertService:
    """Service for upserting dimension table records."""

    def __init__(self, db: Session):
        """Initialize with database session.

        Args:
            db: SQLAlchemy database session
        """
        self.db = db

    def upsert_pipeline(self, pipeline_data: Dict[str, Any]) -> int:
        """Upsert pipeline dimension and return its ID.

        Args:
            pipeline_data: Dict with pipeline dimension fields

        Returns:
            Pipeline dimension ID (primary key)
        """
        platform = pipeline_data["platform"]
        workspace_id = pipeline_data["workspace_id"]
        pipeline_id = pipeline_data["pipeline_id"]

        # Check if exists
        stmt = select(DimPipeline).where(
            DimPipeline.platform == platform,
            DimPipeline.workspace_id == workspace_id,
            DimPipeline.pipeline_id == pipeline_id,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()

        now = datetime.now()

        if existing:
            # Update existing record
            update_stmt = (
                update(DimPipeline)
                .where(
                    DimPipeline.platform == platform,
                    DimPipeline.workspace_id == workspace_id,
                    DimPipeline.pipeline_id == pipeline_id,
                )
                .values(
                    pipeline_name=pipeline_data.get("pipeline_name")
                    or existing.pipeline_name,
                    dlt_tier=pipeline_data.get("dlt_tier") or existing.dlt_tier,
                    is_serverless=pipeline_data.get("is_serverless")
                    if pipeline_data.get("is_serverless") is not None
                    else existing.is_serverless,
                    uc_catalog=pipeline_data.get("uc_catalog") or existing.uc_catalog,
                    uc_schema=pipeline_data.get("uc_schema") or existing.uc_schema,
                    uc_table_name=pipeline_data.get("uc_table_name")
                    or existing.uc_table_name,
                    uc_full_name=pipeline_data.get("uc_full_name")
                    or existing.uc_full_name,
                    owned_by=pipeline_data.get("owned_by") or existing.owned_by,
                    last_seen=now,
                    is_active=True,
                )
            )
            self.db.execute(update_stmt)
            return existing.id

        else:
            # Insert new record
            new_pipeline = DimPipeline(
                platform=platform,
                workspace_id=workspace_id,
                pipeline_id=pipeline_id,
                pipeline_name=pipeline_data.get("pipeline_name"),
                dlt_tier=pipeline_data.get("dlt_tier"),
                is_serverless=pipeline_data.get("is_serverless"),
                uc_catalog=pipeline_data.get("uc_catalog"),
                uc_schema=pipeline_data.get("uc_schema"),
                uc_table_name=pipeline_data.get("uc_table_name"),
                uc_full_name=pipeline_data.get("uc_full_name"),
                owned_by=pipeline_data.get("owned_by"),
                first_seen=now,
                last_seen=now,
                is_active=True,
            )
            self.db.add(new_pipeline)
            self.db.flush()  # Get the ID without committing
            return new_pipeline.id

    def upsert_job(self, job_data: Dict[str, Any]) -> int:
        """Upsert job dimension and return its ID."""
        platform = job_data["platform"]
        workspace_id = job_data["workspace_id"]
        job_id = job_data["job_id"]

        stmt = select(DimJob).where(
            DimJob.platform == platform,
            DimJob.workspace_id == workspace_id,
            DimJob.job_id == job_id,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()

        now = datetime.now()

        if existing:
            update_stmt = (
                update(DimJob)
                .where(
                    DimJob.platform == platform,
                    DimJob.workspace_id == workspace_id,
                    DimJob.job_id == job_id,
                )
                .values(
                    job_name=job_data.get("job_name") or existing.job_name,
                    job_type=job_data.get("job_type") or existing.job_type,
                    job_schedule=job_data.get("job_schedule") or existing.job_schedule,
                    owned_by=job_data.get("owned_by") or existing.owned_by,
                    created_by=job_data.get("created_by") or existing.created_by,
                    is_on_all_purpose_compute=job_data.get("is_on_all_purpose_compute")
                    if job_data.get("is_on_all_purpose_compute") is not None
                    else existing.is_on_all_purpose_compute,
                    created_at_timestamp=job_data.get("created_at_timestamp")
                    or existing.created_at_timestamp,
                    last_seen=now,
                    is_active=True,
                )
            )
            self.db.execute(update_stmt)
            return existing.id

        else:
            new_job = DimJob(
                platform=platform,
                workspace_id=workspace_id,
                job_id=job_id,
                job_name=job_data.get("job_name"),
                job_type=job_data.get("job_type"),
                job_schedule=job_data.get("job_schedule"),
                owned_by=job_data.get("owned_by"),
                created_by=job_data.get("created_by"),
                is_on_all_purpose_compute=job_data.get("is_on_all_purpose_compute"),
                created_at_timestamp=job_data.get("created_at_timestamp"),
                first_seen=now,
                last_seen=now,
                is_active=True,
            )
            self.db.add(new_job)
            self.db.flush()
            return new_job.id

    def upsert_warehouse(self, warehouse_data: Dict[str, Any]) -> int:
        """Upsert warehouse dimension and return its ID."""
        platform = warehouse_data["platform"]
        workspace_id = warehouse_data["workspace_id"]
        warehouse_id = warehouse_data["warehouse_id"]

        stmt = select(DimWarehouse).where(
            DimWarehouse.platform == platform,
            DimWarehouse.workspace_id == workspace_id,
            DimWarehouse.warehouse_id == warehouse_id,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()

        now = datetime.now()

        if existing:
            update_stmt = (
                update(DimWarehouse)
                .where(
                    DimWarehouse.platform == platform,
                    DimWarehouse.workspace_id == workspace_id,
                    DimWarehouse.warehouse_id == warehouse_id,
                )
                .values(
                    warehouse_name=warehouse_data.get("warehouse_name")
                    or existing.warehouse_name,
                    warehouse_type=warehouse_data.get("warehouse_type")
                    or existing.warehouse_type,
                    warehouse_size=warehouse_data.get("warehouse_size")
                    or existing.warehouse_size,
                    owned_by=warehouse_data.get("owned_by") or existing.owned_by,
                    last_seen=now,
                    is_active=True,
                )
            )
            self.db.execute(update_stmt)
            return existing.id

        else:
            new_warehouse = DimWarehouse(
                platform=platform,
                workspace_id=workspace_id,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_data.get("warehouse_name"),
                warehouse_type=warehouse_data.get("warehouse_type"),
                warehouse_size=warehouse_data.get("warehouse_size"),
                owned_by=warehouse_data.get("owned_by"),
                first_seen=now,
                last_seen=now,
                is_active=True,
            )
            self.db.add(new_warehouse)
            self.db.flush()
            return new_warehouse.id

    def upsert_cluster(self, cluster_data: Dict[str, Any]) -> int:
        """Upsert cluster dimension and return its ID."""
        platform = cluster_data["platform"]
        workspace_id = cluster_data["workspace_id"]
        cluster_id = cluster_data["cluster_id"]

        stmt = select(DimCluster).where(
            DimCluster.platform == platform,
            DimCluster.workspace_id == workspace_id,
            DimCluster.cluster_id == cluster_id,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()

        now = datetime.now()

        if existing:
            update_stmt = (
                update(DimCluster)
                .where(
                    DimCluster.platform == platform,
                    DimCluster.workspace_id == workspace_id,
                    DimCluster.cluster_id == cluster_id,
                )
                .values(
                    cluster_name=cluster_data.get("cluster_name")
                    or existing.cluster_name,
                    cluster_type=cluster_data.get("cluster_type")
                    or existing.cluster_type,
                    owned_by=cluster_data.get("owned_by") or existing.owned_by,
                    last_seen=now,
                    is_active=True,
                )
            )
            self.db.execute(update_stmt)
            return existing.id

        else:
            new_cluster = DimCluster(
                platform=platform,
                workspace_id=workspace_id,
                cluster_id=cluster_id,
                cluster_name=cluster_data.get("cluster_name"),
                cluster_type=cluster_data.get("cluster_type"),
                owned_by=cluster_data.get("owned_by"),
                first_seen=now,
                last_seen=now,
                is_active=True,
            )
            self.db.add(new_cluster)
            self.db.flush()
            return new_cluster.id

    def upsert_endpoint(self, endpoint_data: Dict[str, Any]) -> int:
        """Upsert endpoint dimension and return its ID."""
        platform = endpoint_data["platform"]
        workspace_id = endpoint_data["workspace_id"]
        endpoint_id = endpoint_data["endpoint_id"]

        stmt = select(DimEndpoint).where(
            DimEndpoint.platform == platform,
            DimEndpoint.workspace_id == workspace_id,
            DimEndpoint.endpoint_id == endpoint_id,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()

        now = datetime.now()

        if existing:
            update_stmt = (
                update(DimEndpoint)
                .where(
                    DimEndpoint.platform == platform,
                    DimEndpoint.workspace_id == workspace_id,
                    DimEndpoint.endpoint_id == endpoint_id,
                )
                .values(
                    endpoint_name=endpoint_data.get("endpoint_name")
                    or existing.endpoint_name,
                    endpoint_type=endpoint_data.get("endpoint_type")
                    or existing.endpoint_type,
                    owned_by=endpoint_data.get("owned_by") or existing.owned_by,
                    last_seen=now,
                    is_active=True,
                )
            )
            self.db.execute(update_stmt)
            return existing.id

        else:
            new_endpoint = DimEndpoint(
                platform=platform,
                workspace_id=workspace_id,
                endpoint_id=endpoint_id,
                endpoint_name=endpoint_data.get("endpoint_name"),
                endpoint_type=endpoint_data.get("endpoint_type"),
                owned_by=endpoint_data.get("owned_by"),
                first_seen=now,
                last_seen=now,
                is_active=True,
            )
            self.db.add(new_endpoint)
            self.db.flush()
            return new_endpoint.id

    def upsert_dimension(
        self, resource_type: str, dimension_data: Dict[str, Any]
    ) -> Optional[int]:
        """Upsert dimension based on resource type.

        Args:
            resource_type: One of 'pipeline', 'job', 'warehouse', 'cluster', 'endpoint'
            dimension_data: Dimension record data

        Returns:
            Dimension ID or None if resource_type is unknown
        """
        if resource_type == "pipeline":
            return self.upsert_pipeline(dimension_data)
        elif resource_type == "job":
            return self.upsert_job(dimension_data)
        elif resource_type == "warehouse":
            return self.upsert_warehouse(dimension_data)
        elif resource_type == "cluster":
            return self.upsert_cluster(dimension_data)
        elif resource_type == "endpoint":
            return self.upsert_endpoint(dimension_data)
        else:
            logger.warning(f"Unknown resource_type: {resource_type}")
            return None

    def upsert_batch(
        self, dimensions_by_type: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, Dict[str, int]]:
        """Upsert a batch of dimensions and return ID mappings.

        Args:
            dimensions_by_type: Dict mapping resource_type to list of dimension dicts

        Returns:
            Dict mapping resource_type to dict of (resource_id -> dimension_id)
        """
        id_mappings: Dict[str, Dict[str, int]] = {}

        for resource_type, dimensions in dimensions_by_type.items():
            id_mappings[resource_type] = {}

            for dim_data in dimensions:
                try:
                    dim_id = self.upsert_dimension(resource_type, dim_data)
                    if dim_id:
                        # Map resource_id to dimension_id
                        resource_id = dim_data.get(f"{resource_type}_id")
                        if resource_id:
                            id_mappings[resource_type][resource_id] = dim_id

                except Exception as e:
                    logger.error(
                        f"Failed to upsert {resource_type} dimension: {e}",
                        exc_info=True,
                    )
                    continue

        logger.info(
            "Upserted dimensions: "
            + ", ".join(f"{k}={len(v)}" for k, v in id_mappings.items())
        )

        return id_mappings
