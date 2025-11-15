"""
DAB Bundle Generator Service

Generates Databricks Asset Bundle (DAB) configurations from deployment metadata.
Converts deployment details into declarative databricks.yml format.
"""

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..models.db import Deployment, DeploymentDetail

logger = logging.getLogger(__name__)


class DABBundleGenerator:
    """Generates DAB bundle configurations from deployment metadata."""

    def __init__(self):
        """Initialize the bundle generator."""
        pass

    def generate_bundle(
        self,
        deployment: Deployment,
        details: List[DeploymentDetail],
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate complete DAB bundle configuration.

        Args:
            deployment: Deployment record
            details: List of deployment details
            config: Deployment configuration dict with:
                - databricks_host
                - warehouse_id
                - catalog
                - environment_id
                - git_branch

        Returns:
            Dictionary representing databricks.yml configuration
        """
        logger.info(
            f"Generating DAB bundle for deployment {deployment.id} with {len(details)} files"
        )

        # Filter only deployable files (ddl, pipeline)
        deployable_details = [
            d
            for d in details
            if d.file_type in ("ddl", "pipeline") and d.deployment_status != "skipped"
        ]

        logger.info(
            f"Filtered to {len(deployable_details)} deployable files (ddl, pipeline)"
        )

        bundle_config = {
            "bundle": {
                "name": f"nexa_deployment_{deployment.id}",
            },
            "variables": self._generate_variables(config),
            "workspace": {
                "host": config.get("databricks_host", "${var.databricks_host}"),
            },
            "targets": self._generate_targets(deployment, config),
            "resources": self._generate_resources(deployable_details, config),
            "sync": self._generate_sync_config(deployable_details),
        }

        logger.info("DAB bundle configuration generated successfully")
        return bundle_config

    def _generate_variables(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate bundle variables."""
        variables = {
            "deployment_id": {
                "description": "Deployment ID",
                "default": config.get("deployment_id", "unknown"),
            },
            "environment_id": {
                "description": "Environment ID",
                "default": config.get("environment_id", "dev"),
            },
            "warehouse_id": {
                "description": "SQL Warehouse ID",
                "default": config.get("warehouse_id", ""),
            },
            "catalog": {
                "description": "Unity Catalog name",
                "default": config.get("catalog", "analytics"),
            },
            "git_branch": {
                "description": "Git branch",
                "default": config.get("git_branch", "main"),
            },
        }

        return variables

    def _generate_targets(
        self, deployment: Deployment, config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate target environment configurations."""
        deployment_id = deployment.id
        environment_name = config.get("environment_id", "dev")

        # Determine mode based on environment
        mode = "development" if environment_name in ("dev", "development") else "production"

        targets = {
            environment_name: {
                "mode": mode,
                "workspace": {
                    "root_path": f"/Workspace/.bundle/nexa/{deployment_id}",
                },
            }
        }

        return targets

    def _generate_resources(
        self, details: List[DeploymentDetail], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate resource definitions from deployment details.

        Creates:
        - Jobs for DDL files (SQL tasks)
        - Pipelines for DLT files
        """
        resources: Dict[str, Any] = {
            "jobs": {},
            "pipelines": {},
        }

        # Group files by type
        ddl_files = [d for d in details if d.file_type == "ddl"]
        pipeline_files = [d for d in details if d.file_type == "pipeline"]

        # Generate DDL job (if there are DDL files)
        if ddl_files:
            resources["jobs"]["ddl_deployment"] = self._generate_ddl_job(
                ddl_files, config
            )

        # Generate DLT pipelines (one per pipeline file or grouped)
        for pipeline_file in pipeline_files:
            pipeline_name = self._extract_pipeline_name(pipeline_file.file_path)
            resources["pipelines"][pipeline_name] = self._generate_dlt_pipeline(
                pipeline_file, config
            )

        return resources

    def _generate_ddl_job(
        self, ddl_files: List[DeploymentDetail], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a Databricks job for executing DDL files.

        Creates a job with SQL tasks for each DDL file, with dependencies
        based on execution order.
        """
        warehouse_id = config.get("warehouse_id", "${var.warehouse_id}")
        catalog = config.get("catalog", "${var.catalog}")

        # Sort by execution order
        sorted_files = sorted(ddl_files, key=lambda x: x.execution_order)

        tasks = []
        previous_task_key = None

        for idx, detail in enumerate(sorted_files):
            # Generate task key from file path
            task_key = self._generate_task_key(detail.file_path, idx)

            task = {
                "task_key": task_key,
                "sql_task": {
                    "warehouse_id": warehouse_id,
                    "file": {
                        "path": f"./{detail.file_path}",
                    },
                },
            }

            # Add dependency on previous task for sequential execution
            if previous_task_key:
                task["depends_on"] = [{"task_key": previous_task_key}]

            tasks.append(task)
            previous_task_key = task_key

        job_config = {
            "name": "DDL Deployment - ${var.deployment_id}",
            "tasks": tasks,
            "max_concurrent_runs": 1,
            "tags": {
                "deployment_id": "${var.deployment_id}",
                "environment": "${var.environment_id}",
                "deployment_type": "ddl",
            },
        }

        return job_config

    def _generate_dlt_pipeline(
        self, pipeline_detail: DeploymentDetail, config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a DLT pipeline resource.

        Creates a pipeline configuration for a DLT notebook/SQL file.
        """
        catalog = config.get("catalog", "${var.catalog}")
        pipeline_name = self._extract_pipeline_name(pipeline_detail.file_path)

        # Determine target schema from file path or default to pipeline name
        target_schema = self._extract_target_schema(pipeline_detail.file_path, pipeline_name)

        # Determine if it's a notebook or SQL file
        file_extension = Path(pipeline_detail.file_path).suffix.lower()
        is_notebook = file_extension == ".py"

        library_config = {}
        if is_notebook:
            library_config["notebook"] = {"path": f"./{pipeline_detail.file_path}"}
        else:
            library_config["file"] = {"path": f"./{pipeline_detail.file_path}"}

        pipeline_config = {
            "name": f"{pipeline_name} - ${{var.deployment_id}}",
            "catalog": catalog,
            "target": target_schema,
            "channel": "CURRENT",
            "continuous": False,
            "development": True,  # Set to False for production
            "libraries": [library_config],
            "clusters": [
                {
                    "label": "default",
                    "autoscale": {
                        "min_workers": 1,
                        "max_workers": 5,
                    },
                }
            ],
            "tags": {
                "deployment_id": "${var.deployment_id}",
                "environment": "${var.environment_id}",
                "pipeline_name": pipeline_name,
            },
        }

        return pipeline_config

    def _generate_sync_config(self, details: List[DeploymentDetail]) -> Dict[str, Any]:
        """
        Generate sync configuration for bundle deployment.

        Determines which files/directories to include/exclude.
        """
        # Extract unique directories from file paths
        directories = set()
        for detail in details:
            path_parts = Path(detail.file_path).parts
            if len(path_parts) > 1:
                directories.add(path_parts[0])

        # Generate include patterns
        include_patterns = []
        if "ddl" in directories:
            include_patterns.append("ddl/**/*.sql")
        if "pipelines" in directories:
            include_patterns.extend(["pipelines/**/*.py", "pipelines/**/*.sql"])

        # If no specific patterns, include all deployable files
        if not include_patterns:
            include_patterns = ["**/*.sql", "**/*.py"]

        sync_config = {
            "include": include_patterns,
            "exclude": [
                "*.pyc",
                "__pycache__",
                ".git",
                ".gitignore",
                "*.md",
                "tests/",
                ".databricks/",
            ],
        }

        return sync_config

    def _generate_task_key(self, file_path: str, index: int) -> str:
        """
        Generate a valid task key from a file path.

        Task keys must be alphanumeric with underscores.
        """
        # Extract file name without extension
        file_name = Path(file_path).stem

        # Replace special characters with underscores
        task_key = re.sub(r"[^a-zA-Z0-9_]", "_", file_name)

        # Ensure it starts with a letter (prepend if needed)
        if not task_key[0].isalpha():
            task_key = f"task_{task_key}"

        # Add index suffix to ensure uniqueness
        task_key = f"{task_key}_{index}"

        return task_key

    def _extract_pipeline_name(self, file_path: str) -> str:
        """
        Extract pipeline name from file path.

        Examples:
        - pipelines/bronze_ingestion.py → bronze_ingestion
        - dlt/silver/transformations.sql → silver_transformations
        """
        path = Path(file_path)
        file_name = path.stem

        # If file is in a subdirectory, include parent directory in name
        if len(path.parts) > 1:
            parent_dir = path.parts[-2]
            if parent_dir not in ("pipelines", "dlt"):
                # Include parent directory for context
                return f"{parent_dir}_{file_name}"

        return file_name

    def _extract_target_schema(self, file_path: str, default_name: str) -> str:
        """
        Extract target schema from file path or use default.

        Looks for common schema indicators in path:
        - pipelines/bronze/... → bronze
        - pipelines/silver/... → silver
        - pipelines/gold/... → gold
        """
        path_lower = file_path.lower()

        for schema in ["bronze", "silver", "gold", "raw", "curated", "analytics"]:
            if f"/{schema}/" in path_lower or path_lower.startswith(f"{schema}/"):
                return schema

        # Default to pipeline name
        return default_name

    def write_bundle_to_disk(
        self, bundle_config: Dict[str, Any], bundle_dir: Path
    ) -> Path:
        """
        Write bundle configuration to databricks.yml file.

        Args:
            bundle_config: Bundle configuration dictionary
            bundle_dir: Directory to write bundle files

        Returns:
            Path to databricks.yml file
        """
        import yaml

        # Ensure directory exists
        bundle_dir.mkdir(parents=True, exist_ok=True)

        # Write databricks.yml
        bundle_yml_path = bundle_dir / "databricks.yml"

        with open(bundle_yml_path, "w") as f:
            yaml.dump(
                bundle_config,
                f,
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True,
            )

        logger.info(f"Wrote bundle configuration to {bundle_yml_path}")
        return bundle_yml_path
