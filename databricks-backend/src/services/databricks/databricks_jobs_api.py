"""Databricks Jobs API client using the official Databricks SDK for Python.

This module provides an async wrapper around the Databricks SDK's Jobs API,
offering comprehensive job management capabilities including creating, running,
monitoring, and managing Databricks jobs and their runs.
"""

import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional

from databricks.sdk.service.jobs import (
    JobAccessControlRequest,
    JobSettings,
    SubmitTask,
    ViewsToExport,
    Task,
    JobEnvironment,
    GitSource,
    JobEmailNotifications,
    JobNotificationSettings,
    WebhookNotifications,
    JobRunAs,
    CronSchedule,
    JobCluster,
    JobParameterDefinition,
    Continuous,
)

from .sdk_adapter import DatabricksSDKAdapter

logger = logging.getLogger(__name__)


class DatabricksJobsAPI(DatabricksSDKAdapter):
    """Databricks Jobs API client with comprehensive async operations.

    This class provides a complete interface to the Databricks Jobs API using
    the official Databricks SDK. All methods are async and return standardized
    dictionary responses for easy integration with existing code.
    """

    async def list_jobs(
        self, expand_tasks: bool = True, limit: int = 25, name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all jobs in the workspace.

        Args:
            expand_tasks: Whether to include task and cluster details in the response
            limit: The number of jobs to return (1-100, default: 25)
            name: Optional job name filter

        Returns:
            List of job dictionaries
        """
        logger.debug(f"Listing jobs with limit={limit}, expand_tasks={expand_tasks}")
        response = await self._run_sync_method(
            self.sdk_client.jobs.list, expand_tasks=expand_tasks, limit=limit, name=name
        )
        return [j.as_dict() for j in response]

    async def get_job(
        self, job_id: int, page_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get detailed information about a specific job.

        Args:
            job_id: The canonical identifier of the job to retrieve
            page_token: Use next_page_token from previous request for pagination

        Returns:
            Dictionary containing job details
        """
        logger.debug(f"Getting job {job_id}")
        response = await self._run_sync_method(
            self.sdk_client.jobs.get, job_id=job_id, page_token=page_token
        )
        return response.as_dict()

    async def get_job_runs(
        self,
        job_id: Optional[int] = None,
        active_only: bool = False,
        completed_only: bool = False,
        limit: int = 25,
        expand_tasks: bool = False,
        start_time_from: Optional[int] = None,
        start_time_to: Optional[int] = None,
        page_token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List job runs in descending order by start time.

        Args:
            job_id: If provided, only return runs for this job
            active_only: If true, only include active runs (QUEUED, PENDING, RUNNING, TERMINATING)
            completed_only: If true, only include completed runs
            limit: Number of runs to return (1-25, default: 25)
            expand_tasks: Whether to include task and cluster details
            start_time_from: Show runs that started at or after this UTC timestamp (milliseconds)
            start_time_to: Show runs that started at or before this UTC timestamp (milliseconds)
            page_token: Use next_page_token from previous request for pagination

        Returns:
            List of run dictionaries
        """
        logger.debug(f"Listing runs for job_id={job_id}, active_only={active_only}")
        response = await self._run_sync_method(
            self.sdk_client.jobs.list_runs,
            job_id=job_id,
            active_only=active_only,
            completed_only=completed_only,
            limit=limit,
            expand_tasks=expand_tasks,
            start_time_from=start_time_from,
            start_time_to=start_time_to,
            page_token=page_token,
        )
        return [r.as_dict() for r in response]

    async def get_run(
        self,
        run_id: int,
        include_history: bool = False,
        include_resolved_values: bool = False,
        page_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get detailed information about a specific job run.

        Args:
            run_id: The canonical identifier for the run
            include_history: Whether to include repair history
            include_resolved_values: Whether to include resolved parameter values
            page_token: Use next_page_token from previous request for pagination

        Returns:
            Dictionary containing run details
        """
        logger.debug(f"Getting run {run_id}")
        response = await self._run_sync_method(
            self.sdk_client.jobs.get_run,
            run_id=run_id,
            include_history=include_history,
            include_resolved_values=include_resolved_values,
            page_token=page_token,
        )
        return response.as_dict()

    async def create_job(
        self,
        name: str,
        tasks: List[Dict[str, Any]],
        description: Optional[str] = None,
        schedule: Optional[Dict[str, Any]] = None,
        continuous: Optional[Dict[str, Any]] = None,
        max_concurrent_runs: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
        email_notifications: Optional[Dict[str, Any]] = None,
        webhook_notifications: Optional[Dict[str, Any]] = None,
        notification_settings: Optional[Dict[str, Any]] = None,
        git_source: Optional[Dict[str, Any]] = None,
        job_clusters: Optional[List[Dict[str, Any]]] = None,
        environments: Optional[List[Dict[str, Any]]] = None,
        run_as: Optional[Dict[str, Any]] = None,
        access_control_list: Optional[List[Dict[str, Any]]] = None,
        tags: Optional[Dict[str, str]] = None,
        parameters: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Create a new job with the specified configuration.

        Args:
            name: The name of the job
            tasks: List of task configurations
            description: Optional job description
            schedule: Optional cron schedule configuration
            continuous: Optional continuous execution configuration
            max_concurrent_runs: Maximum number of concurrent runs
            timeout_seconds: Job timeout in seconds
            email_notifications: Email notification settings
            webhook_notifications: Webhook notification settings
            notification_settings: Notification settings
            git_source: Git repository configuration
            job_clusters: List of job cluster configurations
            environments: List of environment configurations
            run_as: Run-as configuration
            access_control_list: List of access control configurations
            tags: Job tags
            parameters: List of job parameter definitions
            **kwargs: Additional job settings

        Returns:
            Dictionary with job_id of the created job
        """
        logger.info(f"Creating job '{name}' with {len(tasks)} tasks")

        # Convert tasks to Task objects
        task_objects = [Task.from_dict(task) for task in tasks]

        # Build job settings
        job_settings = {"name": name, "tasks": task_objects}

        # Add optional parameters
        if description:
            job_settings["description"] = description
        if schedule:
            job_settings["schedule"] = CronSchedule.from_dict(schedule)
        if continuous:
            job_settings["continuous"] = Continuous.from_dict(continuous)
        if max_concurrent_runs is not None:
            job_settings["max_concurrent_runs"] = max_concurrent_runs
        if timeout_seconds is not None:
            job_settings["timeout_seconds"] = timeout_seconds
        if email_notifications:
            job_settings["email_notifications"] = JobEmailNotifications.from_dict(
                email_notifications
            )
        if webhook_notifications:
            job_settings["webhook_notifications"] = WebhookNotifications.from_dict(
                webhook_notifications
            )
        if notification_settings:
            job_settings["notification_settings"] = JobNotificationSettings.from_dict(
                notification_settings
            )
        if git_source:
            job_settings["git_source"] = GitSource.from_dict(git_source)
        if job_clusters:
            job_settings["job_clusters"] = [
                JobCluster.from_dict(cluster) for cluster in job_clusters
            ]
        if environments:
            job_settings["environments"] = [
                JobEnvironment.from_dict(env) for env in environments
            ]
        if run_as:
            job_settings["run_as"] = JobRunAs.from_dict(run_as)
        if access_control_list:
            job_settings["access_control_list"] = [
                JobAccessControlRequest.from_dict(acl) for acl in access_control_list
            ]
        if tags:
            job_settings["tags"] = tags
        if parameters:
            job_settings["parameters"] = [
                JobParameterDefinition.from_dict(param) for param in parameters
            ]

        # Add any additional kwargs
        job_settings.update(kwargs)

        response = await self._run_sync_method(
            self.sdk_client.jobs.create, **job_settings
        )
        return {"job_id": response.job_id}

    async def run_now(
        self,
        job_id: int,
        notebook_params: Optional[Dict[str, str]] = None,
        python_params: Optional[List[str]] = None,
        python_named_params: Optional[Dict[str, str]] = None,
        jar_params: Optional[List[str]] = None,
        spark_submit_params: Optional[List[str]] = None,
        sql_params: Optional[Dict[str, str]] = None,
        dbt_commands: Optional[List[str]] = None,
        job_parameters: Optional[Dict[str, str]] = None,
        idempotency_token: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Trigger a new run of an existing job.

        Args:
            job_id: The ID of the job to be executed
            notebook_params: Parameters for notebook tasks
            python_params: Parameters for Python tasks
            python_named_params: Named parameters for Python tasks
            jar_params: Parameters for Spark JAR tasks
            spark_submit_params: Parameters for Spark submit tasks
            sql_params: Parameters for SQL tasks
            dbt_commands: Commands for dbt tasks
            job_parameters: Job-level parameters
            idempotency_token: Token to guarantee idempotency
            **kwargs: Additional run parameters

        Returns:
            Dictionary with run_id of the triggered run
        """
        logger.info(f"Running job {job_id}")

        run_params: Dict[str, Any] = {"job_id": job_id}

        if notebook_params:
            run_params["notebook_params"] = notebook_params
        if python_params:
            run_params["python_params"] = python_params
        if python_named_params:
            run_params["python_named_params"] = python_named_params
        if jar_params:
            run_params["jar_params"] = jar_params
        if spark_submit_params:
            run_params["spark_submit_params"] = spark_submit_params
        if sql_params:
            run_params["sql_params"] = sql_params
        if dbt_commands:
            run_params["dbt_commands"] = dbt_commands
        if job_parameters:
            run_params["job_parameters"] = job_parameters
        if idempotency_token:
            run_params["idempotency_token"] = idempotency_token

        run_params.update(kwargs)

        response = await self._run_sync_method(
            self.sdk_client.jobs.run_now, **run_params
        )
        # The run_now method returns a Wait[Run] object, we need to get the result
        run = response.result()
        return {"run_id": run.run_id}

    async def run_now_and_wait(
        self, job_id: int, timeout_minutes: int = 20, **kwargs
    ) -> Dict[str, Any]:
        """Trigger a run and wait for completion.

        Args:
            job_id: The ID of the job to be executed
            timeout_minutes: Maximum time to wait for completion (default: 20)
            **kwargs: Same parameters as run_now

        Returns:
            Dictionary containing the completed run details
        """
        logger.info(
            f"Running job {job_id} and waiting for completion (timeout: {timeout_minutes}m)"
        )

        response = await self._run_sync_method(
            self.sdk_client.jobs.run_now_and_wait,
            job_id=job_id,
            timeout=timedelta(minutes=timeout_minutes),
            **kwargs,
        )
        return response.as_dict()

    async def submit_run(
        self,
        tasks: List[Dict[str, Any]],
        run_name: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        git_source: Optional[Dict[str, Any]] = None,
        email_notifications: Optional[Dict[str, Any]] = None,
        webhook_notifications: Optional[Dict[str, Any]] = None,
        notification_settings: Optional[Dict[str, Any]] = None,
        environments: Optional[List[Dict[str, Any]]] = None,
        run_as: Optional[Dict[str, Any]] = None,
        access_control_list: Optional[List[Dict[str, Any]]] = None,
        idempotency_token: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Create and trigger a one-time run without creating a job.

        Args:
            tasks: List of task configurations for the run
            run_name: Optional name for the run
            timeout_seconds: Timeout for the run in seconds
            git_source: Git repository configuration
            email_notifications: Email notification settings
            webhook_notifications: Webhook notification settings
            notification_settings: Notification settings
            environments: List of environment configurations
            run_as: Run-as configuration
            access_control_list: List of access control configurations
            idempotency_token: Token to guarantee idempotency
            **kwargs: Additional submit parameters

        Returns:
            Dictionary with run_id of the submitted run
        """
        logger.info(
            f"Submitting one-time run '{run_name or 'Untitled'}' with {len(tasks)} tasks"
        )

        # Convert tasks to SubmitTask objects
        submit_tasks = [SubmitTask.from_dict(task) for task in tasks]

        submit_params: Dict[str, Any] = {"tasks": submit_tasks}

        if run_name:
            submit_params["run_name"] = run_name
        if timeout_seconds is not None:
            submit_params["timeout_seconds"] = timeout_seconds
        if git_source:
            submit_params["git_source"] = GitSource.from_dict(git_source)
        if email_notifications:
            submit_params["email_notifications"] = JobEmailNotifications.from_dict(
                email_notifications
            )
        if webhook_notifications:
            submit_params["webhook_notifications"] = WebhookNotifications.from_dict(
                webhook_notifications
            )
        if notification_settings:
            submit_params["notification_settings"] = JobNotificationSettings.from_dict(
                notification_settings
            )
        if environments:
            submit_params["environments"] = [
                JobEnvironment.from_dict(env) for env in environments
            ]
        if run_as:
            submit_params["run_as"] = JobRunAs.from_dict(run_as)
        if access_control_list:
            submit_params["access_control_list"] = [
                JobAccessControlRequest.from_dict(acl) for acl in access_control_list
            ]
        if idempotency_token:
            submit_params["idempotency_token"] = idempotency_token

        submit_params.update(kwargs)

        response = await self._run_sync_method(
            self.sdk_client.jobs.submit, **submit_params
        )
        # The submit method returns a Wait[Run] object, we need to get the result
        run = response.result()
        return {"run_id": run.run_id}

    async def submit_run_and_wait(
        self,
        tasks: List[Dict[str, Any]],
        run_name: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        timeout_minutes: int = 20,
        **kwargs,
    ) -> Dict[str, Any]:
        """Submit a one-time run and wait for completion.

        Args:
            tasks: List of task configurations for the run
            run_name: Optional name for the run
            timeout_seconds: Timeout for the run in seconds
            timeout_minutes: Maximum time to wait for completion (default: 20)
            **kwargs: Same parameters as submit_run

        Returns:
            Dictionary containing the completed run details
        """
        logger.info(
            f"Submitting run '{run_name or 'Untitled'}' and waiting for completion (timeout: {timeout_minutes}m)"
        )

        submit_tasks = [SubmitTask.from_dict(task) for task in tasks]

        submit_params: Dict[str, Any] = {
            "tasks": submit_tasks,
            "timeout": timedelta(minutes=timeout_minutes),
        }

        if run_name:
            submit_params["run_name"] = run_name
        if timeout_seconds is not None:
            submit_params["timeout_seconds"] = timeout_seconds

        # Add other parameters from kwargs
        for key, value in kwargs.items():
            if key not in submit_params:
                submit_params[key] = value

        run = await self._run_sync_method(
            self.sdk_client.jobs.submit_and_wait, **submit_params
        )

        return run.as_dict()

    async def cancel_run(self, run_id: int) -> None:
        """Cancel a specific job run.

        Args:
            run_id: The ID of the run to cancel
        """
        logger.info(f"Cancelling run {run_id}")
        await self._run_sync_method(self.sdk_client.jobs.cancel_run, run_id=run_id)

    async def cancel_run_and_wait(
        self, run_id: int, timeout_minutes: int = 20
    ) -> Dict[str, Any]:
        """Cancel a run and wait for it to terminate.

        Args:
            run_id: The ID of the run to cancel
            timeout_minutes: Maximum time to wait for cancellation (default: 20)

        Returns:
            Dictionary containing the cancelled run details
        """
        logger.info(f"Cancelling run {run_id} and waiting for termination")
        response = await self._run_sync_method(
            self.sdk_client.jobs.cancel_run_and_wait,
            run_id=run_id,
            timeout=timedelta(minutes=timeout_minutes),
        )
        return response.as_dict()

    async def cancel_all_runs(
        self, job_id: Optional[int] = None, all_queued_runs: Optional[bool] = None
    ) -> None:
        """Cancel all active runs of a job or all queued runs in the workspace.

        Args:
            job_id: If provided, cancel all runs for this job
            all_queued_runs: If True, cancel all queued runs in the workspace
        """
        logger.info(
            f"Cancelling all runs for job_id={job_id}, all_queued_runs={all_queued_runs}"
        )
        await self._run_sync_method(
            self.sdk_client.jobs.cancel_all_runs,
            job_id=job_id,
            all_queued_runs=all_queued_runs,
        )

    async def delete_job(self, job_id: int) -> None:
        """Delete a job permanently.

        Args:
            job_id: The canonical identifier of the job to delete
        """
        logger.info(f"Deleting job {job_id}")
        await self._run_sync_method(self.sdk_client.jobs.delete, job_id=job_id)

    async def delete_run(self, run_id: int) -> None:
        """Delete a non-active run.

        Args:
            run_id: The ID of the run to delete

        Raises:
            DatabricksAPIError: If the run is still active
        """
        logger.info(f"Deleting run {run_id}")
        await self._run_sync_method(self.sdk_client.jobs.delete_run, run_id=run_id)

    async def get_run_output(self, run_id: int) -> Dict[str, Any]:
        """Get the output for a completed job run.

        Args:
            run_id: The canonical identifier for the run

        Returns:
            Dictionary containing the run output
        """
        logger.debug(f"Getting output for run {run_id}")
        response = await self._run_sync_method(
            self.sdk_client.jobs.get_run_output, run_id=run_id
        )
        return response.as_dict()

    async def update_job(
        self,
        job_id: int,
        new_settings: Optional[Dict[str, Any]] = None,
        fields_to_remove: Optional[List[str]] = None,
    ) -> None:
        """Update an existing job.

        Args:
            job_id: The job ID to update
            new_settings: New job settings to apply (partially replaces existing settings)
            fields_to_remove: List of fields to remove from job settings
        """
        logger.info(f"Updating job {job_id}")

        job_settings = None
        if new_settings:
            job_settings = JobSettings.from_dict(new_settings)

        await self._run_sync_method(
            self.sdk_client.jobs.update,
            job_id=job_id,
            new_settings=job_settings,
            fields_to_remove=fields_to_remove,
        )

    async def reset_job(self, job_id: int, new_settings: Dict[str, Any]) -> None:
        """Reset a job to completely new settings.

        Args:
            job_id: The canonical identifier of the job to reset
            new_settings: The new settings that completely replace the old settings
        """
        logger.info(f"Resetting job {job_id}")

        job_settings = JobSettings.from_dict(new_settings)
        await self._run_sync_method(
            self.sdk_client.jobs.reset, job_id=job_id, new_settings=job_settings
        )

    async def repair_run(
        self,
        run_id: int,
        rerun_tasks: Optional[List[str]] = None,
        latest_repair_id: Optional[int] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Repair a failed or cancelled run.

        Args:
            run_id: The ID of the run to repair
            rerun_tasks: List of task keys to rerun
            latest_repair_id: ID of the latest repair attempt
            **kwargs: Additional repair parameters

        Returns:
            Dictionary with repair_id of the repair run
        """
        logger.info(f"Repairing run {run_id}")

        repair_params: Dict[str, Any] = {"run_id": run_id}
        if rerun_tasks:
            repair_params["rerun_tasks"] = rerun_tasks
        if latest_repair_id is not None:
            repair_params["latest_repair_id"] = latest_repair_id
        repair_params.update(kwargs)

        response = await self._run_sync_method(
            self.sdk_client.jobs.repair_run, **repair_params
        )
        return {"repair_id": response.repair_id}

    async def repair_run_and_wait(
        self,
        run_id: int,
        rerun_tasks: Optional[List[str]] = None,
        latest_repair_id: Optional[int] = None,
        timeout_minutes: int = 20,
        **kwargs,
    ) -> Dict[str, Any]:
        """Repair a run and wait for completion.

        Args:
            run_id: The ID of the run to repair
            rerun_tasks: List of task keys to rerun
            latest_repair_id: ID of the latest repair attempt
            timeout_minutes: Maximum time to wait for completion (default: 20)
            **kwargs: Additional repair parameters

        Returns:
            Dictionary containing the repaired run details
        """
        logger.info(f"Repairing run {run_id} and waiting for completion")

        repair_params: Dict[str, Any] = {
            "run_id": run_id,
            "timeout": timedelta(minutes=timeout_minutes),
        }
        if rerun_tasks:
            repair_params["rerun_tasks"] = rerun_tasks
        if latest_repair_id is not None:
            repair_params["latest_repair_id"] = latest_repair_id
        repair_params.update(kwargs)

        response = await self._run_sync_method(
            self.sdk_client.jobs.repair_run_and_wait, **repair_params
        )
        return response.as_dict()

    async def export_run(
        self, run_id: int, views_to_export: str = "CODE"
    ) -> Dict[str, Any]:
        """Export and retrieve the job run task.

        Args:
            run_id: The canonical identifier for the run
            views_to_export: Which views to export (CODE, DASHBOARDS, or ALL)

        Returns:
            Dictionary containing the exported run data
        """
        logger.debug(f"Exporting run {run_id} with views: {views_to_export}")

        views = ViewsToExport(views_to_export) if views_to_export else None

        response = await self._run_sync_method(
            self.sdk_client.jobs.export_run, run_id=run_id, views_to_export=views
        )

        return response.as_dict()

    # =============================================================================
    # PERMISSION MANAGEMENT
    # =============================================================================

    async def get_permissions(self, job_id: str) -> Dict[str, Any]:
        """Get the permissions of a job.

        Args:
            job_id: The job for which to get permissions

        Returns:
            Dictionary containing job permissions
        """
        logger.debug(f"Getting permissions for job {job_id}")
        response = await self._run_sync_method(
            self.sdk_client.jobs.get_permissions, job_id=job_id
        )
        return response.as_dict()

    async def update_permissions(
        self, job_id: str, access_control_list: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Update the permissions of a job.

        Args:
            job_id: The job for which to update permissions
            access_control_list: List of access control configurations

        Returns:
            Dictionary containing updated job permissions
        """
        logger.info(f"Updating permissions for job {job_id}")

        acl = None
        if access_control_list:
            acl = [
                JobAccessControlRequest.from_dict(req) for req in access_control_list
            ]

        response = await self._run_sync_method(
            self.sdk_client.jobs.update_permissions,
            job_id=job_id,
            access_control_list=acl,
        )
        return response.as_dict()

    async def set_permissions(
        self, job_id: str, access_control_list: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Set the permissions of a job (replace all existing permissions).

        Args:
            job_id: The job for which to set permissions
            access_control_list: List of access control configurations

        Returns:
            Dictionary containing the new job permissions
        """
        logger.info(f"Setting permissions for job {job_id}")

        acl = None
        if access_control_list:
            acl = [
                JobAccessControlRequest.from_dict(req) for req in access_control_list
            ]

        response = await self._run_sync_method(
            self.sdk_client.jobs.set_permissions, job_id=job_id, access_control_list=acl
        )
        return response.as_dict()

    async def get_permission_levels(self, job_id: str) -> Dict[str, Any]:
        """Get available permission levels for a job.

        Args:
            job_id: The job for which to get permission levels

        Returns:
            Dictionary containing available permission levels
        """
        logger.debug(f"Getting permission levels for job {job_id}")
        response = await self._run_sync_method(
            self.sdk_client.jobs.get_permission_levels, job_id=job_id
        )
        return response.as_dict()

    # =============================================================================
    # POLICY COMPLIANCE
    # =============================================================================

    async def get_compliance(self, job_id: int) -> Dict[str, Any]:
        """Get the policy compliance status of a job.

        Args:
            job_id: The ID of the job whose compliance status to retrieve

        Returns:
            Dictionary containing compliance status
        """
        logger.debug(f"Getting compliance status for job {job_id}")
        response = await self._run_sync_method(
            self.sdk_client.policy_compliance_for_jobs.get_compliance, job_id=job_id
        )
        return response.as_dict()

    async def enforce_compliance(
        self, job_id: int, validate_only: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Update a job to make it compliant with its policies.

        Args:
            job_id: The ID of the job to enforce compliance on
            validate_only: If True, preview changes without updating the job

        Returns:
            Dictionary containing compliance enforcement response
        """
        logger.info(
            f"Enforcing compliance for job {job_id} (validate_only={validate_only})"
        )

        params: Dict[str, Any] = {"job_id": job_id}
        if validate_only is not None:
            params["validate_only"] = validate_only

        response = await self._run_sync_method(
            self.sdk_client.policy_compliance_for_jobs.enforce_compliance, **params
        )
        return response.as_dict()

    async def list_compliance(
        self, policy_id: str, page_size: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """List policy compliance status of all jobs using a given policy.

        Args:
            policy_id: Canonical unique identifier for the cluster policy
            page_size: Maximum number of results per page

        Returns:
            List of job compliance dictionaries
        """
        logger.debug(f"Listing compliance for policy {policy_id}")

        params: Dict[str, Any] = {"policy_id": policy_id}
        if page_size is not None:
            params["page_size"] = page_size

        response = await self._run_sync_method(
            self.sdk_client.policy_compliance_for_jobs.list_compliance, **params
        )
        return [item.as_dict() for item in response]
