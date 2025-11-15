"""OAuth Token Manager for Databricks Service Principal Authentication.

This module handles OAuth 2.0 client credentials flow using direct API calls
for service principal authentication in Databricks Apps.
"""

import asyncio
from typing import Optional
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import aiohttp
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class OAuthToken:
    """OAuth token with expiry information."""

    access_token: str
    token_type: str = "Bearer"
    expires_at: Optional[datetime] = None
    scope: Optional[str] = None

    @property
    def is_expired(self) -> bool:
        """Check if token is expired (with 5 minute buffer for safety)."""
        if not self.expires_at:
            return False
        buffer_time = timedelta(minutes=5)
        return datetime.now(timezone.utc) + buffer_time >= self.expires_at


class OAuthTokenManager:
    """Manages OAuth tokens for Databricks service principal authentication."""

    def __init__(
        self, host: str, client_id: str, client_secret: str, scope: str = "all-apis"
    ):
        """Initialize OAuth token manager.

        Args:
            host: Databricks workspace URL
            client_id: Service principal client ID
            client_secret: Service principal client secret
            scope: OAuth scope (default: all-apis)
        """
        self.host = host.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.scope = scope

        # Token cache
        self._cached_token: Optional[OAuthToken] = None
        self._token_lock = asyncio.Lock()

        # OAuth endpoint
        self.token_url = f"{self.host}/oidc/v1/token"

        logger.info(
            "OAuth token manager initialized",
            host=self.host,
            client_id=client_id[:8] + "...",
            scope=scope,
        )

    async def get_access_token(self) -> str:
        """Get a valid access token, refreshing if necessary.

        Returns:
            Valid access token string

        Raises:
            Exception: If token acquisition fails
        """
        async with self._token_lock:
            # Return cached token if still valid
            if self._cached_token and not self._cached_token.is_expired:
                logger.debug("Using cached OAuth token")
                return self._cached_token.access_token

            # Acquire new token
            logger.info("Acquiring new OAuth token")
            self._cached_token = await self._acquire_token()
            return self._cached_token.access_token

    async def _acquire_token(self) -> OAuthToken:
        """Acquire a new OAuth token using client credentials flow.

        Returns:
            New OAuth token

        Raises:
            Exception: If token acquisition fails
        """
        timeout = aiohttp.ClientTimeout(total=30)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Prepare request data
            auth = aiohttp.BasicAuth(self.client_id, self.client_secret)
            data = {"grant_type": "client_credentials", "scope": self.scope}

            logger.debug(
                "Requesting OAuth token",
                url=self.token_url,
                grant_type="client_credentials",
                scope=self.scope,
            )

            try:
                async with session.post(
                    self.token_url, auth=auth, data=data
                ) as response:
                    response_data = await response.json()

                    if response.status == 200:
                        # Calculate expiry time
                        expires_in = response_data.get(
                            "expires_in", 3600
                        )  # Default 1 hour
                        expires_at = datetime.now(timezone.utc) + timedelta(
                            seconds=expires_in
                        )

                        token = OAuthToken(
                            access_token=response_data["access_token"],
                            token_type=response_data.get("token_type", "Bearer"),
                            expires_at=expires_at,
                            scope=response_data.get("scope"),
                        )

                        logger.info(
                            "OAuth token acquired successfully",
                            expires_in=expires_in,
                            expires_at=expires_at.isoformat(),
                            token_type=token.token_type,
                            scope=token.scope,
                        )

                        return token

                    else:
                        error_msg = response_data.get(
                            "error_description",
                            response_data.get("error", f"HTTP {response.status}"),
                        )
                        raise Exception(f"OAuth token request failed: {error_msg}")

            except aiohttp.ClientError as e:
                logger.error("Network error during OAuth token request", error=str(e))
                raise Exception(f"Failed to request OAuth token: {e}")
            except Exception as e:
                logger.error(
                    "Unexpected error during OAuth token request", error=str(e)
                )
                raise

    async def refresh_token(self) -> str:
        """Force refresh the OAuth token.

        Returns:
            New access token
        """
        async with self._token_lock:
            logger.info("Force refreshing OAuth token")
            self._cached_token = None  # Clear cache
            return await self.get_access_token()

    def get_auth_headers(self, token: Optional[str] = None) -> dict[str, str]:
        """Get authorization headers for API requests.

        Args:
            token: Optional token to use (if None, will be retrieved)

        Returns:
            Dictionary with Authorization header
        """
        if not token and self._cached_token and not self._cached_token.is_expired:
            token = self._cached_token.access_token

        if not token:
            raise ValueError("No valid token available. Call get_access_token() first.")

        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def handle_auth_error(self) -> str:
        """Handle authentication errors by refreshing token.

        This method should be called when an API request returns 401.

        Returns:
            New access token
        """
        logger.warning("Handling authentication error - refreshing token")
        return await self.refresh_token()

    def is_configured(self) -> bool:
        """Check if OAuth is properly configured.

        Returns:
            True if client credentials are available
        """
        return bool(self.client_id and self.client_secret and self.host)
