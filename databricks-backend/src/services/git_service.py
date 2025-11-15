"""Git service for managing Git operations without platform abstraction."""

import logging
from typing import Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from ..core.config import settings
from ..models.db import Environment
from .gitops_service import GitOpsConfigBuilder, GitOpsService

logger = logging.getLogger(__name__)


def _merge_env_into_config(env: Environment) -> dict[str, Any]:
    """Build a config dict from env.configuration plus top-level fallbacks.

    Ensures keys required by GitOpsConfigBuilder are present even if only stored
    in top-level columns: git_provider, git_repository, git_owner, git_repository_name,
    git_branch (from target_git_branch).
    """
    cfg: dict[str, Any] = dict(env.configuration or {})

    # Provider
    if env.git_provider and not cfg.get("git_provider"):
        cfg["git_provider"] = env.git_provider

    # Repository URL
    if env.git_repository and not cfg.get("git_repository"):
        cfg["git_repository"] = env.git_repository

    # Branch
    if env.target_git_branch and not cfg.get("git_branch"):
        cfg["git_branch"] = env.target_git_branch

    # Derive owner/repo from repository URL when missing
    repo_url = cfg.get("git_repository") or ""
    if repo_url and (not cfg.get("git_owner") or not cfg.get("git_repository_name")):
        try:
            parsed_owner, repo_name, _, _, _ = _parse_git_url(repo_url)
            if parsed_owner and not cfg.get("git_owner"):
                cfg["git_owner"] = parsed_owner
            if repo_name and not cfg.get("git_repository_name"):
                cfg["git_repository_name"] = repo_name
        except Exception as e:
            logger.debug(f"Could not parse owner/repo from {repo_url}: {e}")

    return cfg


def get_git_client(db: Session, environment_id: Optional[str] = None) -> GitOpsService:
    """Factory function to create a configured GitOpsService client.

    Preference order:
    1) Explicit environment_id provided via API query
    2) First active environment in DB
    3) Global application settings as fallback
    """
    # 1) Try explicit environment_id
    if environment_id:
        try:
            id_col: ColumnElement[str] = Environment.__table__.c.id  # type: ignore[attr-defined]
            env = db.query(Environment).filter(id_col == environment_id).first()
            if env and env.configuration is not None:
                logger.info(
                    f"Initializing GitOpsService using environment_id={environment_id}"
                )
                return _create_gitops_service_from_config(_merge_env_into_config(env))
            else:
                logger.warning(
                    f"Environment id {environment_id} not found or has no configuration; falling back to active env."
                )
        except Exception as e:
            logger.error(f"Error loading environment {environment_id}: {e}")

    # 2) Use first active environment
    try:
        active_col: ColumnElement[bool] = Environment.is_active  # type: ignore[attr-defined]
        environment = db.query(Environment).filter(active_col.is_(True)).first()
        if environment and environment.configuration is not None:
            return _create_gitops_service_from_config(
                _merge_env_into_config(environment)
            )
    except Exception as e:
        logger.error(f"Error loading active environment: {e}")

    # 3) Fallback to global settings
    logger.warning(
        "No suitable environment found in DB, falling back to global settings for GitOpsService."
    )
    return _create_gitops_service_from_config(settings.dict())


def get_git_client_for_env(env: Environment) -> GitOpsService:
    """Construct a GitOpsService directly from a provided Environment."""
    return _create_gitops_service_from_config(_merge_env_into_config(env))


def _resolve_git_token(config: dict[str, Any]) -> str:
    """Resolve Git token from config or Databricks Secret Scope.

    Priority:
    1) configuration.git_token (direct value)
    2) Databricks Secrets using SecretManager
    """
    # 1) Direct token in config
    token = (config.get("git_token") or "").strip()
    if token:
        logger.debug("Using git_token from config")
        return token

    # 2) Databricks Secrets using standardized SecretManager
    from ..utils.secrets import SecretManager

    scope = config.get("secret_scope") or settings.secret_scope
    key = config.get("git_token_key") or settings.secret_key_git_token

    if scope and key and settings.databricks_host:
        try:
            secret_manager = SecretManager(settings.databricks_host)
            token = secret_manager.get_secret(scope, key)
            if token:
                logger.debug(f"Retrieved git_token from secret scope '{scope}'")
                return token
        except Exception as e:
            logger.error(
                f"Failed to fetch git token from secrets scope '{scope}' key '{key}': {e}"
            )

    # Last resort: empty string
    logger.warning("No git token found in config or secrets")
    return ""


def _create_gitops_service_from_config(config: dict[str, Any]) -> GitOpsService:
    """Build GitOps service from a configuration dictionary."""
    provider = (config.get("git_provider") or "github").lower()
    repository = (
        config.get("git_repository")
        or config.get("git_repository_name")
        or config.get("git_project")
        or ""
    )
    token = _resolve_git_token(config)
    owner = config.get("git_owner") or ""
    organization = config.get("git_organization") or ""
    project = config.get("git_project") or ""
    base_url = config.get("git_base_url") or ""

    print(
        f"DEBUG: Creating GitOps service with provider={provider}, owner={owner}, repo={repository}, token={token[:20] if token else 'NONE'}..."
    )

    repo_url = repository
    parsed_owner, repo_name, org_cfg, proj_cfg, base_url_cfg = _parse_git_url(
        repo_url, owner, organization, project, base_url
    )

    builder = GitOpsConfigBuilder()
    if provider in {"azure-repos", "azure_devops", "azure"}:
        gitops_config = builder.azure_devops(
            organization=org_cfg or organization,
            project=proj_cfg or project,
            repository=repo_name or repository,
            token=token,
        ).build()
    elif provider == "gitlab":
        gitops_config = builder.gitlab(
            owner=parsed_owner or owner,
            repository=repo_name or repository,
            token=token,
            base_url=base_url_cfg or base_url or "https://gitlab.com",
        ).build()
    else:  # Default to GitHub
        gitops_config = builder.github(
            owner=parsed_owner or owner, repository=repo_name or repository, token=token
        ).build()

    return GitOpsService(gitops_config)


def _parse_git_url(
    repo_url: str,
    owner: str = "",
    organization: str = "",
    project: str = "",
    base_url: str = "",
) -> tuple:
    """Parse Git URL and extract components for different providers."""
    if not repo_url:
        return owner, "", organization, project, base_url

    parsed_owner = owner
    repo_name = ""
    org_cfg = organization
    proj_cfg = project
    base_url_cfg = base_url

    try:
        if "github.com/" in repo_url:
            parts = repo_url.split("github.com/")[-1].removesuffix(".git").split("/")
            if len(parts) >= 2:
                parsed_owner, repo_name = parts[0], parts[1]
        elif "gitlab.com/" in repo_url:
            base_url_cfg = "https://gitlab.com"
            parts = repo_url.split("gitlab.com/")[-1].removesuffix(".git").split("/")
            if len(parts) >= 2:
                parsed_owner, repo_name = parts[0], parts[1]
        elif "dev.azure.com/" in repo_url and "/_git/" in repo_url:
            org_proj, repo_part = repo_url.split("dev.azure.com/")[1].split("/_git/")
            org_proj_parts = org_proj.split("/")
            org_cfg = org_proj_parts[0]
            proj_cfg = org_proj_parts[1] if len(org_proj_parts) > 1 else ""
            repo_name = repo_part.split("/")[0]
        else:
            repo_name = repo_url.rstrip("/").split("/")[-1].removesuffix(".git")

    except Exception as e:
        logger.warning(f"Failed to parse Git URL {repo_url}: {e}")

    return parsed_owner, repo_name, org_cfg, proj_cfg, base_url_cfg


async def get_changed_files(
    head_branch: str, base_branch: str, environment_config: dict[str, Any]
) -> list[dict[str, Any]]:
    """Get changed files from Git comparison.

    Falls back to scanning repository tree of head_branch when compare returns no changes,
    seeding initial deployments.
    """
    try:
        gitops_service = _create_gitops_service_from_config(environment_config)
        changeset = await gitops_service.compute_changeset(base_branch, head_branch)
        processed = await _process_changeset(changeset, gitops_service, head_branch)

        # Fallback: initial seeding when compare returns no files
        if not processed:
            try:
                tree = await gitops_service.get_repository_tree_normalized(head_branch)
                fallback_changeset: list[dict[str, str]] = []
                for it in tree:
                    path = it.get("path")
                    typ = it.get("type")
                    if not path or typ != "blob":
                        continue
                    lp = path.lower()
                    if "pipelines/" in lp or "ddl/" in lp or "jobs/" in lp:
                        fallback_changeset.append({"path": path, "status": "modified"})
                if fallback_changeset:
                    processed = await _process_changeset(
                        fallback_changeset, gitops_service, head_branch
                    )
            except Exception as fe:
                logger.warning(f"Fallback repository scan failed: {fe}")

        return processed
    except Exception as e:
        logger.error(f"Failed to get changed files from Git: {e}")
        return []


async def _process_changeset(
    changeset: list[dict[str, Any]], gitops_service: GitOpsService, ref: str
) -> list[dict[str, Any]]:
    """Process changeset into a deployment-friendly format."""
    files: list[dict[str, Any]] = []
    for change in changeset:
        file_path = change.get("path", "")
        status = change.get("status", "modified")
        if not file_path:
            continue

        file_type = "other"
        lower_path = file_path.lower()
        # Classify pipelines first to avoid misclassifying SQL under /pipelines/ as DDL
        if "pipelines/" in lower_path:
            file_type = "pipeline"
        elif "ddl/" in lower_path:
            file_type = "ddl"
        elif "jobs/" in lower_path:
            file_type = "job"

        content: Optional[str] = None
        if file_type != "other" and status != "removed":
            try:
                content = await gitops_service.get_file_text(file_path, ref=ref)
            except Exception as fe:
                logger.warning(f"Failed fetching content for {file_path}@{ref}: {fe}")

        files.append(
            {
                "file_path": file_path,
                "content": content or "",
                "file_type": file_type,
                "status": status,
            }
        )
    return files
