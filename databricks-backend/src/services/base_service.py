"""Base service for background tasks."""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class BaseService:
    """Base class for background services."""

    def __init__(self, sync_interval: int):
        self.sync_interval = sync_interval
        self.is_running = False
        self.task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the background service."""
        if self.is_running:
            logger.warning(f"{self.__class__.__name__} is already running")
            return

        self.is_running = True
        self.task = asyncio.create_task(self._sync_loop())
        logger.info(
            f"{self.__class__.__name__} started (interval: {self.sync_interval}s)"
        )

    async def stop(self):
        """Stop the background sync service."""
        if not self.is_running:
            return

        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

        logger.info(f"{self.__class__.__name__} stopped")

    async def _sync_loop(self):
        """Main sync loop that runs continuously."""
        logger.info(f"{self.__class__.__name__} sync loop started")

        await asyncio.sleep(10)  # Wait 10 seconds for app startup

        while self.is_running:
            try:
                await self._perform_sync()
                logger.info(f"Next sync in {self.sync_interval} seconds")
            except Exception as e:
                logger.error(f"{self.__class__.__name__} sync failed: {e}")

            try:
                await asyncio.sleep(self.sync_interval)
            except asyncio.CancelledError:
                break

        logger.info(f"{self.__class__.__name__} sync loop ended")

    async def _perform_sync(self):
        """Perform the sync operation. To be implemented by subclasses."""
        raise NotImplementedError
