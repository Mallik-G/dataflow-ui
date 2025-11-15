"""Custom exceptions for the Nexa Databricks API."""

from typing import Any, Optional

from fastapi import HTTPException, status


class NexaBaseException(Exception):
    """Base exception class for all Nexa-specific exceptions."""

    def __init__(self, message: str, details: Optional[dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class NexaHTTPException(HTTPException):
    """Base HTTP exception with consistent error format."""

    def __init__(
        self,
        status_code: int,
        message: str,
        error_code: str,
        details: Optional[dict[str, Any]] = None,
    ):
        self.error_code = error_code
        self.details = details or {}

        detail = {"error_code": error_code, "message": message, "details": self.details}
        super().__init__(status_code=status_code, detail=detail)


# Authentication and Authorization Exceptions
class AuthenticationError(NexaHTTPException):
    """Raised when authentication fails."""

    def __init__(
        self,
        message: str = "Authentication failed",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message=message,
            error_code="AUTHENTICATION_FAILED",
            details=details,
        )


class AuthorizationError(NexaHTTPException):
    """Raised when authorization fails."""

    def __init__(
        self,
        message: str = "Insufficient permissions",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            message=message,
            error_code="AUTHORIZATION_DENIED",
            details=details,
        )


# Resource Exceptions
class ResourceNotFoundError(NexaHTTPException):
    """Raised when a requested resource is not found."""

    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        details: Optional[dict[str, Any]] = None,
    ):
        message = f"{resource_type} with ID '{resource_id}' not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            message=message,
            error_code="RESOURCE_NOT_FOUND",
            details=details
            or {"resource_type": resource_type, "resource_id": resource_id},
        )


class ResourceAlreadyExistsError(NexaHTTPException):
    """Raised when attempting to create a resource that already exists."""

    def __init__(
        self,
        resource_type: str,
        resource_id: str,
        details: Optional[dict[str, Any]] = None,
    ):
        message = f"{resource_type} with ID '{resource_id}' already exists"
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            message=message,
            error_code="RESOURCE_ALREADY_EXISTS",
            details=details
            or {"resource_type": resource_type, "resource_id": resource_id},
        )


class ResourceConflictError(NexaHTTPException):
    """Raised when a resource operation conflicts with current state."""

    def __init__(self, message: str, details: Optional[dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            message=message,
            error_code="RESOURCE_CONFLICT",
            details=details,
        )


# Validation Exceptions
class ValidationError(NexaHTTPException):
    """Raised when input validation fails."""

    def __init__(self, message: str, field_errors: Optional[dict[str, str]] = None):
        details = {"field_errors": field_errors} if field_errors else {}
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message=message,
            error_code="VALIDATION_ERROR",
            details=details,
        )


# Deployment Exceptions
class DeploymentError(NexaHTTPException):
    """Raised when deployment operations fail."""

    def __init__(
        self,
        message: str,
        deployment_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        deployment_details = details or {}
        if deployment_id:
            deployment_details["deployment_id"] = deployment_id

        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=message,
            error_code="DEPLOYMENT_ERROR",
            details=deployment_details,
        )


class DeploymentNotFoundError(ResourceNotFoundError):
    """Raised when a deployment is not found."""

    def __init__(self, deployment_id: str):
        super().__init__("deployment", deployment_id)


class DeploymentTimeoutError(NexaHTTPException):
    """Raised when a deployment times out."""

    def __init__(self, deployment_id: str, timeout_minutes: int):
        message = (
            f"Deployment '{deployment_id}' timed out after {timeout_minutes} minutes"
        )
        super().__init__(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            message=message,
            error_code="DEPLOYMENT_TIMEOUT",
            details={
                "deployment_id": deployment_id,
                "timeout_minutes": timeout_minutes,
            },
        )


# Databricks Integration Exceptions
class DatabricksAPIError(NexaHTTPException):
    """Raised when Databricks API calls fail."""

    def __init__(
        self,
        message: str,
        databricks_error_code: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        error_details = details or {}
        if databricks_error_code:
            error_details["databricks_error_code"] = databricks_error_code

        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            message=message,
            error_code="DATABRICKS_API_ERROR",
            details=error_details,
        )


class DatabricksConnectionError(NexaHTTPException):
    """Raised when connection to Databricks fails."""

    def __init__(
        self,
        message: str = "Failed to connect to Databricks",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message=message,
            error_code="DATABRICKS_CONNECTION_ERROR",
            details=details,
        )


# Git Integration Exceptions
class GitOperationError(NexaHTTPException):
    """Raised when Git operations fail."""

    def __init__(
        self, operation: str, message: str, details: Optional[dict[str, Any]] = None
    ):
        error_details = details or {}
        error_details["operation"] = operation

        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            message=f"Git {operation} failed: {message}",
            error_code="GIT_OPERATION_ERROR",
            details=error_details,
        )


class GitAuthenticationError(NexaHTTPException):
    """Raised when Git authentication fails."""

    def __init__(self, provider: str, details: Optional[dict[str, Any]] = None):
        message = f"Git authentication failed for {provider}"
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message=message,
            error_code="GIT_AUTHENTICATION_ERROR",
            details=details or {"provider": provider},
        )


# Rate Limiting Exceptions
class RateLimitExceededError(NexaHTTPException):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        retry_after: Optional[int] = None,
        details: Optional[dict[str, Any]] = None,
    ):
        message = "Rate limit exceeded"
        error_details = details or {}
        if retry_after:
            error_details["retry_after"] = retry_after
            message += f", retry after {retry_after} seconds"

        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            details=error_details,
        )

        # Add Retry-After header for HTTP 429 responses
        if retry_after:
            self.headers = {"Retry-After": str(retry_after)}


# Environment Exceptions
class EnvironmentNotFoundError(ResourceNotFoundError):
    """Raised when an environment is not found."""

    def __init__(self, environment_id: str):
        super().__init__("environment", environment_id)


class EnvironmentConfigurationError(NexaHTTPException):
    """Raised when environment configuration is invalid."""

    def __init__(
        self,
        environment_id: str,
        message: str,
        details: Optional[dict[str, Any]] = None,
    ):
        error_details = details or {}
        error_details["environment_id"] = environment_id

        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=f"Environment '{environment_id}' configuration error: {message}",
            error_code="ENVIRONMENT_CONFIGURATION_ERROR",
            details=error_details,
        )


# Service Exceptions
class ServiceUnavailableError(NexaHTTPException):
    """Raised when a service is unavailable."""

    def __init__(self, service_name: str, details: Optional[dict[str, Any]] = None):
        message = f"Service '{service_name}' is currently unavailable"
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message=message,
            error_code="SERVICE_UNAVAILABLE",
            details=details or {"service_name": service_name},
        )


class InternalServerError(NexaHTTPException):
    """Raised for internal server errors."""

    def __init__(
        self,
        message: str = "Internal server error",
        details: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=message,
            error_code="INTERNAL_SERVER_ERROR",
            details=details,
        )


# Utility functions for error handling
def format_validation_error(errors: list) -> dict[str, str]:
    """Format Pydantic validation errors into a more readable format."""
    field_errors = {}
    for error in errors:
        field_path = ".".join(str(x) for x in error["loc"])
        field_errors[field_path] = error["msg"]
    return field_errors


def create_error_response(
    error_code: str, message: str, details: Optional[dict[str, Any]] = None
) -> dict[str, Any]:
    """Create a standardized error response."""
    return {"error_code": error_code, "message": message, "details": details or {}}
