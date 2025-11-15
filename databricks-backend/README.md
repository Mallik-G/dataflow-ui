# Databricks Backend

Backend API service for Databricks operations with DAB (Databricks Asset Bundles) deployment engine.

## Features

- ✅ Databricks connection and query execution
- ✅ DAB bundle generation from project YAML
- ✅ DAB deployment with plan/apply workflow
- ✅ Environment state tracking (Git + Database)
- ✅ Deployment history and audit trail
- ✅ Resource inventory management
- ✅ Drift detection
- ✅ DLT pipeline creation

## Architecture

```
src/
├── server.ts           # Express server setup
├── routes/             # API route definitions
│   ├── databricks.routes.ts
│   ├── dab.routes.ts
│   └── deployment.routes.ts
├── services/           # Business logic
│   ├── databricks.service.ts
│   ├── dab.service.ts
│   └── deploymentState.service.ts
├── models/             # TypeScript types
│   └── types.ts
├── config/             # Configuration
│   └── logger.ts
└── utils/              # Utilities
    └── errorHandler.ts
```

## DAB Deployment Strategy

This backend implements the Nexa DAB Deployment & State Tracking Strategy:

### Deployment Flow

1. **Generate Bundle** - Convert project YAML to DAB format
2. **Preview Plan** - Dry run showing creates/updates/deletes
3. **Deploy** - Apply changes to Databricks
4. **Capture State** - Store deployment state in Git + DB
5. **Track Resources** - Maintain resource inventory

### State Management

**Layer 1: Git State Files (Canonical)**
- `.nexa-state/{env}.state.json` - Source of truth
- Signed with HMAC for tamper detection
- Full deployment history
- Diffable and rollback-capable

**Layer 2: Database Cache (Operational)**
- `deployment_history` - All deployments
- `deployed_resources` - Flattened resource list
- `resource_inventory` - Active resources per environment
- Fast queries for UI and monitoring

## API Endpoints

### Databricks Operations

#### Test Connection
```bash
POST /api/databricks/test
```

#### Execute Query
```bash
POST /api/databricks/query
```

#### Create DLT Pipeline
```bash
POST /api/databricks/dlt/create
```

### DAB Operations

#### Generate Bundle
```bash
POST /api/dab/bundle/generate

{
  "projectPath": "/path/to/project",
  "environment": "dev"
}
```

#### Preview Deployment Plan
```bash
POST /api/dab/plan

{
  "bundlePath": "/path/to/.bundle/dev",
  "environment": "dev"
}
```

#### Deploy Bundle
```bash
POST /api/dab/deploy

{
  "bundlePath": "/path/to/.bundle/dev",
  "environment": "dev",
  "commit": "abc123",
  "branch": "develop",
  "user": "username"
}
```

### Deployment State

#### Get Deployment History
```bash
GET /api/deployments/history?environment=dev&limit=50
```

#### Get Current Environment State
```bash
GET /api/deployments/state/dev
```

#### Get Resource Inventory
```bash
GET /api/deployments/resources/dev?resourceType=pipeline
```

#### Detect Drift
```bash
GET /api/deployments/drift/dev
```

## Environment Variables

```env
PORT=3002
NODE_ENV=development

# Databricks Configuration
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
DATABRICKS_CLUSTER_ID=0123-456789-abcdefg

# Database for State Tracking
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nexa_state
DB_USER=postgres
DB_PASSWORD=

# Git Configuration
GIT_REPO_PATH=./nexa-state
GIT_USER_NAME=Nexa Bot
GIT_USER_EMAIL=nexa@example.com

# State Signature
STATE_SIGNATURE_SECRET=your-secret-key
```

## Database Schema

```sql
-- Deployment history
CREATE TABLE deployment_history (
  id VARCHAR(36) PRIMARY KEY,
  commit VARCHAR(40) NOT NULL,
  branch VARCHAR(255) NOT NULL,
  environment VARCHAR(20) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  plan_summary JSONB,
  result JSONB
);

-- Deployed resources
CREATE TABLE deployed_resources (
  id SERIAL PRIMARY KEY,
  deployment_id VARCHAR(36) REFERENCES deployment_history(id),
  artifact_path VARCHAR(500) NOT NULL,
  runtime_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  env VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  deployed_at TIMESTAMP NOT NULL
);

-- Resource inventory
CREATE TABLE resource_inventory (
  id SERIAL PRIMARY KEY,
  artifact_path VARCHAR(500) NOT NULL,
  runtime_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  env VARCHAR(20) NOT NULL,
  last_deployed_commit VARCHAR(40) NOT NULL,
  last_deployed_at TIMESTAMP NOT NULL,
  UNIQUE (artifact_path, env)
);
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Dependencies

- **express** - Web framework
- **axios** - HTTP client for Databricks API
- **js-yaml** - YAML processing
- **simple-git** - Git operations
- **pg** - PostgreSQL client
- **winston** - Logging

## Security

- State files are signed with HMAC
- Git commits are audited
- Deployment user tracking
- Environment-specific credentials
