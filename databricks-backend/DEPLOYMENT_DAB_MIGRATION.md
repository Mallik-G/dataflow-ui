# Migration: Imperative → DAB-Style Deployments

## Overview

This document outlines the architectural shift from **imperative API-driven deployments** to **declarative Databricks Asset Bundle (DAB) deployments**.

---

## Current Architecture (Imperative)

### Flow
```
1. Git Diff → Detect changed files (SQL, Python, YAML)
2. Database Records → Create deployment + deployment_details
3. Repos API → Sync git repository to workspace
4. Jobs API → Trigger serverless deployment job
5. Job Execution → Imperative Python script processes files one by one
6. Database Update → Update deployment_details status
```

### Key Components

**`deployment_service.py:DeploymentOrchestrator`**
- Uses direct API calls (`DatabricksJobsAPI`, `DatabricksReposAPI`)
- Triggers a serverless job that processes files imperatively
- Tracks state in PostgreSQL (`deployments`, `deployment_details`)

**Problems:**
1. ❌ Manual resource management (create/update/delete via API)
2. ❌ No built-in diff/plan workflow
3. ❌ State tracking split between PostgreSQL and Databricks
4. ❌ Complex error handling for partial deployments
5. ❌ Difficult rollbacks
6. ❌ No infrastructure-as-code

---

## Target Architecture (DAB Style)

### Flow
```
1. Git Diff → Detect changed files (SQL, Python, YAML)
2. Bundle Generation → Convert deployment to databricks.yml
3. Bundle Validate → `databricks bundle validate -t <env>`
4. Bundle Plan (optional) → Preview changes
5. Bundle Deploy → `databricks bundle deploy -t <env>`
6. State Tracking → Databricks manages state + PostgreSQL for audit
```

### Key Components

**New: `dab_bundle_generator.py`**
```python
class DABBundleGenerator:
    """Generates databricks.yml bundle configuration from deployment details."""

    def generate_bundle(
        self,
        deployment: Deployment,
        details: List[DeploymentDetail],
        config: DeploymentConfig
    ) -> Dict[str, Any]:
        """
        Generate DAB bundle configuration.

        Returns:
            databricks.yml configuration dict
        """
```

**New: `dab_cli_service.py`**
```python
class DABCLIService:
    """Wrapper around databricks CLI for bundle operations."""

    async def validate_bundle(self, bundle_dir: Path, target: str) -> Dict[str, Any]:
        """Run databricks bundle validate."""

    async def deploy_bundle(self, bundle_dir: Path, target: str) -> Dict[str, Any]:
        """Run databricks bundle deploy."""

    async def destroy_bundle(self, bundle_dir: Path, target: str) -> Dict[str, Any]:
        """Run databricks bundle destroy (rollback)."""
```

**Updated: `deployment_service.py:DeploymentOrchestrator`**
```python
class DeploymentOrchestrator:
    """DAB-based deployment orchestration."""

    async def deploy(self, environment_id: str, git_branch: Optional[str] = None) -> Deployment:
        """
        Deploy using DAB workflow:
        1. Get environment config
        2. Find last successful deployment SHA
        3. Git diff to find changed files
        4. Generate DAB bundle (databricks.yml)
        5. Validate bundle
        6. Deploy bundle
        7. Track results in database
        """
```

### Benefits
1. ✅ Declarative infrastructure-as-code
2. ✅ Built-in validation and plan workflow
3. ✅ Databricks-managed state
4. ✅ Simple rollbacks with `bundle destroy`
5. ✅ Git-friendly bundle configurations
6. ✅ Better error messages from Databricks CLI
7. ✅ Idempotent deployments

---

## DAB Bundle Structure

### Example `databricks.yml`

```yaml
bundle:
  name: "nexa_deployment_${deployment_id}"

variables:
  deployment_id:
    description: "Deployment ID"
    default: "dep-123abc"

  catalog:
    description: "Target catalog"
    default: "analytics"

workspace:
  host: "${var.databricks_host}"

targets:
  dev:
    mode: "development"
    workspace:
      root_path: "/Workspace/.bundle/nexa/${var.deployment_id}"

  prod:
    mode: "production"
    workspace:
      root_path: "/Workspace/.bundle/nexa/${var.deployment_id}"

resources:
  # SQL Tables (DDL files)
  jobs:
    ddl_deployment_job:
      name: "DDL Deployment - ${var.deployment_id}"
      tasks:
        - task_key: "create_customers_table"
          sql_task:
            warehouse_id: "${var.warehouse_id}"
            file:
              path: "./ddl/customers.sql"

        - task_key: "create_orders_table"
          sql_task:
            warehouse_id: "${var.warehouse_id}"
            file:
              path: "./ddl/orders.sql"
          depends_on:
            - task_key: "create_customers_table"

  # DLT Pipelines
  pipelines:
    bronze_pipeline:
      name: "Bronze Pipeline - ${var.deployment_id}"
      catalog: "${var.catalog}"
      target: "bronze"
      channel: "CURRENT"
      libraries:
        - notebook:
            path: "./pipelines/bronze_ingestion.py"

    silver_pipeline:
      name: "Silver Pipeline - ${var.deployment_id}"
      catalog: "${var.catalog}"
      target: "silver"
      channel: "CURRENT"
      libraries:
        - notebook:
            path: "./pipelines/silver_transformations.py"

sync:
  # Sync source files to workspace
  include:
    - "ddl/**/*.sql"
    - "pipelines/**/*.py"
  exclude:
    - "*.pyc"
    - "__pycache__"
```

---

## Implementation Plan

### Phase 1: Core DAB Services

**1. Create `dab_bundle_generator.py`**
```python
"""Generate DAB bundle configurations from deployment metadata."""

class DABBundleGenerator:
    def generate_bundle(
        self,
        deployment: Deployment,
        details: List[DeploymentDetail],
        config: DeploymentConfig
    ) -> Dict[str, Any]:
        """
        Generate databricks.yml configuration.

        Generates:
        - Bundle metadata
        - Target configurations (dev/prod)
        - Resources (jobs, pipelines, tables)
        - Sync configuration
        """

        bundle_config = {
            "bundle": {
                "name": f"nexa_deployment_{deployment.id}",
            },
            "variables": self._generate_variables(config),
            "workspace": {
                "host": config.databricks_host,
            },
            "targets": self._generate_targets(config),
            "resources": self._generate_resources(details, config),
            "sync": self._generate_sync_config(details),
        }

        return bundle_config

    def _generate_resources(
        self,
        details: List[DeploymentDetail],
        config: DeploymentConfig
    ) -> Dict[str, Any]:
        """
        Generate resource definitions from deployment details.

        - DDL files → SQL tasks in a job
        - Pipeline files → DLT pipeline resources
        """
        resources = {
            "jobs": {},
            "pipelines": {},
        }

        # Group files by type
        ddl_files = [d for d in details if d.file_type == "ddl"]
        pipeline_files = [d for d in details if d.file_type == "pipeline"]

        # Generate DDL job
        if ddl_files:
            resources["jobs"]["ddl_deployment"] = self._generate_ddl_job(
                ddl_files, config
            )

        # Generate DLT pipelines
        for pipeline_file in pipeline_files:
            pipeline_name = self._get_pipeline_name(pipeline_file.file_path)
            resources["pipelines"][pipeline_name] = self._generate_dlt_pipeline(
                pipeline_file, config
            )

        return resources
```

**2. Create `dab_cli_service.py`**
```python
"""Wrapper around Databricks CLI for bundle operations."""

class DABCLIService:
    def __init__(self, databricks_host: str, token: str):
        self.host = databricks_host
        self.token = token

    async def validate_bundle(
        self,
        bundle_dir: Path,
        target: str = "dev"
    ) -> Dict[str, Any]:
        """
        Validate DAB bundle configuration.

        Runs: databricks bundle validate -t <target>
        """
        env = self._get_env()

        result = subprocess.run(
            ["databricks", "bundle", "validate", "-t", target],
            cwd=str(bundle_dir),
            capture_output=True,
            text=True,
            env=env,
            timeout=60,
        )

        if result.returncode != 0:
            raise DABValidationError(f"Bundle validation failed: {result.stderr}")

        return {
            "status": "valid",
            "stdout": result.stdout,
            "stderr": result.stderr,
        }

    async def deploy_bundle(
        self,
        bundle_dir: Path,
        target: str = "dev",
        auto_approve: bool = False
    ) -> Dict[str, Any]:
        """
        Deploy DAB bundle.

        Runs: databricks bundle deploy -t <target> [--auto-approve]
        """
        env = self._get_env()

        cmd = ["databricks", "bundle", "deploy", "-t", target]
        if auto_approve:
            cmd.append("--auto-approve")

        result = subprocess.run(
            cmd,
            cwd=str(bundle_dir),
            capture_output=True,
            text=True,
            env=env,
            timeout=600,  # 10 minutes
        )

        if result.returncode != 0:
            raise DABDeploymentError(f"Bundle deployment failed: {result.stderr}")

        # Parse deployment output for resource IDs
        deployed_resources = self._parse_deployment_output(result.stdout)

        return {
            "status": "deployed",
            "resources": deployed_resources,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }

    async def destroy_bundle(
        self,
        bundle_dir: Path,
        target: str = "dev",
        auto_approve: bool = False
    ) -> Dict[str, Any]:
        """
        Destroy DAB bundle (rollback).

        Runs: databricks bundle destroy -t <target>
        """
        env = self._get_env()

        cmd = ["databricks", "bundle", "destroy", "-t", target]
        if auto_approve:
            cmd.append("--auto-approve")

        result = subprocess.run(
            cmd,
            cwd=str(bundle_dir),
            capture_output=True,
            text=True,
            env=env,
            timeout=600,
        )

        if result.returncode != 0:
            raise DABDestroyError(f"Bundle destroy failed: {result.stderr}")

        return {
            "status": "destroyed",
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
```

### Phase 2: Update DeploymentOrchestrator

**Updated `deployment_service.py`**
```python
class DeploymentOrchestrator:
    """DAB-based deployment orchestration."""

    def __init__(self, db: Session):
        self.db = db
        self._secret_managers: Dict[str, SecretManager] = {}
        self.bundle_generator = DABBundleGenerator()  # NEW
        self.dab_cli_service = None  # Initialized per deployment

    async def deploy(
        self,
        environment_id: str,
        git_branch: Optional[str] = None
    ) -> Deployment:
        """
        Deploy using DAB workflow.

        New Flow:
        1. Get environment config
        2. Find last successful deployment SHA
        3. Git diff to find changed files
        4. Create deployment record
        5. Generate DAB bundle (databricks.yml)  # NEW
        6. Write bundle to temp directory  # NEW
        7. Validate bundle  # NEW
        8. Deploy bundle  # NEW
        9. Track results in database
        """
        logger.info(f"=== DAB DEPLOY: Starting deployment for {environment_id} ===")

        # Steps 1-3: Same as before (get config, git diff)
        env = self._get_environment(environment_id)
        config = self._build_deployment_config(env, git_branch)
        git_provider = self._create_git_provider(config)
        git_service = GitService(git_provider)
        current_head = git_service.get_branch_head_sha(config.git_branch)
        last_success = self._get_last_successful_deployment(environment_id)
        last_sha = last_success.git_commit_sha if last_success else None

        if last_sha:
            changes = git_service.compare_commits(last_sha, current_head)
        else:
            changes = self._get_all_files_from_branch(git_provider, config.git_branch)

        if not changes:
            raise ValueError("No changes to deploy")

        # Step 4: Create deployment record (same as before)
        deployment = self._create_deployment_record(
            environment_id=environment_id,
            git_branch=config.git_branch,
            git_commit_sha=current_head,
            deployment_config={
                "git_branch": config.git_branch,
                "databricks_host": config.databricks_host,
                "deployment_method": "dab",  # NEW
            },
        )
        config.deployment_id = deployment.id
        self._populate_deployment_details(deployment.id, changes)

        # NEW: Steps 5-8: DAB Workflow
        try:
            # Get deployment details for bundle generation
            details = self.db.query(DeploymentDetail).filter_by(
                deployment_id=deployment.id
            ).all()

            # Generate DAB bundle configuration
            bundle_config = self.bundle_generator.generate_bundle(
                deployment, details, config
            )

            # Create temporary bundle directory
            bundle_dir = Path(f"/tmp/nexa_bundles/{deployment.id}")
            bundle_dir.mkdir(parents=True, exist_ok=True)

            # Write databricks.yml
            bundle_yml_path = bundle_dir / "databricks.yml"
            with open(bundle_yml_path, "w") as f:
                yaml.dump(bundle_config, f, default_flow_style=False, sort_keys=False)

            # Clone source files to bundle directory
            await self._sync_source_files_to_bundle(
                git_provider, config.git_branch, details, bundle_dir
            )

            # Initialize DAB CLI service
            self.dab_cli_service = DABCLIService(
                databricks_host=config.databricks_host,
                token=config.databricks_token,  # Need to add token to config
            )

            # Validate bundle
            logger.info(f"Validating DAB bundle at {bundle_dir}")
            validation_result = await self.dab_cli_service.validate_bundle(
                bundle_dir=bundle_dir,
                target="dev",  # or from config
            )
            logger.info("Bundle validation passed")

            # Deploy bundle
            logger.info(f"Deploying DAB bundle to {config.databricks_host}")
            deployment_result = await self.dab_cli_service.deploy_bundle(
                bundle_dir=bundle_dir,
                target="dev",
                auto_approve=True,
            )
            logger.info(f"Bundle deployed successfully: {deployment_result['resources']}")

            # Update deployment status
            deployment.status = "success"
            deployment.completed_at = datetime.now(timezone.utc)

            # Update deployment details with deployed resource IDs
            self._update_details_with_resource_ids(
                deployment.id, deployment_result['resources']
            )

            self.db.commit()

            logger.info(f"=== DAB DEPLOY: Completed successfully ===")
            return deployment

        except (DABValidationError, DABDeploymentError) as e:
            logger.error(f"DAB deployment failed: {e}")
            deployment.status = "failed"
            deployment.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            raise

    async def _sync_source_files_to_bundle(
        self,
        git_provider: GitProviderInterface,
        branch: str,
        details: List[DeploymentDetail],
        bundle_dir: Path
    ) -> None:
        """
        Download source files from git and copy to bundle directory.

        Creates directory structure matching repository:
        - ddl/customers.sql
        - pipelines/bronze_ingestion.py
        """
        for detail in details:
            # Get file content from git
            file_content = git_provider.get_file_content(
                path=detail.file_path,
                ref=branch
            )

            # Write to bundle directory
            target_path = bundle_dir / detail.file_path
            target_path.parent.mkdir(parents=True, exist_ok=True)

            with open(target_path, "w") as f:
                f.write(file_content)

            logger.debug(f"Copied {detail.file_path} to bundle")
```

### Phase 3: API Updates

**No breaking changes to API endpoints:**

The existing API endpoints (`/deployments/deploy`, `/deployments/resume`, etc.) will continue to work. The implementation underneath changes to use DAB, but the API contract remains the same.

**Optional: Add new DAB-specific endpoints:**

```python
@router.post("/deployments/{deployment_id}/validate")
async def validate_deployment(deployment_id: str, db: Session = Depends(get_db)):
    """
    Validate a deployment using DAB bundle validation.

    Can be called before deploy to check for errors.
    """
    orchestrator = DeploymentOrchestrator(db)
    validation_result = await orchestrator.validate_deployment(deployment_id)
    return validation_result

@router.post("/deployments/{deployment_id}/plan")
async def plan_deployment(deployment_id: str, db: Session = Depends(get_db)):
    """
    Preview deployment changes (like terraform plan).

    Shows what resources will be created/updated/destroyed.
    """
    orchestrator = DeploymentOrchestrator(db)
    plan_result = await orchestrator.plan_deployment(deployment_id)
    return plan_result

@router.post("/deployments/{deployment_id}/rollback")
async def rollback_deployment(deployment_id: str, db: Session = Depends(get_db)):
    """
    Rollback a deployment using DAB bundle destroy.
    """
    orchestrator = DeploymentOrchestrator(db)
    rollback_result = await orchestrator.rollback_deployment(deployment_id)
    return rollback_result
```

---

## Migration Strategy

### Option 1: Feature Flag (Recommended)

Add configuration to switch between imperative and DAB:

```python
# core/config.py
class Settings(BaseSettings):
    # Existing settings...

    # Deployment engine selection
    deployment_engine: Literal["imperative", "dab"] = Field(
        default="dab",
        env="DEPLOYMENT_ENGINE"
    )
```

Update `DeploymentOrchestrator`:

```python
async def deploy(self, environment_id: str, git_branch: Optional[str] = None) -> Deployment:
    if settings.deployment_engine == "dab":
        return await self._deploy_dab(environment_id, git_branch)
    else:
        return await self._deploy_imperative(environment_id, git_branch)
```

**Benefits:**
- Gradual rollout
- Easy rollback
- A/B testing
- Parallel operation during migration

### Option 2: Hard Cutover

Replace imperative implementation entirely with DAB.

**Benefits:**
- Clean codebase
- No maintenance of dual systems
- Forces adoption

**Risks:**
- Higher risk of issues
- Harder rollback

---

## Testing Plan

### Unit Tests
```python
# tests/test_dab_bundle_generator.py
def test_generate_bundle_with_ddl_files():
    """Test bundle generation for DDL deployments."""

def test_generate_bundle_with_pipelines():
    """Test bundle generation for DLT pipelines."""

# tests/test_dab_cli_service.py
def test_validate_bundle_success():
    """Test successful bundle validation."""

def test_deploy_bundle_failure_handling():
    """Test error handling during deployment."""
```

### Integration Tests
```python
# tests/integration/test_dab_deployment_flow.py
async def test_end_to_end_dab_deployment():
    """
    Test complete DAB deployment flow:
    1. Create deployment
    2. Generate bundle
    3. Validate bundle
    4. Deploy bundle
    5. Verify resources created
    6. Destroy bundle
    """
```

---

## Rollback Plan

### If DAB deployment fails:

1. **Immediate Rollback:**
   ```python
   await orchestrator.rollback_deployment(deployment_id)
   ```

2. **Switch back to imperative:**
   ```bash
   export DEPLOYMENT_ENGINE=imperative
   # Restart service
   ```

3. **Manual cleanup:**
   ```bash
   databricks bundle destroy -t dev --auto-approve
   ```

---

## Benefits Summary

| Feature | Imperative | DAB |
|---------|-----------|-----|
| Declarative config | ❌ | ✅ |
| Validation before deploy | ❌ | ✅ |
| Plan/preview changes | ❌ | ✅ |
| Idempotent | ⚠️ Partial | ✅ |
| Rollback support | ⚠️ Manual | ✅ Built-in |
| Git-friendly | ⚠️ DB only | ✅ YAML configs |
| State management | PostgreSQL only | Databricks + PostgreSQL |
| Error messages | API errors | CLI human-readable |
| Resource dependencies | Manual ordering | Automatic via `depends_on` |

---

## Next Steps

1. ✅ Review this migration plan
2. Create `dab_bundle_generator.py`
3. Create `dab_cli_service.py`
4. Add DAB exceptions to `core/exceptions.py`
5. Update `deployment_service.py` with DAB workflow
6. Add feature flag configuration
7. Write unit tests
8. Write integration tests
9. Deploy to dev environment for testing
10. Gradual rollout to production

---

**Questions for Review:**

1. Should we support both imperative and DAB (feature flag) or hard cutover?
2. What should the default target environment be (dev/prod)?
3. Should we keep bundle directories after deployment for debugging?
4. How should we handle bundle state file storage (`.databricks` directory)?
5. Should we add a `/deployments/{id}/plan` endpoint for preview?

