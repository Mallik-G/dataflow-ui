"""Service layer for observability endpoints (aggregation + pagination)."""

from __future__ import annotations
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from .observability_repository import ObservabilityRepository


class ObservabilityService:
    def __init__(self, db: Session):
        self.repo = ObservabilityRepository(db)

    def _cutoff(self, days: int) -> datetime:
        return datetime.now(timezone.utc) - timedelta(days=days)

    # Auto Loader
    def autoloader_metrics(
        self, *, pipeline_id: Optional[str], days: int, page: int, page_size: int
    ) -> Dict[str, Any]:
        cutoff = self._cutoff(days)
        offset = (page - 1) * page_size
        items, total = self.repo.get_autoloader_metrics(
            pipeline_id=pipeline_id,
            cutoff_date=cutoff,
            offset=offset,
            limit=page_size,
        )
        summary = {
            "total_files_listed": sum(i.total_files_listed or 0 for i in items),
            "total_files_added": sum(i.total_files_added or 0 for i in items),
            "total_gb_processed": round(
                sum(float(i.total_gb_processed or 0) for i in items), 2
            ),
            "total_failed_operations": sum(i.failed_operations or 0 for i in items),
        }
        return {
            "summary": summary,
            "metrics": [
                {
                    "pipeline_id": m.pipeline_id,
                    "pipeline_name": m.pipeline_name,
                    "flow_name": m.flow_name,
                    "event_date": m.event_date.isoformat(),
                    "total_files_listed": m.total_files_listed,
                    "total_files_added": m.total_files_added,
                    "total_gb_processed": float(m.total_gb_processed)
                    if m.total_gb_processed
                    else None,
                    "failed_operations": m.failed_operations,
                    "avg_duration_sec": float(m.avg_duration_sec)
                    if m.avg_duration_sec
                    else None,
                }
                for m in items
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    # Source backlog
    def source_backlog(
        self,
        *,
        pipeline_id: Optional[str],
        flow_name: Optional[str],
        days: int,
        page: int,
        page_size: int,
    ) -> Dict[str, Any]:
        cutoff = self._cutoff(days)
        offset = (page - 1) * page_size
        items, total = self.repo.get_source_backlog(
            pipeline_id=pipeline_id,
            flow_name=flow_name,
            cutoff_date=cutoff,
            offset=offset,
            limit=page_size,
        )
        # Compute top sources on current page (can be adjusted to compute globally if needed)
        source_max_backlog = {}
        for b in items:
            key = f"{b.pipeline_name}:{b.flow_name}:{b.source_name}"
            v = float(b.max_backlog_gb) if b.max_backlog_gb else 0.0
            if v > source_max_backlog.get(key, 0.0):
                source_max_backlog[key] = v
        top_sources = sorted(
            source_max_backlog.items(), key=lambda x: x[1], reverse=True
        )[:10]
        return {
            "summary": {
                "total_sources_monitored": total,
                "top_sources_by_backlog": [
                    {"source": s, "max_backlog_gb": v} for s, v in top_sources
                ],
            },
            "backlog_details": [
                {
                    "pipeline_id": b.pipeline_id,
                    "pipeline_name": b.pipeline_name,
                    "flow_name": b.flow_name,
                    "source_name": b.source_name,
                    "event_date": b.event_date.isoformat(),
                    "max_backlog_gb": float(b.max_backlog_gb)
                    if b.max_backlog_gb
                    else None,
                    "avg_backlog_gb": float(b.avg_backlog_gb)
                    if b.avg_backlog_gb
                    else None,
                    "max_backlog_records": b.max_backlog_records,
                    "max_backlog_hours": float(b.max_backlog_hours)
                    if b.max_backlog_hours
                    else None,
                    "avg_backlog_hours": float(b.avg_backlog_hours)
                    if b.avg_backlog_hours
                    else None,
                }
                for b in items
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    # Lineage
    def lineage(
        self, *, pipeline_id: Optional[str], page: int, page_size: int
    ) -> Dict[str, Any]:
        offset = (page - 1) * page_size
        items, total = self.repo.get_lineage(
            pipeline_id=pipeline_id, offset=offset, limit=page_size
        )
        return {
            "total_edges": total,
            "lineage": [
                {
                    "pipeline_id": edge.pipeline_id,
                    "pipeline_name": edge.pipeline_name,
                    "flow_name": edge.flow_name,
                    "output_dataset": edge.output_dataset,
                    "input_dataset": edge.input_dataset,
                    "flow_type": edge.flow_type,
                    "last_seen": edge.last_seen.isoformat() if edge.last_seen else None,
                }
                for edge in items
            ],
            "page": page,
            "page_size": page_size,
        }
