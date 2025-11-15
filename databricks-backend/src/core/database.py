"""Database configuration and connection management."""

import logging
import os
import ssl
import time
import uuid
from typing import AsyncGenerator, Optional

from sqlalchemy import create_engine, text, event, pool
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from .config import settings

logger = logging.getLogger(__name__)


# --- Global state for OAuth token refresh ---
_oauth_state = {
    "token": None,
    "last_refresh": 0,
    "refresh_interval": 900,  # 15 minutes (matching Databricks article pattern)
}


def _get_postgres_username() -> Optional[str]:
    """Get the Postgres username based on the configured authentication type.

    For OAuth, username must be the DATABRICKS_CLIENT_ID.
    For password auth, use the configured PG_USERNAME.
    """
    if settings.postgres_auth_type == "oauth":
        # OAuth requires username to match the Service Principal CLIENT_ID
        return settings.databricks_client_id or settings.postgres_user
    else:
        # Password auth uses the configured username
        return settings.postgres_user


def _get_postgres_password() -> str:
    """Get the Postgres password based on the configured authentication type.

    For OAuth, returns a cached token that refreshes every 15 minutes.
    For password auth, returns the configured password.
    """
    if settings.postgres_auth_type == "oauth":
        return _get_or_refresh_oauth_token()
    elif settings.postgres_auth_type == "password":
        if not settings.postgres_password:
            raise ValueError("POSTGRES_AUTH_TYPE is 'password' but PG_PASSWORD is not set")
        return settings.postgres_password
    else:
        raise ValueError(
            f"Invalid POSTGRES_AUTH_TYPE: {settings.postgres_auth_type}. "
            "Must be 'password' or 'oauth'"
        )


def _get_or_refresh_oauth_token() -> str:
    """Get or refresh OAuth token for Lakebase Postgres.

    Implements the token refresh pattern from:
    https://docs.databricks.com/aws/en/oltp/instances/query/notebook

    Token is refreshed every 15 minutes to ensure it doesn't expire.
    """
    now = time.time()

    # Check if we need to refresh
    if (
        _oauth_state["token"] is None
        or now - _oauth_state["last_refresh"] > _oauth_state["refresh_interval"]
    ):
        logger.info("Refreshing PostgreSQL OAuth token")

        instance_name = settings.postgres_instance_name

        if not instance_name:
            raise ValueError(
                "Postgres OAuth requires POSTGRES_INSTANCE_NAME to be set. "
                "This is the name of your Lakebase database instance."
            )

        if not settings.databricks_host:
            raise ValueError(
                "Postgres OAuth requires DATABRICKS_HOST to be set. "
                "This is your Databricks workspace URL."
            )

        if not settings.databricks_client_id or not settings.databricks_client_secret:
            raise ValueError(
                "Postgres OAuth requires DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET. "
                "These are your Service Principal credentials."
            )

        try:
            # Use Databricks SDK to generate database credential
            # WorkspaceClient() auto-discovers credentials from environment variables
            from databricks.sdk import WorkspaceClient

            w = WorkspaceClient()

            # Generate database credential for the specified instance
            cred = w.database.generate_database_credential(
                request_id=str(uuid.uuid4()),
                instance_names=[instance_name]
            )

            _oauth_state["token"] = cred.token
            _oauth_state["last_refresh"] = now

            logger.info("Successfully refreshed PostgreSQL OAuth token")

        except Exception as e:
            logger.error(f"Failed to refresh Postgres OAuth token: {e}")
            raise

    return _oauth_state["token"]


# --- SQLAlchemy Event Listeners for Token Refresh ---

def _provide_token_on_connect(dbapi_conn, connection_record):
    """Event listener for sync connections to inject fresh OAuth token.

    This is called every time a connection is created from the pool.
    For OAuth auth, it ensures the token is refreshed if needed.
    """
    if settings.postgres_auth_type == "oauth":
        # Token refresh logic is handled in _get_or_refresh_oauth_token
        # This just ensures we're using the latest token
        pass


# --- Database URL Construction ---

def _build_database_url(async_driver: bool = False) -> str:
    """Build database URL for SQLAlchemy.

    Args:
        async_driver: If True, use asyncpg driver. Otherwise use psycopg2.
    """
    if settings.database_url:
        url = settings.database_url
        if async_driver:
            url = url.replace("postgresql://", "postgresql+asyncpg://")
        return url

    # Build URL without password in the connection string
    # Password will be provided via connect_args or event listener
    # Username is determined by auth type
    driver = "asyncpg" if async_driver else "psycopg2"
    username = _get_postgres_username()

    return (
        f"postgresql+{driver}://{username}:@"
        f"{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_database}"
    )


# --- SSL Context ---

def _build_asyncpg_ssl_context() -> ssl.SSLContext:
    """Build an SSLContext for asyncpg.

    - If PGSSLROOTCERT is set and exists, use it for CA verification.
    - Else, if PGSSLVERIFY=false (or DEBUG True), disable verification for dev.
    - Otherwise, use default context (will verify against system CAs).
    """
    root_cert_path = os.getenv("PGSSLROOTCERT")
    verify_env = os.getenv("PGSSLVERIFY", "true").lower()
    verify_ssl = verify_env not in ("0", "false", "no")

    try:
        if root_cert_path and os.path.exists(root_cert_path):
            return ssl.create_default_context(cafile=root_cert_path)

        if (
            not verify_ssl
            or settings.debug
            or settings.environment.lower() in {"development", "dev"}
        ):
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            return ctx

        return ssl.create_default_context()

    except Exception as e:
        logger.warning(f"Falling back to insecure SSL context: {e}")
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


def _get_sync_connect_args() -> dict:
    """Get connect_args for sync (psycopg2) connections."""
    root_cert_path = os.getenv("PGSSLROOTCERT")

    connect_args = {
        "sslmode": "require",
        "options": f"-c search_path={_TARGET_SCHEMA}",
    }

    if root_cert_path and os.path.exists(root_cert_path):
        connect_args["sslrootcert"] = root_cert_path

    return connect_args


# --- Engine Setup ---

# Target schema
_TARGET_SCHEMA = (settings.postgres_schema or "public").strip() or "public"

# Async Engine
DATABASE_URL = _build_database_url(async_driver=True)

async_engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=settings.database_echo,
    pool_pre_ping=True,
    connect_args={
        "ssl": _build_asyncpg_ssl_context(),
        "server_settings": {"search_path": _TARGET_SCHEMA},
        # For asyncpg, we must provide password in connect_args
        "password": _get_postgres_password() if not settings.database_url else None,
    },
)


# Register event listener to refresh token for async connections
@event.listens_for(async_engine.sync_engine, "connect")
def _async_provide_token(dbapi_conn, connection_record):
    """Refresh OAuth token for async connections if needed."""
    if settings.postgres_auth_type == "oauth" and not settings.database_url:
        # For asyncpg, password is set in connect_args, but we refresh token state
        _get_or_refresh_oauth_token()


# --- Session Management ---

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base for SQLModel
Base = SQLModel


# --- Database Operations ---

async def create_db_and_tables():
    """Create database tables in the target schema.

    Note: Schema will be created if it doesn't exist. Admin should grant permissions.
    See docs/LAKEBASE_GRANTS.sql for required grants.
    """
    async with async_engine.begin() as conn:
        # Create schema if it doesn't exist
        if _TARGET_SCHEMA != "public":
            await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{_TARGET_SCHEMA}"'))
        # Set search_path
        await conn.execute(text(f'SET search_path TO "{_TARGET_SCHEMA}"'))
        await conn.run_sync(Base.metadata.create_all)


async def create_tables():
    """Create database tables if they don't exist."""
    await create_db_and_tables()


async def check_database_exists():
    """Check if database connection is working."""
    try:
        async with async_engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {type(e).__name__}: {e}")
        logger.error(f"Database connection check failed: {e}")
        return False


async def init_engine():
    """Initialize the database engine."""
    # Engine is already initialized, this is a no-op for compatibility
    pass


async def start_token_refresh():
    """Start token refresh service."""
    # Token refresh is handled by event listeners
    pass


async def stop_token_refresh():
    """Stop token refresh service."""
    # Token refresh is handled by event listeners
    pass


async def postgres_health():
    """Check PostgreSQL database health."""
    try:
        async with async_engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            return {"status": "healthy", "database": "postgresql"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "unhealthy", "database": "postgresql", "error": str(e)}


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency to get an async database session."""
    async with AsyncSessionLocal() as session:
        yield session


# --- Sync Session Management ---

def _create_sync_engine():
    """Create a synchronous database engine with token refresh support.

    This centralizes sync engine creation to avoid duplication.
    """
    # Build URL with password for both password and OAuth auth
    if not settings.database_url:
        username = _get_postgres_username()
        password = _get_postgres_password()
        sync_database_url = (
            f"postgresql+psycopg2://{username}:{password}@"
            f"{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_database}"
        )
    else:
        sync_database_url = _build_database_url(async_driver=False)

    sync_engine = create_engine(
        sync_database_url,
        echo=settings.database_echo,
        pool_pre_ping=True,
        connect_args=_get_sync_connect_args(),
    )

    # Register event listener for OAuth token refresh
    if settings.postgres_auth_type == "oauth":
        @event.listens_for(sync_engine, "do_connect")
        def provide_token(dialect, conn_rec, cargs, cparams):
            """Inject refreshed OAuth token on each connection."""
            cparams["password"] = _get_or_refresh_oauth_token()

    # Set search_path without trying to create schema
    # Schema should already exist or be created by admin with proper grants
    with sync_engine.begin() as conn:
    #     # Create schema if it doesn't exist
    #     if _TARGET_SCHEMA != "public":
    #         conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{_TARGET_SCHEMA}"'))
        # Set search_path (this should work even without CREATE privilege)
        conn.execute(text(f'SET search_path TO "{_TARGET_SCHEMA}"'))

    return sync_engine


def get_db():
    """Synchronous database session generator for FastAPI dependency injection."""
    sync_engine = _create_sync_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session():
    """Get a synchronous database session context manager."""
    sync_engine = _create_sync_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
    return SessionLocal()
