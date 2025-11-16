"""
Code Generation API Endpoints

Endpoints for generating code from canvas state and committing to git.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.db import Environment
from ...services.code_generation_service import CodeGenerationService
from ...services.git_commit_service import GitCommitService
from ...core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/codegen", tags=["Code Generation"])


# =============================================================================
# Request/Response Models
# =============================================================================


class GenerateFromCanvasRequest(BaseModel):
    """Request to generate code from canvas state."""

    canvas_state: Dict[str, Any] = Field(..., description="Canvas state from frontend")
    environment_id: str = Field(..., description="Target environment ID")
    options: Optional[Dict[str, Any]] = Field(
        None, description="Generation options"
    )


class GeneratedFile(BaseModel):
    """Generated file."""

    path: str = Field(..., description="File path (e.g., ddl/customers.sql)")
    content: str = Field(..., description="File content")
    type: str = Field(..., description="File type (ddl, pipeline, yaml)")


class GenerateFromCanvasResponse(BaseModel):
    """Response from code generation."""

    files: List[GeneratedFile]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CommitFilesRequest(BaseModel):
    """Request to commit files to git."""

    environment_id: str = Field(..., description="Target environment ID")
    files: List[GeneratedFile] = Field(..., description="Files to commit")
    branch: str = Field(..., description="Target git branch")
    commit_message: str = Field(..., description="Commit message")
    create_pr: bool = Field(
        False, description="Create pull request after commit"
    )
    pr_title: Optional[str] = Field(None, description="PR title (if create_pr=true)")
    pr_description: Optional[str] = Field(
        None, description="PR description (if create_pr=true)"
    )


class CommitFilesResponse(BaseModel):
    """Response from git commit."""

    commit_sha: str = Field(..., description="Git commit SHA")
    branch: str = Field(..., description="Branch where files were committed")
    files_committed: int = Field(..., description="Number of files committed")
    commit_url: Optional[str] = Field(None, description="URL to view commit")
    pr_number: Optional[int] = Field(None, description="PR number (if created)")
    pr_url: Optional[str] = Field(None, description="PR URL (if created)")


class GenerateAndCommitRequest(BaseModel):
    """Request for end-to-end generate + commit workflow."""

    canvas_state: Dict[str, Any]
    environment_id: str
    git_branch: str
    commit_message: str
    create_pr: bool = False
    pr_title: Optional[str] = None
    auto_deploy: bool = Field(
        False, description="Automatically trigger deployment after commit"
    )


class GenerateAndCommitResponse(BaseModel):
    """Response from generate + commit workflow."""

    files: List[GeneratedFile]
    commit_sha: str
    branch: str
    files_committed: int
    pr_number: Optional[int] = None
    pr_url: Optional[str] = None
    deployment_id: Optional[str] = Field(
        None, description="Deployment ID (if auto_deploy=true)"
    )


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/generate", response_model=GenerateFromCanvasResponse)
async def generate_from_canvas(
    request: GenerateFromCanvasRequest, db: Session = Depends(get_db)
):
    """
    Generate DDL, SQL, and YAML files from canvas state.

    This endpoint calls the LLM backend to generate code based on the
    canvas design from the frontend.

    Flow:
    1. Receive canvas state (nodes, edges, metadata)
    2. Call LLM backend to generate files
    3. Return generated files for preview

    Returns:
        Generated files (not yet committed to git)
    """
    try:
        logger.info(
            f"Generating code for environment {request.environment_id}"
        )

        # Initialize code generation service
        codegen_service = CodeGenerationService()

        # Generate files from canvas
        result = await codegen_service.generate_from_canvas(
            canvas_state=request.canvas_state, options=request.options
        )

        files = result.get("files", [])

        return GenerateFromCanvasResponse(
            files=[
                GeneratedFile(
                    path=f.get("path"),
                    content=f.get("content"),
                    type=f.get("type"),
                )
                for f in files
            ],
            metadata=result.get("metadata", {}),
        )

    except Exception as e:
        logger.error(f"Code generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Code generation failed: {str(e)}"
        )


@router.post("/commit", response_model=CommitFilesResponse)
async def commit_files(
    request: CommitFilesRequest, db: Session = Depends(get_db)
):
    """
    Commit generated files to git repository.

    Flow:
    1. Get environment configuration
    2. Initialize git provider
    3. Commit files to specified branch
    4. Optionally create pull request

    Returns:
        Commit result with SHA and URLs
    """
    try:
        logger.info(
            f"Committing {len(request.files)} files to {request.branch}"
        )

        # Get environment
        environment = (
            db.query(Environment).filter_by(id=request.environment_id).first()
        )

        if not environment:
            raise HTTPException(
                status_code=404,
                detail=f"Environment {request.environment_id} not found",
            )

        # Get databricks host for secret retrieval
        databricks_host = environment.databricks_host or settings.databricks_host

        # Initialize git commit service
        git_service = GitCommitService.from_environment(environment, databricks_host)

        # Prepare files for commit
        files_to_commit = [
            {"path": f.path, "content": f.content} for f in request.files
        ]

        # Commit files
        commit_result = await git_service.commit_files(
            files=files_to_commit,
            branch=request.branch,
            commit_message=request.commit_message,
        )

        response = CommitFilesResponse(
            commit_sha=commit_result["commit_sha"],
            branch=commit_result["branch"],
            files_committed=commit_result["files_committed"],
            commit_url=commit_result.get("commit_url"),
        )

        # Create PR if requested
        if request.create_pr:
            pr_title = request.pr_title or f"Deploy: {request.commit_message}"
            target_branch = environment.target_git_branch or "main"

            pr_result = await git_service.create_pull_request(
                source_branch=request.branch,
                target_branch=target_branch,
                title=pr_title,
                description=request.pr_description,
            )

            response.pr_number = pr_result["pr_number"]
            response.pr_url = pr_result["pr_url"]

        logger.info(
            f"Successfully committed {response.files_committed} files to {response.branch}"
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Git commit failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Git commit failed: {str(e)}"
        )


@router.post("/generate-and-commit", response_model=GenerateAndCommitResponse)
async def generate_and_commit(
    request: GenerateAndCommitRequest, db: Session = Depends(get_db)
):
    """
    End-to-end workflow: Generate code from canvas and commit to git.

    This combines the /generate and /commit endpoints into a single operation.

    Flow:
    1. Generate code from canvas state
    2. Commit generated files to git branch
    3. Optionally create pull request
    4. Optionally trigger deployment

    Returns:
        Combined result with files, commit info, and optional deployment ID
    """
    try:
        logger.info(
            f"Starting generate-and-commit workflow for {request.environment_id}"
        )

        # Step 1: Generate code
        codegen_service = CodeGenerationService()
        generation_result = await codegen_service.generate_from_canvas(
            canvas_state=request.canvas_state
        )

        files = generation_result.get("files", [])

        if not files:
            raise HTTPException(
                status_code=400, detail="No files generated from canvas"
            )

        logger.info(f"Generated {len(files)} files")

        # Step 2: Commit to git
        environment = (
            db.query(Environment).filter_by(id=request.environment_id).first()
        )

        if not environment:
            raise HTTPException(
                status_code=404,
                detail=f"Environment {request.environment_id} not found",
            )

        databricks_host = environment.databricks_host or settings.databricks_host
        git_service = GitCommitService.from_environment(environment, databricks_host)

        files_to_commit = [{"path": f["path"], "content": f["content"]} for f in files]

        commit_result = await git_service.commit_files(
            files=files_to_commit,
            branch=request.git_branch,
            commit_message=request.commit_message,
        )

        logger.info(f"Committed {commit_result['files_committed']} files")

        response = GenerateAndCommitResponse(
            files=[
                GeneratedFile(path=f["path"], content=f["content"], type=f.get("type", "unknown"))
                for f in files
            ],
            commit_sha=commit_result["commit_sha"],
            branch=commit_result["branch"],
            files_committed=commit_result["files_committed"],
        )

        # Step 3: Create PR if requested
        if request.create_pr:
            pr_title = request.pr_title or f"Deploy: {request.commit_message}"
            target_branch = environment.target_git_branch or "main"

            pr_result = await git_service.create_pull_request(
                source_branch=request.git_branch,
                target_branch=target_branch,
                title=pr_title,
            )

            response.pr_number = pr_result["pr_number"]
            response.pr_url = pr_result["pr_url"]

        # Step 4: Auto-deploy if requested
        if request.auto_deploy:
            from ...services.deployment_service import DeploymentOrchestrator

            orchestrator = DeploymentOrchestrator(db)
            deployment = await orchestrator.deploy(
                environment_id=request.environment_id,
                git_branch=request.git_branch,
            )

            response.deployment_id = deployment.id
            logger.info(f"Triggered deployment {deployment.id}")

        logger.info("Generate-and-commit workflow completed successfully")

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generate-and-commit workflow failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Workflow failed: {str(e)}"
        )
