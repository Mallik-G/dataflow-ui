"""Pydantic-based application configuration settings."""

import base64
from typing import Optional, Union

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Pydantic-based application configuration settings.

    This class centralizes all application configuration. It uses Pydantic's
    `BaseSettings` to automatically read settings from environment variables or a
    `.env` file, ensuring that configuration is type-safe and easily manageable.

    The settings cover various aspects of the application, including database
    connections, Databricks integration, Git provider details, deployment
    parameters, security, and logging.
    """

    # Application
    app_name: str = Field("Nexa Databricks API", alias="APP_NAME")
    app_version: str = Field("1.0.0", alias="APP_VERSION")
    environment: str = Field("development", alias="ENVIRONMENT")
    debug: bool = Field(False, alias="DEBUG")

    # Database
    database_url: Optional[str] = Field(
        None, alias="DATABASE_URL"
    )  # Allow direct DATABASE_URL env var
    database_echo: bool = Field(False, alias="DATABASE_ECHO")
    use_postgres: bool = Field(
        True, alias="USE_POSTGRES"
    )  # Enable PostgreSQL by default

    # PostgreSQL/Lakebase Configuration
    postgres_host: Optional[str] = Field(None, alias="PG_HOST")
    postgres_port: int = Field(5432, alias="PG_PORT")
    postgres_database: str = Field("databricks_postgres", alias="PG_DATABASE")
    postgres_user: Optional[str] = Field(None, alias="PG_USERNAME")
    postgres_password: Optional[str] = Field(None, alias="PG_PASSWORD")

    # PostgreSQL Authentication Type: "password" or "oauth"
    postgres_auth_type: str = Field("password", alias="POSTGRES_AUTH_TYPE")

    # PostgreSQL OAuth Configuration (for Service Principal authentication)
    # When using OAuth, requires POSTGRES_INSTANCE_NAME + the Databricks credentials above
    postgres_instance_name: Optional[str] = Field(None, alias="POSTGRES_INSTANCE_NAME")

    @field_validator("postgres_password", mode="before")
    @classmethod
    def decode_postgres_password(cls, v):
        # If secret reference wasn't resolved by Databricks Apps, we need to resolve it
        if v and v.startswith("{{secrets/") and v.endswith("}}"):
            # This shouldn't happen in Databricks Apps - secrets should be auto-resolved
            # If we get here, it means secret resolution failed
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Secret reference not resolved by Databricks Apps: {v}. "
                "Attempting manual resolution via Databricks SDK"
            )
            # Extract scope and key from {{secrets/scope/key}}
            secret_path = v[10:-2]  # Remove {{secrets/ and }}
            parts = secret_path.split("/")
            if len(parts) == 2:
                scope, key = parts
                try:
                    from databricks.sdk import WorkspaceClient
                    client = WorkspaceClient()
                    secret_response = client.secrets.get_secret(scope=scope, key=key)
                    v = secret_response.value
                    logger.info(f"Successfully resolved secret {scope}/{key} via SDK")
                except Exception as e:
                    logger.error(f"Failed to resolve secret {scope}/{key}: {e}")

        # Try to decode if it's base64 (for local dev), otherwise use as-is
        if v:
            try:
                decoded = base64.b64decode(v).decode("utf-8")
                # Check if decoded value looks like it was actually base64
                if len(decoded) > 0 and all(32 <= ord(c) < 127 for c in decoded):
                    return decoded
            except (ValueError, TypeError, UnicodeDecodeError):
                pass
        return v
    postgres_schema: Optional[str] = Field("nexa_admin", alias="PG_SCHEMA")
    # Databricks Configuration
    databricks_host: Optional[str] = Field(None, alias="DATABRICKS_HOST")
    databricks_client_id: Optional[str] = Field(None, alias="DATABRICKS_CLIENT_ID")
    databricks_client_secret: Optional[str] = Field(
        None, alias="DATABRICKS_CLIENT_SECRET"
    )
    databricks_auth_type: str = Field("service_principal", alias="DATABRICKS_AUTH_TYPE")
    databricks_workspace_id: str = Field("", alias="DATABRICKS_WORKSPACE_ID")

    # Default Databricks settings
    databricks_warehouse_id: str = Field("", alias="DATABRICKS_WAREHOUSE_ID")
    databricks_catalog: str = Field("", alias="DATABRICKS_CATALOG")

    # Background Services
    background_sync_interval: int = 900  # 15 minutes for jobs/pipelines/usage sync
    metadata_sync_interval: int = 3600  # 1 hour for metadata sync
    enable_jobs_background_sync: bool = Field(False, alias="ENABLE_JOBS_BACKGROUND_SYNC")
    enable_pipeline_background_sync: bool = Field(
        False, alias="ENABLE_PIPELINE_BACKGROUND_SYNC"
    )
    enable_metadata_background_sync: bool = Field(
        False, alias="ENABLE_METADATA_BACKGROUND_SYNC"
    )
    enable_usage_background_sync: bool = Field(
        False, alias="ENABLE_USAGE_BACKGROUND_SYNC"
    )

    # Git Configuration
    git_provider: str = "github"
    git_owner: Optional[str] = None
    git_organization: Optional[str] = None
    git_project: Optional[str] = None
    git_base_url: Optional[AnyHttpUrl] = None
    git_branch: Optional[str] = "develop"

    # Branch policies
    enforce_branch_policies: bool = False

    # Databricks Deployment Configuration
    deployment_engine: str = Field(
        "dab",
        alias="DEPLOYMENT_ENGINE",
        description="Deployment engine: 'dab' (Databricks Asset Bundles) or 'imperative' (direct API calls)"
    )
    deployment_job_name: str = "nexa-deployment-job"
    deployment_workspace_path: str = "/Workspace/nexa_deployments"
    deployment_bundle_storage_path: str = Field(
        "/tmp/nexa_bundles",
        alias="DEPLOYMENT_BUNDLE_STORAGE_PATH",
        description="Local path for storing DAB bundle configurations"
    )
    deployment_retry_attempts: int = 3
    deployment_retry_delay_seconds: int = 60
    deployment_mode: str = "serverless"
    max_concurrent_deployments: int = 5
    deployment_timeout_minutes: int = 30

    # Databricks Secret Scope Configuration
    secret_scope: str = "databricks-apps-secrets"
    secret_key_databricks_client_id: str = "DATABRICKS_CLIENT_ID"
    secret_key_databricks_client_secret: str = "DATABRICKS_CLIENT_SECRET"
    secret_key_git_token: str = "GIT_TOKEN"
    secret_key_postgres_username: str = "PG_USERNAME"
    secret_key_postgres_password: str = "PG_PASSWORD"

    # Databricks Job Monitor Settings (added)
    DATABRICKS_JOB_MONITOR_MAX_POLLS: int = 600  # e.g., 600 polls
    DATABRICKS_JOB_MONITOR_POLL_INTERVAL: int = 600  # seconds between polls

    # Databricks-specific deployment settings
    default_spark_version: str = "14.3.x-scala2.12"
    default_node_type: str = "i3.xlarge"

    # Security
    # secret_key: str = "your-secret-key-here"
    # access_token_expire_minutes: int = 30

    # @field_validator("secret_key")
    # @classmethod
    # def check_secret_key(cls, v, info):
    #     # Only enforce in production environments
    #     env = os.getenv("ENVIRONMENT", "development").lower()
    #     if env in ["production", "prod"] and v == "your-secret-key-here":
    #         raise ValueError("SECRET_KEY must be set in production environments")
    #     return v

    # CORS
    cors_origins: list[str] = [
        "http://13.201.135.1:3000", 
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:5173",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, list[str]]):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    # Logging
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # Environment Configuration
    default_environments: list[dict] = [
        {
            "name": "development",
            "display_name": "Development",
            "git_branch": "develop",
            "auto_deploy": True,
            "platform": "databricks",
        },
        {
            "name": "uat",
            "display_name": "User Acceptance Testing",
            "git_branch": "release",
            "auto_deploy": True,
            "platform": "databricks",
        },
        {
            "name": "production",
            "display_name": "Production",
            "git_branch": "main",
            "auto_deploy": False,
            "platform": "databricks",
        },
    ]

    # Design Studio editing policy: which environments allow canvas edits
    editable_environments: list[str] = ["development"]

    @field_validator("databricks_host")
    @classmethod
    def validate_databricks_host(cls, v):
        """Ensure databricks_host has https:// scheme."""
        if v and not v.startswith("http://") and not v.startswith("https://"):
            return f"https://{v}"
        return v

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


# Create settings instance
settings = Settings()  # type: ignore[call-arg]
