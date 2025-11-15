"""Connector Management API endpoints."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ...core.database import get_db
from ...models.db.connectors import (
    Connector,
    ConnectorDataset,
    ConnectorRun,
    ConnectorStateEnum,
)
from ...models.api.connectors import (
    ConnectorCreateRequest,
    ConnectorResponse,
    ConnectorListResponse,
    ConnectorDatasetsAddRequest,
    ConnectorDatasetResponse,
    ConnectorGenerateRequest,
    ConnectorArtifactsResponse,
    ConnectorCommitRequest,
    ConnectorCommitResponse,
    ConnectorActivateRequest,
    ConnectorRunResponse,
    ConnectorRunsListResponse,
    ConnectorRunDetailResponse,
)
from ...services.code_generation import CodeGenerationService
from ...services.source_validation import SourceValidationService
from ...services.databricks_deployment import DatabricksDeploymentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/connectors", tags=["Connector Management"])


@router.post("/", response_model=ConnectorResponse, status_code=status.HTTP_201_CREATED)
async def create_connector(
    request: ConnectorCreateRequest,
    db: Annotated[Session, Depends(get_db)],
) -> ConnectorResponse:
    """Create a new connector."""
    try:
        # Check if connector with same name already exists
        existing = db.query(Connector).filter(Connector.name == request.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Connector with name '{request.name}' already exists",
            )

        # Create connector
        connector = Connector(
            id=str(uuid.uuid4()),
            name=request.name,
            target_type=request.target_type,
            target_config=request.target_config,
            execution_mode=request.execution_mode,
            schedule_cron=request.schedule_cron,
            compute_type=request.compute_type,
            cluster_config=request.cluster_config,
            status=ConnectorStateEnum.NOT_DEPLOYED,
            created_by=request.created_by,
        )

        db.add(connector)
        db.commit()
        db.refresh(connector)

        logger.info(f"Created connector: {connector.id} ({connector.name})")

        return ConnectorResponse.model_validate(connector)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create connector: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create connector: {str(e)}",
        )


@router.get("/", response_model=ConnectorListResponse)
async def list_connectors(
    db: Annotated[Session, Depends(get_db)],
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> ConnectorListResponse:
    """List all connectors with summary metadata."""
    try:
        query = db.query(Connector).filter(Connector.status != ConnectorStateEnum.DELETED)

        if status_filter:
            query = query.filter(Connector.status == status_filter)

        total = query.count()
        connectors = query.order_by(Connector.created_at.desc()).offset(skip).limit(limit).all()

        return ConnectorListResponse(
            connectors=[ConnectorResponse.model_validate(c) for c in connectors],
            total=total,
        )

    except Exception as e:
        logger.error(f"Failed to list connectors: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list connectors: {str(e)}",
        )


@router.get("/{connector_id}", response_model=ConnectorResponse)
async def get_connector(
    connector_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> ConnectorResponse:
    """Retrieve connector with datasets."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        return ConnectorResponse.model_validate(connector)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get connector: {str(e)}",
        )


@router.delete("/{connector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connector(
    connector_id: str,
    db: Annotated[Session, Depends(get_db)],
):
    """Delete connector (soft delete - marks status as Deleted)."""
    try:
        connector = db.query(Connector).filter(Connector.id == connector_id).first()

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        if connector.status == ConnectorStateEnum.DELETED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Connector is already deleted",
            )

        # Soft delete
        connector.status = ConnectorStateEnum.DELETED
        connector.updated_at = datetime.now(timezone.utc)

        db.commit()

        logger.info(f"Deleted connector: {connector_id}")

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete connector: {str(e)}",
        )


@router.post("/{connector_id}/datasets", response_model=List[ConnectorDatasetResponse], status_code=status.HTTP_201_CREATED)
async def add_connector_datasets(
    connector_id: str,
    request: ConnectorDatasetsAddRequest,
    db: Annotated[Session, Depends(get_db)],
) -> List[ConnectorDatasetResponse]:
    """Add one or more dataset sync configurations under a connector."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        # Validate that datasets can be added (not in certain states)
        if connector.status in [ConnectorStateEnum.COMMITTED, ConnectorStateEnum.ACTIVE]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot add datasets to connector in {connector.status} state. Create a new connector for changes.",
            )

        # Initialize validation service
        validation_service = SourceValidationService()
        validation_errors = []

        # Validate each dataset
        for dataset_config in request.datasets:
            # Parse source_dataset (format: "schema.table")
            source_parts = dataset_config.source_dataset.split(".")
            if len(source_parts) != 2:
                validation_errors.append(
                    f"Invalid source_dataset format '{dataset_config.source_dataset}'. Expected format: 'schema.table'"
                )
                continue

            source_schema, source_table = source_parts

            # Validate table existence
            is_valid, error_msg = validation_service.validate_source_table(
                target_type=connector.target_type,
                target_config=connector.target_config,
                source_schema=source_schema,
                source_table=source_table,
                secrets=None,  # In production, would fetch from Databricks Secrets
            )

            if not is_valid:
                validation_errors.append(
                    f"Dataset '{dataset_config.source_dataset}': {error_msg}"
                )

        # If validation errors occurred, raise HTTP exception
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Dataset validation failed",
                    "validation_errors": validation_errors,
                    "message": "One or more datasets failed validation. Please verify that all source tables exist and are accessible.",
                },
            )

        # Create datasets
        created_datasets = []
        for dataset_config in request.datasets:
            dataset = ConnectorDataset(
                id=str(uuid.uuid4()),
                connector_id=connector_id,
                source_dataset=dataset_config.source_dataset,
                target_name=dataset_config.target_name,
                change_detection=dataset_config.change_detection,
                write_strategy=dataset_config.write_strategy,
                watermark_column=dataset_config.watermark_column,
                primary_keys=dataset_config.primary_keys,
                custom_config=dataset_config.custom_config,
                created_by=request.created_by,
            )
            db.add(dataset)
            created_datasets.append(dataset)

        # Update connector timestamp
        connector.updated_at = datetime.now(timezone.utc)

        db.commit()

        for dataset in created_datasets:
            db.refresh(dataset)

        logger.info(f"Added {len(created_datasets)} datasets to connector {connector_id}")

        return [ConnectorDatasetResponse.model_validate(d) for d in created_datasets]

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to add datasets to connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add datasets: {str(e)}",
        )


@router.get("/{connector_id}/datasets", response_model=List[ConnectorDatasetResponse])
async def get_connector_datasets(
    connector_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> List[ConnectorDatasetResponse]:
    """Retrieve dataset configurations for a connector."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        datasets = (
            db.query(ConnectorDataset)
            .filter(ConnectorDataset.connector_id == connector_id)
            .order_by(ConnectorDataset.created_at)
            .all()
        )

        return [ConnectorDatasetResponse.model_validate(d) for d in datasets]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get datasets for connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get datasets: {str(e)}",
        )


@router.post("/{connector_id}/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_connector_artifacts(
    connector_id: str,
    request: ConnectorGenerateRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Generate PySpark sync code and Databricks workflow JSON from config."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        # Check if datasets exist
        datasets_count = db.query(ConnectorDataset).filter(ConnectorDataset.connector_id == connector_id).count()
        if datasets_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot generate artifacts: no datasets configured",
            )

        # Check current state
        if not request.force_regenerate and connector.status == ConnectorStateEnum.GENERATED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Artifacts already generated. Use force_regenerate=true to regenerate.",
            )

        # Get all datasets for this connector
        datasets = db.query(ConnectorDataset).filter(ConnectorDataset.connector_id == connector_id).all()

        # Initialize code generation service
        code_gen_service = CodeGenerationService()

        # Generate artifacts
        logger.info(f"Generating artifacts for connector {connector_id} with {len(datasets)} datasets")
        generation_result = code_gen_service.generate_connector_artifacts(
            connector=connector,
            datasets=datasets,
            output_dir=None,  # Will use default /tmp/connectors/{connector_id}
        )

        # Update connector with generation results
        artifacts_path = generation_result["output_dir"]
        connector.artifacts_path = artifacts_path
        connector.status = ConnectorStateEnum.GENERATED
        connector.updated_at = datetime.now(timezone.utc)
        connector.error_message = None

        db.commit()

        logger.info(f"Successfully generated {generation_result['files_generated']} artifacts for connector {connector_id}")

        return {
            "connector_id": connector_id,
            "status": "generated",
            "artifacts_path": artifacts_path,
            "files_generated": generation_result["files_generated"],
            "datasets_count": len(datasets),
            "metadata": generation_result["metadata"],
            "message": "Artifacts generated successfully. Use /artifacts endpoint to review.",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to generate artifacts for connector {connector_id}: {e}")

        # Mark connector as error state
        connector = db.query(Connector).filter(Connector.id == connector_id).first()
        if connector:
            connector.status = ConnectorStateEnum.ERROR
            connector.error_message = str(e)
            db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate artifacts: {str(e)}",
        )


@router.get("/{connector_id}/artifacts", response_model=ConnectorArtifactsResponse)
async def get_connector_artifacts(
    connector_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> ConnectorArtifactsResponse:
    """Retrieve generated code/workflow artifacts for review."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        if connector.status not in [ConnectorStateEnum.GENERATED, ConnectorStateEnum.COMMITTED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No artifacts available. Current status: {connector.status}",
            )

        # Initialize code generation service and retrieve artifacts
        code_gen_service = CodeGenerationService()
        artifacts = code_gen_service.get_generated_artifacts(connector.artifacts_path)

        # Format files for response
        all_files = []
        for file_type in ["notebooks", "workflows", "sql"]:
            for file_info in artifacts.get(file_type, []):
                all_files.append({
                    "path": file_info["path"],
                    "filename": file_info["filename"],
                    "type": file_type,
                    "size_bytes": file_info["size_bytes"],
                    "content_preview": file_info["content_preview"],
                    "truncated": file_info["truncated"],
                })

        return ConnectorArtifactsResponse(
            connector_id=connector_id,
            artifacts_path=connector.artifacts_path,
            files=all_files,
            metadata=artifacts.get("metadata", {}),
            generated_at=connector.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get artifacts for connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get artifacts: {str(e)}",
        )


@router.post("/{connector_id}/debug", status_code=status.HTTP_202_ACCEPTED)
async def debug_deploy_connector(
    connector_id: str,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Deploy connector artifacts directly to Databricks workspace for testing (Dev only).

    This endpoint:
    - Deploys generated artifacts to Databricks using Asset Bundles
    - Sets status to DEBUG_DEPLOYED
    - Does NOT require Git commit
    - Only for development/testing purposes
    """
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        # Check if artifacts are generated
        if connector.status not in [ConnectorStateEnum.GENERATED, ConnectorStateEnum.DEBUG_DEPLOYED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot debug deploy: connector must be in Generated or Debug Deployed state. Current: {connector.status}",
            )

        if not connector.artifacts_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No artifacts available for deployment. Run /generate first.",
            )

        # Initialize deployment service
        deployment_service = DatabricksDeploymentService()

        # Deploy to Databricks workspace
        logger.info(f"Starting debug deployment for connector {connector_id}")
        deployment_result = deployment_service.deploy_debug(
            connector_id=connector_id,
            artifacts_path=connector.artifacts_path,
            target_environment="dev",
        )

        # Update connector state
        connector.status = ConnectorStateEnum.DEBUG_DEPLOYED
        connector.updated_at = datetime.now(timezone.utc)
        connector.error_message = None

        db.commit()

        logger.info(f"Debug deployment completed for connector {connector_id}")

        return {
            "connector_id": connector_id,
            "status": "debug_deployed",
            "environment": "dev",
            "workspace_url": deployment_result.get("workspace_url"),
            "deployment_details": deployment_result,
            "message": "Artifacts deployed to Databricks workspace for testing. Use /activate for production deployment.",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to debug deploy connector {connector_id}: {e}")

        # Mark connector as error state
        connector = db.query(Connector).filter(Connector.id == connector_id).first()
        if connector:
            connector.status = ConnectorStateEnum.ERROR
            connector.error_message = f"Debug deployment failed: {str(e)}"
            db.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to debug deploy connector: {str(e)}",
        )


@router.post("/{connector_id}/commit", response_model=ConnectorCommitResponse)
async def commit_connector_artifacts(
    connector_id: str,
    request: ConnectorCommitRequest,
    db: Annotated[Session, Depends(get_db)],
) -> ConnectorCommitResponse:
    """Commit reviewed artifacts to Git (triggering CI/CD)."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        if connector.status != ConnectorStateEnum.GENERATED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot commit: connector must be in Generated state. Current: {connector.status}",
            )

        # TODO: Implement actual Git commit logic
        # For now, simulate commit
        git_commit_id = f"mock-commit-{uuid.uuid4().hex[:8]}"
        git_branch = request.target_branch or "main"

        connector.git_commit_id = git_commit_id
        connector.git_branch = git_branch
        connector.status = ConnectorStateEnum.COMMITTED
        connector.updated_at = datetime.now(timezone.utc)
        connector.updated_by = request.committed_by

        db.commit()

        logger.info(f"Committed artifacts for connector {connector_id} to {git_branch}")

        return ConnectorCommitResponse(
            connector_id=connector_id,
            git_commit_id=git_commit_id,
            git_branch=git_branch,
            committed_at=connector.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to commit artifacts for connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit artifacts: {str(e)}",
        )


@router.post("/{connector_id}/activate", status_code=status.HTTP_202_ACCEPTED)
async def activate_connector(
    connector_id: str,
    request: ConnectorActivateRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """Deploy and activate connector (Databricks workflow)."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        if connector.status not in [ConnectorStateEnum.COMMITTED, ConnectorStateEnum.PAUSED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot activate: connector must be in Committed or Paused state. Current: {connector.status}",
            )

        # TODO: Implement actual Databricks workflow deployment
        # For now, simulate activation
        workflow_id = f"mock-workflow-{uuid.uuid4().hex[:8]}"

        connector.workflow_id = workflow_id
        connector.status = ConnectorStateEnum.ACTIVE
        connector.updated_at = datetime.now(timezone.utc)
        connector.updated_by = request.activated_by

        db.commit()

        logger.info(f"Activated connector {connector_id}")

        return {
            "connector_id": connector_id,
            "status": "active",
            "workflow_id": workflow_id,
            "message": "Connector activated successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to activate connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate connector: {str(e)}",
        )


@router.post("/{connector_id}/pause", status_code=status.HTTP_202_ACCEPTED)
async def pause_connector(
    connector_id: str,
    db: Annotated[Session, Depends(get_db)],
):
    """Pause connector workflow."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        if connector.status != ConnectorStateEnum.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot pause: connector must be in Active state. Current: {connector.status}",
            )

        # TODO: Implement actual workflow pause logic
        connector.status = ConnectorStateEnum.PAUSED
        connector.updated_at = datetime.now(timezone.utc)

        db.commit()

        logger.info(f"Paused connector {connector_id}")

        return {
            "connector_id": connector_id,
            "status": "paused",
            "message": "Connector paused successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to pause connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pause connector: {str(e)}",
        )


@router.get("/{connector_id}/runs", response_model=ConnectorRunsListResponse)
async def list_connector_runs(
    connector_id: str,
    db: Annotated[Session, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
) -> ConnectorRunsListResponse:
    """List recent runs and statuses."""
    try:
        connector = (
            db.query(Connector)
            .filter(Connector.id == connector_id, Connector.status != ConnectorStateEnum.DELETED)
            .first()
        )

        if not connector:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Connector {connector_id} not found",
            )

        query = db.query(ConnectorRun).filter(ConnectorRun.connector_id == connector_id)
        total = query.count()

        runs = (
            query.order_by(ConnectorRun.started_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return ConnectorRunsListResponse(
            runs=[ConnectorRunResponse.model_validate(r) for r in runs],
            total=total,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list runs for connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list runs: {str(e)}",
        )


@router.get("/{connector_id}/runs/{run_id}", response_model=ConnectorRunDetailResponse)
async def get_connector_run(
    connector_id: str,
    run_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> ConnectorRunDetailResponse:
    """Retrieve detailed logs and metrics for a specific run."""
    try:
        run = (
            db.query(ConnectorRun)
            .filter(
                ConnectorRun.id == run_id,
                ConnectorRun.connector_id == connector_id,
            )
            .first()
        )

        if not run:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Run {run_id} not found for connector {connector_id}",
            )

        return ConnectorRunDetailResponse.model_validate(run)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get run {run_id} for connector {connector_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get run details: {str(e)}",
        )
