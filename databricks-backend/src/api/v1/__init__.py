"""API v1 endpoints for Nexa Databricks API."""

from fastapi import APIRouter

from .apps import router as apps_router
from .auth import router as auth_router
from .catalog import router as catalog_router
from .codegen import router as codegen_router
from .usage import router as dbu_usage_router
from .deployments import router as deployments_router
from .environments import router as environments_router
from .git import router as git_router
from .jobs import router as jobs_router
from .artifacts import router as artifacts_router
from .lineage import router as lineage_router
from .connectors import router as connectors_router
from .sessions import router as sessions_router
from .tags import router as tags_router
from .iam import router as iam_router

# from .observability import router as observability_router
# from .permissions import router as permissions_router
from .pipelines import router as pipelines_router
from .repos import router as repos_router
from .statements import router as statements_router
from .warehouses import router as warehouses_router
from .workspace import router as workspace_router

# Create main v1 router
api_v1_router = APIRouter(prefix="/api/v1")

# Include all v1 routers
api_v1_router.include_router(auth_router)
api_v1_router.include_router(apps_router)
api_v1_router.include_router(codegen_router)
api_v1_router.include_router(deployments_router)
api_v1_router.include_router(git_router)
api_v1_router.include_router(catalog_router)
api_v1_router.include_router(environments_router)
api_v1_router.include_router(jobs_router)
api_v1_router.include_router(repos_router)
api_v1_router.include_router(pipelines_router)
api_v1_router.include_router(lineage_router)
api_v1_router.include_router(connectors_router)
api_v1_router.include_router(sessions_router)
# api_v1_router.include_router(observability_router)
api_v1_router.include_router(dbu_usage_router)
api_v1_router.include_router(warehouses_router)
api_v1_router.include_router(workspace_router)
api_v1_router.include_router(artifacts_router)
# api_v1_router.include_router(permissions_router)
api_v1_router.include_router(statements_router)
api_v1_router.include_router(tags_router)
api_v1_router.include_router(iam_router)

__all__ = [
    "api_v1_router",
    "apps_router",
    "catalog_router",
    "dbu_usage_router",
    "deployments_router",
    "environments_router",
    "git_router",
    "jobs_router",
    "lineage_router",
    "connectors_router",
    # "observability_router",
    # "permissions_router",
    "pipelines_router",
    "repos_router",
    "statements_router",
    "warehouses_router",
    "workspace_router",
]
