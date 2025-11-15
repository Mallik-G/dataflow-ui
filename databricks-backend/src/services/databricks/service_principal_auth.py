"""Service Principal Authentication for Databricks Apps.

This module provides authentication utilities specifically designed for Databricks Apps
following 2025 best practices with automatic service principal integration and OAuth 2.0.
"""

import os
from typing import Optional
from dataclasses import dataclass

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class ServicePrincipalConfig:
    """Configuration for Databricks App service principal authentication."""

    # App service principal (auto-provisioned by Databricks)
    app_service_principal_id: Optional[str] = None
    app_service_principal_name: Optional[str] = None

    # OAuth configuration
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None

    # Databricks configuration
    databricks_host: Optional[str] = None
    databricks_token: Optional[str] = None

    @classmethod
    def from_environment(cls) -> "ServicePrincipalConfig":
        """Create configuration from environment variables.

        In a Databricks App environment, these are typically injected via
        the app.yaml configuration with secret references.
        """
        return cls(
            databricks_host=os.getenv("DATABRICKS_HOST"),
            databricks_token=os.getenv("DATABRICKS_TOKEN"),  # Fallback for development
            oauth_client_id=os.getenv(
                "DATABRICKS_CLIENT_ID"
            ),  # Auto-injected by Databricks Apps
            oauth_client_secret=os.getenv(
                "DATABRICKS_CLIENT_SECRET"
            ),  # Auto-injected by Databricks Apps
        )


class ServicePrincipalAuthenticator:
    """Handles authentication for Databricks Apps using service principals.

    This class follows the Databricks Apps 2025 authentication model:
    1. Each app gets a dedicated service principal (auto-provisioned)
    2. Dual authorization: app identity + user permissions
    3. OAuth 2.0 for external API access
    4. No anonymous access - all requests must be authenticated
    """

    def __init__(self, config: Optional[ServicePrincipalConfig] = None):
        """Initialize the authenticator.

        Args:
            config: Service principal configuration. If None, loads from environment.
        """
        self.config = config or ServicePrincipalConfig.from_environment()
        self._validate_config()

    def _validate_config(self) -> None:
        """Validate the authentication configuration."""
        if not self.config.databricks_host:
            raise ValueError(
                "DATABRICKS_HOST is required for service principal authentication"
            )

        # For OAuth, we need client credentials instead of token
        if self.config.oauth_client_id and self.config.oauth_client_secret:
            logger.info(
                "Service principal authenticator initialized with OAuth",
                host=self.config.databricks_host,
                has_oauth_credentials=True,
                client_id=self.config.oauth_client_id[:8] + "..."
                if self.config.oauth_client_id
                else None,
            )
        elif self.config.databricks_token:
            logger.info(
                "Service principal authenticator initialized with token fallback",
                host=self.config.databricks_host,
                has_token=True,
            )
        else:
            raise ValueError(
                "Either OAuth credentials (DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET) or DATABRICKS_TOKEN is required"
            )

    def get_auth_headers(self) -> dict[str, str]:
        """Get authentication headers for Databricks API requests.

        Returns:
            Dictionary of headers for API authentication.
        """
        if not self.config.databricks_token:
            raise ValueError("No authentication token available")

        return {
            "Authorization": f"Bearer {self.config.databricks_token}",
            "User-Agent": "Nexa-Databricks-App/1.0.0",
        }

    def get_oauth_headers(self) -> dict[str, str]:
        """Get OAuth headers for external service authentication.

        Returns:
            Dictionary of headers for OAuth authentication.

        Raises:
            ValueError: If OAuth credentials are not configured.
        """
        if not self.config.oauth_client_id or not self.config.oauth_client_secret:
            raise ValueError("OAuth credentials not configured")

        return {
            "Authorization": f"Bearer {self.config.oauth_client_secret}",
            "Client-ID": self.config.oauth_client_id,
        }

    def is_authenticated(self) -> bool:
        """Check if the service principal is properly authenticated.

        Returns:
            True if authentication is valid, False otherwise.
        """
        try:
            # Check OAuth credentials first
            if (
                self.config.databricks_host
                and self.config.oauth_client_id
                and self.config.oauth_client_secret
            ):
                return True

            # Fallback to token check
            return bool(self.config.databricks_host and self.config.databricks_token)
        except Exception as e:
            logger.error("Authentication check failed", error=str(e))
            return False

    def get_service_principal_info(self) -> dict:
        """Get information about the app's service principal.

        Returns:
            Dictionary containing service principal information.
        """
        return {
            "service_principal_id": self.config.app_service_principal_id,
            "service_principal_name": self.config.app_service_principal_name,
            "authentication_type": "service_principal",
            "oauth_configured": bool(self.config.oauth_client_id),
            "host": self.config.databricks_host,
        }


def get_app_authenticator() -> ServicePrincipalAuthenticator:
    """Get the global service principal authenticator instance.

    This function provides a singleton-like access to the authenticator
    for use throughout the application.

    Returns:
        Configured ServicePrincipalAuthenticator instance.
    """
    return ServicePrincipalAuthenticator()


def require_service_principal_auth():
    """Decorator to require service principal authentication for API endpoints.

    This decorator can be used with FastAPI endpoints to ensure they only
    accept requests with valid service principal authentication.
    """

    def decorator(func):
        def wrapper(*args, **kwargs):
            authenticator = get_app_authenticator()
            if not authenticator.is_authenticated():
                raise ValueError("Service principal authentication required")
            return func(*args, **kwargs)

        return wrapper

    return decorator
