"""Databricks Apps API service for managing app deployments."""

import logging
from typing import Any, Dict, Optional
from datetime import timedelta

from databricks.sdk.service.apps import (
    App,
    AppDeployment,
    AppDeploymentMode,
)
from databricks.sdk.service.iam import AccessControlRequest

from .sdk_adapter import DatabricksSDKAdapter

logger = logging.getLogger(__name__)


class DatabricksAppsAPI(DatabricksSDKAdapter):
    """Service for interacting with Databricks Apps API using the official SDK."""

    def __init__(
        self,
        host: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        """Initialize the Databricks Apps API client.

        Args:
            host: Databricks workspace URL
            client_id: Service principal client ID
            client_secret: Service principal client secret
        """
        super().__init__(host, client_id, client_secret)

    # =============================================================================
    # APP MANAGEMENT
    # =============================================================================

    async def list_apps(
        self, max_results: Optional[int] = None, page_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """List all apps in the workspace using the modern Databricks SDK.

        Args:
            max_results: Maximum number of apps to return (page_size)
            page_token: Token for pagination

        Returns:
            Dict containing apps list and pagination info
        """
        try:
            logger.info("Using SDK apps.list() method")

            # The SDK's list method is an iterator that handles pagination automatically.
            # To fit this into a paginated REST API response, we collect the results
            # and note that the SDK's iterator doesn't expose a next_page_token.
            apps_iterator = await self._run_sync_method(
                self.sdk_client.apps.list, page_size=max_results, page_token=page_token
            )

            apps_list = [app.as_dict() for app in apps_iterator]

            logger.info(f"Successfully retrieved {len(apps_list)} apps via SDK")

            # TODO: The SDK iterator abstracts away the next_page_token. If a true
            # paginated API is required, a more complex wrapper would be needed.
            return {"apps": apps_list, "next_page_token": None}

        except Exception as e:
            logger.error(f"Failed to list apps via SDK: {e}")
            raise

    async def create_app(
        self, app_data: Dict[str, Any], no_compute: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Create a new app using the documented SDK signature create(app: App[, no_compute]).

        Args:
            app_data: App configuration data containing name, description, source_code_path
            no_compute: If true, the app will not be started after creation

        Returns:
            Created app information
        """
        try:
            body_dict: Dict[str, Any] = {}
            if app_data.get("name") is not None:
                body_dict["name"] = app_data.get("name")
            if app_data.get("description") is not None:
                body_dict["description"] = app_data.get("description")
            if app_data.get("source_code_path") is not None:
                body_dict["source_code_path"] = app_data.get("source_code_path")

            app_body = (
                App.from_dict(body_dict)
                if hasattr(App, "from_dict")
                else App(**body_dict)
            )

            # Call SDK: create(app=..., no_compute=...)
            _result = await self._run_sync_method(
                self.sdk_client.apps.create,
                app=app_body,
                no_compute=no_compute,
            )

            # Not all SDK versions return the object here (some return a waiter). Fetch current state.
            current = await self._run_sync_method(
                self.sdk_client.apps.get, name=body_dict["name"]
            )  # type: ignore[index]
            return current.as_dict()
        except Exception as e:
            logger.error(f"Failed to create app: {e}")
            raise

    async def create_app_and_wait(
        self,
        app_data: Dict[str, Any],
        no_compute: Optional[bool] = None,
        timeout_minutes: int = 20,
    ) -> Dict[str, Any]:
        """Create a new app and wait for it to become active using create(app) -> waiter.wait()."""
        try:
            body_dict: Dict[str, Any] = {}
            if app_data.get("name") is not None:
                body_dict["name"] = app_data.get("name")
            if app_data.get("description") is not None:
                body_dict["description"] = app_data.get("description")
            if app_data.get("source_code_path") is not None:
                body_dict["source_code_path"] = app_data.get("source_code_path")

            app_body = (
                App.from_dict(body_dict)
                if hasattr(App, "from_dict")
                else App(**body_dict)
            )

            created = await self._run_sync_method(
                self.sdk_client.apps.create,
                app=app_body,
                no_compute=no_compute,
            )

            # If a waiter is returned, wait for completion; otherwise return the created object
            if hasattr(created, "wait"):
                final_app = await self._run_sync_method(
                    created.wait,
                    timeout=timedelta(minutes=timeout_minutes),
                )
                return final_app.as_dict()
            elif hasattr(created, "as_dict"):
                return created.as_dict()
            else:
                # Fallback: fetch current state
                current = await self._run_sync_method(
                    self.sdk_client.apps.get, name=body_dict["name"]
                )  # type: ignore[index]
                return current.as_dict()
        except Exception as e:
            logger.error(f"Failed to create app and wait: {e}")
            raise

    async def get_app(self, app_name: str) -> Dict[str, Any]:
        """Get details of a specific app."""
        try:
            app = await self._run_sync_method(self.sdk_client.apps.get, name=app_name)
            return app.as_dict()
        except Exception as e:
            logger.error(f"Failed to get app {app_name}: {e}")
            raise

    async def update_app(
        self, app_name: str, app_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update an existing app using update(name, app: App).
        Only fields provided in app_data will be sent. If nothing is provided, returns current app state.
        """
        # Prepare values
        description = app_data.get("description")
        source_code_path = app_data.get("source_code_path")

        # If nothing to update, return current
        if description is None and source_code_path is None:
            current = await self._run_sync_method(
                self.sdk_client.apps.get, name=app_name
            )
            return current.as_dict()

        # Construct App body with only provided fields
        body_dict: Dict[str, Any] = {}
        if description is not None:
            body_dict["description"] = description
        if source_code_path is not None:
            body_dict["source_code_path"] = source_code_path

        try:
            app_body = (
                App.from_dict(body_dict)
                if hasattr(App, "from_dict")
                else App(**body_dict)
            )
            updated = await self._run_sync_method(
                self.sdk_client.apps.update,
                name=app_name,
                app=app_body,
            )
            if hasattr(updated, "as_dict"):
                return updated.as_dict()
            # Fallback: fetch current state
            current = await self._run_sync_method(
                self.sdk_client.apps.get, name=app_name
            )
            return current.as_dict()
        except Exception as e:
            logger.error(f"Failed to update app {app_name}: {e}")
            raise

    async def delete_app(self, app_name: str) -> None:
        """Delete an app."""
        try:
            await self._run_sync_method(self.sdk_client.apps.delete, name=app_name)
            logger.info(f"Successfully deleted app {app_name}")
        except Exception as e:
            logger.error(f"Failed to delete app {app_name}: {e}")
            raise

    # =============================================================================
    # APP DEPLOYMENT MANAGEMENT
    # =============================================================================

    async def list_deployments(
        self,
        app_name: str,
        max_results: Optional[int] = None,
        page_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List all deployments of an app."""
        try:
            deployments_iterator = await self._run_sync_method(
                self.sdk_client.apps.list_deployments,
                app_name=app_name,
                page_size=max_results,
                page_token=page_token,
            )

            deployments_list = [
                deployment.as_dict() for deployment in deployments_iterator
            ]

            return {"app_deployments": deployments_list, "next_page_token": None}
        except Exception as e:
            logger.error(f"Failed to list deployments for app {app_name}: {e}")
            raise

    async def create_deployment(
        self, app_name: str, deployment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Deploy a new version of an app using deploy(app_name, app_deployment: AppDeployment)."""
        try:
            dep_dict: Dict[str, Any] = {}
            if deployment_data.get("source_code_path") is not None:
                dep_dict["source_code_path"] = deployment_data.get("source_code_path")
            if deployment_data.get("mode") is not None:
                # Allow passing either enum value or string; normalize to AppDeploymentMode
                mode_val = deployment_data.get("mode")
                dep_dict["mode"] = (
                    AppDeploymentMode(mode_val)
                    if not isinstance(mode_val, AppDeploymentMode)
                    else mode_val
                )

            app_deployment_body = (
                AppDeployment.from_dict(dep_dict)
                if hasattr(AppDeployment, "from_dict")
                else AppDeployment(**dep_dict)
            )

            result = await self._run_sync_method(
                self.sdk_client.apps.deploy,
                app_name=app_name,
                app_deployment=app_deployment_body,
            )

            # Most SDKs return the deployment object here; normalize
            if hasattr(result, "as_dict"):
                return result.as_dict()
            # Fallback: list deployments and return the most recent
            deployments_iter = await self._run_sync_method(
                self.sdk_client.apps.list_deployments,
                app_name=app_name,
                page_size=1,
            )
            deployments_list = [d.as_dict() for d in deployments_iter]
            return deployments_list[0] if deployments_list else {}
        except Exception as e:
            logger.error(f"Failed to create deployment for app {app_name}: {e}")
            raise

    async def deploy_and_wait(
        self, app_name: str, deployment_data: Dict[str, Any], timeout_minutes: int = 20
    ) -> Dict[str, Any]:
        """Deploy a new version of an app and wait for completion using deploy(...).wait()."""
        try:
            dep_dict: Dict[str, Any] = {}
            if deployment_data.get("source_code_path") is not None:
                dep_dict["source_code_path"] = deployment_data.get("source_code_path")
            if deployment_data.get("mode") is not None:
                mode_val = deployment_data.get("mode")
                dep_dict["mode"] = (
                    AppDeploymentMode(mode_val)
                    if not isinstance(mode_val, AppDeploymentMode)
                    else mode_val
                )

            app_deployment_body = (
                AppDeployment.from_dict(dep_dict)
                if hasattr(AppDeployment, "from_dict")
                else AppDeployment(**dep_dict)
            )

            waiter_or_deployment = await self._run_sync_method(
                self.sdk_client.apps.deploy,
                app_name=app_name,
                app_deployment=app_deployment_body,
            )

            if hasattr(waiter_or_deployment, "wait"):
                final_deployment = await self._run_sync_method(
                    waiter_or_deployment.wait,
                    timeout=timedelta(minutes=timeout_minutes),
                )
                return final_deployment.as_dict()
            elif hasattr(waiter_or_deployment, "as_dict"):
                return waiter_or_deployment.as_dict()
            else:
                # Fallback: query deployment state
                deployments_iter = await self._run_sync_method(
                    self.sdk_client.apps.list_deployments,
                    app_name=app_name,
                    page_size=1,
                )
                deployments_list = [d.as_dict() for d in deployments_iter]
                return deployments_list[0] if deployments_list else {}
        except Exception as e:
            logger.error(f"Failed to deploy app {app_name} and wait: {e}")
            raise

    # =============================================================================
    # APP LIFECYCLE MANAGEMENT
    # =============================================================================

    async def start_app(self, app_name: str) -> Dict[str, Any]:
        """Start the last active deployment of the app and return App state."""
        try:
            waiter_or_deployment = await self._run_sync_method(
                self.sdk_client.apps.start, name=app_name
            )
            # Normalize to App: if not an App, fetch current state
            try:
                if (
                    hasattr(waiter_or_deployment, "as_dict")
                    and "name" in waiter_or_deployment.as_dict()
                ):
                    return waiter_or_deployment.as_dict()
            except Exception:
                pass
            current = await self._run_sync_method(
                self.sdk_client.apps.get, name=app_name
            )
            return current.as_dict()
        except Exception as e:
            logger.error(f"Failed to start app {app_name}: {e}")
            raise

    async def start_app_and_wait(
        self, app_name: str, timeout_minutes: int = 20
    ) -> Dict[str, Any]:
        """Start the last active deployment of the app and wait for it to become active."""
        try:
            waiter = await self._run_sync_method(
                self.sdk_client.apps.start,
                name=app_name,
            )
            app = await self._run_sync_method(
                waiter.wait, timeout=timedelta(minutes=timeout_minutes)
            )
            return app.as_dict()
        except Exception as e:
            logger.error(f"Failed to start app {app_name} and wait: {e}")
            raise

    async def stop_app(self, app_name: str) -> Dict[str, Any]:
        """Stop the active deployment of the app."""
        try:
            await self._run_sync_method(self.sdk_client.apps.stop, name=app_name)
            # The stop method in the SDK doesn't return anything, so we get the app status after.
            return await self.get_app(app_name)
        except Exception as e:
            logger.error(f"Failed to stop app {app_name}: {e}")
            raise

    # =============================================================================
    # APP PERMISSIONS
    # =============================================================================

    async def get_app_permissions(self, app_name: str) -> Dict[str, Any]:
        """Get the permissions of an app."""
        try:
            permissions = await self._run_sync_method(
                self.sdk_client.apps.get_permissions, app_name=app_name
            )
            return permissions.as_dict()
        except Exception as e:
            logger.error(f"Failed to get permissions for app {app_name}: {e}")
            raise

    async def update_app_permissions(
        self, app_name: str, permissions_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update the permissions of an app (partial update)."""
        try:
            access_control_list = [
                AccessControlRequest.from_dict(item)
                for item in permissions_data.get("access_control_list", [])
            ]

            updated_permissions = await self._run_sync_method(
                self.sdk_client.apps.update_permissions,
                app_name=app_name,
                access_control_list=access_control_list,
            )
            return updated_permissions.as_dict()
        except Exception as e:
            logger.error(f"Failed to update permissions for app {app_name}: {e}")
            raise

    async def set_app_permissions(
        self, app_name: str, permissions_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Set the permissions of an app (replace all). Prefer set_permissions if available."""
        try:
            access_control_list = [
                AccessControlRequest.from_dict(item)
                for item in permissions_data.get("access_control_list", [])
            ]

            # Prefer explicit set_permissions; fall back to update_permissions if not available
            set_perm = getattr(self.sdk_client.apps, "set_permissions", None)
            if callable(set_perm):
                new_permissions = await self._run_sync_method(
                    set_perm,
                    app_name=app_name,
                    access_control_list=access_control_list,
                )
            else:
                new_permissions = await self._run_sync_method(
                    self.sdk_client.apps.update_permissions,
                    app_name=app_name,
                    access_control_list=access_control_list,
                )
            return new_permissions.as_dict()
        except Exception as e:
            logger.error(f"Failed to set permissions for app {app_name}: {e}")
            raise

    async def get_app_permission_levels(self, app_name: str) -> Dict[str, Any]:
        """Get available permission levels for an app."""
        try:
            permission_levels = await self._run_sync_method(
                self.sdk_client.apps.get_permission_levels, app_name=app_name
            )
            return permission_levels.as_dict()
        except Exception as e:
            logger.error(f"Failed to get permission levels for app {app_name}: {e}")
            raise
