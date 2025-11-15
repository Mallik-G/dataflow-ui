"""Artifacts API for uploading app bundles to Databricks filesystems."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Form
from fastapi import status as http_status

from ...core.config import settings
from ...core.dependencies import get_active_environment
from ...models.db.deployments import Environment
from ...services.databricks.databricks_files_api import DatabricksFilesAPI
from ...models.api.artifacts import ArtifactUploadResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/artifacts", tags=["Artifacts"])
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB


def get_files_client(
    environment: Annotated[Environment, Depends(get_active_environment)],
) -> DatabricksFilesAPI:
    host = environment.databricks_host
    if not host:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Environment must have databricks_host configured",
        )
    return DatabricksFilesAPI(
        host=host,
        client_id=settings.databricks_client_id,
        client_secret=settings.databricks_client_secret,
    )


@router.post(
    "/upload",
    response_model=ArtifactUploadResponse,
    summary="Upload an artifact to Databricks Files/DBFS",
    description="Uploads a tar/zip or any file to a destination path like /Volumes/... or dbfs:/...",
)
async def upload_artifact(
    files_client: Annotated[DatabricksFilesAPI, Depends(get_files_client)],
    file: UploadFile = File(...),
    dest_path: str = Form(
        ...,
        description="Destination path, e.g. /Volumes/catalog/schema/vol/app.zip or dbfs:/apps/app.zip",
    ),
    mkdirs: bool = Form(True, description="Create parent directories if missing"),
    overwrite: bool = Form(True, description="Overwrite if exists"),
) -> ArtifactUploadResponse:
    try:
        if mkdirs:
            # derive parent directory path
            parent = (
                dest_path.rsplit("/", 1)[0]
                if ":/" not in dest_path
                else dest_path.rsplit("/", 1)[0]
            )
            if parent:
                await files_client.mkdirs(parent)
        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=http_status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Limit is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
            )
        await files_client.upload(dest_path, data, overwrite=overwrite)
        return ArtifactUploadResponse(path=dest_path, size_bytes=len(data))
    except Exception as e:
        logger.error(f"Failed to upload artifact to {dest_path}: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload failed. Please check destination path and permissions.",
        )
