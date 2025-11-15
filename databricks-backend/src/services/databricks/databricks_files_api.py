"""Databricks Files API client using the official SDK.

Supports uploads to Workspace Files (Volatile) and DBFS paths.
"""

from __future__ import annotations
from .sdk_adapter import DatabricksSDKAdapter


class DatabricksFilesAPI(DatabricksSDKAdapter):
    """Async wrapper over WorkspaceClient.files and .dbfs for artifact upload."""

    async def mkdirs(self, path: str) -> None:
        # Supports both /Volumes/... and dbfs:/ paths through files.mkdirs
        return await self._run_sync_method(self.sdk_client.files.mkdirs, path=path)

    async def upload(self, path: str, content: bytes, overwrite: bool = True) -> None:
        # files.upload handles both workspace files and dbfs scheme
        return await self._run_sync_method(
            self.sdk_client.files.upload,
            path=path,
            contents=content,
            overwrite=overwrite,
        )

    async def upload_stream(self, path: str, fileobj, overwrite: bool = True) -> None:
        return await self._run_sync_method(
            self.sdk_client.files.upload,
            path=path,
            contents=fileobj,
            overwrite=overwrite,
        )
