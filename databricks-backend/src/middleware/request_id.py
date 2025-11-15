import uuid

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = structlog.get_logger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware to inject a unique request ID into each incoming request.

    This middleware performs several key functions:
    1.  Generates a unique UUID for each request.
    2.  Binds the `request_id` and other request details (method, path, client)
        to `structlog`'s context, making it available for all subsequent logs
        within that request's lifecycle.
    3.  Stores the `request_id` in `request.state` for easy access within the
        application.
    4.  Adds the `request_id` to the `X-Request-ID` header in the response,
        allowing clients and other services to correlate logs.
    5.  Logs the start and end of each request.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """- Generates a unique request ID.
        - Binds the request ID to structlog's context.
        - Adds the request ID to the response headers.
        """
        # Clear context-local structlog context
        structlog.contextvars.clear_contextvars()

        # Generate a unique request ID
        request_id = str(uuid.uuid4())

        # Bind the request ID to structlog's context
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_host=request.client.host if request.client else None,
        )

        # Store on request.state as well
        request.state.request_id = request_id

        logger.info("Request started")

        response = await call_next(request)

        # Add the request ID to the response headers
        response.headers["X-Request-ID"] = request_id

        logger.info("Request finished")
        structlog.contextvars.clear_contextvars()
        return response
