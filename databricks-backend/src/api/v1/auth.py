"""Authentication endpoints for Databricks service principal OAuth flow."""

import asyncio
import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ...core.config import settings
from ...services.databricks.oauth_token_manager import OAuthTokenManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class TokenResponse(BaseModel):
    """Response model for token generation."""

    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    workspace: str


class AuthStatusResponse(BaseModel):
    """Response model for authentication status."""

    authenticated: bool
    auth_type: str
    workspace: str
    client_id: str


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Generate OAuth Access Token",
    description="Generate a new OAuth access token using service principal credentials",
)
async def generate_token() -> TokenResponse:
    """Generate a new OAuth access token for Databricks API access.

    This endpoint uses the service principal credentials configured in the application
    settings to generate a fresh OAuth access token that can be used for API calls.

    Returns:
        TokenResponse: Contains the access token and metadata

    Raises:
        HTTPException: If token generation fails
    """
    try:
        if not settings.databricks_client_id or not settings.databricks_client_secret:
            raise ValueError("Service principal credentials not configured")

        if not settings.databricks_host:
            raise ValueError("Databricks host not configured")

        # Option 1: Use SDK's internal OAuth token (recommended by Databricks)
        # The SDK manages tokens automatically with proper caching and refresh
        try:
            from databricks.sdk import WorkspaceClient
            from databricks.sdk.credentials_provider import CredentialsStrategy

            # Initialize SDK with OAuth M2M
            sdk_client = WorkspaceClient(
                host=str(settings.databricks_host),
                client_id=settings.databricks_client_id,
                client_secret=settings.databricks_client_secret,
                auth_type="oauth-m2m"
            )

            # Access the token from SDK's credentials provider
            # The SDK will handle token acquisition and caching
            def get_token():
                credentials = sdk_client.config.authenticate()
                if hasattr(credentials, 'token') and callable(credentials.token):
                    return credentials.token()
                elif hasattr(credentials, 'access_token'):
                    return credentials.access_token
                else:
                    # Fallback: trigger auth by making a lightweight API call
                    sdk_client.current_user.me()
                    # Try to extract token again
                    if hasattr(sdk_client.config, '_header_factory'):
                        headers = sdk_client.config._header_factory()
                        auth_header = headers.get('Authorization', '')
                        if auth_header.startswith('Bearer '):
                            return auth_header[7:]
                    raise ValueError("Could not extract token from SDK")

            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            access_token = await loop.run_in_executor(None, get_token)

            expires_in = 3600  # Standard OAuth M2M token expiry

            return TokenResponse(
                access_token=access_token,
                expires_in=expires_in,
                workspace=str(settings.databricks_host),
            )

        except Exception as sdk_error:
            logger.warning(f"SDK token extraction failed: {sdk_error}. Falling back to direct OAuth call.")

            # Option 2: Fallback to direct OAuth token manager (bypasses SDK)
            token_manager = OAuthTokenManager(
                host=str(settings.databricks_host),
                client_id=settings.databricks_client_id,
                client_secret=settings.databricks_client_secret,
            )

            access_token = await token_manager.get_access_token()

            # Get the cached token object for expiry info
            cached_token = token_manager._cached_token
            expires_in = 3600  # Default 1 hour
            if cached_token and cached_token.expires_at:
                from datetime import datetime, timezone
                expires_in = int((cached_token.expires_at - datetime.now(timezone.utc)).total_seconds())

            return TokenResponse(
                access_token=access_token,
                expires_in=expires_in,
                workspace=str(settings.databricks_host),
            )

    except Exception as e:
        logger.error(f"Failed to generate access token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate access token: {str(e)}",
        )


@router.get(
    "/status",
    response_model=AuthStatusResponse,
    summary="Get Authentication Status",
    description="Get the current authentication configuration status",
)
async def auth_status() -> AuthStatusResponse:
    """Get the current authentication configuration status.

    Returns:
        AuthStatusResponse: Current authentication configuration
    """
    return AuthStatusResponse(
        authenticated=bool(
            settings.databricks_host
            and settings.databricks_client_id
            and settings.databricks_client_secret
        ),
        auth_type=settings.databricks_auth_type,
        workspace=str(settings.databricks_host)
        if settings.databricks_host
        else "not configured",
        client_id=settings.databricks_client_id or "not configured",
    )


@router.get(
    "/debug",
    summary="Debug Configuration",
    description="Debug endpoint to check loaded configuration values",
)
async def debug_config():
    """Debug endpoint to check what configuration values are loaded."""
    import os

    return {
        "env_vars": {
            "DATABRICKS_HOST": os.getenv("DATABRICKS_HOST", "NOT SET"),
            "DATABRICKS_CLIENT_ID": os.getenv("DATABRICKS_CLIENT_ID", "NOT SET"),
            "DATABRICKS_CLIENT_SECRET": "***"
            if os.getenv("DATABRICKS_CLIENT_SECRET")
            else "NOT SET",
            "DATABRICKS_AUTH_TYPE": os.getenv("DATABRICKS_AUTH_TYPE", "NOT SET"),
        },
        "settings_values": {
            "databricks_host": str(settings.databricks_host)
            if settings.databricks_host
            else "None",
            "databricks_client_id": settings.databricks_client_id or "None",
            "databricks_client_secret": "***"
            if settings.databricks_client_secret
            else "None",
            "databricks_auth_type": settings.databricks_auth_type,
        },
    }


def get_databricks_config() -> Dict[str, Any]:
    """Get Databricks configuration for API clients.

    Returns:
        Dict containing the current Databricks configuration
    """
    return {
        "host": str(settings.databricks_host) if settings.databricks_host else None,
        "client_id": settings.databricks_client_id,
        "client_secret": settings.databricks_client_secret,
        "auth_type": settings.databricks_auth_type,
        "warehouse_id": settings.databricks_warehouse_id,
    }
