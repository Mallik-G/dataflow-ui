"""SDK adapter for Databricks services not implemented with custom API clients."""

import asyncio
import logging
from typing import Any, Optional
from functools import partial
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import DatabricksError

from ...core.config import settings
from .base_client import DatabricksAPIError

logger = logging.getLogger(__name__)


class DatabricksSDKAdapter:
    """Adapter to use Databricks SDK for services not implemented with custom API clients."""

    def __init__(
        self,
        host: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        """Initialize the SDK adapter with service principal authentication.

        Args:
            host: Databricks workspace URL (defaults to settings.databricks_host)
            client_id: OAuth client ID (defaults to settings.databricks_client_id)
            client_secret: OAuth client secret (defaults to settings.databricks_client_secret)
        """
        try:
            # Build kwargs conditionally to avoid passing None
            wc_kwargs: dict[str, Any] = {}

            effective_host = host or settings.databricks_host
            if effective_host:
                wc_kwargs["host"] = effective_host

            effective_client_id = client_id or settings.databricks_client_id
            effective_client_secret = client_secret or settings.databricks_client_secret
            if effective_client_id and effective_client_secret:
                wc_kwargs["client_id"] = effective_client_id
                wc_kwargs["client_secret"] = effective_client_secret
                wc_kwargs["auth_type"] = "oauth-m2m"

            self.sdk_client = WorkspaceClient(**wc_kwargs)
            self.host = self.sdk_client.config.host
            logger.info(
                f"Initialized Databricks SDK adapter with service principal for {self.host}"
            )
        except Exception as e:
            raise DatabricksAPIError(f"Failed to initialize Databricks SDK: {e}")

    async def _run_sync_method(self, sync_method, *args, **kwargs) -> Any:
        """Run a synchronous SDK method in a thread pool to avoid blocking.

        Uses functools.partial to properly pass kwargs to the executor.
        """
        loop = asyncio.get_event_loop()
        try:
            func = partial(sync_method, *args, **kwargs)
            result = await loop.run_in_executor(None, func)
            return result
        except DatabricksError as e:
            # Convert SDK exceptions to our custom exception format
            raise DatabricksAPIError(
                message=str(e),
                status_code=getattr(e, "status_code", None),
                response_data=getattr(e, "response", None),
            )
        except Exception as e:
            raise DatabricksAPIError(f"SDK operation failed: {e}")
