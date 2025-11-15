"""
Code generation service for Nexa Connectors.

Generates Databricks artifacts (notebooks, workflows, SQL) from connector configurations.
"""

import os
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from jinja2 import Environment, FileSystemLoader, TemplateNotFound
import yaml

from ..core.logging import get_logger

logger = get_logger(__name__)


class CodeGenerationService:
    """Service for generating Databricks artifacts from connector configurations."""

    def __init__(self, templates_dir: str = "templates"):
        """
        Initialize the code generation service.

        Args:
            templates_dir: Path to the templates directory
        """
        self.templates_dir = Path(templates_dir)
        if not self.templates_dir.exists():
            raise ValueError(f"Templates directory not found: {templates_dir}")

        # Load template configuration
        config_path = self.templates_dir / "template_config.yml"
        if config_path.exists():
            with open(config_path, "r") as f:
                self.config = yaml.safe_load(f)
        else:
            logger.warning("template_config.yml not found, using defaults")
            self.config = self._get_default_config()

        # Setup Jinja2 environment
        self.env = Environment(
            loader=FileSystemLoader(str(self.templates_dir)),
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True,
        )

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration if template_config.yml is missing."""
        return {
            "databricks": {
                "spark_version": "13.3.x-scala2.12",
                "node_type": "i3.xlarge",
                "num_workers": 2,
                "timeout_seconds": 7200,
                "notebook_base_path": "/Workspace/Shared/nexa_connectors",
                "timezone": "UTC",
            },
            "secrets": {
                "default_scope": "nexa_connectors",
            },
        }

    def generate_connector_artifacts(
        self,
        connector: Any,  # Connector model instance
        datasets: List[Any],  # List of Dataset model instances
        output_dir: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate all artifacts for a connector.

        Args:
            connector: Connector model instance
            datasets: List of dataset model instances
            output_dir: Optional output directory (defaults to /tmp/connectors/{connector_id})

        Returns:
            Dictionary with generation results including file paths
        """
        if not datasets:
            raise ValueError("Cannot generate artifacts: no datasets configured")

        # Setup output directory
        if output_dir is None:
            output_dir = f"/tmp/connectors/{connector.id}"

        output_path = Path(output_dir)

        # Clean and create output directories
        if output_path.exists():
            shutil.rmtree(output_path)

        output_path.mkdir(parents=True, exist_ok=True)
        (output_path / "notebooks").mkdir(exist_ok=True)
        (output_path / "workflows").mkdir(exist_ok=True)
        (output_path / "sql").mkdir(exist_ok=True)

        generated_files = []
        generation_errors = []

        try:
            # Generate notebooks for each dataset
            for dataset in datasets:
                try:
                    notebook_file = self._generate_dataset_notebook(
                        connector, dataset, output_path / "notebooks"
                    )
                    generated_files.append(notebook_file)
                    logger.info(f"Generated notebook for dataset {dataset.id}")
                except Exception as e:
                    error_msg = f"Failed to generate notebook for dataset {dataset.id}: {e}"
                    logger.error(error_msg)
                    generation_errors.append(error_msg)

            # Generate SQL views for each dataset (optional)
            for dataset in datasets:
                try:
                    sql_file = self._generate_dataset_sql(
                        connector, dataset, output_path / "sql"
                    )
                    generated_files.append(sql_file)
                    logger.info(f"Generated SQL view for dataset {dataset.id}")
                except Exception as e:
                    # SQL views are optional, log but don't fail
                    logger.warning(f"Failed to generate SQL view for dataset {dataset.id}: {e}")

            # Generate Databricks workflow
            try:
                workflow_file = self._generate_workflow(
                    connector, datasets, output_path / "workflows"
                )
                generated_files.append(workflow_file)
                logger.info(f"Generated workflow for connector {connector.id}")
            except Exception as e:
                error_msg = f"Failed to generate workflow: {e}"
                logger.error(error_msg)
                generation_errors.append(error_msg)

            # Generate metadata file
            metadata = self._generate_metadata(connector, datasets, generated_files)
            metadata_file = output_path / "metadata.json"
            with open(metadata_file, "w") as f:
                json.dump(metadata, f, indent=2, default=str)
            generated_files.append(str(metadata_file))

            if generation_errors:
                raise Exception(f"Generation completed with errors: {'; '.join(generation_errors)}")

            return {
                "status": "success",
                "output_dir": str(output_path),
                "files_generated": len(generated_files),
                "files": generated_files,
                "metadata": metadata,
            }

        except Exception as e:
            logger.error(f"Code generation failed: {e}")
            raise

    def _generate_dataset_notebook(
        self, connector: Any, dataset: Any, output_dir: Path
    ) -> str:
        """Generate PySpark notebook for a dataset."""
        template = self.env.get_template("pyspark/dataset_sync_task.py.j2")

        # Parse source_dataset (format: "schema.table")
        source_parts = dataset.source_dataset.split(".")
        if len(source_parts) != 2:
            raise ValueError(
                f"Invalid source_dataset format: {dataset.source_dataset}. Expected 'schema.table'"
            )
        source_schema, source_table = source_parts

        # Parse target_name (format: "catalog.schema.table")
        target_parts = dataset.target_name.split(".")
        if len(target_parts) == 3:
            target_catalog, target_schema, target_table = target_parts
        elif len(target_parts) == 2:
            # Default catalog
            target_catalog = "main"
            target_schema, target_table = target_parts
        else:
            raise ValueError(
                f"Invalid target_name format: {dataset.target_name}. Expected 'catalog.schema.table' or 'schema.table'"
            )

        # Prepare secret keys based on target type
        secret_scope = self.config.get("secrets", {}).get("default_scope", "nexa_connectors")
        secret_keys = self._get_secret_keys(connector.target_type, connector.id)

        # Prepare context for template rendering
        context = {
            "connector_id": connector.id,
            "connector_name": connector.name,
            "dataset_id": dataset.id,
            "dataset_name": source_table,  # Use source table as name
            "target_type": connector.target_type,
            "target_config": connector.target_config,
            "source_schema": source_schema,
            "source_table": source_table,
            "target_catalog": target_catalog,
            "target_schema": target_schema,
            "target_table": target_table,
            "incremental_column": dataset.watermark_column,  # Use watermark_column for incremental
            "execution_mode": connector.execution_mode,
            "secret_scope": secret_scope,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "custom_transformations": None,  # Can be extended later
            **secret_keys,
        }

        # Render template
        rendered = template.render(**context)

        # Write to file
        output_file = output_dir / f"{dataset.id}_sync.py"
        with open(output_file, "w") as f:
            f.write(rendered)

        return str(output_file)

    def _generate_dataset_sql(
        self, connector: Any, dataset: Any, output_dir: Path
    ) -> str:
        """Generate SQL view for a dataset."""
        template = self.env.get_template("sql/dataset_sync_view.sql.j2")

        # Parse source_dataset and target_name
        source_parts = dataset.source_dataset.split(".")
        source_schema, source_table = source_parts if len(source_parts) == 2 else ("", dataset.source_dataset)

        target_parts = dataset.target_name.split(".")
        if len(target_parts) == 3:
            target_catalog, target_schema, target_table = target_parts
        elif len(target_parts) == 2:
            target_catalog = "main"
            target_schema, target_table = target_parts
        else:
            target_catalog, target_schema, target_table = "main", "default", dataset.target_name

        context = {
            "connector_id": connector.id,
            "connector_name": connector.name,
            "dataset_id": dataset.id,
            "dataset_name": source_table,
            "source_schema": source_schema,
            "source_table": source_table,
            "target_catalog": target_catalog,
            "target_schema": target_schema,
            "target_table": target_table,
            "incremental_column": dataset.watermark_column,
            "create_materialized_view": False,  # Can be configured
            "lookback_window": "7 DAYS",
            "viewer_group": "nexa_viewers",
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }

        rendered = template.render(**context)

        output_file = output_dir / f"{dataset.id}_view.sql"
        with open(output_file, "w") as f:
            f.write(rendered)

        return str(output_file)

    def _generate_workflow(
        self, connector: Any, datasets: List[Any], output_dir: Path
    ) -> str:
        """Generate Databricks workflow YAML."""
        template = self.env.get_template("workflows/databricks_job.yml.j2")

        # Prepare datasets context
        datasets_context = []
        for dataset in datasets:
            # Parse source_dataset and target_name
            source_parts = dataset.source_dataset.split(".")
            source_schema, source_table = source_parts if len(source_parts) == 2 else ("", dataset.source_dataset)

            target_parts = dataset.target_name.split(".")
            if len(target_parts) == 3:
                target_catalog, target_schema, target_table = target_parts
            elif len(target_parts) == 2:
                target_catalog = "main"
                target_schema, target_table = target_parts
            else:
                target_catalog, target_schema, target_table = "main", "default", dataset.target_name

            datasets_context.append({
                "dataset_id": dataset.id,
                "source_schema": source_schema,
                "source_table": source_table,
                "target_catalog": target_catalog,
                "target_schema": target_schema,
                "target_table": target_table,
                "incremental_column": dataset.watermark_column,
                "timeout_seconds": 3600,  # Can be configured per dataset
                "max_retries": 2,
            })

        # Get databricks config
        databricks_config = self.config.get("databricks", {})

        context = {
            "connector_id": connector.id,
            "connector_name": connector.name,
            "target_type": connector.target_type,
            "execution_mode": connector.execution_mode,
            "schedule_cron": connector.schedule_cron,
            "compute_type": connector.compute_type,
            "cluster_config": connector.cluster_config,
            "created_by": connector.created_by,
            "datasets": datasets_context,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "git_source": None,  # Will be set during commit
            "notification_email": "alerts@example.com",  # Can be configured
            "webhook_url": None,
            "max_concurrent_runs": 1,
            "spark_version": databricks_config.get("spark_version", "13.3.x-scala2.12"),
            "node_type": databricks_config.get("node_type", "i3.xlarge"),
            "num_workers": databricks_config.get("num_workers", 2),
            "timeout_seconds": databricks_config.get("timeout_seconds", 7200),
            "notebook_base_path": databricks_config.get(
                "notebook_base_path", "/Workspace/Shared/nexa_connectors"
            ),
            "timezone": databricks_config.get("timezone", "UTC"),
        }

        rendered = template.render(**context)

        output_file = output_dir / "databricks_job.yml"
        with open(output_file, "w") as f:
            f.write(rendered)

        return str(output_file)

    def _generate_metadata(
        self, connector: Any, datasets: List[Any], generated_files: List[str]
    ) -> Dict[str, Any]:
        """Generate metadata about the generation process."""
        return {
            "connector_id": connector.id,
            "connector_name": connector.name,
            "target_type": connector.target_type,
            "execution_mode": connector.execution_mode,
            "datasets_count": len(datasets),
            "datasets": [
                {
                    "id": d.id,
                    "source": d.source_dataset,
                    "target": d.target_name,
                    "incremental": bool(d.watermark_column),
                }
                for d in datasets
            ],
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "generated_by": "nexa_api",
            "template_version": "1.0",
            "files_generated": len(generated_files),
            "files": generated_files,
        }

    def _get_secret_keys(self, target_type: str, connector_id: str) -> Dict[str, str]:
        """Get secret key names based on target type."""
        secret_keys = {}

        if target_type == "postgres":
            secret_keys = {
                "secret_key_user": f"{connector_id}_postgres_user",
                "secret_key_password": f"{connector_id}_postgres_password",
            }
        elif target_type == "s3":
            secret_keys = {
                "secret_key_access": f"{connector_id}_s3_access_key",
                "secret_key_secret": f"{connector_id}_s3_secret_key",
            }
        elif target_type == "kafka":
            secret_keys = {
                "secret_key_kafka_jaas": f"{connector_id}_kafka_jaas",
            }
        elif target_type == "snowflake":
            secret_keys = {
                "secret_key_user": f"{connector_id}_snowflake_user",
                "secret_key_password": f"{connector_id}_snowflake_password",
            }
        elif target_type == "bigquery":
            secret_keys = {
                "secret_key_credentials": f"{connector_id}_bigquery_credentials",
            }

        return secret_keys

    def get_generated_artifacts(self, artifacts_path: str) -> Dict[str, Any]:
        """
        Read and return generated artifacts from the output directory.

        Args:
            artifacts_path: Path to the generated artifacts directory

        Returns:
            Dictionary containing artifact information
        """
        output_path = Path(artifacts_path)

        if not output_path.exists():
            raise ValueError(f"Artifacts path does not exist: {artifacts_path}")

        # Read metadata
        metadata_file = output_path / "metadata.json"
        if metadata_file.exists():
            with open(metadata_file, "r") as f:
                metadata = json.load(f)
        else:
            metadata = {}

        # Collect all generated files
        artifacts = {
            "notebooks": [],
            "workflows": [],
            "sql": [],
            "metadata": metadata,
        }

        # Find all files
        for file_type, subdir in [
            ("notebooks", "notebooks"),
            ("workflows", "workflows"),
            ("sql", "sql"),
        ]:
            subdir_path = output_path / subdir
            if subdir_path.exists():
                for file_path in subdir_path.iterdir():
                    if file_path.is_file():
                        # Read file content (limit to 10KB for display)
                        try:
                            with open(file_path, "r") as f:
                                content = f.read(10240)  # Read first 10KB
                                truncated = len(content) == 10240

                            artifacts[file_type].append({
                                "filename": file_path.name,
                                "path": str(file_path),
                                "size_bytes": file_path.stat().st_size,
                                "content_preview": content,
                                "truncated": truncated,
                            })
                        except Exception as e:
                            logger.error(f"Failed to read file {file_path}: {e}")

        return artifacts
