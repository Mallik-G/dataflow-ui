"""
Databricks deployment service for Nexa Connectors.

Handles deploying Asset Bundles to Databricks workspaces.
"""

import os
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Optional

from ..core.logging import get_logger

logger = get_logger(__name__)


class DatabricksDeploymentService:
    """Service for deploying artifacts to Databricks using Asset Bundles."""

    def __init__(self):
        """Initialize the deployment service."""
        self.databricks_host = os.getenv("DATABRICKS_HOST")
        self.databricks_token = os.getenv("DATABRICKS_TOKEN")

        if not self.databricks_host or not self.databricks_token:
            logger.warning("Databricks credentials not configured. Set DATABRICKS_HOST and DATABRICKS_TOKEN environment variables.")

    def deploy_debug(
        self,
        connector_id: str,
        artifacts_path: str,
        target_environment: str = "dev",
    ) -> Dict[str, Any]:
        """
        Deploy connector artifacts directly to Databricks workspace for testing (debug mode).

        This uses Databricks Asset Bundles (DAB) to deploy notebooks and workflows.

        Args:
            connector_id: Connector ID
            artifacts_path: Path to generated artifacts
            target_environment: Target environment (default: dev)

        Returns:
            Dictionary with deployment results

        Raises:
            Exception: If deployment fails
        """
        try:
            logger.info(f"Starting debug deployment for connector {connector_id} to {target_environment}")

            # Validate artifacts path exists
            artifacts_dir = Path(artifacts_path)
            if not artifacts_dir.exists():
                raise ValueError(f"Artifacts path does not exist: {artifacts_path}")

            # Create databricks.yml for Asset Bundle
            bundle_config = self._create_bundle_config(connector_id, artifacts_dir, target_environment)
            bundle_config_path = artifacts_dir / "databricks.yml"

            with open(bundle_config_path, "w") as f:
                import yaml
                yaml.dump(bundle_config, f)

            logger.info(f"Created Asset Bundle config at {bundle_config_path}")

            # Run databricks bundle deploy
            deployment_result = self._run_bundle_deploy(artifacts_dir, target_environment)

            logger.info(f"Debug deployment completed for connector {connector_id}")

            return {
                "status": "success",
                "connector_id": connector_id,
                "environment": target_environment,
                "deployment_result": deployment_result,
                "workspace_url": f"{self.databricks_host}/workspace/Shared/nexa_connectors/{connector_id}",
            }

        except Exception as e:
            logger.error(f"Debug deployment failed for connector {connector_id}: {e}")
            raise

    def _create_bundle_config(
        self,
        connector_id: str,
        artifacts_dir: Path,
        target_environment: str,
    ) -> Dict[str, Any]:
        """Create Databricks Asset Bundle configuration."""

        # Read metadata to get job config
        metadata_path = artifacts_dir / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
        else:
            metadata = {}

        # Base bundle configuration
        bundle_config = {
            "bundle": {
                "name": f"nexa_connector_{connector_id}",
            },
            "workspace": {
                "host": self.databricks_host,
            },
            "targets": {
                target_environment: {
                    "mode": "development",
                    "workspace": {
                        "root_path": f"/Workspace/Shared/nexa_connectors/{connector_id}",
                    },
                },
            },
            "resources": {
                "jobs": {},
            },
            "sync": {
                "include": [
                    "notebooks/*",
                    "workflows/*",
                ],
            },
        }

        # If workflow YAML exists, include it
        workflow_path = artifacts_dir / "workflows" / "databricks_job.yml"
        if workflow_path.exists():
            with open(workflow_path, "r") as f:
                import yaml
                workflow_config = yaml.safe_load(f)

            # Merge workflow configuration into bundle
            if "resources" in workflow_config and "jobs" in workflow_config["resources"]:
                bundle_config["resources"]["jobs"] = workflow_config["resources"]["jobs"]

        return bundle_config

    def _run_bundle_deploy(
        self,
        artifacts_dir: Path,
        target_environment: str,
    ) -> Dict[str, Any]:
        """Run databricks bundle deploy command."""
        try:
            # Set environment variables for Databricks CLI
            env = os.environ.copy()
            env["DATABRICKS_HOST"] = self.databricks_host
            env["DATABRICKS_TOKEN"] = self.databricks_token

            # Run databricks bundle validate first
            logger.info("Validating Asset Bundle...")
            validate_result = subprocess.run(
                ["databricks", "bundle", "validate", "-t", target_environment],
                cwd=str(artifacts_dir),
                capture_output=True,
                text=True,
                env=env,
                timeout=60,
            )

            if validate_result.returncode != 0:
                raise Exception(f"Bundle validation failed: {validate_result.stderr}")

            logger.info("Asset Bundle validation passed")

            # Run databricks bundle deploy
            logger.info(f"Deploying Asset Bundle to {target_environment}...")
            deploy_result = subprocess.run(
                ["databricks", "bundle", "deploy", "-t", target_environment],
                cwd=str(artifacts_dir),
                capture_output=True,
                text=True,
                env=env,
                timeout=300,  # 5 minutes timeout
            )

            if deploy_result.returncode != 0:
                raise Exception(f"Bundle deployment failed: {deploy_result.stderr}")

            logger.info("Asset Bundle deployed successfully")

            # Parse deployment output
            deployment_info = {
                "stdout": deploy_result.stdout,
                "stderr": deploy_result.stderr,
                "returncode": deploy_result.returncode,
            }

            return deployment_info

        except subprocess.TimeoutExpired as e:
            raise Exception(f"Deployment timed out: {str(e)}")
        except FileNotFoundError:
            raise Exception(
                "Databricks CLI not found. Please install it: pip install databricks-cli"
            )
        except Exception as e:
            raise Exception(f"Deployment command failed: {str(e)}")

    def upload_notebooks(
        self,
        connector_id: str,
        notebooks_dir: Path,
        workspace_path: str,
    ) -> Dict[str, Any]:
        """
        Upload notebooks directly to Databricks workspace.

        This is an alternative to Asset Bundles for simpler deployments.

        Args:
            connector_id: Connector ID
            notebooks_dir: Path to notebooks directory
            workspace_path: Target workspace path

        Returns:
            Dictionary with upload results
        """
        try:
            logger.info(f"Uploading notebooks for connector {connector_id}")

            env = os.environ.copy()
            env["DATABRICKS_HOST"] = self.databricks_host
            env["DATABRICKS_TOKEN"] = self.databricks_token

            uploaded_files = []

            # Upload each notebook
            for notebook_file in notebooks_dir.glob("*.py"):
                target_path = f"{workspace_path}/{notebook_file.stem}"

                result = subprocess.run(
                    [
                        "databricks",
                        "workspace",
                        "import",
                        str(notebook_file),
                        target_path,
                        "--language", "PYTHON",
                        "--overwrite",
                    ],
                    capture_output=True,
                    text=True,
                    env=env,
                    timeout=60,
                )

                if result.returncode != 0:
                    logger.error(f"Failed to upload {notebook_file.name}: {result.stderr}")
                else:
                    logger.info(f"Uploaded {notebook_file.name} to {target_path}")
                    uploaded_files.append({
                        "file": notebook_file.name,
                        "workspace_path": target_path,
                    })

            return {
                "status": "success",
                "uploaded_files": uploaded_files,
                "workspace_path": workspace_path,
            }

        except Exception as e:
            logger.error(f"Failed to upload notebooks: {e}")
            raise

    def get_deployment_status(
        self,
        connector_id: str,
        workspace_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get deployment status for a connector.

        Args:
            connector_id: Connector ID
            workspace_path: Optional workspace path (defaults to standard path)

        Returns:
            Dictionary with deployment status
        """
        try:
            if workspace_path is None:
                workspace_path = f"/Workspace/Shared/nexa_connectors/{connector_id}"

            env = os.environ.copy()
            env["DATABRICKS_HOST"] = self.databricks_host
            env["DATABRICKS_TOKEN"] = self.databricks_token

            # Check if workspace path exists
            result = subprocess.run(
                ["databricks", "workspace", "list", workspace_path],
                capture_output=True,
                text=True,
                env=env,
                timeout=30,
            )

            if result.returncode == 0:
                return {
                    "deployed": True,
                    "workspace_path": workspace_path,
                    "files": result.stdout.strip().split("\n"),
                }
            else:
                return {
                    "deployed": False,
                    "workspace_path": workspace_path,
                    "message": "Not deployed to workspace",
                }

        except Exception as e:
            logger.error(f"Failed to get deployment status: {e}")
            return {
                "deployed": False,
                "error": str(e),
            }

    def delete_deployment(
        self,
        connector_id: str,
        workspace_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Delete deployment from Databricks workspace.

        Args:
            connector_id: Connector ID
            workspace_path: Optional workspace path (defaults to standard path)

        Returns:
            Dictionary with deletion results
        """
        try:
            if workspace_path is None:
                workspace_path = f"/Workspace/Shared/nexa_connectors/{connector_id}"

            env = os.environ.copy()
            env["DATABRICKS_HOST"] = self.databricks_host
            env["DATABRICKS_TOKEN"] = self.databricks_token

            # Delete workspace directory
            result = subprocess.run(
                ["databricks", "workspace", "delete", workspace_path, "--recursive"],
                capture_output=True,
                text=True,
                env=env,
                timeout=60,
            )

            if result.returncode == 0:
                logger.info(f"Deleted deployment for connector {connector_id}")
                return {
                    "status": "success",
                    "message": f"Deployment deleted from {workspace_path}",
                }
            else:
                raise Exception(f"Failed to delete deployment: {result.stderr}")

        except Exception as e:
            logger.error(f"Failed to delete deployment: {e}")
            raise
