import urllib.parse
from typing import Any, Optional

import requests

from .git_provider_interface import GitProviderInterface


class GitLabProvider(GitProviderInterface):
    """A Git provider implementation for interacting with the GitLab API.

    This class implements the `GitProviderInterface` and provides concrete
    methods for performing Git operations such as listing branches, managing
    files, and creating merge requests on a GitLab repository. It handles the
    specifics of GitLab's API, including project ID resolution and authentication.
    """

    def _build_headers(self) -> dict[str, str]:
        """Build GitLab-specific authentication headers"""
        return {
            "PRIVATE-TOKEN": self.config.auth_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def list_branches(self) -> list[str]:
        """List branch names in the repository."""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/repository/branches"
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
        """Make HTTP request to GitLab API"""
        url = f"{self.config.base_url}{endpoint}"

        try:
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

            response.raise_for_status()
            return response.json() if response.content else {}

        except requests.exceptions.RequestException as e:
            print(f"GitLab API request failed: {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"Response: {e.response.text}")
            raise

    def _get_project_id(self) -> str:
        """Get project ID from project path or use provided ID"""
        if self.config.project_id:
            return self.config.project_id

        # If no project ID provided, construct from owner/repository
        project_path = f"{self.config.owner}/{self.config.repository}"
        return urllib.parse.quote(project_path, safe="")

    def get_file_content(
        self, file_path: str, branch: Optional[str] = None
    ) -> Optional[dict]:
        """Get file content from GitLab repository"""
        try:
            project_id = self._get_project_id()
            encoded_path = urllib.parse.quote(file_path, safe="")
            endpoint = f"/projects/{project_id}/repository/files/{encoded_path}"
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
        """Create or update a file in GitLab repository"""
        project_id = self._get_project_id()
        encoded_path = urllib.parse.quote(file_path, safe="")

        # Check if file exists
        existing_file = self.get_file_content(file_path, branch)

        if existing_file:
            # Update existing file
            endpoint = f"/projects/{project_id}/repository/files/{encoded_path}"
            method = "PUT"
        else:
            # Create new file
            endpoint = f"/projects/{project_id}/repository/files/{encoded_path}"
            method = "POST"

        data = {
            "branch": branch or "main",
            "content": content,
            "commit_message": message,
            "encoding": "base64" if is_base64 else "text",
        }

        result = self._make_request(method, endpoint, data)
        print(f"{'Updated' if existing_file else 'Created'} GitLab file: {file_path}")
        return result

    def delete_file(
        self, file_path: str, message: str, branch: Optional[str] = None
    ) -> dict:
        """Delete a file from GitLab repository"""
        project_id = self._get_project_id()
        encoded_path = urllib.parse.quote(file_path, safe="")
        endpoint = f"/projects/{project_id}/repository/files/{encoded_path}"

        data = {"branch": branch or "main", "commit_message": message}

        return self._make_request("DELETE", endpoint, data)

    def get_repository_tree(self, branch: str = "main", recursive: bool = True) -> dict:
        """Get GitLab repository file tree"""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/repository/tree"
        params = {
            "ref": branch,
            "recursive": recursive,
            "per_page": 100,  # GitLab API pagination
        }

        # GitLab may return paginated results, collect all
        all_items = []
        page = 1

        while True:
            params["page"] = page
            result = self._make_request("GET", endpoint, params)

            if not result:
                break

            all_items.extend(result)

            # Check if there are more pages (GitLab includes pagination info in headers)
            # For simplicity, we'll break after first page unless result is full
            if len(result) < params["per_page"]:
                break
            page += 1

        return {"tree": all_items}

    def create_branch(self, branch_name: str, source_branch: str = "main") -> dict:
        """Create a new branch in GitLab"""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/repository/branches"
        data = {"branch": branch_name, "ref": source_branch}

        result = self._make_request("POST", endpoint, data)
        print(f"Created GitLab branch '{branch_name}' from '{source_branch}'")
        return result

    def create_pull_request(
        self, head_branch: str, base_branch: str, title: str, body: str = ""
    ) -> dict:
        """Create a merge request in GitLab"""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/merge_requests"
        data = {
            "source_branch": head_branch,
            "target_branch": base_branch,
            "title": title,
            "description": body,
        }

        result = self._make_request("POST", endpoint, data)
        print(f"Created GitLab MR #{result['iid']}: {title}")
        return result

    def merge_pull_request(
        self, pr_id: Any, commit_title: Optional[str] = None, commit_message: str = ""
    ) -> dict:
        """Merge a merge request in GitLab"""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/merge_requests/{pr_id}/merge"
        data = {
            "merge_commit_message": commit_message or commit_title,
            "should_remove_source_branch": False,
        }

        result = self._make_request("PUT", endpoint, data)
        print(f"Merged GitLab MR #{pr_id}")
        return result

    def list_pull_requests(self, state: str = "open") -> list[dict]:
        """List merge requests in GitLab"""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/merge_requests"

        state_map = {
            "open": "opened",
            "closed": "closed",
            "merged": "merged",
            "all": "all",
        }

        params = {"state": state_map.get(state, "opened"), "per_page": 50}

        result = self._make_request("GET", endpoint, params)

        print(f"GitLab Merge Requests ({state}):")
        for mr in result:
            print(f"  #{mr['iid']}: {mr['title']}")
            print(f"    Author: {mr['author']['name']}")
            print(f"    Branch: {mr['source_branch']} -> {mr['target_branch']}")

        return result

    def get_branch_info(self, branch: str) -> dict:
        """Get GitLab branch information"""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/repository/branches/{branch}"
        return self._make_request("GET", endpoint)

    def compare_branches(self, base_branch: str, head_branch: str) -> dict:
        """Compare two branches in GitLab"""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/repository/compare"
        params = {"from": base_branch, "to": head_branch}

        result = self._make_request("GET", endpoint, params)

        print(f"GitLab comparison {base_branch}...{head_branch}")
        if "commits" in result:
            print(f"Total commits: {len(result['commits'])}")
        if "diffs" in result:
            print(f"Files changed: {len(result['diffs'])}")

        return result

    def compare_commits(self, base_commit: str, head_commit: str) -> dict:
        """Compare two commits in GitLab using the same compare endpoint."""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/repository/compare"
        params = {"from": base_commit, "to": head_commit}
        return self._make_request("GET", endpoint, params)

    def _extract_files_from_tree(self, tree_data: dict) -> dict[str, str]:
        """Extract file paths and SHAs from GitLab tree data."""
        files = {}
        for item in tree_data.get("tree", []):
            if item["type"] == "blob":  # Only files, not directories
                files[item["path"]] = item["id"]
        return files

    def close_pull_request(self, pr_id: Any) -> dict:
        """Close a merge request in GitLab without merging."""
        project_id = self._get_project_id()
        endpoint = f"/projects/{project_id}/merge_requests/{pr_id}"
        data = {"state_event": "close"}
        result = self._make_request("PUT", endpoint, data)
        print(f"Closed GitLab MR #{pr_id}")
        return result
