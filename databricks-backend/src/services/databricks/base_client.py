"""Base client for making requests to the Databricks API using service principal authentication."""

import asyncio
import logging
from typing import Any, Optional
from urllib.parse import urljoin

import aiohttp

from .auth_manager import DatabricksAuthManager, DatabricksAuthError

logger = logging.getLogger(__name__)


class DatabricksAPIError(Exception):
    """Custom exception for Databricks API errors."""

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


class DatabricksBaseClient:
    """Base client for interacting with the Databricks API using service principal authentication."""

    def __init__(
        self,
        host: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        api_version: str = "2.1",
    ):
        """Initialize the Databricks API client with service principal authentication.

        Args:
            host: Databricks workspace URL (defaults to DATABRICKS_HOST env var)
            client_id: OAuth client ID (defaults to DATABRICKS_CLIENT_ID env var)
            client_secret: OAuth client secret (defaults to DATABRICKS_CLIENT_SECRET env var)
            api_version: The API version to use.
        """
        # Initialize auth manager
        self.auth_manager = DatabricksAuthManager(
            host=host,
            client_id=client_id,
            client_secret=client_secret,
        )

        self.host = self.auth_manager.host
        self.base_url = urljoin(self.host, f"api/{api_version}/")

        logger.info(
            f"Initialized Databricks base client for {self.host} (API v{api_version})"
        )

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Make an HTTP request to the Databricks API using service principal authentication."""
        url = urljoin(self.base_url, endpoint)

        timeout = aiohttp.ClientTimeout(total=60)  # 60 second timeout

        connector = aiohttp.TCPConnector()

        try:
            # Get authentication headers from auth manager
            headers = await self.auth_manager.get_auth_headers()

            async with aiohttp.ClientSession(
                timeout=timeout, connector=connector
            ) as session:
                async with session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=data if data else None,
                    params=params,
                ) as response:
                    response_data = await response.json()

                    if response.status >= 400:
                        # Handle authentication errors specially
                        if response.status == 401:
                            # Invalidate token and retry once
                            self.auth_manager.invalidate_token()
                            logger.warning(
                                "Authentication failed, invalidating token and retrying"
                            )

                            # Get fresh headers and retry
                            fresh_headers = await self.auth_manager.get_auth_headers()
                            async with session.request(
                                method=method,
                                url=url,
                                headers=fresh_headers,
                                json=data if data else None,
                                params=params,
                            ) as retry_response:
                                retry_data = await retry_response.json()

                                if retry_response.status >= 400:
                                    error_message = retry_data.get(
                                        "message", f"HTTP {retry_response.status}"
                                    )
                                    raise DatabricksAPIError(
                                        message=error_message,
                                        status_code=retry_response.status,
                                        response_data=retry_data,
                                    )
                                return retry_data
                        else:
                            error_message = response_data.get(
                                "message", f"HTTP {response.status}"
                            )
                            raise DatabricksAPIError(
                                message=error_message,
                                status_code=response.status,
                                response_data=response_data,
                            )

                    return response_data

        except DatabricksAuthError as e:
            raise DatabricksAPIError(f"Authentication error: {e}")
        except aiohttp.ClientError as e:
            raise DatabricksAPIError(f"HTTP client error: {e!s}")
        except asyncio.TimeoutError:
            raise DatabricksAPIError("Request timeout")
