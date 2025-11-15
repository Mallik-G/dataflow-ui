"""
DAB CLI Service

Wrapper around Databricks CLI for bundle operations.
Provides async methods for validate, deploy, destroy, and run operations.
"""

import asyncio
import json
import logging
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DABCLIError(Exception):
    """Base exception for DAB CLI errors."""

    pass


class DABValidationError(DABCLIError):
    """Bundle validation failed."""

    pass


class DABDeploymentError(DABCLIError):
    """Bundle deployment failed."""

    pass


class DABDestroyError(DABCLIError):
    """Bundle destroy failed."""

    pass


class DABRunError(DABCLIError):
    """Bundle run failed."""

    pass


class DABCLIService:
    """Wrapper around Databricks CLI for bundle operations."""

    def __init__(
        self,
        databricks_host: str,
        databricks_token: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        """
        Initialize DAB CLI service.

        Args:
            databricks_host: Databricks workspace URL
            databricks_token: Personal access token (optional)
            client_id: OAuth client ID (optional)
            client_secret: OAuth client secret (optional)
        """
        self.databricks_host = databricks_host
        self.databricks_token = databricks_token
        self.client_id = client_id
        self.client_secret = client_secret

    def _get_env(self) -> Dict[str, str]:
        """
        Get environment variables for Databricks CLI.

        Returns:
            Environment dict with Databricks credentials
        """
        env = os.environ.copy()
        env["DATABRICKS_HOST"] = self.databricks_host

        # Use OAuth if client credentials provided, otherwise use token
        if self.client_id and self.client_secret:
            env["DATABRICKS_CLIENT_ID"] = self.client_id
            env["DATABRICKS_CLIENT_SECRET"] = self.client_secret
        elif self.databricks_token:
            env["DATABRICKS_TOKEN"] = self.databricks_token
        else:
            raise DABCLIError("No authentication credentials provided")

        return env

    async def validate_bundle(
        self, bundle_dir: Path, target: str = "dev"
    ) -> Dict[str, Any]:
        """
        Validate DAB bundle configuration.

        Runs: databricks bundle validate -t <target>

        Args:
            bundle_dir: Path to bundle directory containing databricks.yml
            target: Target environment (dev, staging, prod)

        Returns:
            Validation result dict

        Raises:
            DABValidationError: If validation fails
        """
        logger.info(f"Validating DAB bundle at {bundle_dir} for target {target}")

        env = self._get_env()

        try:
            result = await asyncio.create_subprocess_exec(
                "databricks",
                "bundle",
                "validate",
                "-t",
                target,
                cwd=str(bundle_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=60)

            stdout_str = stdout.decode("utf-8")
            stderr_str = stderr.decode("utf-8")

            if result.returncode != 0:
                logger.error(f"Bundle validation failed: {stderr_str}")
                raise DABValidationError(
                    f"Bundle validation failed: {stderr_str or stdout_str}"
                )

            logger.info("Bundle validation passed")
            return {
                "status": "valid",
                "stdout": stdout_str,
                "stderr": stderr_str,
            }

        except asyncio.TimeoutError:
            raise DABValidationError("Bundle validation timed out after 60 seconds")
        except FileNotFoundError:
            raise DABCLIError(
                "Databricks CLI not found. Install: pip install databricks-cli"
            )
        except Exception as e:
            logger.error(f"Bundle validation error: {e}")
            raise DABValidationError(f"Bundle validation failed: {str(e)}")

    async def deploy_bundle(
        self,
        bundle_dir: Path,
        target: str = "dev",
        auto_approve: bool = False,
        force: bool = False,
    ) -> Dict[str, Any]:
        """
        Deploy DAB bundle.

        Runs: databricks bundle deploy -t <target> [--auto-approve] [--force]

        Args:
            bundle_dir: Path to bundle directory
            target: Target environment
            auto_approve: Skip confirmation prompts
            force: Force deployment even if validation fails

        Returns:
            Deployment result dict with deployed resources

        Raises:
            DABDeploymentError: If deployment fails
        """
        logger.info(f"Deploying DAB bundle from {bundle_dir} to target {target}")

        env = self._get_env()

        cmd = ["databricks", "bundle", "deploy", "-t", target]
        if auto_approve:
            cmd.append("--auto-approve")
        if force:
            cmd.append("--force")

        try:
            result = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(bundle_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=600)

            stdout_str = stdout.decode("utf-8")
            stderr_str = stderr.decode("utf-8")

            if result.returncode != 0:
                logger.error(f"Bundle deployment failed: {stderr_str}")
                raise DABDeploymentError(
                    f"Bundle deployment failed: {stderr_str or stdout_str}"
                )

            # Parse deployment output for resource IDs
            deployed_resources = self._parse_deployment_output(stdout_str)

            logger.info(
                f"Bundle deployed successfully. Resources: {len(deployed_resources)}"
            )

            return {
                "status": "deployed",
                "resources": deployed_resources,
                "stdout": stdout_str,
                "stderr": stderr_str,
            }

        except asyncio.TimeoutError:
            raise DABDeploymentError("Bundle deployment timed out after 10 minutes")
        except FileNotFoundError:
            raise DABCLIError(
                "Databricks CLI not found. Install: pip install databricks-cli"
            )
        except Exception as e:
            logger.error(f"Bundle deployment error: {e}")
            raise DABDeploymentError(f"Bundle deployment failed: {str(e)}")

    async def destroy_bundle(
        self,
        bundle_dir: Path,
        target: str = "dev",
        auto_approve: bool = False,
    ) -> Dict[str, Any]:
        """
        Destroy DAB bundle (rollback).

        Runs: databricks bundle destroy -t <target> [--auto-approve]

        Args:
            bundle_dir: Path to bundle directory
            target: Target environment
            auto_approve: Skip confirmation prompts

        Returns:
            Destroy result dict

        Raises:
            DABDestroyError: If destroy fails
        """
        logger.info(f"Destroying DAB bundle from {bundle_dir} for target {target}")

        env = self._get_env()

        cmd = ["databricks", "bundle", "destroy", "-t", target]
        if auto_approve:
            cmd.append("--auto-approve")

        try:
            result = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(bundle_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=600)

            stdout_str = stdout.decode("utf-8")
            stderr_str = stderr.decode("utf-8")

            if result.returncode != 0:
                logger.error(f"Bundle destroy failed: {stderr_str}")
                raise DABDestroyError(
                    f"Bundle destroy failed: {stderr_str or stdout_str}"
                )

            logger.info("Bundle destroyed successfully")

            return {
                "status": "destroyed",
                "stdout": stdout_str,
                "stderr": stderr_str,
            }

        except asyncio.TimeoutError:
            raise DABDestroyError("Bundle destroy timed out after 10 minutes")
        except FileNotFoundError:
            raise DABCLIError(
                "Databricks CLI not found. Install: pip install databricks-cli"
            )
        except Exception as e:
            logger.error(f"Bundle destroy error: {e}")
            raise DABDestroyError(f"Bundle destroy failed: {str(e)}")

    async def run_bundle(
        self,
        bundle_dir: Path,
        target: str = "dev",
        resource_key: Optional[str] = None,
        params: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Run a job or pipeline from the bundle.

        Runs: databricks bundle run -t <target> <resource_key> [params...]

        Args:
            bundle_dir: Path to bundle directory
            target: Target environment
            resource_key: Resource key to run (e.g., "ddl_deployment")
            params: Additional parameters to pass to the job

        Returns:
            Run result dict with run ID

        Raises:
            DABRunError: If run fails
        """
        logger.info(
            f"Running bundle resource {resource_key} from {bundle_dir} on target {target}"
        )

        env = self._get_env()

        cmd = ["databricks", "bundle", "run", "-t", target]
        if resource_key:
            cmd.append(resource_key)
        if params:
            cmd.extend(params)

        try:
            result = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(bundle_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=300)

            stdout_str = stdout.decode("utf-8")
            stderr_str = stderr.decode("utf-8")

            if result.returncode != 0:
                logger.error(f"Bundle run failed: {stderr_str}")
                raise DABRunError(f"Bundle run failed: {stderr_str or stdout_str}")

            # Try to extract run ID from output
            run_id = self._extract_run_id(stdout_str)

            logger.info(f"Bundle run started successfully. Run ID: {run_id}")

            return {
                "status": "running",
                "run_id": run_id,
                "stdout": stdout_str,
                "stderr": stderr_str,
            }

        except asyncio.TimeoutError:
            raise DABRunError("Bundle run timed out after 5 minutes")
        except FileNotFoundError:
            raise DABCLIError(
                "Databricks CLI not found. Install: pip install databricks-cli"
            )
        except Exception as e:
            logger.error(f"Bundle run error: {e}")
            raise DABRunError(f"Bundle run failed: {str(e)}")

    def _parse_deployment_output(self, output: str) -> Dict[str, Any]:
        """
        Parse deployment output to extract deployed resource IDs.

        Looks for patterns like:
        - "Created job: <job_id>"
        - "Updated pipeline: <pipeline_id>"
        - "Deployed <resource_type> <resource_name> with ID <id>"

        Args:
            output: stdout from deployment command

        Returns:
            Dict mapping resource types to lists of IDs
        """
        resources: Dict[str, List[str]] = {
            "jobs": [],
            "pipelines": [],
            "models": [],
            "experiments": [],
        }

        # Pattern for job IDs
        job_pattern = r"(?:Created|Updated|Deployed)\s+job.*?(?:ID|id)[:\s]+(\d+)"
        job_matches = re.findall(job_pattern, output, re.IGNORECASE)
        resources["jobs"].extend(job_matches)

        # Pattern for pipeline IDs
        pipeline_pattern = r"(?:Created|Updated|Deployed)\s+pipeline.*?(?:ID|id)[:\s]+([\w-]+)"
        pipeline_matches = re.findall(pipeline_pattern, output, re.IGNORECASE)
        resources["pipelines"].extend(pipeline_matches)

        # Pattern for model IDs
        model_pattern = r"(?:Created|Updated|Deployed)\s+model.*?(?:ID|id)[:\s]+([\w-]+)"
        model_matches = re.findall(model_pattern, output, re.IGNORECASE)
        resources["models"].extend(model_matches)

        # Pattern for experiment IDs
        experiment_pattern = (
            r"(?:Created|Updated|Deployed)\s+experiment.*?(?:ID|id)[:\s]+(\d+)"
        )
        experiment_matches = re.findall(experiment_pattern, output, re.IGNORECASE)
        resources["experiments"].extend(experiment_matches)

        # Remove empty lists
        resources = {k: v for k, v in resources.items() if v}

        logger.debug(f"Parsed deployment resources: {resources}")
        return resources

    def _extract_run_id(self, output: str) -> Optional[str]:
        """
        Extract run ID from bundle run output.

        Args:
            output: stdout from run command

        Returns:
            Run ID if found, None otherwise
        """
        # Pattern for run IDs
        run_id_pattern = r"Run ID:\s*(\d+)"
        match = re.search(run_id_pattern, output, re.IGNORECASE)

        if match:
            return match.group(1)

        # Alternative pattern
        run_url_pattern = r"runs/(\d+)"
        match = re.search(run_url_pattern, output)

        if match:
            return match.group(1)

        return None

    async def check_cli_installed(self) -> bool:
        """
        Check if Databricks CLI is installed and accessible.

        Returns:
            True if CLI is installed, False otherwise
        """
        try:
            result = await asyncio.create_subprocess_exec(
                "databricks",
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            await asyncio.wait_for(result.communicate(), timeout=10)

            return result.returncode == 0

        except (FileNotFoundError, asyncio.TimeoutError):
            return False
        except Exception:
            return False

    async def get_bundle_summary(
        self, bundle_dir: Path, target: str = "dev"
    ) -> Dict[str, Any]:
        """
        Get summary of bundle resources (dry-run).

        Runs: databricks bundle summary -t <target>

        Args:
            bundle_dir: Path to bundle directory
            target: Target environment

        Returns:
            Summary dict with resource counts

        Raises:
            DABCLIError: If summary fails
        """
        logger.info(f"Getting bundle summary for {bundle_dir} target {target}")

        env = self._get_env()

        try:
            result = await asyncio.create_subprocess_exec(
                "databricks",
                "bundle",
                "summary",
                "-t",
                target,
                cwd=str(bundle_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=30)

            stdout_str = stdout.decode("utf-8")
            stderr_str = stderr.decode("utf-8")

            if result.returncode != 0:
                logger.warning(f"Bundle summary failed: {stderr_str}")
                # Summary might not be available in all CLI versions
                return {"status": "unavailable", "error": stderr_str}

            # Try to parse JSON output if available
            try:
                summary = json.loads(stdout_str)
                return {"status": "success", "summary": summary}
            except json.JSONDecodeError:
                # Return raw output if not JSON
                return {"status": "success", "output": stdout_str}

        except asyncio.TimeoutError:
            logger.warning("Bundle summary timed out")
            return {"status": "timeout"}
        except Exception as e:
            logger.warning(f"Bundle summary error: {e}")
            return {"status": "error", "error": str(e)}
