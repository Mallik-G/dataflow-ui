"""Enhanced GitOps service for Databricks-native deployment workflows."""

import asyncio
import base64
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

from ..providers.git_provider_interface import GitProviderFactory
from .databricks.databricks_repos_api import DatabricksReposAPI
from .databricks.databricks_warehouse_api import (
    DatabricksWarehouseAPI,
)
from .databricks.databricks_workspace_api import DatabricksWorkspaceAPI

logger = logging.getLogger(__name__)


@dataclass
class DeploymentEnvironment:
    """Data class representing the configuration for a single deployment environment.

    This class holds all the necessary details for deploying to a specific
    environment, such as its name, Databricks host, associated Git branch, and
    other platform-specific settings.
    """

    name: str
    display_name: str
    databricks_host: str
    workspace_id: Optional[str] = None
    git_branch: str = "main"
    workspace_folder: str = "/Workspace/nexa-x360"
    secret_scope: Optional[str] = None
    auto_deploy: bool = False
    approval_required: bool = False
    configuration: dict[str, Any] = field(default_factory=dict)


@dataclass
class BranchPromotionRule:
    """Defines a rule for promoting code between different Git branches.

    This data class specifies the source and destination branches for a promotion,
    any conditions that must be met, and whether the promotion should occur
    automatically.
    """

    from_branch: str
    to_branch: str
    conditions: list[str] = field(default_factory=list)
    auto_promote: bool = False


@dataclass
class GitOpsConfig:
    """Central configuration for the GitOps service.

    This data class holds the entire configuration for the GitOps workflow,
    including Git provider details, repository information, environment
    definitions, and promotion rules. It serves as the single source of truth
    for configuring the `GitOpsService`.
    """

    git_provider: str  # github, azure_devops, gitlab
    repository: str
    owner: str
    token: str
    base_url: Optional[str] = None
    organization: Optional[str] = None  # Azure DevOps
    project: Optional[str] = None  # Azure DevOps
    environments: list[DeploymentEnvironment] = field(default_factory=list)
    promotion_rules: list[BranchPromotionRule] = field(default_factory=list)


@dataclass
class DeploymentRequest:
    """Represents a request to perform a deployment.

    This data class captures the details of a deployment request, including the
    target environment, the specific Git commit to deploy, and who initiated
    the action.
    """

    environment_name: str
    git_commit_sha: Optional[str] = None
    deployed_by: str = "system"
    force_deploy: bool = False
    deployment_config: dict[str, Any] = field(default_factory=dict)


@dataclass
class DeploymentResult:
    """Captures the outcome of a deployment operation.

    This data class holds the results of a deployment, including a success
    flag, IDs for any created Databricks jobs or runs, a list of deployed
    assets, and any error messages.
    """

    deployment_id: str
    success: bool
    databricks_job_id: Optional[int] = None
    databricks_run_id: Optional[int] = None
    deployed_assets: list[str] = field(default_factory=list)
    error_message: Optional[str] = None
    deployment_log: Optional[str] = None


class GitOpsService:
    """Orchestrates GitOps workflows for Databricks-native deployments.

    This service provides a high-level API for managing the entire GitOps
    lifecycle, from detecting changes in a Git repository to deploying them to
    the appropriate Databricks environment. It integrates with various Git
    providers and Databricks APIs to automate deployment, promotion, and
    validation processes.
    """

    def __init__(self, config: GitOpsConfig):
        """Initialize GitOps service.

        Args:
            config: GitOps configuration
        """
        self.config = config
        self.git_provider = self._initialize_git_provider()
        self.databricks_api = None  # Will be initialized per environment

    def _initialize_git_provider(self):
        """Initialize the appropriate Git provider."""
        return GitProviderFactory.create_provider(
            provider_type=self.config.git_provider,
            token=self.config.token,
            owner=self.config.owner,
            repository=self.config.repository,
            organization=self.config.organization,
            project=self.config.project,
            base_url=self.config.base_url,
        )

    async def compute_changeset(
        self, base_branch: str, head_branch: str
    ) -> list[dict[str, str]]:
        """Compute normalized changeset between two branches using provider's compare API.

        Returns list of { path, status } where status in [added, modified, removed, renamed].
        """
        try:
            result = await asyncio.to_thread(
                self.git_provider.compare_branches, base_branch, head_branch
            )

            changes: list[dict[str, str]] = []

            # GitHub format
            if isinstance(result, dict) and "files" in result:
                for f in result.get("files", []):
                    path = f.get("filename") or f.get("previous_filename")
                    status = f.get("status") or "modified"
                    if path:
                        changes.append({"path": path, "status": status})
                return changes

            # GitLab format
            if "diffs" in result or (
                "commits" in result and "compare_timeout" in result
            ):
                for d in result.get("diffs", []):
                    # GitLab Diff attributes
                    if d.get("new_file"):
                        status = "added"
                        path = d.get("new_path")
                    elif d.get("deleted_file"):
                        status = "removed"
                        path = d.get("old_path")
                    elif d.get("renamed_file"):
                        status = "renamed"
                        path = d.get("new_path") or d.get("old_path")
                    else:
                        status = "modified"
                        path = d.get("new_path") or d.get("old_path")
                    if path:
                        changes.append({"path": path, "status": status})
                return changes

            # Azure DevOps format
            if "changes" in result:
                for c in result.get("changes", []):
                    status = (c.get("changeType") or "").lower() or "modified"
                    item = c.get("item") or {}
                    path = (item.get("path") or "").lstrip("/")
                    if path:
                        changes.append({"path": path, "status": status})
                return changes

            return []
        except Exception as e:
            logger.error(
                f"Failed to compute changeset {base_branch}...{head_branch}: {e}"
            )
            return []

    async def compute_changeset_by_commits(
        self, base_commit: str, head_commit: str
    ) -> list[dict[str, str]]:
        """Compute changeset using explicit commit SHAs/IDs when branches are missing.

        Attempts provider compare by commit; falls back to branch compare if not supported.
        """
        try:
            compare_commits = getattr(self.git_provider, "compare_commits", None)
            if callable(compare_commits):
                result = await asyncio.to_thread(
                    compare_commits, base_commit, head_commit
                )
            else:
                # Some providers accept commit ids in compare_branches; try that
                result = await asyncio.to_thread(
                    self.git_provider.compare_branches, base_commit, head_commit
                )

            return await self._normalize_compare_result(result)
        except Exception as e:
            logger.error(
                f"Failed to compute changeset by commits {base_commit}..{head_commit}: {e}"
            )
            return []

    async def _normalize_compare_result(self, result: Any) -> list[dict[str, str]]:
        """Normalize various provider compare responses into list of {path,status}."""
        changes: list[dict[str, str]] = []
        if isinstance(result, dict) and "files" in result:
            for f in result.get("files", []):
                path = f.get("filename") or f.get("previous_filename")
                status = f.get("status") or "modified"
                if path:
                    changes.append({"path": path, "status": status})
            return changes
        if isinstance(result, dict) and (
            "diffs" in result or ("commits" in result and "compare_timeout" in result)
        ):
            for d in result.get("diffs", []):
                if d.get("new_file"):
                    changes.append({"path": d.get("new_path"), "status": "added"})
                elif d.get("deleted_file"):
                    changes.append({"path": d.get("old_path"), "status": "removed"})
                elif d.get("renamed_file"):
                    changes.append(
                        {
                            "path": d.get("new_path") or d.get("old_path"),
                            "status": "renamed",
                        }
                    )
                else:
                    changes.append(
                        {
                            "path": d.get("new_path") or d.get("old_path"),
                            "status": "modified",
                        }
                    )
            return changes
        if isinstance(result, dict) and "changes" in result:
            for c in result.get("changes", []):
                status = (c.get("changeType") or "").lower() or "modified"
                item = c.get("item") or {}
                path = (item.get("path") or "").lstrip("/")
                if path:
                    changes.append({"path": path, "status": status})
            return changes
        return changes

    async def execute_sql_file(
        self,
        environment: DeploymentEnvironment,
        warehouse_id: str,
        statement: str,
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> dict[str, Any]:
        """Execute a SQL statement via Statement Execution API and return result."""
        # Note: Now using service principal authentication from settings
        if not environment.databricks_host:
            return {
                "status": "ALERT",
                "message": "Missing Databricks host in environment config",
            }
        from ..core.config import settings

        api = DatabricksWarehouseAPI(
            host=environment.databricks_host,
            client_id=settings.databricks_client_id,
            client_secret=settings.databricks_client_secret,
        )
        return await api.execute_sql(
            statement=statement,
            warehouse_id=warehouse_id,
            catalog=catalog,
            schema=schema,
            wait=True,
        )

    async def get_file_text(
        self, file_path: str, ref: Optional[str] = None
    ) -> Optional[str]:
        """Fetch file content as text for a specific ref (branch or commit).

        Handles provider-specific response shapes and base64 encodings.
        """
        try:
            raw = await asyncio.to_thread(
                self.git_provider.get_file_content, file_path, ref
            )
            if raw is None:
                return None

            # GitHub/GitLab: JSON with content + encoding (base64)
            if isinstance(raw, dict) and "content" in raw:
                content = raw.get("content") or ""
                encoding = str(raw.get("encoding") or "").lower()
                if encoding == "base64" or isinstance(content, str):
                    try:
                        # GitHub may include newlines in base64 string
                        b = base64.b64decode(str(content).encode("utf-8"))
                        return b.decode("utf-8", errors="replace")
                    except Exception:
                        # If it's not base64, return as-is
                        return str(content)

            # Azure DevOps: Items API may return { content: '...', contentMetadata: {...} }
            if isinstance(raw, dict) and ("content" in raw or "value" in raw):
                if "content" in raw and isinstance(raw.get("content"), str):
                    return str(raw.get("content"))
                # Some responses may have 'value' when asking for raw bytes; coerce to string
                val = raw.get("value")
                if isinstance(val, str):
                    return val

            # Unknown shape; attempt to coerce to string
            return str(raw)
        except Exception as e:
            logger.warning(f"Failed to fetch file text for {file_path}@{ref}: {e}")
            return None

    async def run_yaml_task(
        self, environment: DeploymentEnvironment, yaml_text: str
    ) -> list[dict[str, Any]]:
        """Parse YAML and invoke corresponding Databricks APIs.

        This is a placeholder that should be extended to map specific YAML schemas
        to the OpenAPI specs under api_docs/ and call them appropriately.
        """
        try:
            if yaml is None:
                raise RuntimeError("PyYAML not installed")
            data = yaml.safe_load(yaml_text) or {}
            # Heuristic routing
            results: list[dict[str, Any]] = []
            if "pipeline" in data or data.get("kind") == "dlt_pipeline":
                results.append(
                    {
                        "status": "INFO",
                        "message": "DLT pipeline creation not implemented yet",
                    }
                )
            elif "database" in data or data.get("ddl"):
                results.append(
                    {
                        "status": "INFO",
                        "message": "DDL creation via SQL not implemented yet",
                    }
                )
            else:
                results.append(
                    {"status": "INFO", "message": "Unknown YAML type; skipping"}
                )
            return results
        except Exception as e:
            return [{"status": "ERROR", "message": f"YAML parse error: {e}"}]

    async def get_repository_tree_normalized(self, branch: str) -> list[dict[str, str]]:
        """Return a provider-normalized repository tree for the given branch.

        Each item has at least { 'path': str, 'type': 'blob' | 'tree' }.
        """
        try:
            raw = await asyncio.to_thread(self.git_provider.get_repository_tree, branch)
            items: list[dict[str, str]] = []

            # GitHub and GitLab return a 'tree' array with { path, type }
            if isinstance(raw, dict) and "tree" in raw:
                for it in raw.get("tree", []) or []:
                    path = it.get("path")
                    typ = it.get("type") or ("blob" if it.get("size") else "tree")
                    if path:
                        items.append({"path": path, "type": typ})
                return items

            # Azure DevOps returns 'value' with isFolder + path
            if isinstance(raw, dict) and "value" in raw:
                for it in raw.get("value", []) or []:
                    path = (it.get("path") or "").lstrip("/")
                    if not path:
                        continue
                    is_folder = bool(it.get("isFolder", False))
                    items.append(
                        {"path": path, "type": "tree" if is_folder else "blob"}
                    )
                return items

            # Fallback: derive from scan of files only
            file_map = self.git_provider._extract_files_from_tree(
                raw if isinstance(raw, dict) else {}
            )
            for p in file_map.keys():
                items.append({"path": p, "type": "blob"})
            return items

        except Exception as e:
            logger.error(f"Failed to fetch repository tree for {branch}: {e}")
            return []

    async def sync_repository_to_workspace(
        self, environment: DeploymentEnvironment, branch: str, workspace_folder: str
    ) -> bool:
        """Sync Git repository to Databricks workspace using Repos API.

        Ensures a Repo is linked to the configured remote and checked out to the
        desired branch. Creates the repo if missing, otherwise updates branch.
        """
        try:
            # Build Databricks Repos client for this environment
            # Note: Now using service principal authentication from settings
            from ..core.config import settings

            repos = DatabricksReposAPI(
                host=environment.databricks_host,
                client_id=settings.databricks_client_id,
                client_secret=settings.databricks_client_secret,
            )

            # Determine provider and remote URL
            provider = self._repo_provider_string()
            remote_url = self._repo_remote_url()

            # Desired repos path (keep under /Repos). Do not reuse workspace_folder
            desired_path = f"/Repos/{self.config.owner}/{self.config.repository}"

            # Try to find an existing repo by URL or path
            existing = await repos.list_repos(path_prefix=f"/Repos/{self.config.owner}")
            items = existing.get("repos", []) if isinstance(existing, dict) else []
            found = None
            for r in items:
                if r.get("url") == remote_url or r.get("path") == desired_path:
                    found = r
                    break

            if not found:
                # Create new repo linked to remote, checked out at branch
                await repos.create_repo(
                    url=remote_url, provider=provider, path=desired_path, branch=branch
                )
                logger.info(
                    f"Created Databricks Repo at {desired_path} for {remote_url} on branch {branch}"
                )
            else:
                # Ensure correct branch is checked out
                await repos.update_repo(repo_id=found["id"], branch=branch)
                logger.info(
                    f"Updated Databricks Repo {found['id']} to branch {branch} at {found.get('path')}"
                )

            return True

        except Exception as e:
            logger.error(f"Repository sync failed: {e!s}")
            return False

    def _repo_provider_string(self) -> str:
        """Map configured git provider to Databricks Repos provider value."""
        mapping = {
            "github": "gitHub",
            "gitlab": "gitLab",
            "azure_devops": "azureDevOpsServices",
        }
        return mapping.get(self.config.git_provider, "gitHub")

    def _repo_remote_url(self) -> str:
        """Derive remote repository URL from configuration."""
        if self.config.git_provider == "github":
            return (
                f"https://github.com/{self.config.owner}/{self.config.repository}.git"
            )
        if self.config.git_provider == "gitlab":
            base = self.config.base_url or "https://gitlab.com"
            return (
                f"{base.rstrip('/')}/{self.config.owner}/{self.config.repository}.git"
            )
        if self.config.git_provider == "azure_devops":
            # https://dev.azure.com/{organization}/{project}/_git/{repository}
            org = self.config.organization or ""
            proj = self.config.project or ""
            return f"https://dev.azure.com/{org}/{proj}/_git/{self.config.repository}"
        # Default fallback
        return f"https://github.com/{self.config.owner}/{self.config.repository}.git"

    async def close_pull_request_async(self, pr_id: Any) -> bool:
        """Close a pull request without merging (async wrapper)."""
        try:
            await asyncio.to_thread(self.git_provider.close_pull_request, pr_id)
            return True
        except Exception as e:
            logger.error(f"Failed to close PR {pr_id}: {e}")
            return False

    async def _apply_changeset_to_workspace(
        self, environment: DeploymentEnvironment, changeset: list[dict[str, str]]
    ) -> None:
        """Apply normalized changeset to Databricks Workspace.

        - For .py/.sql: import as SOURCE with proper language
        - For notebooks (.ipynb): import as JUPYTER
        - For other files: skip for now (could extend to pipelines/jobs JSON)
        """
        # Note: Now using service principal authentication from settings
        from ..core.config import settings

        ws = DatabricksWorkspaceAPI(
            host=environment.databricks_host,
            client_id=settings.databricks_client_id,
            client_secret=settings.databricks_client_secret,
        )

        # Work under a workspace folder mirroring repo root
        root = environment.workspace_folder.rstrip("/")

        import base64

        for item in changeset:
            path = item.get("path")
            status = item.get("status")
            if not path or status not in {"added", "modified", "renamed"}:
                continue

            # Only handle common code assets here
            suffix = Path(path).suffix.lower()
            if suffix not in {".py", ".sql", ".ipynb"}:
                continue

            # Local file path assumption: generated assets placed under ./generated or repo checkout
            local_path = Path(path)
            if not local_path.exists():
                # Skip if not on disk yet; Repos linkage should expose the latest code for the job anyway
                logger.info(f"Skip workspace import; local file not found: {path}")
                continue

            content = local_path.read_bytes()
            b64 = base64.b64encode(content).decode("utf-8")

            if suffix == ".ipynb":
                fmt, lang = "JUPYTER", None
            elif suffix == ".sql":
                fmt, lang = "SOURCE", "SQL"
            else:
                fmt, lang = "SOURCE", "PYTHON"

            target = f"{root}/{path}".replace("//", "/")
            # Ensure target directory exists
            parent = str(Path(target).parent)
            await ws.mkdirs(parent)
            await ws.import_object(
                path=target, format=fmt, language=lang, content_base64=b64
            )
            logger.info(f"Imported to workspace: {target} ({status})")

    # ---------------------------------------------------------------------------
    # Async wrappers for common Git actions used by PR Management UI
    # ---------------------------------------------------------------------------

    async def create_branch(
        self, branch_name: str, source_branch: str = "main"
    ) -> bool:
        """Create a new branch from the given source branch."""
        try:
            await asyncio.to_thread(
                self.git_provider.create_branch, branch_name, source_branch
            )
            return True
        except Exception as e:
            logger.error(f"Failed to create branch {branch_name}: {e}")
            return False

    async def list_pull_requests(self, state: str = "open") -> list[dict[str, Any]]:
        """List pull requests for the configured repository."""
        # Avoid provider calls when repo or token not configured
        if not (self.config.owner and self.config.repository and self.config.token):
            logger.warning(
                "Git provider not configured: owner/repository/token missing; returning empty PR list"
            )
            return []
        try:
            prs = await asyncio.to_thread(self.git_provider.list_pull_requests, state)
            return prs if isinstance(prs, list) else []
        except Exception as e:
            logger.error(f"Failed to list PRs: {e}")
            return []

    async def list_branches(self) -> list[str]:
        """List branch names for the configured repository."""
        try:
            # Guard: if repo is not configured, return empty to avoid provider 404s
            if not getattr(self.config, "owner", None) or not getattr(
                self.config, "repository", None
            ):
                logger.warning(
                    "GitOpsService.list_branches called without configured owner/repository"
                )
                return []
            branches = await asyncio.to_thread(self.git_provider.list_branches)
            # Ensure unique, sorted list
            uniq = sorted({b for b in branches if isinstance(b, str) and b})
            return uniq
        except Exception as e:
            logger.error(f"Failed to list branches: {e}")
            return []

    async def get_branch_head_sha(self, branch_name: str) -> Optional[str]:
        """Get the HEAD commit SHA for a specific branch."""
        try:
            # Guard: if repo is not configured, return None
            if not getattr(self.config, "owner", None) or not getattr(
                self.config, "repository", None
            ):
                logger.warning(
                    "GitOpsService.get_branch_head_sha called without configured owner/repository"
                )
                return None

            # Use the git provider to get branch information
            if hasattr(self.git_provider, "get_branch_commit_sha"):
                sha = await asyncio.to_thread(
                    self.git_provider.get_branch_commit_sha, branch_name
                )
                return sha if isinstance(sha, str) else None
            else:
                logger.warning(
                    f"Git provider {type(self.git_provider).__name__} does not support get_branch_commit_sha"
                )
                return None

        except Exception as e:
            logger.error(f"Failed to get HEAD SHA for branch {branch_name}: {e}")
            return None

    async def create_pull_request_async(
        self, from_branch: str, to_branch: str, title: str, body: str = ""
    ) -> Optional[dict[str, Any]]:
        """Create a pull request (async wrapper)."""
        try:
            pr = await asyncio.to_thread(
                self.git_provider.create_pull_request,
                from_branch,
                to_branch,
                title,
                body,
            )
            return pr
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to create PR: {error_msg}")

            return None

    async def merge_pull_request_async(
        self, pr_id: Any, commit_title: Optional[str] = None, commit_message: str = ""
    ) -> bool:
        """Merge a pull request (async wrapper)."""
        try:
            await asyncio.to_thread(
                self.git_provider.merge_pull_request,
                pr_id,
                commit_title,
                commit_message,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to merge PR {pr_id}: {e}")
            return False

    # ---------------------------------------------------------------------------
    # Content commits and feature branch helpers
    # ---------------------------------------------------------------------------

    async def create_unique_branch(
        self, prefix: str = "feature/design", source: str = "dev"
    ) -> str:
        """Create a unique feature branch and return its name."""
        import time

        safe_prefix = prefix.strip("/").replace(" ", "-").lower() or "feature/design"
        name = f"{safe_prefix}-{int(time.time())}"
        try:
            await asyncio.to_thread(self.git_provider.create_branch, name, source)
            return name
        except Exception:
            # If branch exists, append random suffix
            import random

            alt = f"{name}-{random.randint(1000, 9999)}"
            await asyncio.to_thread(self.git_provider.create_branch, alt, source)
            return alt

    async def commit_files(
        self,
        files: list[dict[str, Any]],
        message: str,
        branch: str,
        assume_base64: bool = False,
    ) -> list[dict[str, Any]]:
        """Commit multiple files to the repository on the given branch."""
        results: list[dict[str, Any]] = []
        import base64

        for f in files:
            path = f.get("path") or ""
            content = f.get("content", "")
            is_b64 = bool(f.get("is_base64") or assume_base64)
            if not is_b64:
                content = base64.b64encode(str(content).encode("utf-8")).decode("utf-8")
                is_b64 = True
            try:
                res = await asyncio.to_thread(
                    self.git_provider.create_or_update_file,
                    path,
                    content,
                    message,
                    branch,
                    is_b64,
                )
                results.append({"path": path, "status": "ok", "result": res})
            except Exception as e:
                logger.error(f"Commit failed for {path}: {e}")
                results.append({"path": path, "status": "error", "error": str(e)})
        return results


class GitOpsConfigBuilder:
    """Builder for GitOps configuration."""

    def __init__(self):
        self.config = GitOpsConfig(
            git_provider="github", repository="", owner="", token=""
        )

    def github(self, owner: str, repository: str, token: str) -> "GitOpsConfigBuilder":
        """Configure for GitHub."""
        self.config.git_provider = "github"
        self.config.owner = owner
        self.config.repository = repository
        self.config.token = token
        return self

    def azure_devops(
        self, organization: str, project: str, repository: str, token: str
    ) -> "GitOpsConfigBuilder":
        """Configure for Azure DevOps."""
        self.config.git_provider = "azure_devops"
        self.config.organization = organization
        self.config.project = project
        self.config.repository = repository
        self.config.token = token
        return self

    def gitlab(
        self, owner: str, repository: str, token: str, base_url: Optional[str] = None
    ) -> "GitOpsConfigBuilder":
        """Configure for GitLab (supports gitlab.com or self-hosted via base_url)."""
        self.config.git_provider = "gitlab"
        self.config.owner = owner
        self.config.repository = repository
        self.config.token = token
        self.config.base_url = base_url
        return self

    def with_base_url(self, base_url: str) -> "GitOpsConfigBuilder":
        """Optionally override provider base URL (e.g., self-hosted GitLab)."""
        self.config.base_url = base_url
        return self

    def add_environment(
        self, environment: DeploymentEnvironment
    ) -> "GitOpsConfigBuilder":
        """Add environment configuration."""
        self.config.environments.append(environment)
        return self

    def add_promotion_rule(self, rule: BranchPromotionRule) -> "GitOpsConfigBuilder":
        """Add promotion rule."""
        self.config.promotion_rules.append(rule)
        return self

    def build(self) -> GitOpsConfig:
        """Build the configuration."""
        return self.config
