"""
Source validation service for Nexa Connectors.

Validates connectivity and table existence in source systems.
"""

from typing import Dict, Any, Optional, Tuple
import psycopg2
import boto3
from botocore.exceptions import ClientError
import os

from ..core.logging import get_logger

logger = get_logger(__name__)


class SourceValidationService:
    """Service for validating source system connectivity and table existence."""

    def validate_source_table(
        self,
        target_type: str,
        target_config: Dict[str, Any],
        source_schema: str,
        source_table: str,
        secrets: Optional[Dict[str, str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate that a source table exists and is accessible.

        Args:
            target_type: Type of source system (postgres, s3, kafka, snowflake, bigquery)
            target_config: Connection configuration for the source
            source_schema: Schema name (or S3 prefix, Kafka topic, etc.)
            source_table: Table name (or file pattern)
            secrets: Optional dictionary of secrets (for testing without Databricks)

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            if target_type == "postgres":
                return self._validate_postgres_table(
                    target_config, source_schema, source_table, secrets
                )
            elif target_type == "s3":
                return self._validate_s3_path(
                    target_config, source_schema, source_table, secrets
                )
            elif target_type == "kinesis":
                return self._validate_kinesis_stream(
                    target_config, source_schema, source_table, secrets
                )
            elif target_type == "snowflake":
                return self._validate_snowflake_table(
                    target_config, source_schema, source_table, secrets
                )
            elif target_type == "bigquery":
                return self._validate_bigquery_table(
                    target_config, source_schema, source_table, secrets
                )
            else:
                return False, f"Unsupported target type: {target_type}"

        except Exception as e:
            logger.error(f"Validation failed for {target_type}: {e}")
            return False, f"Validation error: {str(e)}"

    def _validate_postgres_table(
        self,
        config: Dict[str, Any],
        schema: str,
        table: str,
        secrets: Optional[Dict[str, str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Validate PostgreSQL schema exists (table is optional, will be created on first run)."""
        conn = None
        try:
            # Get credentials
            if secrets:
                user = secrets.get("user")
                password = secrets.get("password")
            else:
                # In production, these would come from Databricks Secrets
                # For now, try environment variables or skip validation
                user = os.getenv("POSTGRES_USER")
                password = os.getenv("POSTGRES_PASSWORD")

                if not user or not password:
                    logger.warning("PostgreSQL credentials not available for validation. Skipping validation.")
                    return True, None  # Skip validation if credentials not available

            # Connect to database
            conn = psycopg2.connect(
                host=config.get("host"),
                port=config.get("port", 5432),
                database=config.get("database"),
                user=user,
                password=password,
                connect_timeout=10,
            )

            # Check if schema exists (table is optional)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.schemata
                    WHERE schema_name = %s
                )
                """,
                (schema,),
            )

            schema_exists = cursor.fetchone()[0]

            if not schema_exists:
                return False, f"Schema '{schema}' does not exist in PostgreSQL database. Please create the schema first."

            # Optionally check if table exists (just for info, not an error)
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = %s
                    AND table_name = %s
                )
                """,
                (schema, table),
            )

            table_exists = cursor.fetchone()[0]

            if table_exists:
                logger.info(f"Table {schema}.{table} exists and will be synced")
            else:
                logger.info(f"Table {schema}.{table} does not exist yet, will be created on first run")

            return True, None

        except psycopg2.OperationalError as e:
            return False, f"Cannot connect to PostgreSQL: {str(e)}"
        except psycopg2.Error as e:
            return False, f"PostgreSQL error: {str(e)}"
        except Exception as e:
            return False, f"Unexpected error validating PostgreSQL: {str(e)}"
        finally:
            if conn:
                conn.close()

    def _validate_s3_path(
        self,
        config: Dict[str, Any],
        prefix: str,
        path: str,
        secrets: Optional[Dict[str, str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Validate S3 bucket exists (path prefix is optional, will be created)."""
        try:
            # Get credentials
            if secrets:
                aws_access_key = secrets.get("access_key")
                aws_secret_key = secrets.get("secret_key")
            else:
                aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
                aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

                if not aws_access_key or not aws_secret_key:
                    logger.warning("AWS credentials not available for validation. Skipping validation.")
                    return True, None  # Skip validation if credentials not available

            # Create S3 client
            s3_client = boto3.client(
                "s3",
                aws_access_key_id=aws_access_key,
                aws_secret_access_key=aws_secret_key,
            )

            bucket = config.get("bucket")

            # Check if bucket exists (using head_bucket)
            try:
                s3_client.head_bucket(Bucket=bucket)
                logger.info(f"S3 bucket '{bucket}' exists and is accessible")
                return True, None
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")
                if error_code == "404":
                    return False, f"S3 bucket does not exist: {bucket}"
                elif error_code == "403":
                    return False, f"Access denied to S3 bucket: {bucket}"
                else:
                    return False, f"S3 bucket validation error: {str(e)}"

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "NoSuchBucket":
                return False, f"S3 bucket does not exist: {config.get('bucket')}"
            elif error_code == "AccessDenied":
                return False, f"Access denied to S3 bucket: {config.get('bucket')}"
            else:
                return False, f"S3 error: {str(e)}"
        except Exception as e:
            return False, f"Unexpected error validating S3: {str(e)}"

    def _validate_kinesis_stream(
        self,
        config: Dict[str, Any],
        schema: str,  # Not used for Kinesis
        stream_name: str,
        secrets: Optional[Dict[str, str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Validate Kinesis stream existence."""
        try:
            # Get credentials
            if secrets:
                aws_access_key = secrets.get("access_key")
                aws_secret_key = secrets.get("secret_key")
            else:
                aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
                aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

                if not aws_access_key or not aws_secret_key:
                    logger.warning("AWS credentials not available for Kinesis validation. Skipping validation.")
                    return True, None  # Skip validation if credentials not available

            # Get region from config or use default
            region = config.get("region", "us-east-1")

            # Create Kinesis client
            kinesis_client = boto3.client(
                "kinesis",
                aws_access_key_id=aws_access_key,
                aws_secret_access_key=aws_secret_key,
                region_name=region,
            )

            # Check if stream exists
            try:
                response = kinesis_client.describe_stream(StreamName=stream_name)
                stream_status = response["StreamDescription"]["StreamStatus"]

                if stream_status == "ACTIVE":
                    logger.info(f"Kinesis stream '{stream_name}' is active")
                    return True, None
                else:
                    return False, f"Kinesis stream '{stream_name}' exists but is not active. Status: {stream_status}"

            except kinesis_client.exceptions.ResourceNotFoundException:
                return False, f"Kinesis stream '{stream_name}' does not exist in region {region}"

        except ClientError as e:
            return False, f"Kinesis error: {str(e)}"
        except Exception as e:
            return False, f"Unexpected error validating Kinesis: {str(e)}"

    def _validate_snowflake_table(
        self,
        config: Dict[str, Any],
        schema: str,
        table: str,
        secrets: Optional[Dict[str, str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Validate Snowflake table existence."""
        try:
            # For Snowflake validation, we'd need snowflake-connector-python
            # For now, return a placeholder
            # TODO: Implement Snowflake table validation using snowflake-connector-python
            logger.warning("Snowflake table validation not fully implemented")
            return True, None

        except Exception as e:
            return False, f"Unexpected error validating Snowflake: {str(e)}"

    def _validate_bigquery_table(
        self,
        config: Dict[str, Any],
        schema: str,
        table: str,
        secrets: Optional[Dict[str, str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Validate BigQuery table existence."""
        try:
            # For BigQuery validation, we'd need google-cloud-bigquery
            # For now, return a placeholder
            # TODO: Implement BigQuery table validation using google-cloud-bigquery
            logger.warning("BigQuery table validation not fully implemented")
            return True, None

        except Exception as e:
            return False, f"Unexpected error validating BigQuery: {str(e)}"

    def validate_connector_config(
        self,
        target_type: str,
        target_config: Dict[str, Any],
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate connector configuration without checking specific tables.

        Args:
            target_type: Type of source system
            target_config: Connection configuration

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            # Validate required config fields based on target type
            if target_type == "postgres":
                required_fields = ["host", "port", "database"]
            elif target_type == "s3":
                required_fields = ["bucket"]
            elif target_type == "kinesis":
                required_fields = ["region", "stream_name"]
            elif target_type == "snowflake":
                # Optional, not validated
                return True, None
            elif target_type == "bigquery":
                # Optional, not validated
                return True, None
            else:
                return False, f"Unsupported target type: {target_type}"

            # Check for required fields
            missing_fields = [
                field for field in required_fields if field not in target_config
            ]
            if missing_fields:
                return False, f"Missing required configuration fields: {', '.join(missing_fields)}"

            return True, None

        except Exception as e:
            return False, f"Configuration validation error: {str(e)}"
