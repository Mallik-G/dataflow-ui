"""Databricks Unity Catalog API client, refactored to use Databricks SDK."""

import logging
from typing import Iterable, Optional

from databricks.sdk.service.catalog import (
    PermissionsChange,
    CatalogInfo,
    SchemaInfo,
    TableInfo,
    VolumeInfo,
    FunctionInfo,
    ConnectionInfo,
    ExternalLocationInfo,
    StorageCredentialInfo,
    EffectivePermissionsList,
    GetPermissionsResponse,
    ConnectionType,
)

from .sdk_adapter import DatabricksSDKAdapter

logger = logging.getLogger(__name__)


class DatabricksUCAPI(DatabricksSDKAdapter):
    """Async client for Databricks Unity Catalog REST API (v2.1) using the SDK."""

    # =============================================================================
    # CATALOG MANAGEMENT
    # =============================================================================

    async def list_catalogs(
        self, max_results: Optional[int] = None, page_token: Optional[str] = None
    ) -> Iterable[CatalogInfo]:
        """Return list of catalog names from Unity Catalog."""
        kwargs = {}
        if max_results is not None:
            kwargs["max_results"] = max_results
        if page_token is not None:
            kwargs["page_token"] = page_token
        return await self._run_sync_method(self.sdk_client.catalogs.list, **kwargs)

    async def get_catalog(self, catalog_name: str) -> CatalogInfo:
        """Get details for a specific catalog."""
        return await self._run_sync_method(
            self.sdk_client.catalogs.get, name=catalog_name
        )

    async def create_catalog(
        self,
        name: str,
        comment: Optional[str] = None,
        connection_name: Optional[str] = None,
        properties: Optional[dict] = None,
        storage_root: Optional[str] = None,
    ) -> CatalogInfo:
        """Create a new catalog."""
        kwargs = {"name": name}
        if comment:
            kwargs["comment"] = comment
        if connection_name:
            kwargs["connection_name"] = connection_name
        if properties:
            kwargs["properties"] = properties
        if storage_root:
            kwargs["storage_root"] = storage_root
        return await self._run_sync_method(self.sdk_client.catalogs.create, **kwargs)

    async def update_catalog(
        self,
        catalog_name: str,
        comment: Optional[str] = None,
        new_name: Optional[str] = None,
        owner: Optional[str] = None,
    ) -> CatalogInfo:
        """Update an existing catalog."""
        kwargs = {"name": catalog_name}
        if comment:
            kwargs["comment"] = comment
        if new_name:
            kwargs["new_name"] = new_name
        if owner:
            kwargs["owner"] = owner
        return await self._run_sync_method(self.sdk_client.catalogs.update, **kwargs)

    async def delete_catalog(self, catalog_name: str, force: bool = False) -> None:
        """Delete a catalog."""
        return await self._run_sync_method(
            self.sdk_client.catalogs.delete, name=catalog_name, force=force
        )

    # =============================================================================
    # SCHEMA MANAGEMENT
    # =============================================================================

    async def list_schemas(
        self,
        catalog_name: str,
        max_results: Optional[int] = None,
        page_token: Optional[str] = None,
    ) -> Iterable[SchemaInfo]:
        """Return list of schema names for a given catalog."""
        kwargs = {"catalog_name": catalog_name}
        if max_results is not None:
            kwargs["max_results"] = max_results
        if page_token is not None:
            kwargs["page_token"] = page_token
        return await self._run_sync_method(self.sdk_client.schemas.list, **kwargs)

    async def get_schema(self, full_schema_name: str) -> SchemaInfo:
        """Get details for a specific schema."""
        return await self._run_sync_method(
            self.sdk_client.schemas.get, full_name=full_schema_name
        )

    async def create_schema(
        self,
        name: str,
        catalog_name: str,
        comment: str = None,
        properties: dict = None,
        storage_root: str = None,
    ) -> SchemaInfo:
        """Create a new schema."""
        kwargs = {"name": name, "catalog_name": catalog_name}
        if comment:
            kwargs["comment"] = comment
        if properties:
            kwargs["properties"] = properties
        if storage_root:
            kwargs["storage_root"] = storage_root
        return await self._run_sync_method(self.sdk_client.schemas.create, **kwargs)

    async def update_schema(
        self,
        full_schema_name: str,
        comment: str = None,
        new_name: str = None,
        owner: str = None,
    ) -> SchemaInfo:
        """Update an existing schema."""
        kwargs = {"full_name": full_schema_name}
        if comment:
            kwargs["comment"] = comment
        if new_name:
            kwargs["new_name"] = new_name
        if owner:
            kwargs["owner"] = owner
        return await self._run_sync_method(self.sdk_client.schemas.update, **kwargs)

    async def delete_schema(self, full_schema_name: str) -> None:
        """Delete a schema."""
        return await self._run_sync_method(
            self.sdk_client.schemas.delete, full_name=full_schema_name
        )

    # =============================================================================
    # TABLE MANAGEMENT
    # =============================================================================

    async def list_tables(
        self,
        catalog_name: str,
        schema_name: str,
        max_results: Optional[int] = None,
        page_token: Optional[str] = None,
    ) -> Iterable[TableInfo]:
        """Return list of table names for a given catalog.schema."""
        kwargs = {"catalog_name": catalog_name, "schema_name": schema_name}
        if max_results is not None:
            kwargs["max_results"] = max_results
        if page_token is not None:
            kwargs["page_token"] = page_token
        return await self._run_sync_method(self.sdk_client.tables.list, **kwargs)

    async def get_table(self, full_table_name: str) -> TableInfo:
        """Get full details for a table."""
        return await self._run_sync_method(
            self.sdk_client.tables.get, full_name=full_table_name
        )

    async def delete_table(self, full_table_name: str) -> None:
        """Delete a table."""
        return await self._run_sync_method(
            self.sdk_client.tables.delete, full_name=full_table_name
        )

    # =============================================================================
    # PERMISSIONS & GRANTS MANAGEMENT
    # =============================================================================

    async def get_permissions(
        self, securable_type: str, full_name: str
    ) -> GetPermissionsResponse:
        """Get permissions for a securable object."""
        return await self._run_sync_method(
            self.sdk_client.grants.get,
            securable_type=securable_type,
            full_name=full_name,
        )

    async def get_effective_permissions(
        self, securable_type: str, full_name: str, principal: str = None
    ) -> EffectivePermissionsList:
        """Get effective permissions for a securable object."""
        kwargs = {"securable_type": securable_type, "full_name": full_name}
        if principal:
            kwargs["principal"] = principal
        return await self._run_sync_method(
            self.sdk_client.grants.get_effective, **kwargs
        )

    async def update_permissions(
        self, securable_type: str, full_name: str, changes: list[PermissionsChange]
    ) -> GetPermissionsResponse:
        """Update permissions for a securable object."""
        return await self._run_sync_method(
            self.sdk_client.grants.update,
            securable_type=securable_type,
            full_name=full_name,
            changes=changes,
        )

    # =============================================================================
    # VOLUMES MANAGEMENT
    # =============================================================================

    async def list_volumes(
        self, catalog_name: str, schema_name: str
    ) -> Iterable[VolumeInfo]:
        """List volumes in a given catalog.schema."""
        return await self._run_sync_method(
            self.sdk_client.volumes.list,
            catalog_name=catalog_name,
            schema_name=schema_name,
        )

    async def get_volume(self, full_volume_name: str) -> VolumeInfo:
        """Get details for a specific volume."""
        return await self._run_sync_method(
            self.sdk_client.volumes.read, name=full_volume_name
        )

    async def delete_volume(self, full_volume_name: str) -> None:
        """Delete a volume."""
        return await self._run_sync_method(
            self.sdk_client.volumes.delete, name=full_volume_name
        )

    # =============================================================================
    # FUNCTIONS MANAGEMENT
    # =============================================================================

    async def list_functions(
        self, catalog_name: str, schema_name: str
    ) -> Iterable[FunctionInfo]:
        """List functions in a given catalog.schema."""
        return await self._run_sync_method(
            self.sdk_client.functions.list,
            catalog_name=catalog_name,
            schema_name=schema_name,
        )

    async def get_function(self, full_function_name: str) -> FunctionInfo:
        """Get details for a specific function."""
        return await self._run_sync_method(
            self.sdk_client.functions.get, name=full_function_name
        )

    async def delete_function(self, full_function_name: str) -> None:
        """Delete a function."""
        return await self._run_sync_method(
            self.sdk_client.functions.delete, name=full_function_name
        )

    # =============================================================================
    # CONNECTIONS MANAGEMENT
    # =============================================================================

    async def list_connections(self) -> Iterable[ConnectionInfo]:
        """List all connections."""
        return await self._run_sync_method(self.sdk_client.connections.list)

    async def get_connection(self, connection_name: str) -> ConnectionInfo:
        """Get details for a specific connection."""
        return await self._run_sync_method(
            self.sdk_client.connections.get, name=connection_name
        )

    async def create_connection(
        self,
        name: str,
        connection_type: ConnectionType,
        options: dict,
        comment: str = None,
        properties: dict = None,
        read_only: bool = None,
    ) -> ConnectionInfo:
        """Create a new connection."""
        kwargs = {"name": name, "connection_type": connection_type, "options": options}
        if comment:
            kwargs["comment"] = comment
        if properties:
            kwargs["properties"] = properties
        if read_only is not None:
            kwargs["read_only"] = read_only
        return await self._run_sync_method(self.sdk_client.connections.create, **kwargs)

    async def delete_connection(self, connection_name: str) -> None:
        """Delete a connection."""
        return await self._run_sync_method(
            self.sdk_client.connections.delete, name=connection_name
        )

    # =============================================================================
    # EXTERNAL LOCATIONS MANAGEMENT
    # =============================================================================

    async def list_external_locations(self) -> Iterable[ExternalLocationInfo]:
        """List all external locations."""
        return await self._run_sync_method(self.sdk_client.external_locations.list)

    async def get_external_location(self, location_name: str) -> ExternalLocationInfo:
        """Get details for a specific external location."""
        return await self._run_sync_method(
            self.sdk_client.external_locations.get, name=location_name
        )

    async def create_external_location(
        self,
        name: str,
        url: str,
        credential_name: str,
        comment: str = None,
        read_only: bool = None,
        skip_validation: bool = None,
    ) -> ExternalLocationInfo:
        """Create a new external location."""
        kwargs = {"name": name, "url": url, "credential_name": credential_name}
        if comment:
            kwargs["comment"] = comment
        if read_only is not None:
            kwargs["read_only"] = read_only
        if skip_validation is not None:
            kwargs["skip_validation"] = skip_validation
        return await self._run_sync_method(
            self.sdk_client.external_locations.create, **kwargs
        )

    async def delete_external_location(self, location_name: str) -> None:
        """Delete an external location."""
        return await self._run_sync_method(
            self.sdk_client.external_locations.delete, name=location_name
        )

    # =============================================================================
    # STORAGE CREDENTIALS MANAGEMENT
    # =============================================================================

    async def list_storage_credentials(self) -> Iterable[StorageCredentialInfo]:
        """List all storage credentials."""
        return await self._run_sync_method(self.sdk_client.storage_credentials.list)

    async def get_storage_credential(
        self, credential_name: str
    ) -> StorageCredentialInfo:
        """Get details for a specific storage credential."""
        return await self._run_sync_method(
            self.sdk_client.storage_credentials.get, name=credential_name
        )

    async def create_storage_credential(
        self,
        name: str,
        comment: Optional[str] = None,
        aws_iam_role: Optional[dict] = None,
        azure_service_principal: Optional[dict] = None,
        azure_managed_identity: Optional[dict] = None,
        read_only: Optional[bool] = None,
        skip_validation: Optional[bool] = None,
    ) -> StorageCredentialInfo:
        """Create a new storage credential."""
        kwargs = {"name": name}
        if comment:
            kwargs["comment"] = comment
        if aws_iam_role:
            kwargs["aws_iam_role"] = aws_iam_role
        if azure_service_principal:
            kwargs["azure_service_principal"] = azure_service_principal
        if azure_managed_identity:
            kwargs["azure_managed_identity"] = azure_managed_identity
        if read_only is not None:
            kwargs["read_only"] = read_only
        if skip_validation is not None:
            kwargs["skip_validation"] = skip_validation
        return await self._run_sync_method(
            self.sdk_client.storage_credentials.create, **kwargs
        )

    async def delete_storage_credential(self, credential_name: str) -> None:
        """Delete a storage credential."""
        return await self._run_sync_method(
            self.sdk_client.storage_credentials.delete, name=credential_name
        )
