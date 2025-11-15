"""Main application file for the Nexa Databricks API.

This file initializes the FastAPI application, configures middleware, sets up logging,
and includes the API routers.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

# Load environment variables from .env file
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass  # dotenv not installed

import structlog
import time
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError, TimeoutError

from .middleware import RequestResponseLoggingMiddleware

from .api.v1 import api_v1_router
from .core.config import settings
from .core.database import (
    create_tables,
    check_database_exists,
    init_engine,
    start_token_refresh,
    stop_token_refresh,
    postgres_health,
)
from sqlmodel import SQLModel
from .core.logging import configure_logging
from .middleware.error_handlers import setup_error_handlers
from .middleware.request_id import RequestIdMiddleware
from .services.background.jobs_background_sync import JobsBackgroundSyncService
from .services.background.pipeline_background_sync import (
    pipeline_background_sync_service,
)
from .services.background.metadata_background_sync import (
    MetadataBackgroundSyncService,
)

# Configure logging
configure_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan - initialize database and background services."""
    app.state.background_sync_service = None
    app.state.pipeline_background_sync_service = pipeline_background_sync_service
    app.state.metadata_sync_service = None

    is_testing = os.getenv("TESTING", "").lower() == "true"

    if is_testing:
        logger.info(
            "Test mode detected: skipping DB init and background services startup"
        )
    else:
        logger.info("Application startup initiated")

        # Log PostgreSQL configuration for debugging
        logger.info(
            "PostgreSQL Configuration",
            auth_type=settings.postgres_auth_type,
            use_postgres=settings.use_postgres,
            host=settings.postgres_host[:50] if settings.postgres_host else None,
            database=settings.postgres_database,
            schema=settings.postgres_schema,
            username=settings.postgres_user,
            has_password=bool(settings.postgres_password),
            password=settings.postgres_password[:4] + "****"
        )

        # Check if database exists before initializing
        database_exists = await check_database_exists()
        print(f"Database exists: {database_exists}")

        if database_exists and settings.use_postgres:
            try:
                await init_engine()
                from .core.database import async_engine

                async with async_engine.begin() as conn:
                    await conn.run_sync(SQLModel.metadata.create_all)
                await start_token_refresh()

                # Start database health monitoring
                import asyncio

                async def check_database_health_task():
                    while True:
                        try:
                            is_healthy = await postgres_health()
                            if not is_healthy:
                                logger.warning("Database health check failed")
                        except Exception as e:
                            logger.error(f"Exception during health check: {e}")
                        await asyncio.sleep(300)  # Check every 5 minutes

                _health_check_task = asyncio.create_task(check_database_health_task())
                logger.info(
                    "PostgreSQL database engine initialized and health monitoring started"
                )
            except Exception as e:
                logger.error(f"Failed to initialize PostgreSQL database engine: {e}")
                logger.info("Application will start without PostgreSQL functionality")
        elif not settings.use_postgres:
            # Use SQLite
            await create_tables()
            logger.info("SQLite database tables created")
        else:
            logger.info(
                "No PostgreSQL database instance found - starting with limited functionality"
            )

        # Start background sync services (conditional)
        if settings.enable_jobs_background_sync:
            app.state.background_sync_service = JobsBackgroundSyncService(
                sync_interval=settings.background_sync_interval
            )
            await app.state.background_sync_service.start()
            logger.info(
                "Jobs background sync service started",
                interval_seconds=settings.background_sync_interval,
            )
        else:
            logger.info("Jobs background sync service disabled via settings")

        if settings.enable_pipeline_background_sync:
            await pipeline_background_sync_service.start()
            logger.info(
                "Pipeline background sync service started",
                interval_seconds=pipeline_background_sync_service.sync_interval,
            )
        else:
            logger.info("Pipeline background sync service disabled via settings")

        if settings.enable_metadata_background_sync:
            # Start metadata background sync service
            app.state.metadata_sync_service = MetadataBackgroundSyncService(
                sync_interval=settings.metadata_sync_interval
            )
            await app.state.metadata_sync_service.start()
            logger.info(
                "Metadata background sync service started",
                interval_seconds=settings.metadata_sync_interval,
            )
        else:
            logger.info("Metadata background sync service disabled via settings")

        # Optional: DBU usage background sync
        if settings.enable_usage_background_sync:
            try:
                from .services.background.usage_background_sync import (
                    dbu_background_sync_service,
                )

                await dbu_background_sync_service.start()
                logger.info(
                    "Usage (DBU) background sync service started",
                    interval_seconds=settings.background_sync_interval,
                )
            except Exception as e:
                logger.error(f"Failed to start usage background sync service: {e}")
        else:
            logger.info("Usage (DBU) background sync service disabled via settings")

        # Set global reference for API endpoints
        global _metadata_sync_service
        _metadata_sync_service = app.state.metadata_sync_service
        from .services.background import metadata_background_sync

        metadata_background_sync.metadata_sync_service = app.state.metadata_sync_service

        logger.info("Application startup complete")

    yield

    # Clean shutdown (only if started)
    logger.info("Application shutdown initiated")

    if (
        not is_testing
        and getattr(settings, "enable_jobs_background_sync", True)
        and app.state.background_sync_service
    ):
        await app.state.background_sync_service.stop()
        logger.info("Jobs background sync service stopped")

    if (
        not is_testing
        and getattr(settings, "enable_pipeline_background_sync", True)
        and pipeline_background_sync_service.is_running
    ):
        await pipeline_background_sync_service.stop()
        logger.info("Pipeline background sync service stopped")

    if (
        not is_testing
        and getattr(settings, "enable_metadata_background_sync", True)
        and app.state.metadata_sync_service
    ):
        await app.state.metadata_sync_service.stop()
        logger.info("Metadata background sync service stopped")

    if not is_testing and getattr(settings, "enable_usage_background_sync", False):
        try:
            from .services.background.usage_background_sync import (
                dbu_background_sync_service,
            )

            if dbu_background_sync_service.is_running:
                await dbu_background_sync_service.stop()
                logger.info("Usage (DBU) background sync service stopped")
        except Exception as e:
            logger.error(f"Failed to stop usage background sync service: {e}")

    # Stop PostgreSQL token refresh if it was started
    if not is_testing and settings.use_postgres:
        try:
            await stop_token_refresh()
            logger.info("PostgreSQL token refresh stopped")
        except Exception as e:
            logger.error(f"Error stopping token refresh: {e}")

    logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="Nexa Databricks Platform API providing unified API for Catalog operations, Ingestion and Pipeline orchestration, data lineage tracking, SQL execution, and automated deployment capabilities across environments",
    version=settings.app_version,
    lifespan=lifespan,
    debug=settings.debug,
)


# PostgreSQL/Database specific exception handlers
@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Database error occurred. Please try again later."},
    )


@app.exception_handler(OperationalError)
async def operational_error_handler(request: Request, exc: OperationalError):
    logger.error(
        f"Database connection error on {request.method} {request.url.path}: {exc}"
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database temporarily unavailable. Please try again later."},
    )


@app.exception_handler(TimeoutError)
async def timeout_error_handler(request: Request, exc: TimeoutError):
    logger.error(f"Database timeout on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=504, content={"detail": "Request timed out. Please try again."}
    )


# Performance monitoring middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    logger.info(
        f"Request: {request.method} {request.url.path} - {process_time * 1000:.1f}ms"
    )
    return response


# Add Request ID middleware first
app.add_middleware(RequestIdMiddleware)

# Set up security middleware and error handlers
# Log every request/response (with redaction/truncation)
app.add_middleware(RequestResponseLoggingMiddleware)

setup_error_handlers(app)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router only
app.include_router(api_v1_router)


@app.get("/health")
async def health_check(request: Request):
    """Health check endpoint."""
    # Check database status
    database_status = "disabled"
    if settings.use_postgres:
        try:
            is_healthy = await postgres_health()
            database_status = "healthy" if is_healthy else "unhealthy"
        except Exception:
            database_status = "unhealthy"
    else:
        database_status = "sqlite"

    # Check background services status - only check enabled services
    background_sync_status = "disabled"
    pipeline_sync_status = "disabled"

    # Check background services status
    try:
        bg_service = getattr(request.app.state, "background_sync_service", None)
        background_sync_status = (
            "running" if bg_service and bg_service.is_running else "stopped"
        )
    except Exception:
        background_sync_status = "stopped"

    try:
        pipeline_service = getattr(
            request.app.state, "pipeline_background_sync_service", None
        )
        pipeline_sync_status = (
            "running" if pipeline_service and pipeline_service.is_running else "stopped"
        )
    except Exception:
        pipeline_sync_status = "stopped"

    # Overall status is healthy if all services are running
    enabled_services_healthy = True
    if settings.use_postgres and database_status != "healthy":
        enabled_services_healthy = False
    if background_sync_status != "running":
        enabled_services_healthy = False
    if pipeline_sync_status != "running":
        enabled_services_healthy = False

    overall_status = "healthy" if enabled_services_healthy else "degraded"

    return {
        "status": overall_status,
        "platform": "databricks",
        "version": settings.app_version,
        "database": {
            "type": "postgresql" if settings.use_postgres else "sqlite",
            "status": database_status,
        },
        "services": {
            "background_sync": background_sync_status,
            "pipeline_sync": pipeline_sync_status,
        },
    }


def get_background_sync_service(
    request: Request,
) -> Optional[JobsBackgroundSyncService]:
    """Get the background sync service instance from the app state."""
    return getattr(request.app.state, "background_sync_service", None)


def get_pipeline_background_sync_service(request: Request):
    """Get the pipeline background sync service instance from the app state."""
    return getattr(request.app.state, "pipeline_background_sync_service", None)


@app.get("/background-sync/status")
async def background_sync_status(
    background_sync_service: Optional[JobsBackgroundSyncService] = Depends(
        get_background_sync_service
    ),
):
    """Get background sync service status."""
    if not background_sync_service:
        return {
            "enabled": False,
            "status": "disabled",
            "message": "Background sync service is not configured",
        }

    return {
        "enabled": True,
        "status": "running" if background_sync_service.is_running else "stopped",
        "sync_interval": background_sync_service.sync_interval,
        "has_task": background_sync_service.task is not None,
    }


@app.get("/pipeline-sync/status")
async def pipeline_sync_status(
    pipeline_sync_service=Depends(get_pipeline_background_sync_service),
):
    """Get pipeline background sync service status."""
    if not pipeline_sync_service:
        return {
            "enabled": False,
            "status": "disabled",
            "message": "Pipeline background sync service is not configured",
        }

    return {
        "enabled": True,
        "status": "running" if pipeline_sync_service.is_running else "stopped",
        "sync_interval": pipeline_sync_service.sync_interval,
        "has_task": pipeline_sync_service.task is not None,
    }


@app.get("/info")
async def app_info():
    """Get application information and configuration."""
    return {
        "app_name": settings.app_name,
        "version": settings.app_version,
        "platform": "databricks",
        "deployment_mode": settings.deployment_mode,
        "limits": {
            "max_concurrent_deployments": settings.max_concurrent_deployments,
            "deployment_timeout_minutes": settings.deployment_timeout_minutes,
        },
        "git": {
            "provider": settings.git_provider,
            "enforce_branch_policies": settings.enforce_branch_policies,
        },
    }


# ============================================================================
# SERVE STATIC FILES FROM CLIENT BUILD DIRECTORY (MUST BE LAST!)
# ============================================================================
# This static file mount MUST be the last route registered!
# It catches all unmatched requests and serves the React app.
# Skip static mounting in development mode to avoid conflicts with /docs
is_development = os.getenv("ENVIRONMENT", "development").lower() in [
    "development",
    "dev",
]
client_build_dir = Path("client") / "build"

if client_build_dir.exists() and not is_development:
    logger.info(f"Mounting static files from {client_build_dir}")
    app.mount(
        "/", StaticFiles(directory=str(client_build_dir), html=True), name="static"
    )
else:
    if is_development:
        logger.info(
            "Development mode: Skipping static files mount to preserve API docs access"
        )
    else:
        logger.info(
            "Client build directory not found; static files not mounted - /docs endpoint available"
        )
