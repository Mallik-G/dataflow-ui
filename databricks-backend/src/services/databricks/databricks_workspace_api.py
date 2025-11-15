"""Databricks Workspace and Files API client (2.0), refactored to use Databricks SDK."""

from typing import Iterable, Optional

from databricks.sdk.service import workspace as dbs_workspace
from databricks.sdk.service.workspace import ExportFormat, Language

from .sdk_adapter import DatabricksSDKAdapter


class DatabricksWorkspaceAPI(DatabricksSDKAdapter):
    """Async client for /api/2.0/workspace endpoints using the SDK."""

    async def get_status(self, path: str) -> dbs_workspace.ObjectInfo:
        """Return workspace object status for given path."""
        return await self._run_sync_method(
            self.sdk_client.workspace.get_status, path=path
        )

    async def list(self, path: str) -> Iterable[dbs_workspace.ObjectInfo]:
        """List objects under a workspace directory path."""
        return await self._run_sync_method(self.sdk_client.workspace.list, path=path)

    async def mkdirs(self, path: str) -> None:
        """Create workspace directories recursively at path."""
        return await self._run_sync_method(self.sdk_client.workspace.mkdirs, path=path)

    async def delete(self, path: str, recursive: bool = True) -> None:
        """Delete a workspace object, optionally recursively."""
        return await self._run_sync_method(
            self.sdk_client.workspace.delete, path=path, recursive=recursive
        )

    async def export(
        self, path: str, format: str = "SOURCE", direct_download: bool = False
    ) -> dbs_workspace.ExportResponse:
        """Export a workspace object."""
        return await self._run_sync_method(
            self.sdk_client.workspace.export,
            path=path,
            format=format,
            direct_download=direct_download,
        )

    async def import_object(
        self,
        path: str,
        format: str,
        language: Optional[str],
        content_base64: str,
        overwrite: bool = True,
    ) -> None:
        """Import a notebook/file into workspace from base64 content."""
        # Convert string parameters to SDK enum types
        format_enum = ExportFormat(format) if isinstance(format, str) else format
        language_enum = (
            Language(language) if language and isinstance(language, str) else language
        )

        return await self._run_sync_method(
            self.sdk_client.workspace.import_,
            path=path,
            format=format_enum,
            language=language_enum,
            content=content_base64,
            overwrite=overwrite,
        )
