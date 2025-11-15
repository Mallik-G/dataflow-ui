"""Databricks Delta Live Tables (DLT) Pipelines API endpoints, refactored to use Databricks SDK."""

import logging
from typing import Annotated, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from ...services.observability_service import ObservabilityService

from ...core.database import get_db
from ...core.config import settings
from ...core.dependencies import get_active_environment
from ...models.db.deployments import Environment
from ...models.api.pipelines import (
    PipelineResponse,
    PipelinesListResponse,
    PipelineSpec,
    StartPipelineUpdateRequest,
)
from ...services.databricks.databricks_pipelines_api import DatabricksPipelinesAPI
from ...services.databricks.base_client import DatabricksAPIError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipelines", tags=["Data Pipeline Management"])


def get_pipelines_api(
    environment: Annotated[Environment, Depends(get_active_environment)],
) -> DatabricksPipelinesAPI:
    """Dependency to get a configured Databricks Pipelines API client."""
    host = environment.databricks_host
    if not host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )
    return DatabricksPipelinesAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


def _nexa_default_tags(environment: Environment, via: str = "api") -> dict[str, str]:
    """Default tags to stamp on created/managed resources for tracking.

    Note: Not cached as environment configuration may change during runtime.
    """
    tags: dict[str, str] = {"managed_by": "nexa-admin", "created_by": "dataready-ai"}
    if environment:
        if environment.id:
            tags["nexa_environment_id"] = str(environment.id)
        if environment.name:
            tags["nexa_environment_name"] = str(environment.name)
    return tags


@router.get("/", response_model=PipelinesListResponse)
async def list_pipelines(
    db: Annotated[Session, Depends(get_db)],
    max_results: Optional[int] = None,
    page_token: Optional[str] = None,
    filter_query: Optional[str] = None,
) -> PipelinesListResponse:
    # Serve from DB
    from ...models.db import Pipeline

    q = db.query(Pipeline)
    # Optional filter by our tags
    if filter_query:
        # simple contains on name or target_table
        like = f"%{filter_query}%"
        q = q.filter((Pipeline.name.ilike(like)) | (Pipeline.target_table.ilike(like)))
    items = q.limit(max_results or 100).all()
    pipelines = [
        PipelineResponse.model_validate(
            {
                "pipeline_id": p.pipeline_id,
                "name": p.name,
                "spec": p.spec or {},
                "state": None,
            }
        )
        for p in items
    ]
    return PipelinesListResponse(
        statuses=pipelines, next_page_token=None, prev_page_token=None
    )


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(
    pipeline_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> PipelineResponse:
    try:
        from ...models.db import Pipeline as DbPipeline
        from ...models.db import DeploymentDetail

        p = db.query(DbPipeline).filter(DbPipeline.pipeline_id == pipeline_id).first()
        if not p:
            raise HTTPException(
                status_code=404, detail=f"Pipeline {pipeline_id} not found in database"
            )
        # Determine Nexa management
        has_deployment = (
            db.query(DeploymentDetail)
            .filter(DeploymentDetail.platform_object_id == pipeline_id)
            .first()
            is not None
        )
        tags = p.tags or {}
        nexa_tags = (
            str(tags.get("created_by")) == "dataready-ai"
            and str(tags.get("managed_by")) == "nexa-admin"
        )
        if not has_deployment and not nexa_tags:
            raise HTTPException(
                status_code=404,
                detail="Pipeline is not Nexa-managed (no tags and not in deployment)",
            )
        payload = {
            "pipeline_id": p.pipeline_id,
            "name": p.name,
            "spec": p.spec or {},
            "state": None,
        }
        # Optionally hint when tags exist but deployment missing
        if nexa_tags and not has_deployment:
            payload["latest_updates"] = [
                {"note": "Nexa tags present but deployment record not found"}
            ]
        return PipelineResponse.model_validate(payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    request: PipelineSpec,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
    environment: Annotated[Environment, Depends(get_active_environment)],
    db: Annotated[Session, Depends(get_db)],
) -> PipelineResponse:
    try:
        create_kwargs = request.dict(exclude_none=True)
        # Stamp default tags into configuration
        create_kwargs.setdefault("configuration", {})
        create_kwargs["configuration"].update(_nexa_default_tags(environment, via="api"))

        created = await pipelines_api.create_pipeline(create_kwargs)
        if not created.pipeline_id:
            raise HTTPException(
                status_code=500, detail="CreatePipelineResponse missing pipeline_id"
            )
        # Return creation response directly instead of fetching details again
        return PipelineResponse.model_validate(
            created.as_dict() if hasattr(created, "as_dict") else created
        )
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_pipeline(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
    environment: Annotated[Environment, Depends(get_active_environment)],
    request: PipelineSpec,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        update_kwargs = request.dict(exclude_none=True)
        # Ensure tags persist on updates
        update_kwargs.setdefault("configuration", {})
        update_kwargs["configuration"].update(_nexa_default_tags(environment, via="api"))
        await pipelines_api.update_pipeline(pipeline_id, update_kwargs)
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/start-update")
async def start_pipeline_update(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
    request: StartPipelineUpdateRequest,
):
    try:
        resp = await pipelines_api.start_update(
            pipeline_id=pipeline_id,
            full_refresh=request.full_refresh,
            refresh_selection=request.refresh_selection,
            full_refresh_selection=request.full_refresh_selection,
            validate_only=request.validate_only,
        )
        return resp.as_dict()
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/stop", status_code=status.HTTP_202_ACCEPTED)
async def stop_pipeline(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
):
    try:
        _ = await pipelines_api.stop_pipeline(pipeline_id)
        return {"pipeline_id": pipeline_id, "status": "stopping"}
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/stop-and-wait", response_model=PipelineResponse)
async def stop_pipeline_and_wait(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
):
    try:
        final_state = await pipelines_api.stop_pipeline_and_wait(pipeline_id)
        return PipelineResponse.model_validate(
            final_state.as_dict() if hasattr(final_state, "as_dict") else final_state
        )
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/updates")
async def list_pipeline_updates(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
    max_results: Optional[int] = None,
):
    try:
        resp = await pipelines_api.list_updates(
            pipeline_id=pipeline_id, max_results=max_results
        )
        items = []
        if hasattr(resp, "updates"):
            items = resp.updates or []
        elif hasattr(resp, "__iter__"):
            items = list(resp)
        updates = [u.as_dict() if hasattr(u, "as_dict") else u for u in items]
        return {"updates": updates}
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/updates/{update_id}")
async def get_pipeline_update(
    pipeline_id: str,
    update_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
):
    try:
        upd = await pipelines_api.get_update(
            pipeline_id=pipeline_id, update_id=update_id
        )
        return upd.as_dict()
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/events")
async def list_pipeline_events(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
    max_results: Optional[int] = None,
    filter_query: Optional[str] = None,
    page_token: Optional[str] = None,
):
    """Get events and logs for a Delta Live Tables pipeline with pagination support."""
    try:
        events_response = await pipelines_api.list_pipeline_events(
            pipeline_id=pipeline_id,
            max_results=max_results,
            filter_query=filter_query,
            page_token=page_token,
        )

        # Handle dict response format with pagination
        if isinstance(events_response, dict):
            events = events_response.get("events", [])
            next_page_token = events_response.get("next_page_token")

            # Convert events to dict format
            events_dict = [e.as_dict() if hasattr(e, "as_dict") else e for e in events]

            return {
                "events": events_dict,
                "next_page_token": next_page_token,
                "total_fetched": len(events_dict),
            }

        # Handle SDK response format (legacy)
        events = [e.as_dict() if hasattr(e, "as_dict") else e for e in events_response]
        return {"events": events}

    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/permission-levels")
async def get_pipeline_permission_levels(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
):
    try:
        levels = await pipelines_api.get_permission_levels(pipeline_id)
        return levels.as_dict()
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/permissions")
async def get_pipeline_permissions(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
):
    try:
        perms = await pipelines_api.get_permissions(pipeline_id)
        return perms.as_dict()
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{pipeline_id}/permissions")
async def update_pipeline_permissions(
    pipeline_id: str,
    payload: dict,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
):
    try:
        perms = await pipelines_api.update_permissions(
            pipeline_id=pipeline_id,
            access_control_list=payload.get("access_control_list"),
        )
        return perms.as_dict()
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{pipeline_id}/permissions")
async def set_pipeline_permissions(
    pipeline_id: str,
    payload: dict,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
):
    try:
        perms = await pipelines_api.set_permissions(
            pipeline_id=pipeline_id,
            access_control_list=payload.get("access_control_list"),
        )
        return perms.as_dict()
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/wait-until-idle", response_model=PipelineResponse)
async def wait_until_pipeline_idle(
    pipeline_id: str,
    pipelines_api: Annotated[DatabricksPipelinesAPI, Depends(get_pipelines_api)],
):
    try:
        final_state = await pipelines_api.wait_get_pipeline_idle(pipeline_id)
        return PipelineResponse.model_validate(
            final_state.as_dict() if hasattr(final_state, "as_dict") else final_state
        )
    except DatabricksAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/lineage",
    summary="Get data lineage graph",
    response_description="Data lineage showing dataset dependencies",
)
async def get_lineage_graph(
    db: Annotated[Session, Depends(get_db)],
    pipeline_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=2000),
) -> dict[str, Any]:
    try:
        svc = ObservabilityService(db)
        return svc.lineage(pipeline_id=pipeline_id, page=page, page_size=page_size)
    except Exception as e:
        logger.error(f"Error getting lineage graph: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get lineage graph",
        )


@router.get(
    "/autoloader",
    summary="Get Auto Loader metrics",
    response_description="Auto Loader file processing metrics",
)
async def get_autoloader_metrics(
    db: Annotated[Session, Depends(get_db)],
    pipeline_id: Optional[str] = None,
    days: int = Query(7, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
) -> dict[str, Any]:
    try:
        svc = ObservabilityService(db)
        return svc.autoloader_metrics(
            pipeline_id=pipeline_id, days=days, page=page, page_size=page_size
        )
    except Exception as e:
        logger.error(f"Error getting Auto Loader metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get Auto Loader metrics",
        )


@router.get(
    "/backlog/sources",
    summary="Get per-source backlog metrics",
    response_description="Per-source backlog metrics for streaming health",
)
async def get_source_backlog(
    db: Annotated[Session, Depends(get_db)],
    pipeline_id: Optional[str] = None,
    flow_name: Optional[str] = None,
    days: int = Query(7, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
) -> dict[str, Any]:
    """Get per-source backlog metrics for detailed streaming monitoring.

    Useful for tracking which Kafka topic or S3 path has the most backlog.
    """
    try:
        svc = ObservabilityService(db)
        return svc.source_backlog(
            pipeline_id=pipeline_id,
            flow_name=flow_name,
            days=days,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        logger.error(f"Error getting source backlog: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get source backlog",
        )
