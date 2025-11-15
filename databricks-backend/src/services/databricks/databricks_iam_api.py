"""Databricks Identity and Access Management API client using SDK."""

import logging
from typing import Any, Dict, List, Optional

from .sdk_adapter import DatabricksSDKAdapter

logger = logging.getLogger(__name__)


class DatabricksIAMAPI(DatabricksSDKAdapter):
    """Databricks IAM API client with async operations using SDK."""

    # User Management
    async def list_users(
        self,
        count: Optional[int] = None,
        start_index: Optional[int] = None,
        filter_expression: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List users in the workspace.

        Args:
            count: Maximum number of users to return
            start_index: Starting index for pagination
            filter_expression: SCIM filter expression

        Returns:
            List of users with pagination info
        """
        logger.info("Listing users")

        params = {}
        if count is not None:
            params["count"] = count
        if start_index is not None:
            params["start_index"] = start_index
        if filter_expression:
            params["filter"] = filter_expression

        result = await self._run_sync_method(self.sdk_client.users.list, **params)
        return {"users": list(result), "total_results": len(list(result))}

    async def get_user(self, user_id: str) -> Dict[str, Any]:
        """Get details of a specific user.

        Args:
            user_id: User ID or email

        Returns:
            User details
        """
        logger.info(f"Getting user: {user_id}")
        return await self._run_sync_method(self.sdk_client.users.get, user_id)

    async def create_user(
        self,
        user_name: str,
        email: str,
        display_name: Optional[str] = None,
        active: bool = True,
    ) -> Dict[str, Any]:
        """Create a new user.

        Args:
            user_name: Username for the user
            email: Email address
            display_name: Display name for the user
            active: Whether the user is active

        Returns:
            Created user details
        """
        logger.info(f"Creating user: {user_name}")

        user_data = {
            "user_name": user_name,
            "emails": [{"value": email, "primary": True}],
            "active": active,
        }
        if display_name:
            user_data["display_name"] = display_name

        return await self._run_sync_method(self.sdk_client.users.create, **user_data)

    async def update_user(
        self,
        user_id: str,
        display_name: Optional[str] = None,
        active: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Update an existing user.

        Args:
            user_id: User ID to update
            display_name: New display name
            active: Whether the user should be active

        Returns:
            Updated user details
        """
        logger.info(f"Updating user: {user_id}")

        update_data = {}
        if display_name is not None:
            update_data["display_name"] = display_name
        if active is not None:
            update_data["active"] = active

        return await self._run_sync_method(
            self.sdk_client.users.update, user_id, **update_data
        )

    async def delete_user(self, user_id: str) -> None:
        """Delete a user.

        Args:
            user_id: User ID to delete
        """
        logger.info(f"Deleting user: {user_id}")
        await self._run_sync_method(self.sdk_client.users.delete, user_id)

    # Group Management
    async def list_groups(
        self,
        count: Optional[int] = None,
        start_index: Optional[int] = None,
        filter_expression: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List groups in the workspace.

        Args:
            count: Maximum number of groups to return
            start_index: Starting index for pagination
            filter_expression: SCIM filter expression

        Returns:
            List of groups with pagination info
        """
        logger.info("Listing groups")

        params = {}
        if count is not None:
            params["count"] = count
        if start_index is not None:
            params["start_index"] = start_index
        if filter_expression:
            params["filter"] = filter_expression

        result = await self._run_sync_method(self.sdk_client.groups.list, **params)
        return {"groups": list(result), "total_results": len(list(result))}

    async def get_group(self, group_id: str) -> Dict[str, Any]:
        """Get details of a specific group.

        Args:
            group_id: Group ID

        Returns:
            Group details
        """
        logger.info(f"Getting group: {group_id}")
        return await self._run_sync_method(self.sdk_client.groups.get, group_id)

    async def create_group(
        self,
        display_name: str,
        members: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a new group.

        Args:
            display_name: Name of the group
            members: List of user IDs to add as members

        Returns:
            Created group details
        """
        logger.info(f"Creating group: {display_name}")

        group_data = {
            "display_name": display_name,
        }
        if members:
            group_data["members"] = [{"value": member_id} for member_id in members]

        return await self._run_sync_method(self.sdk_client.groups.create, **group_data)

    async def add_user_to_group(self, group_id: str, user_id: str) -> None:
        """Add a user to a group.

        Args:
            group_id: Group ID
            user_id: User ID to add
        """
        logger.info(f"Adding user {user_id} to group {group_id}")
        await self._run_sync_method(
            self.sdk_client.groups.patch,
            group_id,
            operations=[
                {"op": "add", "path": "members", "value": [{"value": user_id}]}
            ],
        )

    async def remove_user_from_group(self, group_id: str, user_id: str) -> None:
        """Remove a user from a group.

        Args:
            group_id: Group ID
            user_id: User ID to remove
        """
        logger.info(f"Removing user {user_id} from group {group_id}")
        await self._run_sync_method(
            self.sdk_client.groups.patch,
            group_id,
            operations=[{"op": "remove", "path": f'members[value eq "{user_id}"]'}],
        )

    async def delete_group(self, group_id: str) -> None:
        """Delete a group.

        Args:
            group_id: Group ID to delete
        """
        logger.info(f"Deleting group: {group_id}")
        await self._run_sync_method(self.sdk_client.groups.delete, group_id)

    # Service Principal Management
    async def list_service_principals(
        self,
        count: Optional[int] = None,
        start_index: Optional[int] = None,
        filter_expression: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List service principals in the workspace.

        Args:
            count: Maximum number of service principals to return
            start_index: Starting index for pagination
            filter_expression: SCIM filter expression

        Returns:
            List of service principals with pagination info
        """
        logger.info("Listing service principals")

        params = {}
        if count is not None:
            params["count"] = count
        if start_index is not None:
            params["start_index"] = start_index
        if filter_expression:
            params["filter"] = filter_expression

        result = await self._run_sync_method(
            self.sdk_client.service_principals.list, **params
        )
        return {"service_principals": list(result), "total_results": len(list(result))}

    async def get_service_principal(self, service_principal_id: str) -> Dict[str, Any]:
        """Get details of a specific service principal.

        Args:
            service_principal_id: Service principal ID

        Returns:
            Service principal details
        """
        logger.info(f"Getting service principal: {service_principal_id}")
        return await self._run_sync_method(
            self.sdk_client.service_principals.get, service_principal_id
        )

    async def create_service_principal(
        self,
        application_id: str,
        display_name: str,
        active: bool = True,
    ) -> Dict[str, Any]:
        """Create a new service principal.

        Args:
            application_id: Application ID for the service principal
            display_name: Display name
            active: Whether the service principal is active

        Returns:
            Created service principal details
        """
        logger.info(f"Creating service principal: {display_name}")

        sp_data = {
            "application_id": application_id,
            "display_name": display_name,
            "active": active,
        }

        return await self._run_sync_method(
            self.sdk_client.service_principals.create, **sp_data
        )

    async def delete_service_principal(self, service_principal_id: str) -> None:
        """Delete a service principal.

        Args:
            service_principal_id: Service principal ID to delete
        """
        logger.info(f"Deleting service principal: {service_principal_id}")
        await self._run_sync_method(
            self.sdk_client.service_principals.delete, service_principal_id
        )
