"""
Git Commit Service

Handles committing generated files to git repositories.
"""

import logging
from typing import Any, Dict, List, Optional

from ..providers.git_provider_interface import GitProviderInterface, GitProviderFactory
from ..models.db import Environment
from ..utils.secrets import SecretManager
from ..core.config import settings

logger = logging.getLogger(__name__)


class GitCommitService:
    """Service for committing files to git repositories."""

    def __init__(self, git_provider: GitProviderInterface):
        """
        Initialize git commit service.

        Args:
            git_provider: Git provider instance (GitHub, GitLab, etc.)
        """
        self.git_provider = git_provider

    @classmethod
    def from_environment(
        cls, environment: Environment, databricks_host: str
    ) -> "GitCommitService":
        """
        Create GitCommitService from environment configuration.

        Args:
            environment: Environment record with git configuration
            databricks_host: Databricks host for secret retrieval

        Returns:
            GitCommitService instance
        """
        # Get git token from secrets
        secret_manager = SecretManager(databricks_host)
        git_token = secret_manager.get_secret(
            settings.secret_scope, settings.secret_key_git_token
        )

        if not git_token:
            raise ValueError("Git token not configured in secret scope")

        # Parse repository URL
        import re

        git_repo = environment.git_repository
        if not git_repo:
            raise ValueError(f"Environment {environment.id} has no git repository")

        # Extract owner and repository from URL
        match = re.search(r"[:/]([^/]+)/([^/]+?)(\.git)?$", git_repo)
        if not match:
            raise ValueError(f"Could not parse repository URL: {git_repo}")

        owner = match.group(1)
        repository = match.group(2)

        # Determine provider type
        provider_type = environment.git_provider or "github"

        # Create git provider
        git_provider = GitProviderFactory.create_provider(
            provider_type=provider_type,
            token=git_token,
            owner=owner,
            repository=repository,
        )

        return cls(git_provider)

    async def commit_files(
        self,
        files: List[Dict[str, str]],
        branch: str,
        commit_message: str,
        author_name: Optional[str] = None,
        author_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Commit files to git repository.

        Args:
            files: List of files to commit
                [
                    {"path": "ddl/customers.sql", "content": "CREATE TABLE..."},
                    ...
                ]
            branch: Target branch
            commit_message: Commit message
            author_name: Commit author name (optional)
            author_email: Commit author email (optional)

        Returns:
            Commit result
                {
                    "commit_sha": "abc123",
                    "branch": "feature/my-pipeline",
                    "files_committed": 5,
                    "commit_url": "https://github.com/..."
                }
        """
        logger.info(
            f"Committing {len(files)} files to branch {branch}"
        )

        committed_files = []

        try:
            # Commit each file
            for file in files:
                file_path = file.get("path")
                content = file.get("content")

                if not file_path or content is None:
                    logger.warning(f"Skipping invalid file: {file}")
                    continue

                # Check if file exists
                try:
                    existing_file = self.git_provider.get_file_content(
                        path=file_path, ref=branch
                    )
                    file_exists = True
                    file_sha = existing_file.get("sha") if isinstance(existing_file, dict) else None
                except Exception:
                    file_exists = False
                    file_sha = None

                # Commit file (create or update)
                commit_result = self.git_provider.commit_file(
                    path=file_path,
                    content=content,
                    message=commit_message,
                    branch=branch,
                    sha=file_sha,  # Required for updates
                )

                committed_files.append(
                    {
                        "path": file_path,
                        "action": "updated" if file_exists else "created",
                        "commit_sha": commit_result.get("commit", {}).get("sha"),
                    }
                )

                logger.info(
                    f"{'Updated' if file_exists else 'Created'} {file_path} in {branch}"
                )

            # Get final commit SHA (from last commit)
            final_commit_sha = (
                committed_files[-1]["commit_sha"] if committed_files else None
            )

            logger.info(
                f"Successfully committed {len(committed_files)} files to {branch}"
            )

            return {
                "commit_sha": final_commit_sha,
                "branch": branch,
                "files_committed": len(committed_files),
                "files": committed_files,
                "commit_url": self._get_commit_url(final_commit_sha),
            }

        except Exception as e:
            logger.error(f"Git commit error: {e}", exc_info=True)
            raise RuntimeError(f"Failed to commit files: {str(e)}")

    async def create_pull_request(
        self,
        source_branch: str,
        target_branch: str,
        title: str,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a pull request.

        Args:
            source_branch: Source branch (with changes)
            target_branch: Target branch (e.g., main)
            title: PR title
            description: PR description (optional)

        Returns:
            PR result
                {
                    "pr_number": 123,
                    "pr_url": "https://github.com/.../pull/123",
                    "state": "open"
                }
        """
        logger.info(f"Creating PR: {source_branch} → {target_branch}")

        try:
            pr_result = self.git_provider.create_pull_request(
                title=title,
                body=description or "",
                head=source_branch,
                base=target_branch,
            )

            pr_number = pr_result.get("number")
            pr_url = pr_result.get("html_url") or pr_result.get("web_url")

            logger.info(f"Created PR #{pr_number}: {pr_url}")

            return {
                "pr_number": pr_number,
                "pr_url": pr_url,
                "state": pr_result.get("state", "open"),
            }

        except Exception as e:
            logger.error(f"PR creation error: {e}", exc_info=True)
            raise RuntimeError(f"Failed to create pull request: {str(e)}")

    async def get_branch_info(self, branch: str) -> Dict[str, Any]:
        """
        Get branch information.

        Args:
            branch: Branch name

        Returns:
            Branch info
                {
                    "name": "main",
                    "commit_sha": "abc123",
                    "commit_message": "...",
                    "exists": true
                }
        """
        try:
            branch_info = self.git_provider.get_branch_info(branch)

            commit_sha = branch_info.get("commit", {}).get("sha") or branch_info.get(
                "commit", {}
            ).get("id")

            return {
                "name": branch,
                "commit_sha": commit_sha,
                "exists": True,
            }

        except Exception as e:
            logger.warning(f"Branch {branch} not found: {e}")
            return {"name": branch, "exists": False}

    async def create_branch(
        self, branch_name: str, from_branch: str = "main"
    ) -> Dict[str, Any]:
        """
        Create a new branch.

        Args:
            branch_name: New branch name
            from_branch: Branch to create from (default: main)

        Returns:
            Branch info
                {
                    "name": "feature/my-branch",
                    "commit_sha": "abc123",
                    "created": true
                }
        """
        logger.info(f"Creating branch {branch_name} from {from_branch}")

        try:
            # Get base branch info
            base_info = await self.get_branch_info(from_branch)

            if not base_info.get("exists"):
                raise ValueError(f"Base branch {from_branch} does not exist")

            # Create branch
            branch_result = self.git_provider.create_branch(
                branch=branch_name, sha=base_info["commit_sha"]
            )

            logger.info(f"Created branch {branch_name}")

            return {
                "name": branch_name,
                "commit_sha": base_info["commit_sha"],
                "created": True,
            }

        except Exception as e:
            logger.error(f"Branch creation error: {e}", exc_info=True)
            raise RuntimeError(f"Failed to create branch: {str(e)}")

    def _get_commit_url(self, commit_sha: Optional[str]) -> Optional[str]:
        """
        Get commit URL from SHA.

        Args:
            commit_sha: Commit SHA

        Returns:
            Commit URL or None
        """
        if not commit_sha:
            return None

        # This is provider-specific, would need to be implemented in git_provider
        # For now, return None
        return None
