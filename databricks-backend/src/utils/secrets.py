"""Databricks secret management utilities."""

import base64
import logging
from typing import Dict, Tuple

from databricks.sdk import WorkspaceClient

from ..core.config import settings

logger = logging.getLogger(__name__)


class SecretManager:
    """Helper to access Databricks secrets with local caching."""

    def __init__(self, host: str):
        self.host = host
        self._client = WorkspaceClient(
            host=host,
            client_id=settings.databricks_client_id,
            client_secret=settings.databricks_client_secret,
            auth_type="oauth-m2m",
        )
        self._cache: Dict[Tuple[str, str], str] = {}

    def get_secret(self, scope: str, key: str) -> str:
        """Fetch secret value from Databricks, caching results per scope/key."""
        if not scope:
            raise ValueError("Secret scope is required to fetch secrets")
        if not key:
            raise ValueError("Secret key name is required to fetch secrets")

        cache_key = (scope, key)
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            secret_response = self._client.secrets.get_secret(scope=scope, key=key)
            value = self._extract_secret_value(secret_response)
            self._cache[cache_key] = value
            return value
        except Exception as e:
            logger.error(f"Failed to retrieve secret '{key}' from scope '{scope}': {e}")
            raise ValueError(
                f"Could not retrieve secret '{key}' from scope '{scope}': {e}"
            )

    @staticmethod
    def _extract_secret_value(secret_response) -> str:
        """Extract the actual secret value from the SDK response object."""
        if hasattr(secret_response, "value"):
            val = secret_response.value
            if isinstance(val, str):
                # Try to decode as base64 first (Databricks often stores secrets base64-encoded)
                try:
                    decoded = base64.b64decode(val).decode("utf-8")
                    return decoded
                except Exception:
                    # Not base64 encoded, return as-is
                    return val
            if isinstance(val, bytes):
                return val.decode("utf-8")

        if isinstance(secret_response, dict) and "value" in secret_response:
            val = secret_response["value"]
            if isinstance(val, str):
                try:
                    decoded = base64.b64decode(val).decode("utf-8")
                    return decoded
                except Exception:
                    return val
            if isinstance(val, bytes):
                return val.decode("utf-8")

        raise ValueError(f"Unexpected secret response format: {type(secret_response)}")
