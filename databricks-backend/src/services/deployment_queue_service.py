"""
Deployment Queue Service

Manages FIFO deployment queue per environment.
Ensures only one deployment runs at a time per environment.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.db import Deployment, DeploymentQueue

logger = logging.getLogger(__name__)


class DeploymentQueueService:
    """Manages deployment queue to prevent concurrent deployments per environment."""

    def __init__(self, db: Session):
        self.db = db

    def enqueue_deployment(
        self,
        deployment_id: str,
        environment_id: str,
        requested_by: Optional[str] = None,
        files_count: int = 0,
    ) -> DeploymentQueue:
        """
        Add deployment to queue.

        Args:
            deployment_id: Deployment ID
            environment_id: Target environment ID
            requested_by: User who requested deployment
            files_count: Number of files in deployment

        Returns:
            DeploymentQueue record
        """
        logger.info(
            f"Enqueueing deployment {deployment_id} for environment {environment_id}"
        )

        # Calculate next position in queue
        position = self._get_next_position(environment_id)

        queue_entry = DeploymentQueue(
            id=f"queue-{uuid.uuid4()}",
            deployment_id=deployment_id,
            environment_id=environment_id,
            position=position,
            status="queued",
            requested_by=requested_by,
            files_count=files_count,
            queued_at=datetime.now(timezone.utc),
        )

        self.db.add(queue_entry)
        self.db.commit()
        self.db.refresh(queue_entry)

        logger.info(
            f"Deployment {deployment_id} queued at position {position} for {environment_id}"
        )

        return queue_entry

    def can_start_deployment(self, environment_id: str) -> bool:
        """
        Check if a deployment can start in this environment.

        A deployment can start if there's no currently running deployment.

        Args:
            environment_id: Environment ID

        Returns:
            True if a deployment can start, False otherwise
        """
        running_count = (
            self.db.query(DeploymentQueue)
            .filter(
                and_(
                    DeploymentQueue.environment_id == environment_id,
                    DeploymentQueue.status == "running",
                )
            )
            .count()
        )

        can_start = running_count == 0
        logger.debug(
            f"Environment {environment_id}: running={running_count}, can_start={can_start}"
        )

        return can_start

    def get_next_queued_deployment(
        self, environment_id: str
    ) -> Optional[DeploymentQueue]:
        """
        Get next queued deployment for environment.

        Returns deployment with lowest position number that's in 'queued' status.

        Args:
            environment_id: Environment ID

        Returns:
            Next DeploymentQueue entry or None
        """
        next_deployment = (
            self.db.query(DeploymentQueue)
            .filter(
                and_(
                    DeploymentQueue.environment_id == environment_id,
                    DeploymentQueue.status == "queued",
                )
            )
            .order_by(DeploymentQueue.position.asc())
            .first()
        )

        if next_deployment:
            logger.info(
                f"Next queued deployment for {environment_id}: {next_deployment.deployment_id} (position {next_deployment.position})"
            )
        else:
            logger.debug(f"No queued deployments for {environment_id}")

        return next_deployment

    def start_deployment(self, queue_id: str) -> DeploymentQueue:
        """
        Mark deployment as running.

        Args:
            queue_id: Queue entry ID

        Returns:
            Updated DeploymentQueue entry
        """
        queue_entry = self.db.query(DeploymentQueue).filter_by(id=queue_id).first()

        if not queue_entry:
            raise ValueError(f"Queue entry {queue_id} not found")

        if queue_entry.status != "queued":
            raise ValueError(
                f"Cannot start deployment in status '{queue_entry.status}'"
            )

        queue_entry.status = "running"
        queue_entry.started_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(queue_entry)

        logger.info(
            f"Started deployment {queue_entry.deployment_id} in {queue_entry.environment_id}"
        )

        return queue_entry

    def complete_deployment(
        self, queue_id: str, success: bool, error_message: Optional[str] = None
    ) -> DeploymentQueue:
        """
        Mark deployment as completed or failed.

        Args:
            queue_id: Queue entry ID
            success: True if deployment succeeded
            error_message: Error message if failed

        Returns:
            Updated DeploymentQueue entry
        """
        queue_entry = self.db.query(DeploymentQueue).filter_by(id=queue_id).first()

        if not queue_entry:
            raise ValueError(f"Queue entry {queue_id} not found")

        queue_entry.status = "completed" if success else "failed"
        queue_entry.completed_at = datetime.now(timezone.utc)
        queue_entry.error_message = error_message

        self.db.commit()
        self.db.refresh(queue_entry)

        logger.info(
            f"Deployment {queue_entry.deployment_id} {queue_entry.status} in {queue_entry.environment_id}"
        )

        return queue_entry

    def cancel_deployment(self, queue_id: str) -> DeploymentQueue:
        """
        Cancel a queued deployment.

        Args:
            queue_id: Queue entry ID

        Returns:
            Updated DeploymentQueue entry
        """
        queue_entry = self.db.query(DeploymentQueue).filter_by(id=queue_id).first()

        if not queue_entry:
            raise ValueError(f"Queue entry {queue_id} not found")

        if queue_entry.status not in ["queued", "running"]:
            raise ValueError(
                f"Cannot cancel deployment in status '{queue_entry.status}'"
            )

        queue_entry.status = "cancelled"
        queue_entry.completed_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(queue_entry)

        logger.info(
            f"Cancelled deployment {queue_entry.deployment_id} in {queue_entry.environment_id}"
        )

        # Reorder remaining queued deployments
        self._reorder_queue(queue_entry.environment_id)

        return queue_entry

    def get_queue_status(self, environment_id: str) -> List[DeploymentQueue]:
        """
        Get current queue status for environment.

        Args:
            environment_id: Environment ID

        Returns:
            List of queue entries (queued and running only)
        """
        queue_entries = (
            self.db.query(DeploymentQueue)
            .filter(
                and_(
                    DeploymentQueue.environment_id == environment_id,
                    DeploymentQueue.status.in_(["queued", "running"]),
                )
            )
            .order_by(DeploymentQueue.position.asc())
            .all()
        )

        logger.debug(
            f"Queue status for {environment_id}: {len(queue_entries)} entries"
        )

        return queue_entries

    def get_queue_position(self, deployment_id: str) -> Optional[dict]:
        """
        Get queue position for a deployment.

        Args:
            deployment_id: Deployment ID

        Returns:
            Dict with position info or None
        """
        queue_entry = (
            self.db.query(DeploymentQueue)
            .filter_by(deployment_id=deployment_id)
            .first()
        )

        if not queue_entry:
            return None

        # Count how many are ahead in queue
        ahead_count = (
            self.db.query(DeploymentQueue)
            .filter(
                and_(
                    DeploymentQueue.environment_id == queue_entry.environment_id,
                    DeploymentQueue.status.in_(["queued", "running"]),
                    DeploymentQueue.position < queue_entry.position,
                )
            )
            .count()
        )

        return {
            "queue_id": queue_entry.id,
            "position": queue_entry.position,
            "status": queue_entry.status,
            "ahead_in_queue": ahead_count,
            "queued_at": queue_entry.queued_at,
            "started_at": queue_entry.started_at,
        }

    # -------------------------------------------------------------------------
    # Private Helper Methods
    # -------------------------------------------------------------------------

    def _get_next_position(self, environment_id: str) -> int:
        """
        Get next available position in queue.

        Args:
            environment_id: Environment ID

        Returns:
            Next position number (1-based)
        """
        max_position = (
            self.db.query(DeploymentQueue.position)
            .filter(DeploymentQueue.environment_id == environment_id)
            .order_by(DeploymentQueue.position.desc())
            .first()
        )

        return (max_position[0] + 1) if max_position else 1

    def _reorder_queue(self, environment_id: str) -> None:
        """
        Reorder queue positions after cancellation.

        Args:
            environment_id: Environment ID
        """
        queued_entries = (
            self.db.query(DeploymentQueue)
            .filter(
                and_(
                    DeploymentQueue.environment_id == environment_id,
                    DeploymentQueue.status == "queued",
                )
            )
            .order_by(DeploymentQueue.position.asc())
            .all()
        )

        # Reassign positions sequentially
        for idx, entry in enumerate(queued_entries, start=1):
            entry.position = idx

        self.db.commit()
        logger.debug(f"Reordered queue for {environment_id}: {len(queued_entries)} entries")
