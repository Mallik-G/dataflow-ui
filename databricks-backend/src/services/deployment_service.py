"""
Simplified Deployment Service V2

Clean implementation of deployment orchestration with three deployment types:
1. DEPLOY - Fresh deployment (compares last successful SHA to current HEAD)
2. RESUME - Retry failed deployment including smart detect git changes

Supports two deployment engines:
1. DAB (Databricks Asset Bundles) - Declarative, recommended
2. Imperative - Direct API calls, legacy

All secrets stored in Databricks secret scope.
"""

import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session
import yaml

from ..core.config import settings
from ..core.exceptions import (
    DABValidationError,
    DABDeploymentError,
    DABDestroyError,
)
from ..models.db import Deployment, DeploymentDetail, Environment
from ..providers.git_provider_interface import GitProviderFactory, GitProviderInterface
from ..utils.secrets import SecretManager
from .databricks.databricks_jobs_api import DatabricksJobsAPI
from .databricks.databricks_repos_api import DatabricksReposAPI
from .dab_bundle_generator import DABBundleGenerator
from .dab_cli_service import DABCLIService

logger = logging.getLogger(__name__)

# File type patterns
FILE_TYPE_PATTERNS = {
    "ddl": [r"^ddl/.*\.sql$", r".*/tables/.*\.sql$", r".*/views/.*\.sql$"],
    "pipeline": [r"^pipelines/.*\.(sql|py)$", r"^dlt/.*\.(sql|py)$"],
}


# =============================================================================
# Data Classes
# =============================================================================


@dataclass
class DeploymentConfig:
    """Configuration for a deployment."""

    deployment_id: str
    environment_id: str
    databricks_host: str
    warehouse_id: str
    catalog: str
    git_repository: str
    git_branch: str
    git_provider: str  # github, gitlab, azure_devops
    databricks_client_id: str
    databricks_client_secret: str
    git_token: str


@dataclass
class FileChange:
    """Represents a file change from git."""

    file_path: str
    status: str  # added, modified, removed
    file_type: str  # ddl, pipeline, other


# =============================================================================
# Git Integration
# =============================================================================


class GitService:
    """Handles all git operations using git provider APIs."""

    def __init__(self, git_provider: GitProviderInterface):
        self.provider = git_provider

    def compare_commits(self, from_sha: str, to_sha: str) -> List[FileChange]:
        """
        Compare two commits and return list of changed files.

        Args:
            from_sha: Base commit SHA
            to_sha: Target commit SHA

        Returns:
            List of FileChange objects
        """
        logger.info(f"Comparing commits: {from_sha[:8]}...{to_sha[:8]}")

        compare_result = self.provider.compare_commits(from_sha, to_sha)

        # Handle GitHub format (files) and GitLab format (diffs)
        files = compare_result.get("files") or compare_result.get("diffs", [])

        changes = []
        for file_info in files:
            # Extract file path (different formats for different providers)
            file_path = (
                file_info.get("filename")
                or file_info.get("new_path")
                or file_info.get("old_path")
                or file_info.get("path")
            )

            if not file_path:
                continue

            # Determine status
            status = self._extract_status(file_info)
            file_type = self._classify_file_type(file_path)

            changes.append(
                FileChange(file_path=file_path, status=status, file_type=file_type)
            )

        logger.info(f"Found {len(changes)} changed files")
        return changes

    def get_branch_head_sha(self, branch: str) -> str:
        """Get the current HEAD SHA of a branch."""
        branch_info = self.provider.get_branch_info(branch)

        # GitHub format
        sha = branch_info.get("commit", {}).get("sha")

        # GitLab format
        if not sha:
            sha = branch_info.get("commit", {}).get("id")

        if not sha:
            raise ValueError(f"Could not get HEAD SHA for branch {branch}")

        logger.info(f"Branch {branch} HEAD: {sha[:8]}")
        return sha

    def _extract_status(self, file_info: Dict) -> str:
        """Extract file status from git provider response."""
        # GitHub: status field
        status = file_info.get("status", "modified")

        # GitLab: boolean flags
        if file_info.get("new_file"):
            status = "added"
        elif file_info.get("deleted_file"):
            status = "removed"
        elif file_info.get("renamed_file"):
            status = "modified"

        return status

    def _classify_file_type(self, file_path: str) -> str:
        """Classify file type based on path patterns."""
        path_lower = file_path.lower()

        for file_type, patterns in FILE_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.match(pattern, path_lower):
                    return file_type

        return "other"


# =============================================================================
# Databricks Integration
# =============================================================================


class DatabricksService:
    """Handles Databricks workspace and job operations."""

    def __init__(self, host: str, client_id: str, client_secret: str):
        self.repos_api = DatabricksReposAPI(
            host=host, client_id=client_id, client_secret=client_secret
        )
        self.jobs_api = DatabricksJobsAPI(
            host=host, client_id=client_id, client_secret=client_secret
        )

    async def sync_repository(
        self, repo_url: str, branch: str, workspace_path: str, provider: str = "github"
    ) -> str:
        """
        Sync git repository to workspace using Databricks Repos API.

        Args:
            repo_url: Git repository URL
            branch: Branch to sync
            workspace_path: Target workspace path
            provider: Git provider (github, gitlab, etc)

        Returns:
            Repository ID
        """
        logger.info(f"Syncing repository to {workspace_path} (branch: {branch})")

        try:
            # Check if repo exists
            existing_repos = await self.repos_api.list_repos()

            repo_id = None
            for repo in existing_repos:
                if repo.path == workspace_path:
                    repo_id = str(repo.id)
                    logger.info(
                        f"Found existing repo at {workspace_path} with ID: {repo_id}"
                    )
                    break

            # Create or update
            if repo_id:
                logger.info(f"Updating existing repo {repo_id} to branch: {branch}")
                await self.repos_api.update_repo(int(repo_id), branch=branch)
            else:
                logger.info(f"Creating new repo at {workspace_path} from {repo_url}")
                create_result = await self.repos_api.create_repo(
                    url=repo_url, provider=provider, path=workspace_path
                )
                repo_id = str(create_result.id)
                logger.info(
                    f"Created repo with ID: {repo_id}, updating to branch: {branch}"
                )
                await self.repos_api.update_repo(int(repo_id), branch=branch)

            # Verify repo was synced
            logger.info(f"Verifying repo sync for {repo_id}")
            repo_info = await self.repos_api.get_repo(int(repo_id))
            current_branch = repo_info.branch if hasattr(repo_info, "branch") else None
            head_commit = (
                repo_info.head_commit_id
                if hasattr(repo_info, "head_commit_id")
                else None
            )

            logger.info(
                f"Repository synced successfully: "
                f"repo_id={repo_id}, path={workspace_path}, "
                f"branch={current_branch}, commit={head_commit[:8] if head_commit else 'unknown'}"
            )

            if current_branch != branch:
                logger.warning(
                    f"Branch mismatch after sync: expected '{branch}', got '{current_branch}'. "
                    f"This may cause deployment issues."
                )

            return repo_id

        except Exception as e:
            logger.error(f"Failed to sync repository: {e}")
            logger.error(
                f"Details - url: {repo_url}, branch: {branch}, path: {workspace_path}"
            )
            raise RuntimeError(f"Repository sync failed: {str(e)}") from e

    async def trigger_deployment_job(self, job_id: str, parameters: List[str]) -> str:
        """
        Trigger the deployment job.

        Args:
            job_id: Databricks job ID
            parameters: List of command-line parameters

        Returns:
            Run ID
        """
        logger.info(f"Triggering job {job_id} with params: {parameters}")

        run_result = await self.jobs_api.run_now(
            job_id=int(job_id), python_params=parameters
        )

        run_id = str(run_result["run_id"])
        logger.info(f"Job started: run_id={run_id}")
        return run_id

    async def find_deployment_job(self) -> Optional[str]:
        """Find the persistent deployment job."""
        jobs = await self.jobs_api.list_jobs()

        for job in jobs:
            if job.get("settings", {}).get("name") == settings.deployment_job_name:
                return str(job.get("job_id"))

        return None


# =============================================================================
# Deployment Orchestration
# =============================================================================


class DeploymentOrchestrator:
    """Main orchestrator for deployment operations."""

    def __init__(self, db: Session):
        self.db = db
        self._secret_managers: Dict[str, SecretManager] = {}
        self.bundle_generator = DABBundleGenerator()
        self.dab_cli_service: Optional[DABCLIService] = None

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    async def deploy(
        self, environment_id: str, git_branch: Optional[str] = None
    ) -> Deployment:
        """
        Create and execute a new deployment.

        Routes to either DAB or imperative deployment based on configuration.

        Args:
            environment_id: Target environment ID
            git_branch: Optional branch override

        Returns:
            Deployment record
        """
        # Route to appropriate deployment engine
        if settings.deployment_engine == "dab":
            return await self._deploy_dab(environment_id, git_branch)
        else:
            return await self._deploy_imperative(environment_id, git_branch)

    async def _deploy_imperative(
        self, environment_id: str, git_branch: Optional[str] = None
    ) -> Deployment:
        """
        Create and execute a new deployment using imperative approach.

        Flow:
        1. Get environment config
        2. Find last successful deployment SHA
        3. Compare last SHA to current HEAD using git provider API
        4. Insert deployment and deployment_details records
        5. Sync repository to workspace using Databricks Repos API
        6. Trigger serverless deployment job

        Args:
            environment_id: Target environment ID
            git_branch: Optional branch override

        Returns:
            Deployment record
        """
        logger.info(
            f"=== IMPERATIVE DEPLOY: Starting new deployment for environment {environment_id} ==="
        )

        # Get environment configuration
        env = self._get_environment(environment_id)
        config = self._build_deployment_config(env, git_branch)

        # Initialize git provider
        git_provider = self._create_git_provider(config)
        git_service = GitService(git_provider)

        # Get current HEAD SHA
        current_head = git_service.get_branch_head_sha(config.git_branch)

        # Find last successful deployment
        last_success = self._get_last_successful_deployment(environment_id)
        last_sha = last_success.git_commit_sha if last_success else None

        # Calculate changes
        if last_sha:
            logger.info(
                f"Comparing from last success {last_sha[:8]} to {current_head[:8]}"
            )
            changes = git_service.compare_commits(last_sha, current_head)
        else:
            logger.info(f"First deployment - getting all files at {current_head[:8]}")
            changes = self._get_all_files_from_branch(git_provider, config.git_branch)

        if not changes:
            logger.warning("No changes detected!")
            raise ValueError("No changes to deploy")

        deployment_metadata = {
            "git_branch": config.git_branch,
            "databricks_host": config.databricks_host,
        }

        # Create deployment record
        deployment = self._create_deployment_record(
            environment_id=environment_id,
            git_branch=config.git_branch,
            git_commit_sha=current_head,
            deployment_config=deployment_metadata,
        )

        config.deployment_id = deployment.id

        # Populate deployment details
        self._populate_deployment_details(deployment.id, changes)

        # Sync repository to workspace
        workspace_path = f"{settings.deployment_workspace_path}/{deployment.id}"
        databricks_service = self._create_databricks_service(config)

        repo_id = await databricks_service.sync_repository(
            repo_url=config.git_repository,
            branch=config.git_branch,
            workspace_path=workspace_path,
            provider=config.git_provider,
        )

        logger.info(
            f"Repo synced with ID: {repo_id}. Waiting for workspace to stabilize..."
        )
        import asyncio

        await asyncio.sleep(2)  # Give Databricks a moment to fully sync files

        # Trigger deployment job
        job_id = await databricks_service.find_deployment_job()
        if not job_id:
            raise RuntimeError("Deployment job not found. Run setup first.")

        params = self._build_job_parameters(deployment.id, config)
        run_id = await databricks_service.trigger_deployment_job(job_id, params)

        # Update deployment with run ID only (job will update status to in_progress/success/failed)
        deployment.job_run_id = int(run_id)
        self.db.commit()

        logger.info(
            f"=== IMPERATIVE DEPLOY: Job triggered. Deployment ID: {deployment.id}, Run ID: {run_id} ==="
        )
        return deployment

    async def _deploy_dab(
        self, environment_id: str, git_branch: Optional[str] = None
    ) -> Deployment:
        """
        Create and execute a new deployment using DAB (Databricks Asset Bundles).

        Flow:
        1. Get environment config
        2. Find last successful deployment SHA
        3. Compare last SHA to current HEAD using git provider API
        4. Create deployment record
        5. Generate DAB bundle configuration (databricks.yml)
        6. Write bundle to disk
        7. Sync source files to bundle directory
        8. Validate bundle
        9. Deploy bundle
        10. Track results in database

        Args:
            environment_id: Target environment ID
            git_branch: Optional branch override

        Returns:
            Deployment record
        """
        logger.info(
            f"=== DAB DEPLOY: Starting new deployment for environment {environment_id} ==="
        )

        # Steps 1-3: Get config, git diff (same as imperative)
        env = self._get_environment(environment_id)
        config = self._build_deployment_config(env, git_branch)
        git_provider = self._create_git_provider(config)
        git_service = GitService(git_provider)
        current_head = git_service.get_branch_head_sha(config.git_branch)
        last_success = self._get_last_successful_deployment(environment_id)
        last_sha = last_success.git_commit_sha if last_success else None

        # Calculate changes
        if last_sha:
            logger.info(
                f"Comparing from last success {last_sha[:8]} to {current_head[:8]}"
            )
            changes = git_service.compare_commits(last_sha, current_head)
        else:
            logger.info(f"First deployment - getting all files at {current_head[:8]}")
            changes = self._get_all_files_from_branch(git_provider, config.git_branch)

        if not changes:
            logger.warning("No changes detected!")
            raise ValueError("No changes to deploy")

        deployment_metadata = {
            "git_branch": config.git_branch,
            "databricks_host": config.databricks_host,
            "deployment_method": "dab",
        }

        # Step 4: Create deployment record
        deployment = self._create_deployment_record(
            environment_id=environment_id,
            git_branch=config.git_branch,
            git_commit_sha=current_head,
            deployment_config=deployment_metadata,
        )

        config.deployment_id = deployment.id
        self._populate_deployment_details(deployment.id, changes)

        # DAB workflow starts here
        try:
            # Get deployment details for bundle generation
            details = self.db.query(DeploymentDetail).filter_by(
                deployment_id=deployment.id
            ).all()

            # Step 5: Generate DAB bundle configuration
            bundle_config_dict = {
                "databricks_host": config.databricks_host,
                "warehouse_id": config.warehouse_id,
                "catalog": config.catalog,
                "environment_id": environment_id,
                "git_branch": config.git_branch,
                "deployment_id": deployment.id,
            }
            bundle_config = self.bundle_generator.generate_bundle(
                deployment, details, bundle_config_dict
            )

            # Step 6: Create bundle directory
            bundle_dir = Path(settings.deployment_bundle_storage_path) / deployment.id
            bundle_dir.mkdir(parents=True, exist_ok=True)

            # Step 7: Write databricks.yml
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

            # Step 8: Sync source files to bundle directory
            await self._sync_source_files_to_bundle(
                git_provider, config.git_branch, details, bundle_dir
            )

            # Step 9: Initialize DAB CLI service
            self.dab_cli_service = DABCLIService(
                databricks_host=config.databricks_host,
                client_id=config.databricks_client_id,
                client_secret=config.databricks_client_secret,
            )

            # Step 10: Validate bundle
            logger.info(f"Validating DAB bundle at {bundle_dir}")
            validation_result = await self.dab_cli_service.validate_bundle(
                bundle_dir=bundle_dir,
                target=environment_id,
            )
            logger.info("Bundle validation passed")

            # Step 11: Deploy bundle
            logger.info(f"Deploying DAB bundle to {config.databricks_host}")
            deployment_result = await self.dab_cli_service.deploy_bundle(
                bundle_dir=bundle_dir,
                target=environment_id,
                auto_approve=True,
            )
            logger.info(
                f"Bundle deployed successfully: {deployment_result.get('resources', {})}"
            )

            # Step 12: Update deployment status
            deployment.status = "success"
            deployment.completed_at = datetime.now(timezone.utc)

            # Update deployment details with deployed resource IDs
            self._update_details_with_resource_ids(
                deployment.id, deployment_result.get("resources", {})
            )

            self.db.commit()

            logger.info(f"=== DAB DEPLOY: Completed successfully ===")
            return deployment

        except (DABValidationError, DABDeploymentError) as e:
            logger.error(f"DAB deployment failed: {e}")
            deployment.status = "failed"
            deployment.error_message = str(e)
            deployment.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            raise
        except Exception as e:
            logger.error(f"Unexpected error during DAB deployment: {e}", exc_info=True)
            deployment.status = "failed"
            deployment.error_message = f"Unexpected error: {str(e)}"
            deployment.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            raise

    async def resume(self, deployment_id: str) -> Deployment:
        """
        Resume a failed/partial deployment with smart code change detection.

        Flow:
        1. Validate deployment exists and can be resumed
        2. Check for code changes since last deployment attempt
        3. If code changed:
           - Add new files to deployment_details
           - Mark modified files as pending
           - Mark removed files as skipped
           - Update deployment SHA to latest
           - Sync workspace repo to latest code
        4. Trigger deployment job to process pending/failed files

        Args:
            deployment_id: Existing deployment ID

        Returns:
            Updated deployment record
        """
        logger.info(f"=== RESUME: Resuming deployment {deployment_id} ===")

        # Get existing deployment
        deployment = self.db.query(Deployment).filter_by(id=deployment_id).first()

        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        if deployment.status not in ["failed", "partial_success"]:
            raise ValueError(
                f"Cannot resume deployment with status: {deployment.status}"
            )

        # Get environment config
        env = self._get_environment(deployment.environment_id)
        config = self._build_deployment_config(env, deployment.git_branch)
        config.deployment_id = deployment.id

        # Initialize git provider
        git_provider = self._create_git_provider(config)
        git_service = GitService(git_provider)

        # Get current HEAD SHA
        current_head = git_service.get_branch_head_sha(config.git_branch)
        previous_sha = deployment.git_commit_sha

        # Check if code changed since last deployment
        if current_head != previous_sha:
            logger.info(
                f"Code changes detected: {previous_sha[:8]} → {current_head[:8]}"
            )

            # Get list of changed files
            changes = git_service.compare_commits(previous_sha, current_head)
            logger.info(f"Found {len(changes)} changed files")

            # Sync code changes to deployment_details
            self._sync_code_changes_to_details(deployment_id, changes)

            # Update deployment SHA to latest
            deployment.git_commit_sha = current_head
            self.db.commit()
            logger.info(f"Updated deployment SHA to {current_head[:8]}")
        else:
            logger.info("No code changes detected, retrying failed/pending files only")

        # Sync workspace repository to latest code
        workspace_path = f"{settings.deployment_workspace_path}/{deployment.id}"
        databricks_service = self._create_databricks_service(config)

        repo_id = await databricks_service.sync_repository(
            repo_url=config.git_repository,
            branch=config.git_branch,
            workspace_path=workspace_path,
            provider=config.git_provider,
        )
        logger.info(f"Workspace repo synced: {repo_id}")

        # Trigger deployment job
        job_id = await databricks_service.find_deployment_job()
        if not job_id:
            raise RuntimeError("Deployment job not found")

        params = self._build_job_parameters(deployment.id, config)
        run_id = await databricks_service.trigger_deployment_job(job_id, params)

        # Update deployment with run ID only (job will update status to in_progress/success/failed)
        deployment.job_run_id = int(run_id)
        self.db.commit()

        logger.info(f"=== RESUME: Job triggered. Run ID: {run_id} ===")
        return deployment

    # -------------------------------------------------------------------------
    # Helper Methods
    # -------------------------------------------------------------------------

    def _get_environment(self, environment_id: str) -> Environment:
        """Get environment by ID."""
        env = self.db.query(Environment).filter_by(id=environment_id).first()

        if not env:
            raise ValueError(f"Environment {environment_id} not found")

        return env

    def _get_secret_manager(self, databricks_host: str) -> SecretManager:
        """Return (and cache) a SecretManager for the given Databricks host."""
        if not databricks_host:
            raise ValueError("Databricks host is required for secret retrieval")

        if databricks_host not in self._secret_managers:
            self._secret_managers[databricks_host] = SecretManager(databricks_host)

        return self._secret_managers[databricks_host]

    def _build_deployment_config(
        self, env: Environment, branch_override: Optional[str] = None
    ) -> DeploymentConfig:
        """Build deployment configuration from environment metadata and secret scope."""
        databricks_host = env.databricks_host or settings.databricks_host
        if not databricks_host:
            raise ValueError(f"Environment {env.id} does not define a Databricks host")

        warehouse_id = settings.databricks_warehouse_id
        if not warehouse_id:
            raise ValueError("DATABRICKS_WAREHOUSE_ID must be configured in settings")

        catalog = settings.databricks_catalog
        if not catalog:
            raise ValueError("DATABRICKS_CATALOG must be configured in settings")

        git_repository = env.git_repository
        if not git_repository:
            raise ValueError(f"Environment {env.id} does not define a git_repository")

        git_branch = branch_override or env.target_git_branch or "main"

        secret_manager = self._get_secret_manager(databricks_host)

        databricks_client_id = secret_manager.get_secret(
            settings.secret_scope, settings.secret_key_databricks_client_id
        )
        databricks_client_secret = secret_manager.get_secret(
            settings.secret_scope, settings.secret_key_databricks_client_secret
        )
        git_token = secret_manager.get_secret(
            settings.secret_scope, settings.secret_key_git_token
        )

        if not git_token:
            raise ValueError(
                f"Git token secret '{settings.secret_key_git_token}' in scope '{settings.secret_scope}' is empty"
            )

        git_repo_lower = git_repository.lower()
        if "gitlab" in git_repo_lower:
            git_provider = "gitlab"
        elif (
            "azure" in git_repo_lower
            or "visualstudio" in git_repo_lower
            or "dev.azure" in git_repo_lower
        ):
            git_provider = "azure_devops"
        else:
            git_provider = "github"

        return DeploymentConfig(
            deployment_id="",
            environment_id=env.id,
            databricks_host=databricks_host,
            warehouse_id=warehouse_id,
            catalog=catalog,
            git_repository=git_repository,
            git_branch=git_branch,
            git_provider=git_provider,
            databricks_client_id=databricks_client_id,
            databricks_client_secret=databricks_client_secret,
            git_token=git_token,
        )

    def _create_git_provider(self, config: DeploymentConfig) -> GitProviderInterface:
        """Create git provider instance."""
        token = (config.git_token or "").strip()

        if not token:
            raise ValueError("Git token not configured in secret scope")

        # Parse owner and repo from URL
        match = re.search(r"[:/]([^/]+)/([^/]+?)(\.git)?$", config.git_repository)
        if not match:
            raise ValueError(f"Could not parse repository URL: {config.git_repository}")

        owner = match.group(1)
        repository = match.group(2)

        # Create provider
        if config.git_provider == "github":
            return GitProviderFactory.create_provider(
                provider_type="github", token=token, owner=owner, repository=repository
            )
        elif config.git_provider == "gitlab":
            return GitProviderFactory.create_provider(
                provider_type="gitlab", token=token, owner=owner, repository=repository
            )
        else:
            raise ValueError(f"Unsupported git provider: {config.git_provider}")

    def _create_databricks_service(self, config: DeploymentConfig) -> DatabricksService:
        """Create Databricks service instance."""
        return DatabricksService(
            host=config.databricks_host,
            client_id=config.databricks_client_id,
            client_secret=config.databricks_client_secret,
        )

    def _get_last_successful_deployment(
        self, environment_id: str
    ) -> Optional[Deployment]:
        """Get last successful deployment for environment."""
        dep_table = Deployment.__table__  # type: ignore[attr-defined]
        return (
            self.db.query(Deployment)
            .filter(dep_table.c.environment_id == environment_id)
            .filter(dep_table.c.status == "success")
            .order_by(dep_table.c.completed_at.desc())
            .first()
        )

    def _get_succeeded_files(self, deployment_id: str) -> Set[str]:
        """Get file paths that succeeded in a deployment."""
        detail_table = DeploymentDetail.__table__  # type: ignore[attr-defined]
        succeeded_details = (
            self.db.query(DeploymentDetail)
            .filter(detail_table.c.deployment_id == deployment_id)
            .filter(detail_table.c.deployment_status == "success")
            .all()
        )

        return {detail.file_path for detail in succeeded_details}

    def _create_deployment_record(
        self,
        environment_id: str,
        git_branch: str,
        git_commit_sha: str,
        deployment_config: Optional[Dict[str, Any]] = None,
    ) -> Deployment:
        """Create deployment database record."""
        deployment = Deployment(
            id=f"dep-{uuid.uuid4()}",
            environment_id=environment_id,
            git_branch=git_branch,
            git_commit_sha=git_commit_sha,
            status="pending",
            created_at=datetime.now(timezone.utc),
            deployment_config=deployment_config,
        )

        self.db.add(deployment)
        self.db.commit()
        self.db.refresh(deployment)

        logger.info(f"Created deployment record: {deployment.id}")
        return deployment

    def _populate_deployment_details(
        self, deployment_id: str, changes: List[FileChange]
    ) -> None:
        """Populate deployment_details table (only ddl and pipeline files)."""
        execution_order_map = {"ddl": 10, "pipeline": 20}

        details = []
        skipped_other_count = 0

        for change in changes:
            # Only include ddl and pipeline files (skip "other")
            if change.file_type not in ("ddl", "pipeline"):
                skipped_other_count += 1
                continue

            detail = DeploymentDetail(
                id=f"detail-{uuid.uuid4()}",
                deployment_id=deployment_id,
                file_path=change.file_path,
                file_type=change.file_type,
                git_status=change.status,
                deployment_status="pending",
                execution_order=execution_order_map.get(change.file_type, 99),
            )
            details.append(detail)

        if details:
            self.db.add_all(details)
            self.db.commit()
            logger.info(f"Populated {len(details)} deployment details")

        if skipped_other_count > 0:
            logger.info(
                f"Skipped {skipped_other_count} out-of-scope files (not in ddl/ or pipelines/)"
            )

    def _populate_deployment_details_with_skip(
        self,
        deployment_id: str,
        changes: List[FileChange],
        succeeded_files: Set[str],
        changed_files: Set[str],
    ) -> None:
        """
        Populate deployment_details with smart skip logic (only ddl and pipeline files).

        Skip if:
        - File succeeded in previous run AND
        - File not in new changeset (wasn't modified as part of fix)

        Deploy if:
        - File is in cumulative changeset AND
        - (File failed previously OR file was changed since failure)
        """
        execution_order_map = {"ddl": 10, "pipeline": 20}

        details = []
        skipped_count = 0
        pending_count = 0
        skipped_other_count = 0

        for change in changes:
            # Only include ddl and pipeline files (skip "other")
            if change.file_type not in ("ddl", "pipeline"):
                skipped_other_count += 1
                continue

            # Smart skip logic for in-scope files
            if (
                change.file_path in succeeded_files
                and change.file_path not in changed_files
            ):
                status = "skipped"
                skipped_count += 1
            else:
                status = "pending"
                pending_count += 1

            detail = DeploymentDetail(
                id=f"detail-{uuid.uuid4()}",
                deployment_id=deployment_id,
                file_path=change.file_path,
                file_type=change.file_type,
                git_status=change.status,
                deployment_status=status,
                execution_order=execution_order_map.get(change.file_type, 99),
            )
            details.append(detail)

        if details:
            self.db.add_all(details)
            self.db.commit()
            logger.info(
                f"Populated {len(details)} details ({pending_count} pending, {skipped_count} already deployed)"
            )

        if skipped_other_count > 0:
            logger.info(
                f"Skipped {skipped_other_count} out-of-scope files (not in ddl/ or pipelines/)"
            )

    def _sync_code_changes_to_details(
        self, deployment_id: str, changes: List[FileChange]
    ) -> None:
        """
        Sync code changes to deployment_details table.

        - Added files: Insert new records with status='pending'
        - Modified files: Update existing records to status='pending'
        - Removed files: Update existing records to status='skipped'
        - Filter out non-ddl/non-pipeline files
        """
        added_count = 0
        modified_count = 0
        removed_count = 0
        skipped_other_count = 0

        for change in changes:
            # Only process ddl and pipeline files
            if change.file_type not in ("ddl", "pipeline"):
                skipped_other_count += 1
                continue

            # Check if file already exists in deployment_details
            detail_table = DeploymentDetail.__table__  # type: ignore[attr-defined]
            existing = (
                self.db.query(DeploymentDetail)
                .filter(detail_table.c.deployment_id == deployment_id)
                .filter(detail_table.c.file_path == change.file_path)
                .first()
            )

            if change.status == "removed":
                # File was deleted → mark as skipped
                if existing:
                    existing.deployment_status = "skipped"
                    existing.git_status = "removed"
                    removed_count += 1

            elif change.status == "added":
                # New file → add to deployment_details
                if not existing:
                    self._insert_new_file_to_details(deployment_id, change)
                    added_count += 1

            elif change.status in ("modified", "renamed"):
                # File changed → mark as pending
                if existing:
                    # Only update if it was successful before (don't touch failed/pending)
                    if existing.deployment_status == "success":
                        existing.deployment_status = "pending"
                        existing.git_status = change.status
                        modified_count += 1
                else:
                    # File exists in code but not in details → add it
                    self._insert_new_file_to_details(deployment_id, change)
                    added_count += 1

        self.db.commit()

        logger.info(
            f"Code changes synced: {added_count} added, {modified_count} modified, {removed_count} removed"
        )
        if skipped_other_count > 0:
            logger.info(f"Ignored {skipped_other_count} non-deployable files")

    def _insert_new_file_to_details(
        self, deployment_id: str, file_change: FileChange
    ) -> None:
        """Insert a new file into deployment_details."""
        execution_order_map = {"ddl": 10, "pipeline": 20}

        detail = DeploymentDetail(
            id=f"detail-{uuid.uuid4()}",
            deployment_id=deployment_id,
            file_path=file_change.file_path,
            file_type=file_change.file_type,
            git_status=file_change.status,
            deployment_status="pending",
            execution_order=execution_order_map.get(file_change.file_type, 99),
        )
        self.db.add(detail)

    def _build_job_parameters(
        self, deployment_id: str, config: DeploymentConfig
    ) -> List[str]:
        """Build parameters for deployment job."""
        params: List[str] = [
            "--deployment-id",
            deployment_id,
            "--environment-id",
            config.environment_id,
        ]

        params.extend(["--databricks-host", config.databricks_host])
        params.extend(["--warehouse-id", config.warehouse_id])
        params.extend(["--catalog", config.catalog])
        params.extend(["--secret-scope", settings.secret_scope])
        params.extend(
            ["--databricks-client-id-key", settings.secret_key_databricks_client_id]
        )
        params.extend(
            [
                "--databricks-client-secret-key",
                settings.secret_key_databricks_client_secret,
            ]
        )
        params.extend(["--git-token-key", settings.secret_key_git_token])
        params.extend(
            ["--postgres-username-key", settings.secret_key_postgres_username]
        )
        params.extend(
            ["--postgres-password-key", settings.secret_key_postgres_password]
        )

        # PostgreSQL connection parameters
        if settings.postgres_host:
            params.extend(["--postgres-host", settings.postgres_host])
        if settings.postgres_port:
            params.extend(["--postgres-port", str(settings.postgres_port)])
        if settings.postgres_database:
            params.extend(["--postgres-database", settings.postgres_database])
        if settings.postgres_schema:
            params.extend(["--postgres-schema", settings.postgres_schema])

        return params

    def _get_all_files_from_branch(
        self, git_provider: GitProviderInterface, branch: str
    ) -> List[FileChange]:
        """
        Get all files from a branch (for first deployment).

        This uses the git provider's tree API to list all files.
        """
        logger.info(f"Getting all files from branch {branch}")

        tree = git_provider.get_repository_tree(branch=branch, recursive=True)

        # GitHub format
        items = tree.get("tree", [])

        # GitLab format (already unwrapped in provider)
        if not items and isinstance(tree, list):
            items = tree

        changes = []
        for item in items:
            # Skip directories
            if item.get("type") == "tree":
                continue

            file_path = item.get("path")
            if not file_path:
                continue

            file_type = self._classify_file_type(file_path)

            changes.append(
                FileChange(file_path=file_path, status="added", file_type=file_type)
            )

        logger.info(f"Found {len(changes)} files in branch")
        return changes

    def _classify_file_type(self, file_path: str) -> str:
        """Classify file type based on path."""
        path_lower = file_path.lower()

        for file_type, patterns in FILE_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.match(pattern, path_lower):
                    return file_type

        return "other"

    # -------------------------------------------------------------------------
    # DAB-Specific Helper Methods
    # -------------------------------------------------------------------------

    async def _sync_source_files_to_bundle(
        self,
        git_provider: GitProviderInterface,
        branch: str,
        details: List[DeploymentDetail],
        bundle_dir: Path,
    ) -> None:
        """
        Download source files from git and copy to bundle directory.

        Creates directory structure matching repository:
        - ddl/customers.sql
        - pipelines/bronze_ingestion.py

        Args:
            git_provider: Git provider instance
            branch: Git branch
            details: List of deployment details
            bundle_dir: Bundle directory path
        """
        logger.info(f"Syncing {len(details)} source files to bundle directory")

        for detail in details:
            try:
                # Get file content from git
                file_content = git_provider.get_file_content(
                    path=detail.file_path, ref=branch
                )

                # Decode if base64 encoded (GitHub returns base64)
                if isinstance(file_content, dict) and file_content.get("encoding") == "base64":
                    import base64
                    file_content = base64.b64decode(file_content.get("content", "")).decode("utf-8")
                elif isinstance(file_content, dict):
                    file_content = file_content.get("content", "")

                # Write to bundle directory
                target_path = bundle_dir / detail.file_path
                target_path.parent.mkdir(parents=True, exist_ok=True)

                with open(target_path, "w") as f:
                    f.write(file_content)

                logger.debug(f"Copied {detail.file_path} to bundle")

            except Exception as e:
                logger.error(f"Failed to sync file {detail.file_path}: {e}")
                raise

        logger.info(f"Successfully synced all source files to {bundle_dir}")

    def _update_details_with_resource_ids(
        self, deployment_id: str, resources: Dict[str, List[str]]
    ) -> None:
        """
        Update deployment_details with deployed resource IDs.

        Args:
            deployment_id: Deployment ID
            resources: Dict mapping resource types to lists of IDs
                      e.g., {"jobs": ["123"], "pipelines": ["abc-def"]}
        """
        if not resources:
            logger.warning("No resources returned from deployment")
            return

        logger.info(f"Updating deployment details with resource IDs: {resources}")

        # Get all details for this deployment
        details = self.db.query(DeploymentDetail).filter_by(
            deployment_id=deployment_id
        ).all()

        # Update details with resource IDs (simple mapping for now)
        # In production, you'd want more sophisticated matching logic
        job_ids = resources.get("jobs", [])
        pipeline_ids = resources.get("pipelines", [])

        job_index = 0
        pipeline_index = 0

        for detail in details:
            if detail.file_type == "ddl" and job_index < len(job_ids):
                detail.platform_object_id = job_ids[job_index]
                detail.deployment_status = "success"
                detail.deployed_at = datetime.now(timezone.utc)
                job_index += 1
            elif detail.file_type == "pipeline" and pipeline_index < len(pipeline_ids):
                detail.platform_object_id = pipeline_ids[pipeline_index]
                detail.deployment_status = "success"
                detail.deployed_at = datetime.now(timezone.utc)
                pipeline_index += 1

        self.db.commit()
        logger.info(f"Updated {len(details)} deployment details with resource IDs")
