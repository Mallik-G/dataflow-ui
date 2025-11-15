from typing import Any, Optional

import requests

from .git_provider_interface import GitProviderInterface


class GitHubProvider(GitProviderInterface):
    """A Git provider implementation for interacting with the GitHub API.

    This class implements the `GitProviderInterface` and provides concrete
    methods for performing Git operations such as listing branches, managing
    files, and creating pull requests on a GitHub repository.
    """

    def _build_headers(self) -> dict[str, str]:
        """Build GitHub-specific authentication headers"""
        return {
            "Authorization": f"token {self.config.auth_token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        }

    def list_branches(self) -> list[str]:
        """List branch names in the repository."""
        endpoint = f"/repos/{self.config.owner}/{self.config.repository}/branches"
        branches: list[str] = []
        page = 1
        per_page = 100
        while True:
            params = {"per_page": per_page, "page": page}
            result = self._make_request("GET", endpoint, params)
            if not isinstance(result, list) or not result:
                break
            names = [
                str(b.get("name"))
                for b in result
                if isinstance(b, dict) and b.get("name")
            ]
            branches.extend(names)
            if len(result) < per_page:
                break
            page += 1
        return branches

    def _make_request(
        self, method: str, endpoint: str, data: Optional[dict] = None
    ) -> Any:
        """Make HTTP request to GitHub API."""
        url = f"{self.config.base_url}{endpoint}"

        try:
            # Log request details for debugging
            print(f"DEBUG: Making {method} request to {url}")
            print(f"DEBUG: Headers: {dict(self.headers)}")
            if data:
                print(f"DEBUG: Data: {data}")

            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=data)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=self.headers, json=data)
            elif method.upper() == "PATCH":
                response = requests.patch(url, headers=self.headers, json=data)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, json=data)

            print(f"DEBUG: Response status: {response.status_code}")
            response.raise_for_status()
            return response.json() if response.content else {}

        except requests.exceptions.RequestException as e:
            print(f"❌ GitHub API request failed: {e}")
            print(f"📍 URL: {url}")
            print(
                f"🔑 Auth header: Authorization: {self.headers.get('Authorization', 'MISSING')[:30]}..."
            )
            if hasattr(e, "response") and e.response is not None:
                print(f"📝 Response: {e.response.text}")
            raise

    def get_file_content(
        self, file_path: str, branch: Optional[str] = None
    ) -> Optional[dict]:
        """Get file content from GitHub repository."""
        try:
            endpoint = f"/repos/{self.config.owner}/{self.config.repository}/contents/{file_path}"
            params = {"ref": branch} if branch else {}
            return self._make_request("GET", endpoint, params)
        except Exception:
            return None

    def create_or_update_file(
        self,
        file_path: str,
        content: str,
        message: str,
        branch: Optional[str] = None,
        is_base64: bool = True,
    ) -> dict:
        """Create or update a file in GitHub repository."""
        endpoint = (
            f"/repos/{self.config.owner}/{self.config.repository}/contents/{file_path}"
        )

        # Get current file SHA if it exists
        current_file = self.get_file_content(file_path, branch)

        data = {
            "message": message,
            "content": content if is_base64 else self.encode_file_content(content),
        }

        if branch:
            data["branch"] = branch

        if current_file:
            data["sha"] = current_file["sha"]

        result = self._make_request("PUT", endpoint, data)
        print(f"{'Updated' if current_file else 'Created'} file: {file_path}")
        return result

    def delete_file(
        self, file_path: str, message: str, branch: Optional[str] = None
    ) -> dict:
        """Delete a file from GitHub repository."""
        endpoint = (
            f"/repos/{self.config.owner}/{self.config.repository}/contents/{file_path}"
        )

        # Get current file SHA
        current_file = self.get_file_content(file_path, branch)
        if not current_file:
            raise ValueError(f"File {file_path} not found")

        data = {"message": message, "sha": current_file["sha"]}

        if branch:
            data["branch"] = branch

        return self._make_request("DELETE", endpoint, data)

    def get_repository_tree(self, branch: str = "main", recursive: bool = True) -> dict:
        """Get GitHub repository file tree."""
        endpoint = (
            f"/repos/{self.config.owner}/{self.config.repository}/git/trees/{branch}"
        )
        params = {"recursive": "1"} if recursive else {}
        return self._make_request("GET", endpoint, params)

    def create_branch(self, branch_name: str, source_branch: str = "main") -> dict:
        """Create a new branch in GitHub."""
        # Get the SHA of the source branch
        endpoint = f"/repos/{self.config.owner}/{self.config.repository}/git/refs/heads/{source_branch}"
        source_ref = self._make_request("GET", endpoint)
        source_sha = source_ref["object"]["sha"]

        # Create new branch
        endpoint = f"/repos/{self.config.owner}/{self.config.repository}/git/refs"
        data = {"ref": f"refs/heads/{branch_name}", "sha": source_sha}

        result = self._make_request("POST", endpoint, data)
        print(f"Created GitHub branch '{branch_name}' from '{source_branch}'")
        return result

    def create_pull_request(
        self, head_branch: str, base_branch: str, title: str, body: str = ""
    ) -> dict:
        """Create a pull request in GitHub."""
        endpoint = f"/repos/{self.config.owner}/{self.config.repository}/pulls"
        data = {"title": title, "head": head_branch, "base": base_branch, "body": body}

        result = self._make_request("POST", endpoint, data)
        print(f"Created GitHub PR #{result['number']}: {title}")
        return result

    def merge_pull_request(
        self, pr_id: Any, commit_title: Optional[str] = None, commit_message: str = ""
    ) -> dict:
        """Merge a pull request in GitHub."""
        endpoint = (
            f"/repos/{self.config.owner}/{self.config.repository}/pulls/{pr_id}/merge"
        )
        data = {"commit_message": commit_message, "merge_method": "merge"}

        if commit_title:
            data["commit_title"] = commit_title

        result = self._make_request("PUT", endpoint, data)
        print(f"Merged GitHub PR #{pr_id}. Merge SHA: {result['sha']}")
        return result

    def list_pull_requests(self, state: str = "open") -> list[dict]:
        """List pull requests in GitHub."""
        endpoint = f"/repos/{self.config.owner}/{self.config.repository}/pulls"
        params = {"state": state}

        result = self._make_request("GET", endpoint, params)

        print(f"GitHub Pull Requests ({state}):")
        for pr in result:
            print(f"  #{pr['number']}: {pr['title']}")
            print(f"    Author: {pr['user']['login']}")
            print(f"    Branch: {pr['head']['ref']} -> {pr['base']['ref']}")

        return result

    def get_branch_info(self, branch: str) -> dict:
        """Get GitHub branch information."""
        endpoint = (
            f"/repos/{self.config.owner}/{self.config.repository}/branches/{branch}"
        )
        return self._make_request("GET", endpoint)

    def compare_branches(self, base_branch: str, head_branch: str) -> dict:
        """Compare two branches in GitHub."""
        endpoint = f"/repos/{self.config.owner}/{self.config.repository}/compare/{base_branch}...{head_branch}"
        result = self._make_request("GET", endpoint)

        print(f"GitHub comparison {base_branch}...{head_branch}")
        print(f"Total commits: {result['total_commits']}")
        print(f"Files changed: {len(result['files'])}")

        return result

    def compare_commits(self, base_commit: str, head_commit: str) -> dict:
        """Compare two commits in GitHub (uses same compare endpoint)."""
        endpoint = f"/repos/{self.config.owner}/{self.config.repository}/compare/{base_commit}...{head_commit}"
        return self._make_request("GET", endpoint)

    def close_pull_request(self, pr_id: Any) -> dict:
        """Close a pull request without merging in GitHub."""
        endpoint = f"/repos/{self.config.owner}/{self.config.repository}/pulls/{pr_id}"
        data = {"state": "closed"}
        result = self._make_request("PATCH", endpoint, data)
        print(f"Closed GitHub PR #{pr_id}.")
        return result

    def _extract_files_from_tree(self, tree_data: dict) -> dict[str, str]:
        """Extract file paths and SHAs from GitHub tree data."""
        files = {}
        for item in tree_data.get("tree", []):
            if item["type"] == "blob":  # Only files, not directories
                files[item["path"]] = item["sha"]
        return files
