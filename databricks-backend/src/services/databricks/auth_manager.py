"""Unified OAuth authentication manager for Databricks service principal authentication."""

import asyncio
import logging
import os
import time
from typing import Dict, Optional
from urllib.parse import urljoin

import aiohttp

logger = logging.getLogger(__name__)


class DatabricksAuthError(Exception):
    """Custom exception for Databricks authentication errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response_data: Optional[dict] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(message)


class DatabricksAuthManager:
    """Manages OAuth authentication for Databricks service principal."""

    def __init__(
        self,
        host: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        """Initialize the auth manager with service principal credentials.

        Args:
            host: Databricks workspace URL (defaults to DATABRICKS_HOST env var)
            client_id: OAuth client ID (defaults to DATABRICKS_CLIENT_ID env var)
            client_secret: OAuth client secret (defaults to DATABRICKS_CLIENT_SECRET env var)
        """
        self.host = host or os.getenv("DATABRICKS_HOST")
        self.client_id = client_id or os.getenv("DATABRICKS_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("DATABRICKS_CLIENT_SECRET")

        if not self.host:
            raise DatabricksAuthError(
                "DATABRICKS_HOST environment variable or host parameter required"
            )
        if not self.client_id:
            raise DatabricksAuthError(
                "DATABRICKS_CLIENT_ID environment variable or client_id parameter required"
            )
        if not self.client_secret:
            raise DatabricksAuthError(
                "DATABRICKS_CLIENT_SECRET environment variable or client_secret parameter required"
            )

        # Normalize host URL
        if not self.host.startswith(("http://", "https://")):
            self.host = f"https://{self.host}"
        if not self.host.endswith("/"):
            self.host += "/"

        # OAuth token endpoint
        self.token_url = urljoin(self.host, "oidc/v1/token")

        # Token cache
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[float] = None
        self._refresh_lock = asyncio.Lock()

        logger.info(f"Initialized Databricks auth manager for {self.host}")

    async def get_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary.

        Returns:
            Valid access token

        Raises:
            DatabricksAuthError: If token acquisition fails
        """
        async with self._refresh_lock:
            # Check if current token is still valid (with 60 second buffer)
            if (
                self._access_token
                and self._token_expires_at
                and time.time() < (self._token_expires_at - 60)
            ):
                return self._access_token

            # Acquire new token
            await self._refresh_token()

            if not self._access_token:
                raise DatabricksAuthError("Failed to acquire access token")

            return self._access_token

    async def _refresh_token(self) -> None:
        """Refresh the OAuth access token using client credentials flow."""
        logger.info("Refreshing OAuth access token")

        # Prepare OAuth request
        token_data = {
            "grant_type": "client_credentials",
            "scope": "all-apis",
        }

        # Use HTTP Basic Auth for client credentials
        auth = aiohttp.BasicAuth(self.client_id, self.client_secret)

        timeout = aiohttp.ClientTimeout(total=30)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                async with session.post(
                    url=self.token_url,
                    data=token_data,
                    auth=auth,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                ) as response:
                    response_data = await response.json()

                    if response.status >= 400:
                        error_message = response_data.get(
                            "error_description",
                            response_data.get("error", f"HTTP {response.status}"),
                        )
                        raise DatabricksAuthError(
                            message=f"OAuth token request failed: {error_message}",
                            status_code=response.status,
                            response_data=response_data,
                        )

                    # Extract token information
                    access_token = response_data.get("access_token")
                    expires_in = response_data.get("expires_in", 3600)  # Default 1 hour

                    if not access_token:
                        raise DatabricksAuthError(
                            "No access token in OAuth response",
                            response_data=response_data,
                        )

                    # Cache the token
                    self._access_token = access_token
                    self._token_expires_at = time.time() + expires_in

                    logger.info(
                        f"Successfully refreshed OAuth token (expires in {expires_in}s)"
                    )

            except aiohttp.ClientError as e:
                raise DatabricksAuthError(f"OAuth request failed: {e}")
            except asyncio.TimeoutError:
                raise DatabricksAuthError("OAuth request timeout")

    async def get_auth_headers(self) -> Dict[str, str]:
        """Get authorization headers for API requests.

        Returns:
            Dictionary with Authorization header
        """
        access_token = await self.get_access_token()
        return {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def invalidate_token(self) -> None:
        """Invalidate the current cached token to force refresh on next request."""
        logger.info("Invalidating cached OAuth token")
        self._access_token = None
        self._token_expires_at = None
