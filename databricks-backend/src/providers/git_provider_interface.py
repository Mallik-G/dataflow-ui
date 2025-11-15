"""Git provider abstraction and factory.

Defines provider interface and concrete factory to create implementations for
GitHub, GitLab, and Azure DevOps.
"""

import base64
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional


class GitProviderConfig:
    """Configuration data class for Git providers.

    This class holds all the necessary configuration parameters required to
    connect to a Git provider's API, such as the provider type, API base URL,
    authentication credentials, and repository details.
    """

    def __init__(
        self,
        provider_type: str,
        base_url: str,
        auth_token: str,
        owner: str,
        repository: str,
        project_id: Optional[str] = None,  # For Azure DevOps
        organization: Optional[str] = None,  # For Azure DevOps
    ):
        self.provider_type = provider_type
        self.base_url = base_url
        self.auth_token = auth_token
        self.owner = owner
        self.repository = repository
        self.project_id = project_id
        self.organization = organization


class GitProviderInterface(ABC):
    """Abstract base class defining the interface for Git provider interactions.

    This class establishes a contract for all concrete Git provider
    implementations (e.g., GitHub, GitLab, Azure DevOps). It ensures that each
    provider offers a consistent set of methods for common Git operations,
    allowing the application to interact with different Git services through a
    unified interface.
    """

    def __init__(self, config: GitProviderConfig):
        self.config = config
        self.headers = self._build_headers()

    @abstractmethod
    def _build_headers(self) -> dict[str, str]:
        """Build authentication headers for the provider."""
        pass

    @abstractmethod
    def _make_request(
        self, method: str, endpoint: str, data: Optional[dict] = None
    ) -> Any:
        """Make HTTP request to provider API."""
        pass

    @abstractmethod
    def list_branches(self) -> list[str]:
        """List branch names in the repository."""
        pass

    @abstractmethod
    def get_file_content(
        self, file_path: str, branch: Optional[str] = None
    ) -> Optional[dict]:
        """Get file content from repository."""
        pass

    @abstractmethod
    def create_or_update_file(
        self,
        file_path: str,
        content: str,
        message: str,
        branch: Optional[str] = None,
        is_base64: bool = True,
    ) -> dict:
        """Create or update a file in the repository."""
        pass

    @abstractmethod
    def delete_file(
        self, file_path: str, message: str, branch: Optional[str] = None
    ) -> dict:
        """Delete a file from the repository."""
        pass

    @abstractmethod
    def get_repository_tree(self, branch: str = "main", recursive: bool = True) -> dict:
        """Get repository file tree."""
        pass

    @abstractmethod
    def create_branch(self, branch_name: str, source_branch: str = "main") -> dict:
        """Create a new branch."""
        pass

    @abstractmethod
    def create_pull_request(
        self, head_branch: str, base_branch: str, title: str, body: str = ""
    ) -> dict:
        """Create a pull request."""
        pass

    @abstractmethod
    def merge_pull_request(
        self, pr_id: Any, commit_title: Optional[str] = None, commit_message: str = ""
    ) -> dict:
        """Merge a pull request."""
        pass

    @abstractmethod
    def list_pull_requests(self, state: str = "open") -> list[dict]:
        """List pull requests."""
        pass

    @abstractmethod
    def get_branch_info(self, branch: str) -> dict:
        """Get branch information."""
        pass

    @abstractmethod
    def compare_branches(self, base_branch: str, head_branch: str) -> dict:
        """Compare two branches."""
        pass

    @abstractmethod
    def compare_commits(self, base_commit: str, head_commit: str) -> dict:
        """Compare two commits by their SHA/ID."""
        pass

    @abstractmethod
    def close_pull_request(self, pr_id: Any) -> dict:
        """Close a pull request without merging."""
        pass

    # Common utility methods
    def encode_file_content(self, file_path: str) -> str:
        """Encode file content to base64."""
        try:
            with open(file_path, "rb") as f:
                content = f.read()
                return base64.b64encode(content).decode("utf-8")
        except Exception as e:
            print(f"Failed to encode file {file_path}: {e}")
            raise

    def scan_local_changes(
        self, local_directory: str = ".", branch: str = "main"
    ) -> dict[str, list[str]]:
        """Scan local directory for changes compared to remote repository.

        Returns dict with 'modified', 'added', 'deleted' file lists.
        """
        try:
            # Get remote repository tree
            remote_tree = self.get_repository_tree(branch)
            remote_files = self._extract_files_from_tree(remote_tree)

            # Scan local files
            local_files = {}
            local_path = Path(local_directory)

            for file_path in local_path.rglob("*"):
                if file_path.is_file() and not str(file_path).startswith(".git"):
                    # Get relative path from repository root
                    rel_path = file_path.relative_to(local_path)
                    rel_path_str = str(rel_path).replace(
                        "\\", "/"
                    )  # Normalize path separators

                    # Calculate local file content hash equivalent to git blob SHA
                    with open(file_path, "rb") as f:
                        content = f.read()
                        # Git blob SHA is SHA1 of "blob {size}\0{content}"
                        import hashlib

                        blob_content = f"blob {len(content)}\0".encode() + content
                        local_sha = hashlib.sha1(blob_content).hexdigest()
                        local_files[rel_path_str] = local_sha

            # Compare local vs remote
            modified = []
            added = []
            deleted = []

            # Check for added and modified files
            for local_file, local_sha in local_files.items():
                if local_file in remote_files:
                    if local_sha != remote_files[local_file]:
                        modified.append(local_file)
                else:
                    added.append(local_file)

            # Check for deleted files
            for remote_file in remote_files:
                if remote_file not in local_files:
                    deleted.append(remote_file)

            return {"modified": modified, "added": added, "deleted": deleted}

        except Exception as e:
            print(f"Error scanning local changes: {e}")
            raise

    @abstractmethod
    def _extract_files_from_tree(self, tree_data: dict) -> dict[str, str]:
        """Extract file paths and SHAs from tree data (provider-specific)."""
        pass


class GitProviderFactory:
    """Factory class to create appropriate Git provider instances."""

    @staticmethod
    def create_provider(provider_type: str, **kwargs) -> GitProviderInterface:
        """Create a Git provider instance based on type."""
        if provider_type.lower() == "github":
            from .github_provider import GitHubProvider

            config = GitProviderConfig(
                provider_type="github",
                base_url="https://api.github.com",
                auth_token=kwargs["token"],
                owner=kwargs["owner"],
                repository=kwargs["repository"],
            )
            return GitHubProvider(config)

        elif provider_type.lower() == "azure_devops":
            from .azure_devops_provider import AzureDevOpsProvider

            config = GitProviderConfig(
                provider_type="azure_devops",
                base_url=f"https://dev.azure.com/{kwargs['organization']}",
                auth_token=kwargs["token"],
                owner=kwargs["organization"],
                repository=kwargs["repository"],
                project_id=kwargs["project"],
                organization=kwargs["organization"],
            )
            return AzureDevOpsProvider(config)

        elif provider_type.lower() == "gitlab":
            from .gitlab_provider import GitLabProvider

            base_url = kwargs.get("base_url", "https://gitlab.com")
            config = GitProviderConfig(
                provider_type="gitlab",
                base_url=f"{base_url}/api/v4",
                auth_token=kwargs["token"],
                owner=kwargs["owner"],
                repository=kwargs["repository"],
                project_id=kwargs.get("project_id"),
            )
            return GitLabProvider(config)

        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")


# Example configurations for different providers
PROVIDER_EXAMPLES = {
    "github": {
        "provider_type": "github",
        "token": "your_github_token",
        "owner": "username",
        "repository": "repo_name",
    },
    "azure_devops": {
        "provider_type": "azure_devops",
        "token": "your_azure_pat",
        "organization": "your_org",
        "project": "your_project",
        "repository": "your_repo",
    },
    "gitlab": {
        "provider_type": "gitlab",
        "token": "your_gitlab_token",
        "owner": "username",
        "repository": "repo_name",
        "project_id": "12345",  # Optional: project ID
        "base_url": "https://gitlab.com",  # Optional: for self-hosted
    },
}
