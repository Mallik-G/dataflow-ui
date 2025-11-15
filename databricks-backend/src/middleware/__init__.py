"""Middleware package for Nexa X360 Databricks CI/CD Platform."""

from .request_response_logging import RequestResponseLoggingMiddleware


from .error_handlers import (
    APIError,
    DatabaseError,
    ErrorContext,
    ExternalServiceError,
    handle_database_error,
    handle_external_service_error,
    setup_error_handlers,
    ValidationError,
)
from .request_id import RequestIdMiddleware
# from .security import (
#     RateLimitMiddleware,
#     SecurityHeadersMiddleware,
#     setup_security_middleware,
# )

__all__ = [
    # Security middleware
    # "SecurityHeadersMiddleware",
    # "RateLimitMiddleware",
    "RequestIdMiddleware",
    # "setup_security_middleware",
    # Request/Response logging
    "RequestResponseLoggingMiddleware",
    # Error handling
    "APIError",
    "DatabaseError",
    "ValidationError",
    "ExternalServiceError",
    "ErrorContext",
    "setup_error_handlers",
    "handle_database_error",
    "handle_external_service_error",
]
