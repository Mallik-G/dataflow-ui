"""Repository for observability (DLT) read models with pagination."""

from __future__ import annotations
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..models.db.observability import (
    AutoLoaderSummary,
    SourceBacklogSummary,
    LineageGraph,
)


class ObservabilityRepository:
    def __init__(self, db: Session):
        self.db = db

    # Auto Loader
    def get_autoloader_metrics(
        self,
        *,
        pipeline_id: Optional[str],
        cutoff_date,
        offset: int,
        limit: int,
    ) -> Tuple[List[AutoLoaderSummary], int]:
        q = self.db.query(AutoLoaderSummary).filter(
            AutoLoaderSummary.event_date >= cutoff_date
        )
        if pipeline_id:
            q = q.filter(AutoLoaderSummary.pipeline_id == pipeline_id)
        total = q.count()
        items = (
            q.order_by(desc(AutoLoaderSummary.event_date))
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    # Source backlog
    def get_source_backlog(
        self,
        *,
        pipeline_id: Optional[str],
        flow_name: Optional[str],
        cutoff_date,
        offset: int,
        limit: int,
    ) -> Tuple[List[SourceBacklogSummary], int]:
        q = self.db.query(SourceBacklogSummary).filter(
            SourceBacklogSummary.event_date >= cutoff_date
        )
        if pipeline_id:
            q = q.filter(SourceBacklogSummary.pipeline_id == pipeline_id)
        if flow_name:
            q = q.filter(SourceBacklogSummary.flow_name == flow_name)
        total = q.count()
        items = (
            q.order_by(desc(SourceBacklogSummary.event_date))
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    # Lineage graph
    def get_lineage(
        self,
        *,
        pipeline_id: Optional[str],
        offset: int,
        limit: int,
    ) -> Tuple[List[LineageGraph], int]:
        q = self.db.query(LineageGraph)
        if pipeline_id:
            q = q.filter(LineageGraph.pipeline_id == pipeline_id)
        total = q.count()
        items = (
            q.order_by(LineageGraph.pipeline_id, LineageGraph.flow_name)
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total
