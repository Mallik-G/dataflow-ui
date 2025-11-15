"""Databricks Git Credentials API client for managing Git credentials."""

from typing import List, Optional

from databricks.sdk.service.workspace import CredentialInfo

from .sdk_adapter import DatabricksSDKAdapter


class DatabricksGitCredentialsAPI(DatabricksSDKAdapter):
    """Databricks Git Credentials API client with async operations using the SDK."""

    async def list_credentials(self) -> List[CredentialInfo]:
        """List all Git credentials for the authenticated user."""
        response = await self._run_sync_method(self.sdk_client.git_credentials.list)
        return list(response)

    async def get_credential(self, credential_id: int) -> CredentialInfo:
        """Get a specific Git credential by ID."""
        response = await self._run_sync_method(
            self.sdk_client.git_credentials.get, credential_id=credential_id
        )
        return response

    async def create_credential(
        self,
        git_provider: str,
        git_username: Optional[str] = None,
        personal_access_token: Optional[str] = None,
        name: Optional[str] = None,
        is_default_for_provider: Optional[bool] = None,
    ) -> dict:
        """Create a new Git credential."""
        response = await self._run_sync_method(
            self.sdk_client.git_credentials.create,
            git_provider=git_provider,
            git_username=git_username,
            personal_access_token=personal_access_token,
            name=name,
            is_default_for_provider=is_default_for_provider,
        )
        return response.as_dict()

    async def update_credential(
        self,
        credential_id: int,
        git_provider: str,
        git_username: Optional[str] = None,
        personal_access_token: Optional[str] = None,
        name: Optional[str] = None,
        is_default_for_provider: Optional[bool] = None,
    ) -> None:
        """Update an existing Git credential."""
        await self._run_sync_method(
            self.sdk_client.git_credentials.update,
            credential_id=credential_id,
            git_provider=git_provider,
            git_username=git_username,
            personal_access_token=personal_access_token,
            name=name,
            is_default_for_provider=is_default_for_provider,
        )

    async def delete_credential(self, credential_id: int) -> None:
        """Delete a Git credential."""
        await self._run_sync_method(
            self.sdk_client.git_credentials.delete, credential_id=credential_id
        )
