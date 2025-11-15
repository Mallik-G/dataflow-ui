"""Retry decorator with exponential backoff for resilient API calls."""

import asyncio
import functools
import logging
from typing import Callable, Type, Tuple
import random

logger = logging.getLogger(__name__)


def async_retry(
    max_attempts: int = 3,
    backoff_base: float = 2.0,
    backoff_max: float = 60.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    jitter: bool = True,
):
    """Decorator to retry async functions with exponential backoff.

    Args:
        max_attempts: Maximum number of retry attempts (default: 3)
        backoff_base: Base for exponential backoff in seconds (default: 2.0)
        backoff_max: Maximum backoff delay in seconds (default: 60.0)
        exceptions: Tuple of exception types to retry on (default: all exceptions)
        jitter: Add random jitter to backoff to avoid thundering herd (default: True)

    Example:
        @async_retry(max_attempts=5, exceptions=(ConnectionError, TimeoutError))
        async def fetch_data():
            return await api.get("/data")
    """

    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            attempt = 1

            while attempt <= max_attempts:
                try:
                    return await func(*args, **kwargs)

                except exceptions as e:
                    if attempt == max_attempts:
                        logger.error(
                            f"{func.__name__} failed after {max_attempts} attempts: {e}"
                        )
                        raise

                    # Calculate exponential backoff delay
                    delay = min(backoff_base ** (attempt - 1), backoff_max)

                    # Add jitter to prevent thundering herd
                    if jitter:
                        delay = delay * (0.5 + random.random())

                    logger.warning(
                        f"{func.__name__} attempt {attempt}/{max_attempts} failed: {e}. "
                        f"Retrying in {delay:.2f}s..."
                    )

                    await asyncio.sleep(delay)
                    attempt += 1

        return wrapper

    return decorator


def sync_retry(
    max_attempts: int = 3,
    backoff_base: float = 2.0,
    backoff_max: float = 60.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    jitter: bool = True,
):
    """Decorator to retry synchronous functions with exponential backoff.

    Args:
        max_attempts: Maximum number of retry attempts (default: 3)
        backoff_base: Base for exponential backoff in seconds (default: 2.0)
        backoff_max: Maximum backoff delay in seconds (default: 60.0)
        exceptions: Tuple of exception types to retry on (default: all exceptions)
        jitter: Add random jitter to backoff to avoid thundering herd (default: True)

    Example:
        @sync_retry(max_attempts=5, exceptions=(ConnectionError,))
        def fetch_data():
            return requests.get("/data")
    """

    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            attempt = 1

            while attempt <= max_attempts:
                try:
                    return func(*args, **kwargs)

                except exceptions as e:
                    if attempt == max_attempts:
                        logger.error(
                            f"{func.__name__} failed after {max_attempts} attempts: {e}"
                        )
                        raise

                    # Calculate exponential backoff delay
                    delay = min(backoff_base ** (attempt - 1), backoff_max)

                    # Add jitter to prevent thundering herd
                    if jitter:
                        delay = delay * (0.5 + random.random())

                    logger.warning(
                        f"{func.__name__} attempt {attempt}/{max_attempts} failed: {e}. "
                        f"Retrying in {delay:.2f}s..."
                    )

                    import time

                    time.sleep(delay)
                    attempt += 1

        return wrapper

    return decorator
