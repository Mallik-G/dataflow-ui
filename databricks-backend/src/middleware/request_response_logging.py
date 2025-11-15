import json
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import StreamingResponse
from starlette.background import BackgroundTask
from ..services.background.api_audit_log import make_background_task

from ..core.logging import get_logger


SENSITIVE_HEADERS = {"authorization", "cookie", "x-api-key"}  # Add more as needed


class RequestResponseLoggingMiddleware(BaseHTTPMiddleware):
    """Logs every request and response body safely.

    - Logs the first stream_prefix_size bytes of streaming response bodies for debugging.
    - Logs full response bodies for non-streaming responses.
    - Redacts sensitive headers (e.g., authorization, cookies).
    - Safely handles large/binary data by truncation or marking.
    """

    def __init__(self, app, max_body=1024 * 64, max_stream_log_size=1024 * 64, stream_prefix_size=1024):
        super().__init__(app)
        self.logger = get_logger("http")
        self.max_body = max_body
        self.max_stream_log_size = max_stream_log_size
        self.stream_prefix_size = stream_prefix_size

    async def dispatch(self, request: Request, call_next: Callable):
        start_time = time.time()

        # Read and log request
        req_body_bytes = await request.body()
        req_body = self._safe_text(req_body_bytes)
        headers = dict(request.headers)
        for header in SENSITIVE_HEADERS:
            if header in headers:
                headers[header] = "***REDACTED***"

        self.logger.info(
            "HTTP Request",
            method=request.method,
            url=str(request.url),
            headers=headers,
            body=req_body,
        )

        # Recreate request stream for downstream after reading body
        async def receive():
            return {"type": "http.request", "body": req_body_bytes, "more_body": False}

        request._receive = receive  # type: ignore

        # Process response, capturing body
        response = await call_next(request)

        try:
            body_bytes = b""
            if isinstance(response, StreamingResponse):
                # Consume up to stream_prefix_size bytes for logging, then replace iterator
                chunks = []
                consumed = 0
                async for chunk in response.body_iterator:
                    chunks.append(chunk)
                    consumed += len(chunk)
                    if consumed >= self.stream_prefix_size:
                        break

                full_consumed = b"".join(chunks)
                body_bytes = full_consumed[:self.stream_prefix_size]
                body_to_log = self._safe_text(body_bytes)
                if consumed > self.stream_prefix_size:
                    body_to_log += f" <truncated after {self.stream_prefix_size} bytes>"

                # Replace iterator with all consumed bytes + rest of stream
                original_iterator = response.body_iterator
                async def new_iter():
                    # Yield all the bytes we already consumed
                    yield full_consumed
                    # Then yield the rest from the original iterator
                    async for chunk in original_iterator:
                        yield chunk

                response.body_iterator = new_iter()

                duration_ms = (time.time() - start_time) * 1000.0
                self.logger.info(
                    "HTTP Response (streaming)",
                    status_code=response.status_code,
                    duration_ms=round(duration_ms, 2),
                    body=body_to_log,
                )
                # Background task only if full body fits in prefix (unlikely)
                if consumed <= self.stream_prefix_size:
                    request_bytes = req_body_bytes if req_body_bytes else None
                    bg_task = make_background_task(
                        request, response, request_bytes, body_bytes, duration_ms
                    )
                    response.background = BackgroundTask(bg_task.func, *bg_task.args, **bg_task.kwargs)
            else:
                body_bytes = await response.body()
                duration_ms = (time.time() - start_time) * 1000.0

                self.logger.info(
                    "HTTP Response",
                    status_code=response.status_code,
                    duration_ms=round(duration_ms, 2),
                    body=self._safe_text(body_bytes),
                )

                # Queue DB write in background (non-blocking)
                request_bytes = req_body_bytes if req_body_bytes else None
                bg_task = make_background_task(
                    request, response, request_bytes, body_bytes, duration_ms
                )
                response.background = BackgroundTask(bg_task.func, *bg_task.args, **bg_task.kwargs)
        except Exception as e:
            self.logger.error("HTTP logging error", error=str(e))

        return response

    def _safe_text(self, data: bytes) -> str:
        if not data:
            return ""
        if len(data) > self.max_body:
            return f"<{len(data)} bytes, truncated>"
        try:
            text = data.decode("utf-8")
        except Exception:
            return f"<binary {len(data)} bytes>"
        # Ensure valid JSON pretty-print if possible
        try:
            obj = json.loads(text)
            return json.dumps(obj, ensure_ascii=False)
        except Exception:
            return text
