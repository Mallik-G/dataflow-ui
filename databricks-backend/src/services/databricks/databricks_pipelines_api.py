"""Databricks Delta Live Tables (DLT) Pipelines API service, refactored to use Databricks SDK."""

import logging
from typing import Any, Iterable, Optional

from databricks.sdk.service import pipelines as dbs_pipelines

# from ...models.api.pipelines import PipelineSpec  # unused
from .sdk_adapter import DatabricksSDKAdapter

logger = logging.getLogger(__name__)


class DatabricksPipelinesAPI(DatabricksSDKAdapter):
    """Service for interacting with Databricks DLT Pipelines API using the SDK."""

    async def list_pipelines(
        self,
        max_results: Optional[int] = None,
        page_token: Optional[str] = None,
        filter_query: Optional[str] = None,
    ) -> Iterable[dbs_pipelines.PipelineStateInfo]:
        """List all Delta Live Tables pipelines."""
        logger.info(f"Listing DLT pipelines with filter: {filter_query}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.list_pipelines,
            max_results=max_results,
            page_token=page_token,
            filter=filter_query,
        )

    async def create_pipeline(
        self, create_kwargs: dict
    ) -> dbs_pipelines.CreatePipelineResponse:
        """Create a new Delta Live Tables pipeline."""
        logger.info(f"Creating DLT pipeline: {create_kwargs.get('name', 'Unknown')}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.create, **create_kwargs
        )

    async def get_pipeline(self, pipeline_id: str) -> dbs_pipelines.GetPipelineResponse:
        """Get details of a specific Delta Live Tables pipeline."""
        logger.info(f"Getting DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.get, pipeline_id=pipeline_id
        )

    async def update_pipeline(self, pipeline_id: str, update_kwargs: dict) -> None:
        """Update an existing Delta Live Tables pipeline."""
        logger.info(f"Updating DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.update, pipeline_id=pipeline_id, **update_kwargs
        )

    async def delete_pipeline(self, pipeline_id: str) -> None:
        """Delete a Delta Live Tables pipeline."""
        logger.info(f"Deleting DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.delete, pipeline_id=pipeline_id
        )

    async def start_update(
        self,
        pipeline_id: str,
        full_refresh: Optional[bool] = None,
        refresh_selection: Optional[list[str]] = None,
        full_refresh_selection: Optional[list[str]] = None,
        validate_only: Optional[bool] = None,
    ) -> dbs_pipelines.StartUpdateResponse:
        """Start an update for a Delta Live Tables pipeline."""
        logger.info(f"Starting update for DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.start_update,
            pipeline_id=pipeline_id,
            full_refresh=full_refresh,
            refresh_selection=refresh_selection,
            full_refresh_selection=full_refresh_selection,
            validate_only=validate_only,
        )

    async def list_updates(
        self, pipeline_id: str, max_results: Optional[int] = None
    ) -> Iterable[dbs_pipelines.UpdateInfo]:
        """List updates for a Delta Live Tables pipeline."""
        logger.info(f"Listing updates for DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.list_updates,
            pipeline_id=pipeline_id,
            max_results=max_results,
        )

    async def get_update(
        self, pipeline_id: str, update_id: str
    ) -> dbs_pipelines.GetUpdateResponse:
        """Get a specific update for a pipeline."""
        logger.info(f"Getting update {update_id} for DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.get_update,
            pipeline_id=pipeline_id,
            update_id=update_id,
        )

    async def list_pipeline_events(
        self,
        pipeline_id: str,
        max_results: Optional[int] = None,
        filter_query: Optional[str] = None,
        page_token: Optional[str] = None,
    ) -> dict[str, Any]:
        """List events for a Delta Live Tables pipeline with pagination support.
        Always returns events as plain dicts for consistency.
        """
        logger.info(f"Listing events for DLT pipeline: {pipeline_id}")

        # Use a reasonable page size to avoid the 250 event limit
        page_size = min(max_results or 250, 250)

        try:
            result = await self._run_sync_method(
                self.sdk_client.pipelines.list_pipeline_events,
                pipeline_id=pipeline_id,
                max_results=page_size,
                page_token=page_token,
                filter=filter_query,
            )

            # Extract events and pagination info from SDK response
            events = []
            next_page_token = None

            if hasattr(result, "events"):
                events = list(result.events) if result.events else []
            elif hasattr(result, "__iter__"):
                events = list(result)

            if hasattr(result, "next_page_token"):
                next_page_token = result.next_page_token

            # Normalize to dicts
            events_dict = [e.as_dict() if hasattr(e, "as_dict") else e for e in events]

            return {
                "events": events_dict,
                "next_page_token": next_page_token,
                "total_fetched": len(events_dict),
            }

        except Exception as e:
            logger.error(f"Failed to list pipeline events for {pipeline_id}: {e}")
            # If pagination fails, try without pagination but with smaller limit
            if "more than 250 events" in str(e) and not page_token:
                logger.warning(
                    f"Retrying with smaller page size for pipeline {pipeline_id}"
                )
                return await self.list_pipeline_events(
                    pipeline_id=pipeline_id,
                    max_results=100,  # Even smaller page size
                    filter_query=filter_query,
                    page_token=None,
                )
            raise

    async def stop_pipeline(self, pipeline_id: str) -> Any:
        """Stop a pipeline (non-blocking). Returns waiter handle."""
        logger.info(f"Stopping DLT pipeline (non-blocking): {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.stop, pipeline_id=pipeline_id
        )

    async def stop_pipeline_and_wait(
        self, pipeline_id: str
    ) -> dbs_pipelines.GetPipelineResponse:
        """Stop a pipeline and wait for it to be idle/stopped."""
        logger.info(f"Stopping DLT pipeline and waiting: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.stop_and_wait, pipeline_id=pipeline_id
        )

    async def wait_get_pipeline_idle(
        self, pipeline_id: str
    ) -> dbs_pipelines.GetPipelineResponse:
        """Wait until pipeline is idle and return its state."""
        logger.info(f"Waiting for DLT pipeline to become idle: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.wait_get_pipeline_idle, pipeline_id=pipeline_id
        )

    async def get_permissions(
        self, pipeline_id: str
    ) -> dbs_pipelines.PipelinePermissions:
        """Get pipeline permissions."""
        logger.info(f"Getting permissions for DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.get_permissions, pipeline_id=pipeline_id
        )

    async def update_permissions(
        self,
        pipeline_id: str,
        access_control_list: Optional[list[dict[str, Any]]] = None,
    ) -> dbs_pipelines.PipelinePermissions:
        """Update pipeline permissions (patch)."""
        logger.info(f"Updating permissions for DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.update_permissions,
            pipeline_id=pipeline_id,
            access_control_list=access_control_list,
        )

    async def set_permissions(
        self,
        pipeline_id: str,
        access_control_list: Optional[list[dict[str, Any]]] = None,
    ) -> dbs_pipelines.PipelinePermissions:
        """Set pipeline permissions (replace)."""
        logger.info(f"Setting permissions for DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.set_permissions,
            pipeline_id=pipeline_id,
            access_control_list=access_control_list,
        )

    async def get_permission_levels(
        self, pipeline_id: str
    ) -> dbs_pipelines.GetPipelinePermissionLevelsResponse:
        """Get available permission levels for a pipeline object."""
        logger.info(f"Getting permission levels for DLT pipeline: {pipeline_id}")
        return await self._run_sync_method(
            self.sdk_client.pipelines.get_permission_levels, pipeline_id=pipeline_id
        )
