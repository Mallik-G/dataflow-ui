import base64
from typing import Any, Optional

import requests

from .git_provider_interface import GitProviderInterface


class AzureDevOpsProvider(GitProviderInterface):
    """A Git provider implementation for interacting with Azure DevOps Repos.

    This class implements the `GitProviderInterface` and provides methods for
    performing Git operations such as listing branches, reading file contents,
    and managing pull requests against an Azure DevOps repository.
    """

    def _build_headers(self) -> dict[str, str]:
        """Build Azure DevOps-specific authentication headers."""
        # Azure DevOps uses Basic auth with PAT
        auth_string = f":{self.config.auth_token}"
        auth_bytes = auth_string.encode("ascii")
        auth_b64 = base64.b64encode(auth_bytes).decode("ascii")

        return {
            "Authorization": f"Basic {auth_b64}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def list_branches(self) -> list[str]:
        """List branch names in the repository."""
        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/refs"
        result = self._make_request(
            "GET", endpoint, {"filter": "heads/", "api-version": "7.1"}
        )
        names: list[str] = []
        for ref in result.get("value", []):
            name = ref.get("name")
            if isinstance(name, str) and name.startswith("refs/heads/"):
                names.append(name.split("refs/heads/")[1])
        return names

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Any] = None,
        params: Optional[dict] = None,
    ) -> Any:
        """Make HTTP request to Azure DevOps API."""
        url = f"{self.config.base_url}{endpoint}"

        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=data)
            elif method.upper() == "POST":
                response = requests.post(
                    url, headers=self.headers, json=data, params=params
                )
            elif method.upper() == "PUT":
                response = requests.put(
                    url, headers=self.headers, json=data, params=params
                )
            elif method.upper() == "PATCH":
                response = requests.patch(
                    url, headers=self.headers, json=data, params=params
                )
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, params=params)

            response.raise_for_status()

            # Enhanced JSON parsing with better error handling
            if response.content:
                try:
                    return response.json()
                except ValueError as json_error:
                    print(f"Azure DevOps API returned invalid JSON: {json_error}")
                    print(f"URL: {url}")
                    print(f"Status: {response.status_code}")
                    print(f"Response: {response.text[:500]}...")
                    raise ValueError(
                        f"Invalid JSON response from Azure DevOps API: {json_error}"
                    )
            else:
                return {}

        except requests.exceptions.RequestException as e:
            print(f"Azure DevOps API request failed: {e}")
            print(f"URL: {url}")
            if hasattr(e, "response") and e.response is not None:
                print(f"Status: {e.response.status_code}")
                print(f"Response: {e.response.text[:500]}...")
            raise

    def get_file_content(
        self, file_path: str, branch: Optional[str] = None
    ) -> Optional[dict]:
        """Get file content from Azure DevOps repository."""
        try:
            endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/items"
            params = {"path": f"/{file_path}", "api-version": "7.1"}
            if branch:
                params["versionDescriptor.version"] = branch
                params["versionDescriptor.versionType"] = "branch"

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
        """Create or update a file in Azure DevOps repository using Push API."""
        if not branch:
            branch = "main"

        # Get current commit from branch
        branch_info = self.get_branch_info(branch)
        old_object_id = branch_info["commit"]["commitId"]

        # Prepare the push data
        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/pushes"

        # Check if file exists to determine if it's an add or edit
        existing_file = self.get_file_content(file_path, branch)
        change_type = "edit" if existing_file else "add"

        push_data = {
            "refUpdates": [
                {"name": f"refs/heads/{branch}", "oldObjectId": old_object_id}
            ],
            "commits": [
                {
                    "comment": message,
                    "changes": [
                        {
                            "changeType": change_type,
                            "item": {"path": f"/{file_path}"},
                            "newContent": {
                                "content": content,
                                "contentType": "base64encoded"
                                if is_base64
                                else "rawtext",
                            },
                        }
                    ],
                }
            ],
        }

        params = {"api-version": "7.1"}
        result = self._make_request("POST", endpoint, push_data, params)
        print(
            f"{'Updated' if existing_file else 'Created'} Azure DevOps file: {file_path}"
        )
        return result

    def delete_file(
        self, file_path: str, message: str, branch: Optional[str] = None
    ) -> dict:
        """Delete a file from Azure DevOps repository."""
        if not branch:
            branch = "main"

        # Get current commit from branch
        branch_info = self.get_branch_info(branch)
        old_object_id = branch_info["commit"]["commitId"]

        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/pushes"

        push_data = {
            "refUpdates": [
                {"name": f"refs/heads/{branch}", "oldObjectId": old_object_id}
            ],
            "commits": [
                {
                    "comment": message,
                    "changes": [
                        {"changeType": "delete", "item": {"path": f"/{file_path}"}}
                    ],
                }
            ],
        }

        params = {"api-version": "7.1"}
        return self._make_request("POST", endpoint, push_data, params)

    def get_repository_tree(self, branch: str = "main", recursive: bool = True) -> dict:
        """Get Azure DevOps repository file tree."""
        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/items"
        params = {
            "recursionLevel": "full" if recursive else "oneLevel",
            "versionDescriptor.version": branch,
            "versionDescriptor.versionType": "branch",
            "api-version": "7.1",
        }
        return self._make_request("GET", endpoint, params)

    def create_branch(self, branch_name: str, source_branch: str = "main") -> dict:
        """Create a new branch in Azure DevOps."""
        # Get source branch info
        source_info = self.get_branch_info(source_branch)
        source_commit_id = source_info["commit"]["commitId"]

        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/refs"
        data = [
            {
                "name": f"refs/heads/{branch_name}",
                "oldObjectId": "0000000000000000000000000000000000000000",
                "newObjectId": source_commit_id,
            }
        ]

        params = {"api-version": "7.1"}
        result = self._make_request("POST", endpoint, data, params)
        print(f"Created Azure DevOps branch '{branch_name}' from '{source_branch}'")
        return result

    def create_pull_request(
        self, head_branch: str, base_branch: str, title: str, body: str = ""
    ) -> dict:
        """Create a pull request in Azure DevOps."""
        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/pullrequests"
        data = {
            "sourceRefName": f"refs/heads/{head_branch}",
            "targetRefName": f"refs/heads/{base_branch}",
            "title": title,
            "description": body,
        }

        params = {"api-version": "7.1"}
        result = self._make_request("POST", endpoint, data, params)
        print(f"Created Azure DevOps PR #{result['pullRequestId']}: {title}")
        return result

    def merge_pull_request(
        self, pr_id: Any, commit_title: Optional[str] = None, commit_message: str = ""
    ) -> dict:
        """Merge a pull request in Azure DevOps."""
        # First get the current PR to get its last merge source commit
        endpoint = (
            f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}"
            f"/pullrequests/{pr_id}"
        )
        params = {"api-version": "7.1"}
        pr_info = self._make_request("GET", endpoint, params)

        # Complete the pull request
        endpoint = (
            f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}"
            f"/pullrequests/{pr_id}"
        )
        data = {
            "status": "completed",
            "lastMergeSourceCommit": pr_info["lastMergeSourceCommit"],
            "completionOptions": {
                "mergeCommitMessage": commit_message or commit_title or "Merged PR",
                "deleteSourceBranch": False,
            },
        }

        result = self._make_request("PATCH", endpoint, data, {"api-version": "7.1"})
        print(f"Merged Azure DevOps PR #{pr_id}")
        return result

    def list_pull_requests(self, state: str = "open") -> list[dict]:
        """List pull requests in Azure DevOps."""
        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/pullrequests"

        status_map = {"open": "active", "closed": "completed", "all": "all"}

        params = {
            "searchCriteria.status": status_map.get(state, "active"),
            "api-version": "7.1",
        }

        result = self._make_request("GET", endpoint, params)

        print(f"Azure DevOps Pull Requests ({state}):")
        for pr in result.get("value", []):
            print(f"  #{pr['pullRequestId']}: {pr['title']}")
            print(f"    Author: {pr['createdBy']['displayName']}")
            print(f"    Branch: {pr['sourceRefName']} -> {pr['targetRefName']}")

        return result.get("value", [])

    def get_branch_info(self, branch: str) -> dict:
        """Get Azure DevOps branch information."""
        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/refs"
        params = {"filter": f"heads/{branch}", "api-version": "7.1"}
        refs = self._make_request("GET", endpoint, params)

        if refs.get("value"):
            branch_ref = refs["value"][0]
            # Get commit details
            commit_endpoint = (
                f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}"
                f"/commits/{branch_ref['objectId']}"
            )
            commit_params = {"api-version": "7.1"}
            commit_info = self._make_request("GET", commit_endpoint, commit_params)

            return {"name": branch, "commit": commit_info}
        else:
            raise ValueError(f"Branch {branch} not found")

    def compare_branches(self, base_branch: str, head_branch: str) -> dict:
        """Compare two branches in Azure DevOps."""
        # Get commit IDs for both branches
        base_info = self.get_branch_info(base_branch)
        head_info = self.get_branch_info(head_branch)

        base_commit = base_info["commit"]["commitId"]
        head_commit = head_info["commit"]["commitId"]

        # Get diff between commits
        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/diffs/commits"
        params = {
            "baseVersionDescriptor.version": base_commit,
            "baseVersionDescriptor.versionType": "commit",
            "targetVersionDescriptor.version": head_commit,
            "targetVersionDescriptor.versionType": "commit",
            "api-version": "7.1",
        }

        result = self._make_request("GET", endpoint, params)

        print(f"Azure DevOps comparison {base_branch}...{head_branch}")
        if "changes" in result:
            print(f"Files changed: {len(result['changes'])}")

        return result

    def compare_commits(self, base_commit: str, head_commit: str) -> dict:
        """Compare two commits in Azure DevOps using the diffs API."""
        endpoint = f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}/diffs/commits"
        params = {
            "baseVersionDescriptor.version": base_commit,
            "baseVersionDescriptor.versionType": "commit",
            "targetVersionDescriptor.version": head_commit,
            "targetVersionDescriptor.versionType": "commit",
            "api-version": "7.1",
        }
        return self._make_request("GET", endpoint, params)

    def close_pull_request(self, pr_id: Any) -> dict:
        """Close a pull request in Azure DevOps without merging."""
        endpoint = (
            f"/{self.config.project_id}/_apis/git/repositories/{self.config.repository}"
            f"/pullrequests/{pr_id}"
        )
        data = {"status": "abandoned"}
        result = self._make_request("PATCH", endpoint, data, {"api-version": "7.1"})
        print(f"Closed Azure DevOps PR #{pr_id}")
        return result

    def _extract_files_from_tree(self, tree_data: dict) -> dict[str, str]:
        """Extract file paths and SHAs from Azure DevOps tree data."""
        files = {}
        for item in tree_data.get("value", []):
            if not item.get("isFolder", True):  # Only files, not directories
                # Remove leading slash if present
                path = item["path"].lstrip("/")
                files[path] = item.get("objectId", "")
        return files
