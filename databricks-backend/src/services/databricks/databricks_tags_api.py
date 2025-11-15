"""Databricks Tags API client using SDK for resource tagging operations."""

import logging
from typing import Any, Dict, List, Optional

from .sdk_adapter import DatabricksSDKAdapter

logger = logging.getLogger(__name__)


class DatabricksTagsAPI(DatabricksSDKAdapter):
    """Databricks Tags API client with async operations using SDK."""

    async def create_tag(
        self,
        tag_name: str,
        description: Optional[str] = None,
        allowed_values: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a new tag definition.

        Args:
            tag_name: Name of the tag
            description: Optional description of the tag
            allowed_values: Optional list of allowed values for the tag

        Returns:
            Created tag information
        """
        logger.info(f"Creating tag: {tag_name}")

        tag_data = {
            "name": tag_name,
        }
        if description:
            tag_data["description"] = description
        if allowed_values:
            tag_data["allowed_values"] = allowed_values

        return await self._run_sync_method(
            self.sdk_client.workspace.tags.create, **tag_data
        )

    async def get_tag(self, tag_name: str) -> Dict[str, Any]:
        """Get information about a specific tag.

        Args:
            tag_name: Name of the tag to retrieve

        Returns:
            Tag information
        """
        logger.info(f"Getting tag: {tag_name}")
        return await self._run_sync_method(self.sdk_client.workspace.tags.get, tag_name)

    async def list_tags(self) -> List[Dict[str, Any]]:
        """List all available tags in the workspace.

        Returns:
            List of all tags
        """
        logger.info("Listing all tags")
        result = await self._run_sync_method(self.sdk_client.workspace.tags.list)
        return list(result)

    async def update_tag(
        self,
        tag_name: str,
        description: Optional[str] = None,
        allowed_values: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Update an existing tag definition.

        Args:
            tag_name: Name of the tag to update
            description: New description for the tag
            allowed_values: New list of allowed values

        Returns:
            Updated tag information
        """
        logger.info(f"Updating tag: {tag_name}")

        update_data = {}
        if description is not None:
            update_data["description"] = description
        if allowed_values is not None:
            update_data["allowed_values"] = allowed_values

        return await self._run_sync_method(
            self.sdk_client.workspace.tags.update, tag_name, **update_data
        )

    async def delete_tag(self, tag_name: str) -> None:
        """Delete a tag definition.

        Args:
            tag_name: Name of the tag to delete
        """
        logger.info(f"Deleting tag: {tag_name}")
        await self._run_sync_method(self.sdk_client.workspace.tags.delete, tag_name)

    async def tag_resource(
        self,
        resource_type: str,
        resource_id: str,
        tag_name: str,
        tag_value: str,
    ) -> None:
        """Apply a tag to a resource.

        Args:
            resource_type: Type of resource (e.g., 'table', 'schema', 'catalog')
            resource_id: ID or full name of the resource
            tag_name: Name of the tag to apply
            tag_value: Value to assign to the tag
        """
        logger.info(
            f"Tagging {resource_type} {resource_id} with {tag_name}={tag_value}"
        )

        # Note: Resource tagging varies by resource type in Databricks
        # This is a generic implementation - may need customization per resource type
        await self._run_sync_method(
            self.sdk_client.workspace.tags.tag_resource,
            resource_type=resource_type,
            resource_id=resource_id,
            tag_name=tag_name,
            tag_value=tag_value,
        )

    async def untag_resource(
        self,
        resource_type: str,
        resource_id: str,
        tag_name: str,
    ) -> None:
        """Remove a tag from a resource.

        Args:
            resource_type: Type of resource
            resource_id: ID or full name of the resource
            tag_name: Name of the tag to remove
        """
        logger.info(f"Removing tag {tag_name} from {resource_type} {resource_id}")

        await self._run_sync_method(
            self.sdk_client.workspace.tags.untag_resource,
            resource_type=resource_type,
            resource_id=resource_id,
            tag_name=tag_name,
        )

    async def get_resource_tags(
        self,
        resource_type: str,
        resource_id: str,
    ) -> Dict[str, str]:
        """Get all tags applied to a resource.

        Args:
            resource_type: Type of resource
            resource_id: ID or full name of the resource

        Returns:
            Dictionary of tag names to values
        """
        logger.info(f"Getting tags for {resource_type} {resource_id}")

        result = await self._run_sync_method(
            self.sdk_client.workspace.tags.get_resource_tags,
            resource_type=resource_type,
            resource_id=resource_id,
        )
        return result
