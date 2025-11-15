"""Databricks Repos API client (2.0), refactored to use Databricks SDK."""

from typing import Iterable, Optional

from databricks.sdk.service.workspace import RepoInfo

from .sdk_adapter import DatabricksSDKAdapter


class DatabricksReposAPI(DatabricksSDKAdapter):
    """Async client for /api/2.0/repos endpoints using the SDK."""

    async def list_repos(self, path_prefix: Optional[str] = None) -> Iterable[RepoInfo]:
        """List repos in the workspace."""
        return await self._run_sync_method(
            self.sdk_client.repos.list, path_prefix=path_prefix
        )

    async def get_repo(self, repo_id: int) -> RepoInfo:
        """Retrieve a single repo by its ID."""
        return await self._run_sync_method(self.sdk_client.repos.get, repo_id=repo_id)

    async def create_repo(
        self,
        url: str,
        provider: str,
        path: Optional[str] = None,
    ) -> RepoInfo:
        """Create a repo from a remote Git URL."""
        # The SDK's create method does not take a branch, it uses the repo's default.
        # The branch can be updated in a subsequent call to update_repo.
        return await self._run_sync_method(
            self.sdk_client.repos.create, url=url, provider=provider, path=path
        )

    async def update_repo(
        self,
        repo_id: int,
        branch: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> None:
        """Update a repo's checked-out reference."""
        return await self._run_sync_method(
            self.sdk_client.repos.update, repo_id=repo_id, branch=branch, tag=tag
        )

    async def delete_repo(self, repo_id: int) -> None:
        """Delete a repo from the workspace."""
        return await self._run_sync_method(
            self.sdk_client.repos.delete, repo_id=repo_id
        )
