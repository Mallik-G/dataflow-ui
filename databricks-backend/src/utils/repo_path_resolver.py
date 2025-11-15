"""Repository path resolution utilities for Databricks workspace repos.

This module provides centralized path management for Databricks repository operations,
ensuring consistent path handling across all services and supporting configurable
base paths for different environments.
"""

import logging
from typing import Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class RepoPathResolver:
    """Centralized repository path resolver for Databricks workspace operations.

    This class provides consistent path generation and validation for Databricks
    repository operations, supporting configurable base paths and environment-specific
    path isolation.
    """

    def __init__(
        self, base_path: Optional[str] = None, path_template: Optional[str] = None
    ):
        """Initialize the repository path resolver.

        Args:
            base_path: Custom base path override
            path_template: Custom path template override
        """
        self.base_path = base_path or "/Repos"
        self.path_template = path_template or "{base_path}/{owner}/{repo_name}"

    def get_workspace_repo_path(
        self, repo_name: str, environment_config: Optional[dict[str, Any]] = None
    ) -> str:
        """Generate workspace repository path for a given repository name.

        Args:
            repo_name: Name of the repository
            environment_config: Optional environment-specific configuration

        Returns:
            Full workspace path for the repository
        """
        # Extract repo name from URL if needed
        clean_repo_name = self._extract_repo_name(repo_name)

        # Get base path (environment-specific or default)
        base_path = self._get_effective_base_path(environment_config)

        # Generate full path using template
        full_path = self.path_template.format(
            base_path=base_path, repo_name=clean_repo_name
        )

        logger.debug(f"Generated workspace repo path: {full_path}")
        return full_path

    def get_parent_directory(
        self, environment_config: Optional[dict[str, Any]] = None
    ) -> str:
        """Get the parent directory for repository operations.

        Args:
            environment_config: Optional environment-specific configuration

        Returns:
            Parent directory path
        """
        return self._get_effective_base_path(environment_config)

    def get_list_prefix(
        self, environment_config: Optional[dict[str, Any]] = None
    ) -> str:
        """Get the path prefix for listing repositories.

        Args:
            environment_config: Optional environment-specific configuration

        Returns:
            Path prefix for repository listing operations
        """
        return self._get_effective_base_path(environment_config)

    def get_unique_repo_path(
        self,
        repo_name: str,
        timestamp: int,
        environment_config: Optional[dict[str, Any]] = None,
    ) -> str:
        """Generate unique repository path with timestamp suffix.

        Args:
            repo_name: Name of the repository
            timestamp: Timestamp for uniqueness
            environment_config: Optional environment-specific configuration

        Returns:
            Unique workspace path for the repository
        """
        clean_repo_name = self._extract_repo_name(repo_name)
        unique_repo_name = f"{clean_repo_name}-{timestamp}"
        return self.get_workspace_repo_path(unique_repo_name, environment_config)

    def validate_path(self, path: str) -> bool:
        """Validate that a path is within allowed repository directories.

        Args:
            path: Path to validate

        Returns:
            True if path is valid, False otherwise
        """
        # Ensure path starts with /Workspace/Repos or /Repos
        if not (path.startswith("/Workspace/Repos") or path.startswith("/Repos")):
            logger.warning(f"Invalid repository path: {path}")
            return False

        # Ensure no path traversal attempts
        if ".." in path or "//" in path:
            logger.warning(f"Suspicious path detected: {path}")
            return False

        return True

    def normalize_path(self, path: str) -> str:
        """Normalize a repository path by removing trailing slashes and redundant separators.

        Args:
            path: Path to normalize

        Returns:
            Normalized path
        """
        # Remove trailing slashes
        normalized = path.rstrip("/")

        # Replace multiple slashes with single slash
        while "//" in normalized:
            normalized = normalized.replace("//", "/")

        return normalized

    def _extract_repo_name(self, repo_identifier: str) -> str:
        """Extract repository name from URL or path.

        Args:
            repo_identifier: Repository URL, path, or name

        Returns:
            Clean repository name
        """
        # If it's a URL, extract the repo name
        if repo_identifier.startswith(("http://", "https://")):
            parsed_url = urlparse(repo_identifier)
            repo_name = parsed_url.path.split("/")[-1]
            # Remove .git suffix if present
            repo_name = repo_name.replace(".git", "")
        # If it's a path, get the last component
        elif "/" in repo_identifier:
            repo_name = repo_identifier.split("/")[-1]
        # Otherwise, use as-is
        else:
            repo_name = repo_identifier

        # Clean up any remaining artifacts
        repo_name = repo_name.replace(".git", "").strip()

        if not repo_name:
            repo_name = "nexa-repo"

        return repo_name

    def _get_effective_base_path(
        self, environment_config: Optional[dict[str, Any]] = None
    ) -> str:
        """Get the effective base path, considering environment-specific overrides.

        Args:
            environment_config: Optional environment-specific configuration

        Returns:
            Effective base path to use
        """
        if environment_config:
            # Check for direct repo_base_path in environment_config
            if "repo_base_path" in environment_config:
                env_base_path = environment_config["repo_base_path"]
                logger.debug(
                    f"Using environment-specific repo base path: {env_base_path}"
                )
                return env_base_path

            # Check for repo_base_path in nested configuration JSON
            if "configuration" in environment_config and isinstance(
                environment_config["configuration"], dict
            ):
                nested_config = environment_config["configuration"]
                if "repo_base_path" in nested_config:
                    env_base_path = nested_config["repo_base_path"]
                    logger.debug(
                        f"Using nested environment-specific repo base path: {env_base_path}"
                    )
                    return env_base_path

            # Check for environment name-based path customization
            if "environment_name" in environment_config:
                env_name = environment_config["environment_name"]
                env_base_path = f"{self.base_path}-{env_name}"
                logger.debug(
                    f"Using environment-name-based repo base path: {env_base_path}"
                )
                return env_base_path

        # Use global default
        logger.debug(f"Using default repo base path: {self.base_path}")
        return self.base_path

    @classmethod
    def create_from_environment(
        cls, environment_config: dict[str, Any]
    ) -> "RepoPathResolver":
        """Create a RepoPathResolver instance configured for a specific environment.

        Args:
            environment_config: Environment configuration dictionary

        Returns:
            Configured RepoPathResolver instance
        """
        base_path = environment_config.get("repo_base_path", "/Repos")
        path_template = environment_config.get(
            "repo_path_template", "{base_path}/{owner}/{repo_name}"
        )

        return cls(base_path=base_path, path_template=path_template)


# Global instance for convenience
default_resolver = RepoPathResolver()
