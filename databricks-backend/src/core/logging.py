"""Structlog-based logging configuration for the application."""

import logging
import logging.config
import random
from typing import Any, Optional

import structlog
from structlog.types import Processor

# --- Structlog Configuration ---


def redact_sensitive(_, __, event_dict):
    """Redact sensitive fields in log events."""
    sensitive_fields = {"password", "token", "secret", "key", "authorization"}
    for field in sensitive_fields:
        if field in event_dict:
            event_dict[field] = "***REDACTED***"
    return event_dict


def sample_debug_logs(sample_rate: float):
    """Return a processor that samples DEBUG logs at the given rate."""
    def processor(logger, method_name, event_dict):
        if method_name == "debug" and random.random() > sample_rate:
            # Drop the log by raising DropEvent
            raise structlog.DropEvent
        return event_dict
    return processor


def configure_logging(
    log_level: str = "INFO", debug: bool = False, log_file: Optional[str] = None, sample_debug_rate: float = 1.0
):
    """Configure logging for the application using structlog.

    This function sets up structured logging with context-aware capabilities.
    It configures both `structlog` and the standard `logging` library to work
    together, providing clear and parseable log output in either JSON or a
    developer-friendly console format.

    Args:
        log_level (str): The minimum log level to output (e.g., "INFO", "DEBUG").
        debug (bool): If True, sets the log level to DEBUG, overriding `log_level`.
        log_file (str, optional): If provided, logs will be written to this file
                                  in JSON format, with rotation. Defaults to None.
        sample_debug_rate (float): Rate to sample DEBUG logs (0.0 to 1.0). E.g., 0.1
                                   keeps 10% of DEBUG logs. Defaults to 1.0 (no sampling).
    """
    log_level = "DEBUG" if debug else log_level.upper()

    # Define shared processors for all logs
    shared_processors: list[Processor] = [
        redact_sensitive,
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        # structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        # structlog.processors.UnicodeDecoder(),
    ]

    if sample_debug_rate < 1.0:
        shared_processors.insert(1, sample_debug_logs(sample_debug_rate))  # After redact, before others

    # Configure structlog itself
    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Define formatters for standard library logging
    formatters = {
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.processors.JSONRenderer(),
        },
        "console": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.dev.ConsoleRenderer(colors=False),
        },
    }

    # Define handlers
    handlers = {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "console",
            "stream": "ext://sys.stderr",
        }
    }
    if log_file:
        handlers["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "json",
            "filename": log_file,
            "maxBytes": 10 * 1024 * 1024,  # 10MB
            "backupCount": 5,
            "encoding": "utf8",
        }
        error_log_file = log_file.replace(".log", "_errors.log")
        handlers["error_file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "ERROR",
            "formatter": "json",
            "filename": error_log_file,
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 3,
            "encoding": "utf8",
        }

    # Configure standard library logging
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": formatters,
            "handlers": handlers,
            "loggers": {
                "": {
                    "handlers": list(handlers.keys()),
                    "level": log_level,
                    "propagate": True,
                },
                # Quiet down noisy third-party loggers
                "uvicorn.access": {"level": "WARNING", "propagate": False},
                "uvicorn.error": {"level": "INFO"},
                "databases": {"level": "WARNING"},
                "httpx": {"level": "WARNING"},
            },
        }
    )

    logger = get_logger(__name__)
    logger.info("Logging system initialized", log_level=log_level, debug_mode=debug)


def get_logger(name: Optional[str] = None) -> Any:
    """Get a structlog logger."""
    return structlog.get_logger(name)


def log_performance(func_name: str, duration_ms: float, **kwargs):
    """Log performance metrics using structlog."""
    logger = get_logger("performance")

    if duration_ms > 1000:
        level = "warning"
        emoji = "🐌"
    elif duration_ms > 500:
        level = "info"
        emoji = "⏱️"
    else:
        level = "debug"
        emoji = "⚡"

    getattr(logger, level)(
        f"{emoji} Performance",
        func_name=func_name,
        duration_ms=round(duration_ms, 2),
        **kwargs,
    )


def log_api_metrics(
    method: str, path: str, status_code: int, duration_ms: float, **kwargs
):
    """Log API metrics in a structured format using structlog."""
    logger = get_logger("api_metrics")

    if status_code >= 500:
        level = "error"
    elif status_code >= 400:
        level = "warning"
    else:
        level = "info"

    getattr(logger, level)(
        "API Request",
        method=method,
        path=path,
        status_code=status_code,
        duration_ms=round(duration_ms, 2),
        **kwargs,
    )
