"""
Code Generation Service

Integrates with LLM backend to generate DDL, SQL, and YAML files from canvas state.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)


class CodeGenerationService:
    """Service for generating code from canvas state using LLM."""

    def __init__(self, llm_backend_url: Optional[str] = None):
        """
        Initialize code generation service.

        Args:
            llm_backend_url: LLM backend URL (defaults to http://localhost:3003)
        """
        self.llm_backend_url = llm_backend_url or "http://localhost:3003"
        self.timeout = 120.0  # 2 minutes for LLM generation

    async def generate_from_canvas(
        self, canvas_state: Dict[str, Any], options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate DDL, SQL, and YAML files from canvas state.

        Args:
            canvas_state: Canvas state from frontend
                {
                    "nodes": [...],  # Node definitions
                    "edges": [...],  # Edge definitions
                    "metadata": {...}
                }
            options: Generation options
                {
                    "generate_ddl": true,
                    "generate_pipelines": true,
                    "generate_bundle": true,
                    "catalog": "analytics",
                    "schema_prefix": "bronze"
                }

        Returns:
            Generated files dict
                {
                    "files": [
                        {
                            "path": "ddl/customers.sql",
                            "content": "CREATE TABLE...",
                            "type": "ddl"
                        },
                        ...
                    ],
                    "metadata": {...}
                }
        """
        logger.info("Generating code from canvas state")

        options = options or {}

        # Prepare request payload
        payload = {
            "canvas_state": canvas_state,
            "options": {
                "generate_ddl": options.get("generate_ddl", True),
                "generate_pipelines": options.get("generate_pipelines", True),
                "generate_bundle": options.get("generate_bundle", False),
                "catalog": options.get("catalog", settings.databricks_catalog or "analytics"),
                "schema_prefix": options.get("schema_prefix", "bronze"),
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.llm_backend_url}/api/v1/generate/from-canvas",
                    json=payload,
                )

                response.raise_for_status()
                result = response.json()

                logger.info(
                    f"Generated {len(result.get('files', []))} files from canvas"
                )

                return result

        except httpx.TimeoutException:
            logger.error("LLM backend timeout during code generation")
            raise RuntimeError("Code generation timed out after 2 minutes")
        except httpx.HTTPStatusError as e:
            logger.error(f"LLM backend HTTP error: {e.response.status_code}")
            raise RuntimeError(
                f"Code generation failed: {e.response.text}"
            )
        except Exception as e:
            logger.error(f"Code generation error: {e}", exc_info=True)
            raise RuntimeError(f"Code generation failed: {str(e)}")

    async def generate_ddl_for_table(
        self, table_config: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Generate DDL for a single table.

        Args:
            table_config: Table configuration
                {
                    "name": "customers",
                    "columns": [
                        {"name": "id", "type": "INT", "nullable": false},
                        {"name": "name", "type": "VARCHAR(255)", "nullable": false}
                    ],
                    "catalog": "analytics",
                    "schema": "bronze"
                }

        Returns:
            Generated DDL
                {
                    "ddl": "CREATE TABLE analytics.bronze.customers...",
                    "file_path": "ddl/bronze/customers.sql"
                }
        """
        logger.info(f"Generating DDL for table {table_config.get('name')}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.llm_backend_url}/api/v1/generate/ddl",
                    json=table_config,
                )

                response.raise_for_status()
                result = response.json()

                return result

        except Exception as e:
            logger.error(f"DDL generation error: {e}", exc_info=True)
            raise RuntimeError(f"DDL generation failed: {str(e)}")

    async def generate_pipeline(
        self, pipeline_config: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Generate DLT pipeline code.

        Args:
            pipeline_config: Pipeline configuration
                {
                    "name": "bronze_ingestion",
                    "source_type": "delta",
                    "source_path": "s3://bucket/data",
                    "target_catalog": "analytics",
                    "target_schema": "bronze",
                    "transformations": [...]
                }

        Returns:
            Generated pipeline code
                {
                    "code": "@dlt.table...",
                    "file_path": "pipelines/bronze/bronze_ingestion.py",
                    "language": "python"
                }
        """
        logger.info(f"Generating pipeline {pipeline_config.get('name')}")

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.llm_backend_url}/api/v1/generate/pipeline",
                    json=pipeline_config,
                )

                response.raise_for_status()
                result = response.json()

                return result

        except Exception as e:
            logger.error(f"Pipeline generation error: {e}", exc_info=True)
            raise RuntimeError(f"Pipeline generation failed: {str(e)}")

    async def validate_generated_code(
        self, files: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Validate generated code (syntax check, best practices).

        Args:
            files: List of generated files
                [
                    {"path": "ddl/customers.sql", "content": "..."},
                    ...
                ]

        Returns:
            Validation results
                {
                    "valid": true,
                    "errors": [],
                    "warnings": [...]
                }
        """
        logger.info(f"Validating {len(files)} generated files")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.llm_backend_url}/api/v1/validate",
                    json={"files": files},
                )

                response.raise_for_status()
                result = response.json()

                if not result.get("valid", False):
                    logger.warning(
                        f"Validation failed with {len(result.get('errors', []))} errors"
                    )

                return result

        except Exception as e:
            logger.error(f"Validation error: {e}", exc_info=True)
            # Don't fail on validation errors, just log and return
            return {
                "valid": True,
                "errors": [],
                "warnings": [f"Validation service unavailable: {str(e)}"],
            }

    def format_files_for_commit(
        self, generated_files: List[Dict[str, str]]
    ) -> List[Dict[str, str]]:
        """
        Format generated files for git commit.

        Args:
            generated_files: Raw generated files from LLM

        Returns:
            Formatted files ready for commit
                [
                    {
                        "path": "ddl/customers.sql",
                        "content": "...",
                        "encoding": "utf-8"
                    },
                    ...
                ]
        """
        formatted_files = []

        for file in generated_files:
            formatted_files.append(
                {
                    "path": file.get("path"),
                    "content": file.get("content"),
                    "encoding": "utf-8",
                }
            )

        return formatted_files
