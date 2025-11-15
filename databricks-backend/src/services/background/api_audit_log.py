import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request
from starlette.background import BackgroundTask
from starlette.responses import Response

from ...core.database import get_db
from ...models.db import APIAudit

MAX_TEXT = 8192


def _truncate(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    return s if len(s) <= MAX_TEXT else s[:MAX_TEXT]


def write_api_audit(
    req: Request,
    res_status: int,
    req_body: Optional[str],
    res_body: Optional[str],
    duration_ms: float,
    error_message: Optional[str] = None,
):
    db = next(get_db())
    try:
        request_id = getattr(getattr(req, "state", object()), "request_id", None)
        record = APIAudit(
            request_id=request_id,
            user_id=None,
            method=req.method,
            endpoint=req.url.path,
            platform="databricks",
            status_code=res_status,
            request_body=_truncate(req_body or ""),
            response_body=_truncate(res_body or ""),
            error_message=_truncate(error_message or ""),
            timestamp=datetime.now(timezone.utc),
            duration_ms=int(duration_ms),
        )
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def make_background_task(
    req: Request,
    res: Response,
    req_body: Optional[bytes],
    res_body: Optional[bytes],
    duration_ms: float,
):
    # Convert bodies to JSON strings when possible
    def to_text(b: Optional[bytes]) -> Optional[str]:
        if not b:
            return None
        try:
            txt = b.decode("utf-8")
        except Exception:
            return None
        try:
            return json.dumps(json.loads(txt), ensure_ascii=False)
        except Exception:
            return txt

    return BackgroundTask(
        write_api_audit,
        req,
        getattr(res, "status_code", 500),
        to_text(req_body),
        to_text(res_body),
        duration_ms,
        None,
    )
