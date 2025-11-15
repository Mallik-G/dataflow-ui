#!/usr/bin/env python3
"""
██╗   ██╗███████╗██╗  ██╗ █████╗    ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗
████╗ ██║██╔════╝╚██╗██╔╝██╔══██╗   ██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝
██╔██╗██║█████╗   ╚███╔╝ ███████║   ██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝
██║╚████║██╔══╝   ██╔██╗ ██╔══██║   ██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝
██║ ╚███║███████╗██╔╝ ██╗██║  ██║   ██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║
╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝

Nexa AI - Enterprise Databricks Deployment Engine
Copyright (c) 2024 DataReady AI. All rights reserved.

PROPRIETARY AND CONFIDENTIAL SOFTWARE
This software is the exclusive property of DataReady AI and is protected by copyright
and trade secret laws. Unauthorized copying, distribution, modification, public display,
or public performance of this software is strictly prohibited.

RESTRICTIONS:
• No reverse engineering, decompilation, or disassembly
• No modification or creation of derivative works
• No distribution or transfer without written authorization
• Use only as authorized under your commercial license agreement

SDK-based serverless deployment executor for Databricks jobs.

This enterprise-grade deployment tool is designed to run on Databricks serverless compute.
It connects to PostgreSQL databases, processes deployment queues, and manages the complete
lifecycle of data pipeline deployments with comprehensive logging and error handling.
SUPPORT:
For technical support, contact your assigned DataReady AI account manager or email
enterprise-support@dataready.ai. Include your organization ID and deployment details.

Unauthorized use or distribution will be prosecuted to the full extent of the law.
"""

import argparse
import base64
import logging
import os
import sys
import time
import traceback
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.workspace import ExportFormat
from databricks.sdk.service import pipelines

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

# Deployment timeouts (seconds)
STATEMENT_TIMEOUT = 600  # 10 minutes for SQL statements
PIPELINE_TIMEOUT = 1800  # 30 minutes for pipeline updates
DB_QUERY_TIMEOUT = 30  # 30 seconds for DB queries
CONNECTION_RETRY_MAX = 3  # Max retries for connections
CONNECTION_RETRY_DELAY = 5  # Seconds between retries


# ============================================================================
# ENUMS & DATA CLASSES
# ============================================================================


class DeploymentStatus(str, Enum):
    """Deployment status values matching database schema."""

    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    IN_PROGRESS = "in_progress"


class FileType(str, Enum):
    """Supported file types for deployment."""

    DDL = "ddl"
    PIPELINE = "pipeline"
    OTHER = "other"


@dataclass
class DeploymentFile:
    """Strongly-typed deployment file representation."""

    id: str
    deployment_id: str
    file_path: str
    file_type: str
    git_status: str
    execution_order: int
    deployment_status: str
    platform_object_id: Optional[str] = None
    error_message: Optional[str] = None
    deployed_at: Optional[datetime] = None

    def __post_init__(self):
        """Validate required fields."""
        if not self.file_path:
            raise ValueError(f"File path is required for deployment detail {self.id}")
        if self.file_type not in [
            FileType.DDL.value,
            FileType.PIPELINE.value,
            FileType.OTHER.value,
        ]:
            raise ValueError(f"Invalid file type: {self.file_type}")


@dataclass
class DeploymentMetrics:
    """Track deployment metrics for reporting."""

    total_files: int = 0
    success_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    start_time: float = field(default_factory=time.time)

    @property
    def elapsed_time(self) -> float:
        return time.time() - self.start_time

    @property
    def success_rate(self) -> float:
        if self.total_files == 0:
            return 0.0
        return (self.success_count / self.total_files) * 100


# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================


class ColoredFormatter(logging.Formatter):
    """Enhanced formatter with colors and better context."""

    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{color}{record.levelname}{self.RESET}"

        # Add context information if available
        if hasattr(record, "deployment_id"):
            record.msg = f"[Deploy:{record.deployment_id}] {record.msg}"
        if hasattr(record, "file_path"):
            record.msg = f"[{record.file_path}] {record.msg}"

        return super().format(record)


def setup_logging(
    log_level: str = "INFO", log_file: Optional[str] = None
) -> logging.Logger:
    """Configure logging with file and console handlers."""
    logger = logging.getLogger("nexa-deploy")
    logger.setLevel(getattr(logging, log_level.upper()))
    logger.handlers.clear()

    # Disable root logger to prevent double logging in Databricks
    logging.getLogger().handlers.clear()
    logging.getLogger().setLevel(logging.CRITICAL)

    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_formatter = ColoredFormatter(
        "[%(asctime)s] %(levelname)s | %(message)s", datefmt="%H:%M:%S"
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # File handler (if specified)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    # Prevent propagation to root logger
    logger.propagate = False

    return logger


logger = setup_logging()


# ============================================================================
# UTILITY FUNCTIONS & CONTEXT MANAGERS
# ============================================================================


@contextmanager
def log_context(operation: str, **context_vars):
    """Context manager for logging operation start/end with timing."""
    start = time.time()
    context_str = " | ".join(f"{k}={v}" for k, v in context_vars.items())
    logger.info(f"▶️  Starting: {operation} | {context_str}")

    try:
        yield
        elapsed = time.time() - start
        logger.info(f"✅ Completed: {operation} | Duration: {elapsed:.2f}s")
    except Exception as e:
        elapsed = time.time() - start
        logger.error(
            f"❌ Failed: {operation} | Duration: {elapsed:.2f}s | Error: {str(e)}"
        )
        raise


def retry_with_backoff(
    max_attempts: int = 3, initial_delay: float = 1.0, backoff_factor: float = 2.0
):
    """Decorator for retrying functions with exponential backoff."""

    def decorator(func):
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt == max_attempts:
                        logger.error(
                            f"Failed after {max_attempts} attempts: {func.__name__}"
                        )
                        raise

                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}: {str(e)}. "
                        f"Retrying in {delay:.1f}s..."
                    )
                    time.sleep(delay)
                    delay *= backoff_factor

            raise last_exception

        return wrapper

    return decorator


def safe_dict_get(
    data: Dict, key: str, default: Any = None, required: bool = False
) -> Any:
    """Safely get value from dict with validation."""
    value = data.get(key, default)
    if required and value is None:
        raise ValueError(f"Required key '{key}' not found in data: {data}")
    return value


# ============================================================================
# DATABASE CONNECTION MANAGER
# ============================================================================


class DatabaseManager:
    """Manages PostgreSQL connections with pooling and error handling."""

    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        username: str,
        password: str,
        schema: str = "nexa_admin",
        ssl_root_cert: Optional[str] = None,
    ):
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self.schema = schema
        self.ssl_root_cert = ssl_root_cert
        self._connection = None

    @retry_with_backoff(max_attempts=CONNECTION_RETRY_MAX)
    def get_connection(self):
        """Get or create database connection with retry logic."""
        if self._connection is None or self._connection.closed:
            connect_kwargs = {
                "host": self.host,
                "port": self.port,
                "dbname": self.database,
                "user": self.username,
                "password": self.password,
                "sslmode": "require",
                "connect_timeout": DB_QUERY_TIMEOUT,
                "options": f"-c search_path={self.schema}",
            }

            if self.ssl_root_cert:
                connect_kwargs["sslrootcert"] = self.ssl_root_cert

            logger.debug(
                f"Connecting to PostgreSQL: {self.host}:{self.port}/{self.database} (schema: {self.schema})"
            )
            self._connection = psycopg2.connect(**connect_kwargs)
            logger.debug("Database connection established with autocommit=True")

        return self._connection

    @contextmanager
    def cursor(self, cursor_factory=None):
        """Context manager for database cursors with automatic cleanup."""
        conn = self.get_connection()
        cur = conn.cursor(cursor_factory=cursor_factory or RealDictCursor)
        try:
            yield cur
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database operation failed, rolling back: {e}")
            raise
        finally:
            cur.close()

    def close(self):
        """Close database connection."""
        if self._connection and not self._connection.closed:
            # Final commit before closing to ensure all changes are persisted
            try:
                self._connection.commit()
                logger.debug("Final commit before closing connection")
            except Exception as e:
                logger.warning(f"Failed to commit before closing: {e}")

            self._connection.close()
            logger.debug("Database connection closed")

    def test_connection(self) -> bool:
        """Test database connectivity."""
        try:
            with self.cursor() as cur:
                cur.execute("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False


# ============================================================================
# MAIN DEPLOYMENT EXECUTOR
# ============================================================================


class SDKDeploymentExecutor:
    """Enhanced database-driven deployment executor with improved error handling."""

    def __init__(self, args: argparse.Namespace):
        # Core identifiers
        self.deployment_id = args.deployment_id
        self.environment_id = args.environment_id

        # Databricks configuration
        self.databricks_host = args.databricks_host
        self.warehouse_id = args.warehouse_id
        self.catalog = args.catalog

        # Secret configuration
        self.secret_scope = args.secret_scope
        self.databricks_client_id_key = args.databricks_client_id_key
        self.databricks_client_secret_key = args.databricks_client_secret_key
        self.git_token_key = getattr(args, "git_token_key", None)
        self.postgres_username_key = args.postgres_username_key
        self.postgres_password_key = args.postgres_password_key

        # Workspace paths
        base_workspace_path = "/Workspace/nexa_deployments"
        self.workspace_repo_path = f"{base_workspace_path}/{self.deployment_id}"

        # Initialize clients (lazy loading)
        self.workspace_client: Optional[WorkspaceClient] = None
        self.db_manager: Optional[DatabaseManager] = None

        # Metrics tracking
        self.metrics = DeploymentMetrics()

        # Pipeline processing cache
        self._pipeline_group_processed = {}

        # Dry run mode
        self.dry_run = args.dry_run

        # Initialize connections
        self._initialize_connections(args)

        logger.info(
            f"Initialized deployment executor for deployment {self.deployment_id}"
        )

    def _initialize_connections(self, args: argparse.Namespace):
        """Initialize all required connections with validation."""
        with log_context("Connection Initialization"):
            # Get secrets using passed parameters
            self.databricks_client_id = self._get_secret(
                self.secret_scope, self.databricks_client_id_key
            )
            self.databricks_client_secret = self._get_secret(
                self.secret_scope, self.databricks_client_secret_key
            )
            self.pg_username = self._get_secret(
                self.secret_scope, self.postgres_username_key
            )
            self.pg_password = self._get_secret(
                self.secret_scope, self.postgres_password_key
            )

            # Initialize database manager
            pg_host = args.postgres_host or os.getenv("PG_HOST")
            if not pg_host:
                raise ValueError(
                    "PostgreSQL host is required (--postgres-host or PG_HOST)"
                )

            pg_port = args.postgres_port or int(os.getenv("PG_PORT", "5432"))
            pg_database = args.postgres_database or os.getenv(
                "PG_DATABASE", "databricks_postgres"
            )
            pg_schema = args.postgres_schema or os.getenv("PG_SCHEMA", "public")

            self.db_manager = DatabaseManager(
                host=pg_host,
                port=pg_port,
                database=pg_database,
                username=self.pg_username,
                password=self.pg_password,
                schema=pg_schema,
                ssl_root_cert=os.getenv("PGSSLROOTCERT"),
            )

            # Test connections
            if not self.db_manager.test_connection():
                raise RuntimeError("Failed to establish database connection")

            # Initialize workspace client
            self._get_workspace_client()

            logger.info("All connections initialized successfully")

    def _get_workspace_client(self) -> WorkspaceClient:
        """Get or create authenticated workspace client."""
        if self.workspace_client is None:
            self.workspace_client = WorkspaceClient()
            logger.debug("Initialized Databricks SDK workspace client")
        return self.workspace_client

    @retry_with_backoff(max_attempts=2)
    def _get_secret(self, scope: str, key: str) -> str:
        """Read secret from Databricks with retry logic and base64 decoding."""
        try:
            client = self._get_workspace_client()
            secret_value = client.secrets.get_secret(scope=scope, key=key)

            if not secret_value or not secret_value.value:
                raise ValueError(f"Secret {scope}/{key} is empty")

            # Databricks often stores secrets as base64-encoded strings, try to decode
            val = secret_value.value
            if isinstance(val, str):
                try:
                    # Try to decode as base64 first
                    decoded = base64.b64decode(val).decode("utf-8")
                    logger.debug(
                        f"Successfully retrieved and decoded secret: {scope}/{key}"
                    )
                    return decoded
                except Exception:
                    # Not base64 encoded, return as-is
                    logger.debug(
                        f"Successfully retrieved secret (not base64): {scope}/{key}"
                    )
                    return val

            logger.debug(f"Successfully retrieved secret: {scope}/{key}")
            return val

        except Exception as e:
            logger.error(f"Failed to read secret {scope}/{key}: {e}")
            raise

    def _default_tags(self) -> Dict[str, str]:
        """Default tags for all resources."""
        return {
            "managed_by": "nexa-admin",
            "created_by": "dataready-ai",
            "deployment_id": str(self.deployment_id),
        }

    def _get_deployment_files_from_db(self) -> List[DeploymentFile]:
        """Query database for pending/failed files with improved error handling."""
        with log_context("Fetching Deployment Files", deployment_id=self.deployment_id):
            with self.db_manager.cursor() as cursor:
                schema = self.db_manager.schema

                # First, check if ANY records exist for this deployment
                cursor.execute(
                    f"SELECT COUNT(*) as total_count, STRING_AGG(DISTINCT deployment_status, ', ') as statuses FROM {schema}.deployment_details WHERE deployment_id = %s",
                    (self.deployment_id,),
                )
                check_row = cursor.fetchone()
                total_count = check_row["total_count"] if check_row else 0
                all_statuses = (
                    check_row["statuses"]
                    if check_row and check_row["statuses"]
                    else "none"
                )

                logger.info(
                    f"Found {total_count} total deployment_details records for deployment {self.deployment_id}"
                )
                logger.info(f"Statuses present: {all_statuses}")

                if total_count == 0:
                    logger.warning(
                        f"❌ No deployment_details records found for deployment_id: {self.deployment_id}"
                    )
                    logger.warning(f"Schema: {schema}, Table: deployment_details")
                    logger.warning(
                        "This suggests the deployment_details weren't populated by the API"
                    )
                    return []

                query = f"""
                    SELECT
                        id, deployment_id, file_path, file_type, git_status,
                        execution_order, deployment_status, platform_object_id,
                        error_message, deployed_at
                    FROM {schema}.deployment_details
                    WHERE deployment_id = %s
                      AND deployment_status IN ('pending', 'failed')
                    ORDER BY execution_order ASC
                """
                cursor.execute(query, (self.deployment_id,))
                rows = cursor.fetchall()

                if not rows:
                    logger.warning(
                        f"No pending or failed files found (all {total_count} files have other statuses: {all_statuses})"
                    )
                    return []

                # Convert to strongly-typed objects
                files = []
                for row in rows:
                    try:
                        file = DeploymentFile(**dict(row))
                        files.append(file)
                    except Exception as e:
                        logger.error(
                            f"Failed to parse deployment file row: {row}. Error: {e}"
                        )
                        continue

                # Apply smart ordering
                files = self._apply_execution_order(files)

                logger.info(f"Loaded {len(files)} files for deployment")
                return files

    def _apply_execution_order(
        self, files: List[DeploymentFile]
    ) -> List[DeploymentFile]:
        """Apply intelligent execution ordering based on dependencies."""

        def order_key(f: DeploymentFile) -> Tuple[int, str]:
            path = f.file_path.lower()

            # DDL: tables before views
            if f.file_type == FileType.DDL.value:
                if "/tables/" in path or path.startswith("ddl/tables"):
                    return (0, path)
                if "/views/" in path or path.startswith("ddl/views"):
                    return (1, path)
                return (1, path)

            # Pipelines: bronze -> silver -> gold
            if f.file_type == FileType.PIPELINE.value:
                if "bronze" in path:
                    return (2, path)
                if "silver" in path:
                    return (3, path)
                if "gold" in path:
                    return (4, path)
                return (5, path)

            return (6, path)

        return sorted(files, key=order_key)

    def _update_file_status(
        self,
        detail_id: str,
        status: DeploymentStatus,
        error_message: Optional[str] = None,
        platform_object_id: Optional[str] = None,
    ):
        """Update single file status with validation."""
        with log_context(
            "Update File Status", detail_id=detail_id, status=status.value
        ):
            with self.db_manager.cursor() as cursor:
                schema = self.db_manager.schema
                query = f"""
                    UPDATE {schema}.deployment_details
                    SET deployment_status = %s,
                        error_message = %s,
                        deployed_at = %s,
                        platform_object_id = COALESCE(%s, platform_object_id)
                    WHERE id = %s
                """
                cursor.execute(
                    query,
                    (
                        status.value,
                        error_message,
                        datetime.now(timezone.utc),
                        platform_object_id,
                        detail_id,
                    ),
                )

                if cursor.rowcount == 0:
                    logger.warning(f"No rows updated for detail_id: {detail_id}")

    def _update_multiple_file_status(
        self,
        details: List[DeploymentFile],
        status: DeploymentStatus,
        error_message: Optional[str] = None,
        platform_object_id: Optional[str] = None,
    ):
        """Batch update multiple file statuses."""
        if not details:
            return

        with log_context(
            "Batch Update File Status", count=len(details), status=status.value
        ):
            with self.db_manager.cursor() as cursor:
                schema = self.db_manager.schema
                now = datetime.now(timezone.utc)
                params = [
                    (status.value, error_message, now, platform_object_id, d.id)
                    for d in details
                ]

                query = f"""
                    UPDATE {schema}.deployment_details
                    SET deployment_status = %s,
                        error_message = %s,
                        deployed_at = %s,
                        platform_object_id = COALESCE(%s, platform_object_id)
                    WHERE id = %s
                """
                cursor.executemany(query, params)
                logger.info(f"Batch updated {cursor.rowcount} records")

    def _update_overall_deployment_status(self):
        """Update overall deployment status with metrics."""
        with log_context("Update Overall Status", deployment_id=self.deployment_id):
            with self.db_manager.cursor() as cursor:
                schema = self.db_manager.schema
                # Get counts
                cursor.execute(
                    f"""
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN deployment_status = 'success' THEN 1 ELSE 0 END) as success,
                        SUM(CASE WHEN deployment_status = 'failed' THEN 1 ELSE 0 END) as failed
                    FROM {schema}.deployment_details
                    WHERE deployment_id = %s
                    """,
                    (self.deployment_id,),
                )
                row = cursor.fetchone()

                total = row["total"] or 0
                success = row["success"] or 0
                failed = row["failed"] or 0

                # Determine overall status
                if failed > 0:
                    new_status = "failed"
                elif success < total:
                    new_status = "partial_success"
                else:
                    new_status = "success"

                completed_at = datetime.now(timezone.utc)

                # Update deployments table
                cursor.execute(
                    f"""
                    UPDATE {schema}.deployments
                    SET status = %s,
                        completed_at = %s
                    WHERE id = %s
                    """,
                    (new_status, completed_at, self.deployment_id),
                )

                rows_updated = cursor.rowcount
                logger.info(
                    f"Deployment status: {new_status} | "
                    f"Success: {success}/{total} | Failed: {failed}/{total} | "
                    f"Rows updated: {rows_updated}"
                )
                logger.debug(
                    f"Will commit deployment status '{new_status}' when context exits"
                )

    def _print_deployment_header(self):
        """Print enhanced deployment header with validation checks."""
        print("\n" + "=" * 80)
        print(
            "██╗   ██╗███████╗██╗  ██╗ █████╗    ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗"
        )
        print(
            "████╗ ██║██╔════╝╚██╗██╔╝██╔══██╗   ██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝"
        )
        print(
            "██╔██╗██║█████╗   ╚███╔╝ ███████║   ██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝ "
        )
        print(
            "██║╚████║██╔══╝   ██╔██╗ ██╔══██║   ██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝  "
        )
        print(
            "██║ ╚███║███████╗██╔╝ ██╗██║  ██║   ██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║   "
        )
        print(
            "╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   "
        )
        print()
        print("🚀 NEXA AI - ENTERPRISE DATABRICKS DEPLOYMENT ENGINE v2.0")
        print("Copyright (c) 2024 DataReady AI. All rights reserved.")
        print("=" * 80)
        print(f"📋 Deployment ID:    {self.deployment_id}")
        print(f"🌍 Environment:      {self.environment_id}")
        print(f"📂 Workspace Path:   {self.workspace_repo_path}")
        print(f"🗄️ Target Catalog:   {self.catalog}")
        print(
            f"⏰ Started At:       {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )
        if self.dry_run:
            print("🧪 Mode:             DRY RUN (no changes will be applied)")
        print("=" * 80 + "\n")

    def _print_deployment_summary(self):
        """Print comprehensive deployment summary with metrics."""
        # Get cumulative status from database
        with self.db_manager.cursor() as cursor:
            schema = self.db_manager.schema
            cursor.execute(
                f"""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN deployment_status = 'success' THEN 1 ELSE 0 END) as success,
                    SUM(CASE WHEN deployment_status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN deployment_status = 'skipped' THEN 1 ELSE 0 END) as skipped,
                    SUM(CASE WHEN deployment_status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN deployment_status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
                FROM {schema}.deployment_details
                WHERE deployment_id = %s
                """,
                (self.deployment_id,),
            )
            row = cursor.fetchone()

        # Overall counts
        total = row["total"] if row else 0
        success = row["success"] if row else 0
        failed = row["failed"] if row else 0
        skipped = row["skipped"] if row else 0
        pending = row["pending"] if row else 0
        in_progress = row["in_progress"] if row else 0

        # This run counts
        processed_this_run = (
            self.metrics.success_count
            + self.metrics.failed_count
            + self.metrics.skipped_count
        )

        print("\n" + "=" * 80)
        print("📊 DEPLOYMENT SUMMARY")
        print("=" * 80)

        # This run section
        print("\n🔄 THIS RUN:")
        print(f"   Processed:              {processed_this_run:>4} files")
        print(f"   ✅ Succeeded:           {self.metrics.success_count:>4} files")
        print(f"   ❌ Failed:              {self.metrics.failed_count:>4} files")
        if self.metrics.skipped_count > 0:
            print(f"   ⏭️  Skipped:             {self.metrics.skipped_count:>4} files")

        # Cumulative section
        print("\n📊 OVER ALL STATUS:")
        print(f"   Total Files:            {total:>4}")
        print(f"   ✅ Successful:          {success:>4} files")
        print(f"   ❌ Failed:              {failed:>4} files")
        if skipped > 0:
            print(f"   ⏭️ Skipped:             {skipped:>4} files (already deployed)")
        if pending > 0:
            print(f"   ⏸️ Pending:             {pending:>4} files (not yet processed)")
        if in_progress > 0:
            print(f"   🔄 In Progress:         {in_progress:>4} files")

        print(f"\n⏱️ Execution Time:         {self.metrics.elapsed_time:>7.1f} seconds")
        print(
            f"📈 Overall Success Rate:    {(success / total * 100) if total > 0 else 0:>6.1f}%"
        )
        print(
            f"🏁 Completed At:            {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
        )

        # Status message - success only if no failures, no pending, no in_progress
        if failed == 0 and pending == 0 and in_progress == 0:
            if skipped > 0:
                print(
                    f"\n🎉 DEPLOYMENT SUCCESSFUL! {success} files deployed, {skipped} already up-to-date."
                )
            else:
                print("\n🎉 DEPLOYMENT SUCCESSFUL! All files deployed successfully.")
        elif failed > 0:
            print(f"\n⚠️ DEPLOYMENT COMPLETED WITH {failed} FAILURE(S)")
            print("   Check logs above for detailed error messages.")
        elif pending > 0 or in_progress > 0:
            remaining = pending + in_progress
            print(f"\n⚠️ DEPLOYMENT INCOMPLETE: {remaining} files remaining")
            print("   Use resume to retry pending/failed files.")

        print("=" * 80 + "\n")

    def execute_deployment(self):
        """Main deployment orchestration with comprehensive error handling."""
        self._print_deployment_header()

        try:
            # Check if deployment is already in progress or completed (idempotency check)
            with self.db_manager.cursor() as cursor:
                schema = self.db_manager.schema
                cursor.execute(
                    f"SELECT status FROM {schema}.deployments WHERE id = %s FOR UPDATE NOWAIT",
                    (self.deployment_id,),
                )
                row = cursor.fetchone()
                current_status = row["status"] if row else None

                if current_status == "success":
                    logger.warning(
                        f"⚠️ Deployment {self.deployment_id} already completed successfully."
                    )
                    self._print_deployment_summary()
                    return
                elif current_status == "in_progress":
                    logger.warning(
                        f"⚠️ Deployment {self.deployment_id} is already running."
                    )
                    self._print_deployment_summary()
                    return
                elif current_status in ("partial_success", "failed"):
                    logger.info(
                        f"🔄 Resuming deployment {self.deployment_id} (status: {current_status}). Retrying pending/failed files only."
                    )

            # Update deployment status to in_progress and set started_at
            with self.db_manager.cursor() as cursor:
                schema = self.db_manager.schema
                cursor.execute(
                    f"""
                    UPDATE {schema}.deployments
                    SET status = 'in_progress',
                        started_at = %s
                    WHERE id = %s
                    """,
                    (datetime.now(timezone.utc), self.deployment_id),
                )
                logger.info("✅ Deployment status set to 'in_progress'")

            logger.info("🔍 Scanning deployment queue...")
            files = self._get_deployment_files_from_db()

            if not files:
                logger.warning(
                    "⚠️ No pending or failed files found in deployment queue."
                )
                logger.warning("This could mean:")
                logger.warning("  1. deployment_details weren't populated by the API")
                logger.warning("  2. All files are already marked as success/skipped")
                logger.warning("  3. Schema mismatch between API and serverless job")
                self._update_overall_deployment_status()
                self._print_deployment_summary()
                return

            self.metrics.total_files = len(files)

            # Verify workspace repo path exists
            logger.info(f"🔍 Verifying workspace repo path: {self.workspace_repo_path}")
            try:
                client = self._get_workspace_client()
                repo_status = client.workspace.get_status(self.workspace_repo_path)
                logger.info(
                    f"✅ Workspace repo exists (type: {repo_status.object_type})"
                )
            except Exception as repo_error:
                logger.error(
                    f"❌ Workspace repo path does not exist: {self.workspace_repo_path}"
                )
                logger.error(f"Error: {repo_error}")
                raise RuntimeError(
                    f"Workspace repo not found at {self.workspace_repo_path}. "
                    f"Ensure the repository was synced before starting the deployment job."
                ) from repo_error

            # Group pipeline files
            grouped_pipelines = self._group_pipeline_details(files)
            pipeline_groups = len(grouped_pipelines)
            ddl_files = sum(1 for f in files if f.file_type == FileType.DDL.value)

            logger.info("📋 Deployment Plan:")
            logger.info(f"   • {ddl_files} DDL files to execute")
            logger.info(f"   • {pipeline_groups} pipeline groups to deploy")
            logger.info(f"   • Target catalog: {self.catalog or 'DBFS Storage'}")
            print()

            # Process each file
            for idx, detail in enumerate(files, 1):
                progress = f"[{idx}/{len(files)}]"

                try:
                    if self.dry_run:
                        logger.info(
                            f"🧪 {progress} DRY RUN: Would deploy {detail.file_type} '{detail.file_path}'"
                        )
                        continue

                    if detail.file_type == FileType.DDL.value:
                        self._process_ddl_file(detail, progress)
                    elif detail.file_type == FileType.PIPELINE.value:
                        self._process_pipeline_file(detail, grouped_pipelines, progress)
                    else:
                        logger.info(
                            f"⏭️  {progress} Skipping {detail.file_type} file: {detail.file_path}"
                        )
                        self._update_file_status(detail.id, DeploymentStatus.SKIPPED)
                        self.metrics.skipped_count += 1

                except Exception as e:
                    self._handle_deployment_error(detail, e, grouped_pipelines)

            # Update final status
            logger.info("\n📊 Finalizing deployment status...")
            self._update_overall_deployment_status()
            self._print_deployment_summary()

        except Exception as e:
            logger.error(f"💥 CRITICAL DEPLOYMENT FAILURE: {str(e)}")
            logger.error(f"🔍 Traceback:\n{traceback.format_exc()}")
            raise
        finally:
            self._cleanup()

    def _process_ddl_file(self, detail: DeploymentFile, progress: str):
        """Process a single DDL file with detailed logging."""
        logger.info(f"🔧 {progress} Executing DDL: {detail.file_path}")

        if detail.git_status == "removed":
            logger.info("   ⏭️ Skipping removed DDL file")
            self._update_file_status(detail.id, DeploymentStatus.SKIPPED)
            self.metrics.skipped_count += 1
            return

        result = self._deploy_ddl_sdk(detail)
        self._update_file_status(
            detail.id,
            DeploymentStatus.SUCCESS,
            platform_object_id=result.get("platform_object_id"),
        )
        self.metrics.success_count += 1
        logger.info("   ✅ DDL execution completed successfully")

    def _process_pipeline_file(
        self,
        detail: DeploymentFile,
        grouped_pipelines: Dict[str, List[DeploymentFile]],
        progress: str,
    ):
        """Process a pipeline file as part of a pipeline group."""
        group_key = self._pipeline_group_key(detail.file_path)

        if not group_key:
            logger.warning(
                f"⚠️  {progress} Unable to determine pipeline group for {detail.file_path}"
            )
            self._update_file_status(detail.id, DeploymentStatus.SKIPPED)
            self.metrics.skipped_count += 1
            return

        # Check if already processed
        if group_key in self._pipeline_group_processed:
            logger.info(f"   ✅ Pipeline group '{group_key}' already processed")
            self._update_file_status(
                detail.id,
                DeploymentStatus.SUCCESS,
                platform_object_id=self._pipeline_group_processed[group_key],
            )
            self.metrics.success_count += 1
            return

        # Deploy entire group
        group_details = grouped_pipelines.get(group_key, [])
        logger.info(
            f"🔄 {progress} Deploying pipeline group: {group_key} ({len(group_details)} files)"
        )

        platform_id = self._deploy_pipeline_group_sdk(group_key, group_details)
        platform_object_id = platform_id or None

        # Mark all files in group as successful
        self._pipeline_group_processed[group_key] = platform_object_id
        self._update_multiple_file_status(
            group_details,
            DeploymentStatus.SUCCESS,
            platform_object_id=platform_object_id,
        )
        self.metrics.success_count += len(group_details)
        logger.info(
            "   ✅ Pipeline '%s' deployed successfully (ID: %s)",
            group_key,
            platform_object_id or "<not created>",
        )

    def _handle_deployment_error(
        self,
        detail: DeploymentFile,
        error: Exception,
        grouped_pipelines: Dict[str, List[DeploymentFile]],
    ):
        """Handle deployment errors with appropriate logging and status updates."""
        error_msg = str(error)
        error_trace = traceback.format_exc()

        logger.error(f"❌ Failed to deploy {detail.file_type} '{detail.file_path}'")
        logger.error(f"   💥 Error: {error_msg}")
        logger.debug(f"   🔍 Traceback:\n{error_trace}")

        if detail.file_type == FileType.PIPELINE.value:
            # Fail entire pipeline group
            group_key = self._pipeline_group_key(detail.file_path)
            if group_key:
                group_details = grouped_pipelines.get(group_key, [detail])
                self._update_multiple_file_status(
                    group_details, DeploymentStatus.FAILED, error_message=error_msg
                )
                self.metrics.failed_count += len(group_details)
                logger.error(
                    f"   🚫 Entire pipeline group '{group_key}' marked as failed"
                )
            else:
                self._update_file_status(
                    detail.id, DeploymentStatus.FAILED, error_message=error_msg
                )
                self.metrics.failed_count += 1
        else:
            self._update_file_status(
                detail.id, DeploymentStatus.FAILED, error_message=error_msg
            )
            self.metrics.failed_count += 1

    def _pipeline_group_key(self, relative_path: str) -> Optional[str]:
        """Extract pipeline group key from file path."""
        parts = relative_path.strip("/").split("/")
        if (
            len(parts) >= 3
            and parts[0] == "pipelines"
            and parts[1].lower() in {"bronze", "silver", "gold"}
        ):
            return "/".join(parts[:3])
        return None

    def _group_pipeline_details(
        self, details: List[DeploymentFile]
    ) -> Dict[str, List[DeploymentFile]]:
        """Group pipeline files by their folder."""
        grouped: Dict[str, List[DeploymentFile]] = {}

        for detail in details:
            if detail.file_type != FileType.PIPELINE.value:
                continue

            key = self._pipeline_group_key(detail.file_path)
            if not key:
                logger.warning(
                    f"Could not determine group for pipeline: {detail.file_path}"
                )
                continue

            grouped.setdefault(key, []).append(detail)

        # Sort files within each group for deterministic processing
        for key in grouped:
            grouped[key].sort(key=lambda x: x.file_path)

        return grouped

    @retry_with_backoff(max_attempts=2)
    def _read_workspace_file(self, file_path: str) -> str:
        """Read file content from Databricks workspace with retry."""
        client = self._get_workspace_client()
        full_path = f"{self.workspace_repo_path}/{file_path}".replace("//", "/")

        logger.debug(f"Reading workspace file: {full_path}")

        try:
            # First check if the repo root exists
            try:
                repo_status = client.workspace.get_status(self.workspace_repo_path)
                logger.debug(
                    f"Repo root exists: {self.workspace_repo_path} (type: {repo_status.object_type})"
                )
            except Exception as repo_check:
                logger.error(f"Repo root does not exist: {self.workspace_repo_path}")
                logger.error(f"Error: {repo_check}")
                raise RuntimeError(
                    f"Workspace repo path not found: {self.workspace_repo_path}"
                ) from repo_check

            exported = client.workspace.export(full_path, format=ExportFormat.SOURCE)
            content_b64 = getattr(exported, "content", None)

            if content_b64 is None:
                raise RuntimeError(f"No content returned for {full_path}")

            if isinstance(content_b64, str):
                content_b64 = content_b64.encode("utf-8")

            content = base64.b64decode(content_b64).decode("utf-8")
            logger.debug(
                f"Successfully read {len(content)} characters from {full_path}"
            )
            return content

        except Exception as e:
            logger.error(f"Failed to read workspace file: {full_path}")
            raise RuntimeError(f"Workspace file read failed: {str(e)}") from e

    def _wait_for_statement(
        self, statement_id: str, timeout_sec: int = STATEMENT_TIMEOUT
    ) -> Dict[str, Any]:
        """Wait for SQL statement execution with enhanced status tracking."""
        client = self._get_workspace_client()
        start = time.time()
        last_status = None
        last_log_time = start

        logger.info("   ⏳ Waiting for SQL execution...")

        while True:
            elapsed = time.time() - start

            if elapsed > timeout_sec:
                raise TimeoutError(
                    f"Statement {statement_id} timed out after {elapsed:.1f}s. "
                    f"Last status: {last_status}"
                )

            try:
                resp = client.statement_execution.get_statement(
                    statement_id=statement_id
                )
            except Exception as e:
                # Only catch errors from get_statement API call
                logger.warning(f"Error polling statement {statement_id}: {e}")
                time.sleep(5)
                continue

            # Extract status from various possible response structures
            state_val = self._extract_statement_state(resp)

            # Log status changes
            if state_val != last_status:
                logger.info(f"   📡 Status: {state_val} (elapsed: {elapsed:.1f}s)")
                last_status = state_val
                last_log_time = time.time()
            elif time.time() - last_log_time > 30:  # Log every 30 seconds if no change
                logger.info(f"   ⏸️  Still {state_val}... (elapsed: {elapsed:.1f}s)")
                last_log_time = time.time()

            if state_val in ("SUCCEEDED", "FAILED", "CANCELED", "CANCELLED", "ERROR"):
                if state_val != "SUCCEEDED":
                    error_msg = self._extract_error_message(resp)
                    raise RuntimeError(
                        f"SQL execution failed with status {state_val}. "
                        f"Error: {error_msg}"
                    )

                logger.info(f"   ✅ Completed in {elapsed:.1f}s")
                return self._extract_statement_results(resp)

            time.sleep(3)

    def _extract_statement_state(self, resp: Any) -> Optional[str]:
        """Extract statement state from API response with multiple fallback strategies."""
        # Try different attribute paths
        attempts = [
            lambda: getattr(getattr(resp, "status", None), "state", None),
            lambda: getattr(resp, "state", None),
            lambda: getattr(getattr(resp, "status", None), "value", None),
            lambda: resp.get("status", {}).get("state")
            if hasattr(resp, "get")
            else None,
            lambda: resp.get("state") if hasattr(resp, "get") else None,
        ]

        for attempt in attempts:
            try:
                result = attempt()
                if result:
                    state_str = str(result).upper()
                    # Handle enum prefixes like "STATEMENTSTATE.FAILED" -> "FAILED"
                    if "." in state_str:
                        state_str = state_str.split(".")[-1]
                    return state_str
            except (AttributeError, TypeError):
                continue

        logger.warning(f"Could not extract state from response: {resp}")
        return None

    def _extract_error_message(self, resp: Any) -> str:
        """Extract error message from statement response."""
        try:
            status = getattr(resp, "status", None)
            if status:
                error = getattr(status, "error", None)
                if error:
                    return str(getattr(error, "message", error))
        except (AttributeError, TypeError):
            pass

        return "No error details available"

    def _extract_statement_results(self, resp: Any) -> Dict[str, Any]:
        """Extract results from statement response."""
        results = {"status": "success", "rows_affected": None, "execution_time": None}

        try:
            manifest = getattr(resp, "manifest", None)
            if manifest:
                results["rows_affected"] = getattr(manifest, "total_row_count", None)
        except (AttributeError, TypeError):
            pass

        return results

    def _deploy_ddl_sdk(self, detail: DeploymentFile) -> Dict[str, Any]:
        """Deploy DDL file using SQL execution with enhanced error handling."""
        client = self._get_workspace_client()

        if not self.warehouse_id:
            raise ValueError("Warehouse ID is required for DDL deployment")

        # Normalize warehouse ID
        wh_id = self.warehouse_id
        if "/warehouses/" in wh_id:
            wh_id = wh_id.split("/warehouses/")[-1]

        logger.debug(f"Deploying DDL to warehouse: {wh_id}")

        # Read SQL content
        sql_text = self._read_workspace_file(detail.file_path)

        if not sql_text.strip():
            raise ValueError(f"DDL file is empty: {detail.file_path}")

        logger.debug(f"Executing SQL ({len(sql_text)} chars)")

        # Execute statement
        exec_method = getattr(client.statement_execution, "execute", None) or getattr(
            client.statement_execution, "execute_statement"
        )

        try:
            resp = exec_method(
                warehouse_id=wh_id,
                statement=sql_text,
                catalog=self.catalog,
                wait_timeout="0s",  # Don't wait in execute call, we'll poll separately
            )
        except Exception as e:
            raise RuntimeError(f"Failed to submit DDL statement: {str(e)}") from e

        # Extract statement ID
        statement_id = getattr(resp, "statement_id", None) or (
            resp.get("statement_id") if isinstance(resp, dict) else None
        )

        if not statement_id:
            raise RuntimeError("No statement_id returned from SQL execution")

        logger.debug(f"Statement submitted: {statement_id}")

        # Wait for completion
        results = self._wait_for_statement(statement_id, timeout_sec=STATEMENT_TIMEOUT)

        logger.info(f"   📊 Rows affected: {results.get('rows_affected', 'N/A')}")

        return {
            "status": "success",
            "platform_object_id": None,
            "statement_id": statement_id,
            "results": results,
        }

    def _deploy_pipeline_group_sdk(
        self, group_key: str, group_details: List[DeploymentFile]
    ) -> str:
        """Deploy or update a DLT pipeline for a group of files."""
        client = self._get_workspace_client()

        # Parse group key: pipelines/<layer>/<name>
        parts = group_key.split("/")
        layer, name = parts[1], parts[2]
        pipeline_name = f"{layer}_{name}"

        logger.debug(f"Processing pipeline group: {group_key} -> {pipeline_name}")

        # Check for removed files
        all_removed = all(d.git_status == "removed" for d in group_details)
        existing_id = next(
            (d.platform_object_id for d in group_details if d.platform_object_id), None
        )

        if all_removed:
            if existing_id:
                logger.info(f"   🗑️ All files removed, deleting pipeline: {existing_id}")
                client.pipelines.delete(pipeline_id=existing_id)
                return existing_id

            logger.info(
                "   ⏭️  All files in group '%s' marked removed and no existing pipeline found; skipping create",
                group_key,
            )
            return ""

        # Build pipeline configuration
        pipeline_config = self._build_pipeline_config(
            group_key,
            layer,
            pipeline_name,
            group_details,
        )

        # Create or update pipeline
        if existing_id:
            return self._update_existing_pipeline(
                existing_id, pipeline_name, pipeline_config
            )
        return self._create_new_pipeline(pipeline_name, pipeline_config)

    def _build_pipeline_config(
        self,
        group_key: str,
        layer: str,
        pipeline_name: str,
        group_details: List[DeploymentFile],
    ) -> Dict[str, Any]:
        """Build pipeline configuration dictionary aligned with Databricks SDK expectations."""
        pipeline_root = f"{self.workspace_repo_path}/{group_key}".replace("//", "/")

        # Order libraries deterministically and skip files that were removed from git
        active_details = [d for d in group_details if d.git_status != "removed"]
        if not active_details:
            raise ValueError(
                f"No active pipeline files to deploy for group '{group_key}'"
            )

        active_details.sort(key=lambda d: (d.execution_order, d.file_path))

        libraries = []
        for detail in active_details:
            workspace_path = f"{self.workspace_repo_path}/{detail.file_path}".replace(
                "//", "/"
            )
            libraries.append(
                pipelines.PipelineLibrary(
                    file=pipelines.FileLibrary(path=workspace_path)
                )
            )

        configuration: Dict[str, str] = {"schema": str(layer)}
        if self.catalog:
            configuration["catalog"] = str(self.catalog)

        # Single event log table for ALL Nexa-managed pipelines
        # This enables unified observability platform with one query instead of N queries
        event_log_spec = pipelines.EventLogSpec(
            catalog=self.catalog,
            schema="dlt_logs",
            name="nexa_system_event_log",  # Shared across all pipelines
        )

        config: Dict[str, Any] = {
            "name": pipeline_name,
            "libraries": libraries,
            "continuous": False,
            "development": True,
            "configuration": configuration,
            "serverless": True,
            "catalog": self.catalog,
            "schema": layer,
            "event_log": event_log_spec,
            "channel": "CURRENT",
            "photon": True,
            "root_path": pipeline_root,
            "tags": self._default_tags(),
        }

        # Remove optional keys that ended up empty
        if not configuration:
            config.pop("configuration", None)

        sanitized_summary = {
            "name": pipeline_name,
            "libraries": [lib.file.path for lib in libraries if lib.file],
            "catalog": self.catalog,
            "schema": layer,
            "channel": config.get("channel"),
            "photon": config.get("photon"),
            "root_path": pipeline_root,
        }
        logger.debug("   📋 Pipeline configuration summary: %s", sanitized_summary)

        # Filter out None values before invoking the SDK
        return {key: value for key, value in config.items() if value is not None}

    def _update_existing_pipeline(
        self, pipeline_id: str, pipeline_name: str, config: Dict[str, Any]
    ) -> str:
        """Update an existing DLT pipeline."""
        logger.info(f"   🔄 Updating existing pipeline: {pipeline_id}")

        client = self._get_workspace_client()

        try:
            client.pipelines.update(pipeline_id=pipeline_id, **config)
            logger.debug("   ⏳ Starting pipeline update...")

            # Trigger update
            client.pipelines.start_update(pipeline_id=pipeline_id)

            # Wait for completion
            logger.debug("   ⏳ Waiting for pipeline to become idle...")
            client.pipelines.wait_get_pipeline_idle(
                pipeline_id=pipeline_id, timeout=timedelta(seconds=PIPELINE_TIMEOUT)
            )

            logger.info("   ✅ Pipeline updated successfully")
            return pipeline_id

        except Exception as e:
            raise RuntimeError(
                f"Failed to update pipeline {pipeline_id}: {str(e)}"
            ) from e

    def _create_new_pipeline(self, pipeline_name: str, config: Dict[str, Any]) -> str:
        """Create a new DLT pipeline."""
        logger.info(f"   ➕ Creating new pipeline: {pipeline_name}")

        client = self._get_workspace_client()

        try:
            created = client.pipelines.create(**config)

            # Extract pipeline ID
            pipeline_id = getattr(created, "pipeline_id", None) or (
                created.get("pipeline_id") if isinstance(created, dict) else None
            )

            if not pipeline_id:
                raise RuntimeError("Create pipeline did not return pipeline_id")

            logger.info(f"   📝 Created pipeline with ID: {pipeline_id}")
            logger.debug("   ⏳ Starting initial pipeline update...")

            # Trigger initial update
            client.pipelines.start_update(pipeline_id=pipeline_id)

            # Wait for completion
            logger.debug("   ⏳ Waiting for pipeline to become idle...")
            client.pipelines.wait_get_pipeline_idle(
                pipeline_id=pipeline_id, timeout=timedelta(seconds=PIPELINE_TIMEOUT)
            )

            logger.info("   ✅ Pipeline created and initialized successfully")
            return pipeline_id

        except Exception as e:
            raise RuntimeError(
                f"Failed to create pipeline '{pipeline_name}': {str(e)}"
            ) from e

    def _cleanup(self):
        """Clean up resources and connections."""
        logger.debug("Cleaning up resources...")

        if self.db_manager:
            self.db_manager.close()

        # Workspace client cleanup (if needed)
        self.workspace_client = None

        logger.debug("Cleanup completed")


# ============================================================================
# CLI ARGUMENT PARSING
# ============================================================================


def parse_args() -> argparse.Namespace:
    """Parse and validate command line arguments."""
    parser = argparse.ArgumentParser(
        description="Nexa AI - Enhanced Databricks Deployment Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Standard deployment
  %(prog)s --deployment-id abc123 --environment-id prod \\
           --databricks-host https://workspace.cloud.databricks.com \\
           --warehouse-id 1234abcd5678efgh \\
           --catalog main_catalog \\
           --secret-scope my-secret-scope \\
           --databricks-client-id-key DATABRICKS_CLIENT_ID \\
           --databricks-client-secret-key DATABRICKS_CLIENT_SECRET \\
           --postgres-username-key PG_USERNAME \\
           --postgres-password-key PG_PASSWORD

  # Dry run mode
  %(prog)s --deployment-id abc123 --environment-id dev \\
           --secret-scope my-secret-scope \\
           --databricks-client-id-key DATABRICKS_CLIENT_ID \\
           --databricks-client-secret-key DATABRICKS_CLIENT_SECRET \\
           --postgres-username-key PG_USERNAME \\
           --postgres-password-key PG_PASSWORD \\
           --dry-run

For support: enterprise-support@dataready.ai
        """,
    )

    # Required arguments
    required = parser.add_argument_group("required arguments")
    required.add_argument(
        "--deployment-id", required=True, help="Unique deployment identifier"
    )
    required.add_argument(
        "--environment-id",
        required=True,
        help="Target environment identifier (e.g., dev, staging, prod)",
    )

    # Databricks configuration
    databricks = parser.add_argument_group("databricks configuration")
    databricks.add_argument(
        "--databricks-host",
        help="Databricks workspace URL (or use DATABRICKS_HOST env var)",
    )
    databricks.add_argument(
        "--warehouse-id",
        help="SQL warehouse ID for DDL execution (required for DDL deployments)",
    )
    databricks.add_argument(
        "--catalog",
        help="Unity Catalog name for deployments (optional, uses DBFS if not specified)",
    )

    # PostgreSQL configuration
    postgres = parser.add_argument_group("postgresql configuration")
    postgres.add_argument(
        "--postgres-host", help="PostgreSQL host (or use PG_HOST env var)"
    )
    postgres.add_argument(
        "--postgres-port",
        type=int,
        default=5432,
        help="PostgreSQL port (default: 5432)",
    )
    postgres.add_argument(
        "--postgres-database",
        default="databricks_postgres",
        help="PostgreSQL database name (default: databricks_postgres)",
    )
    postgres.add_argument(
        "--postgres-schema",
        default="public",
        help="PostgreSQL schema name (default: public)",
    )

    # Secret configuration
    secrets = parser.add_argument_group("secret configuration")
    secrets.add_argument(
        "--secret-scope", required=True, help="Databricks secret scope name"
    )
    secrets.add_argument(
        "--databricks-client-id-key",
        required=True,
        help="Secret key name for Databricks client ID",
    )
    secrets.add_argument(
        "--databricks-client-secret-key",
        required=True,
        help="Secret key name for Databricks client secret",
    )
    secrets.add_argument(
        "--git-token-key", help="Secret key name for Git token (optional)"
    )
    secrets.add_argument(
        "--postgres-username-key",
        required=True,
        help="Secret key name for PostgreSQL username",
    )
    secrets.add_argument(
        "--postgres-password-key",
        required=True,
        help="Secret key name for PostgreSQL password",
    )

    # Operational settings
    operations = parser.add_argument_group("operational settings")
    operations.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview deployment without making changes",
    )
    operations.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)",
    )
    operations.add_argument(
        "--log-file",
        help="Path to log file (optional, logs to console if not specified)",
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.deployment_id:
        parser.error("--deployment-id is required")
    if not args.environment_id:
        parser.error("--environment-id is required")

    return args


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================


def main():
    """Main entry point with comprehensive error handling."""
    args = None

    try:
        # Parse arguments
        args = parse_args()

        # Configure logging
        global logger
        logger = setup_logging(log_level=args.log_level, log_file=args.log_file)

        logger.info("=" * 80)
        logger.info("🚀 Nexa AI Deployment Engine v2.0 - Starting")
        logger.info("=" * 80)

        # Create and run executor
        executor = SDKDeploymentExecutor(args)
        executor.execute_deployment()

        logger.info("=" * 80)
        logger.info("🎉 Deployment completed successfully!")
        logger.info("=" * 80)

    except KeyboardInterrupt:
        logger.error("\n⚠️  Deployment interrupted by user (Ctrl+C)")
        raise

    except Exception as e:
        logger.error("\n" + "=" * 80)
        logger.error("💥 DEPLOYMENT FAILED")
        logger.error("=" * 80)
        logger.error(f"Error: {str(e)}")
        logger.error(f"\nFull traceback:\n{traceback.format_exc()}")
        logger.error("=" * 80)
        logger.error("📞 ENTERPRISE SUPPORT")
        logger.error("=" * 80)
        logger.error("   • Contact: enterprise-support@dataready.ai")
        logger.error("   • Include your deployment ID and environment")
        logger.error("   • Attach relevant log files if available")

        if args and args.deployment_id:
            logger.error(f"   • Deployment ID: {args.deployment_id}")
        if args and args.environment_id:
            logger.error(f"   • Environment: {args.environment_id}")

        logger.error("=" * 80)

        raise


if __name__ == "__main__":
    main()
