"""Initializes the db models package, ensuring all modules are imported."""

# Import all modules in this directory that contain model definitions.
# This ensures that SQLAlchemy's Base declarative meta class is aware of all tables
# when this package is imported. The "noqa" comments prevent linters from complaining
# about unused imports, as they are imported for their side-effect of registration.
from . import (
    apps,  # noqa: F401
    auditing,  # noqa: F401
    compute_tracking,  # noqa: F401
    connectors,  # noqa: F401
    deployment_details,  # noqa: F401
    deployment_queue,  # noqa: F401
    deployments,  # noqa: F401
    jobs,  # noqa: F401
    metadata,  # noqa: F401
    observability,  # noqa: F401
    pipelines,  # noqa: F401
    usage_tracking,  # noqa: F401
    usage_star_schema,  # noqa: F401
)

# Import specific models to be exposed at the package level for convenience.
from .apps import App, AppDeployment
from .auditing import APIAudit, PullRequestAudit
from .compute_tracking import (
    DBUAggregates,
    DBUCostAlert,
    DBUPricingRules,
    DBUSyncStatus,
    MonthlyDBUInvoice,
    PipelineDBUUsage,
)
from .connectors import Connector, ConnectorDataset, ConnectorRun
from .deployment_details import DeploymentDetail
from .deployment_queue import DeploymentQueue
from .deployments import (
    Deployment,
    Environment,
    EnvironmentDeploymentState,
)
from .jobs import Job, JobHealth, JobRun
from .metadata import CatalogMetadata
from .observability import (
    AutoLoaderSummary,
    LineageGraph,
    PipelineHealthCurrent,
    PipelineMetricsDaily,
    PipelineMetricsHourly,
    SourceBacklogSummary,
)
from .pipelines import (
    Pipeline,
    PipelineEvent,
    PipelineMetadata,
    PipelineSyncStatus,
    PipelineTableMapping,
    PipelineUpdate,
)
from .usage_tracking import (
    CostingRules,
    MonthlyInvoice,
    PipelineUsage,
    UsageAggregates,
    UsageSyncStatus,
)
from .usage_star_schema import (
    DimPipeline,
    DimJob,
    DimWarehouse,
    DimCluster,
    DimEndpoint,
    UsageFact,
)

__all__ = [
    # Exported from apps
    "App",
    "AppDeployment",
    # Exported from auditing
    "APIAudit",
    "PullRequestAudit",
    # Exported from dbu_tracking
    "DBUAggregates",
    "DBUCostAlert",
    "DBUPricingRules",
    "DBUSyncStatus",
    "MonthlyDBUInvoice",
    "PipelineDBUUsage",
    # Exported from connectors
    "Connector",
    "ConnectorDataset",
    "ConnectorRun",
    # Exported from deployments
    "Deployment",
    "DeploymentDetail",
    "DeploymentQueue",
    "Environment",
    "EnvironmentDeploymentState",
    # Exported from jobs
    "Job",
    "JobHealth",
    "JobRun",
    # Exported from metadata
    "CatalogMetadata",
    # Exported from observability
    "AutoLoaderSummary",
    "LineageGraph",
    "PipelineHealthCurrent",
    "PipelineMetricsDaily",
    "PipelineMetricsHourly",
    "SourceBacklogSummary",
    # Exported from pipelines
    "Pipeline",
    "PipelineEvent",
    "PipelineMetadata",
    "PipelineSyncStatus",
    "PipelineTableMapping",
    "PipelineUpdate",
    # Exported from usage_tracking
    "CostingRules",
    "MonthlyInvoice",
    "PipelineUsage",
    "UsageAggregates",
    "UsageSyncStatus",
    # Exported from usage_star_schema
    "DimPipeline",
    "DimJob",
    "DimWarehouse",
    "DimCluster",
    "DimEndpoint",
    "UsageFact",
]
