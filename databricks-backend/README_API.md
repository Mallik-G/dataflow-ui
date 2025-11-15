# Databricks Backend - FastAPI Implementation

## Overview

Complete FastAPI backend for Nexa Databricks API with comprehensive Databricks integration, lineage tracking, usage monitoring, and deployment orchestration.

**Tech Stack:**
- FastAPI 0.121.0
- Python 3.13
- SQLAlchemy 2.0 + SQLModel
- PostgreSQL with async support
- Pydantic v2 for validation
- Structlog for logging
- Poetry for dependency management

## API Endpoints (v1)

### Core Services

1. **Authentication** (`/api/v1/auth`)
   - OAuth token management
   - Service principal authentication
   - JWT token generation
   - Multi-auth support (PAT, OAuth, Azure Entra)

2. **Databricks Apps** (`/api/v1/apps`)
   - App lifecycle management
   - Deployment tracking
   - Serverless app support
   - Health monitoring

3. **Unity Catalog** (`/api/v1/catalog`)
   - Schema management
   - Table operations
   - Volume management
   - Metadata sync

4. **Data Lineage** (`/api/v1/lineage`)
   - Column-level lineage
   - Table dependencies
   - Lineage visualization
   - Impact analysis

5. **Jobs** (`/api/v1/jobs`)
   - Job CRUD operations
   - Run management
   - Job clustering
   - Execution tracking

6. **Pipelines** (`/api/v1/pipelines`)
   - DLT pipeline management
   - Pipeline updates
   - Event tracking
   - Observability metrics

### Platform Integration

7. **Connectors** (`/api/v1/connectors`)
   - External data source connections
   - Connector validation
   - Connection pooling
   - Credentials management

8. **Git/GitOps** (`/api/v1/git`)
   - Repository management
   - Branch operations
   - Commit tracking
   - Multi-provider support (GitHub, GitLab, Azure DevOps)

9. **Deployments** (`/api/v1/deployments`)
   - Environment-based deployments
   - Rollback capabilities
   - Deployment history
   - State tracking

10. **Environments** (`/api/v1/environments`)
    - Environment configuration
    - Credential management
    - Environment variables
    - Access control

### Operations & Monitoring

11. **Usage Tracking** (`/api/v1/usage`)
    - DBU consumption
    - Cost allocation
    - Usage star schema
    - Invoice generation

12. **Warehouses** (`/api/v1/warehouses`)
    - SQL warehouse management
    - Cluster sizing
    - Auto-scaling configuration
    - Performance monitoring

13. **Statements** (`/api/v1/statements`)
    - SQL execution
    - Query history
    - Result streaming
    - Query optimization

14. **IAM** (`/api/v1/iam`)
    - User management
    - Group operations
    - Service principals
    - Permission assignment

15. **Tags** (`/api/v1/tags`)
    - Tag management
    - Tag propagation
    - Bulk tagging
    - Tag search

## Background Services

### Sync Services
- **Jobs Background Sync** - Periodic job metadata synchronization
- **Pipeline Background Sync** - DLT pipeline state tracking
- **Metadata Background Sync** - Unity Catalog metadata refresh
- **Usage Background Sync** - DBU usage data collection
- **Usage Star Schema Sync** - Dimensional model updates

### Observability
- **Pipeline Metric Export** - Metrics export to monitoring systems
- **Observability Repository** - Centralized metrics storage
- **API Audit Logging** - Request/response tracking

## Database Models

### API Models (Pydantic)
- Apps, Catalog, Connectors, Deployments
- Environments, Git, Jobs, Lineage
- Permissions, Pipelines, Repos
- Statements, Warehouses, Workspace
- Compute Usage (Star Schema)

### DB Models (SQLModel)
- Apps, Auditing, Compute Tracking
- Connectors, Deployment Details, Deployments
- Jobs, Metadata, Observability
- Pipelines, Usage Star Schema, Usage Tracking

## Services Architecture

### Databricks Integration
- **Auth Manager** - Multi-auth strategy handler
- **OAuth Token Manager** - Token refresh & management
- **Service Principal Auth** - M2M authentication
- **SDK Adapter** - Databricks SDK wrapper

### Databricks API Clients
- Apps API, Billing API, Files API
- Git Credentials API, IAM API, Jobs API
- Pipelines API, Repos API, SQL Warehouse API
- Tags API, UC API, UC Lineage API
- Warehouse API, Workspace API

### Business Logic Services
- **Deployment Service** - Environment-based deployments
- **GitOps Service** - Git-driven workflows
- **Git Service** - Repository operations
- **Code Generation** - Artifact generation
- **Source Validation** - Code quality checks
- **Dimension Upsert Service** - Star schema updates
- **Invoice Service** - Cost reporting
- **Usage Record Transformer** - Usage data ETL

### Metadata Services
- **Metadata Sync Service** - UC metadata synchronization
- **Metadata Transformer** - Data transformation
- **System Tables Client** - System table access

## Git Provider Support

Unified interface with multiple implementations:
- **GitHub Provider** - GitHub REST API
- **GitLab Provider** - GitLab API
- **Azure DevOps Provider** - Azure Repos API

## Middleware & Error Handling

- **Request ID Middleware** - Request tracing
- **Request/Response Logging** - Comprehensive logging
- **Error Handlers** - Centralized exception handling
- **CORS Middleware** - Cross-origin support

## Configuration

Environment-based configuration via Pydantic Settings:
- Database connection (PostgreSQL)
- Databricks workspace settings
- Authentication configuration
- Feature flags
- Logging configuration

## Scripts

- **Create Star Schema** - Usage analytics schema
- **Drop All Tables** - Database cleanup
- **Observability Pipeline** - Metrics collection DLT
- **Serverless SDK Deployment** - Automated deployment

## Key Features

✅ **Async/Await** - Fully asynchronous API
✅ **Type Safety** - Pydantic models throughout
✅ **Database Migrations** - Alembic integration
✅ **Background Tasks** - Periodic sync services
✅ **Health Checks** - Database & service monitoring
✅ **Structured Logging** - JSON logs with context
✅ **Error Tracking** - Request ID tracking
✅ **Token Refresh** - Automatic OAuth renewal
✅ **Multi-tenancy** - Environment isolation
✅ **Cost Tracking** - DBU usage & invoicing
✅ **Data Lineage** - Full lineage graph
✅ **GitOps Ready** - Git-driven deployments

## API Documentation

FastAPI auto-generates:
- **OpenAPI Spec** - `/docs` (Swagger UI)
- **ReDoc** - `/redoc` (Alternative UI)
- **OpenAPI JSON** - `/openapi.json`

## Development Tools

- **Black** - Code formatting
- **isort** - Import sorting
- **Ruff** - Fast linting
- **MyPy** - Static type checking
- **Bandit** - Security scanning
- **pytest** - Testing framework
- **pre-commit** - Git hooks

## Running the Backend

### Using Poetry
```bash
cd databricks-backend
poetry install
poetry run uvicorn src.app:app --reload --port 3002
```

### Using Docker
```bash
docker build -t databricks-backend .
docker run -p 3002:3002 databricks-backend
```

### Using Docker Compose
```bash
docker-compose up databricks-backend
```

## Environment Variables

See `.env.example` for required configuration:
- Databricks workspace URL & credentials
- PostgreSQL connection details
- Git provider credentials
- OAuth settings
- Feature flags

## Architecture Highlights

**Layered Architecture:**
```
API Routes (FastAPI)
    ↓
Business Services
    ↓
Databricks Clients
    ↓
External APIs (Databricks, Git, etc.)
```

**Database Pattern:**
```
API Models (Request/Response)
    ↔
DB Models (Persistence)
    ↔
PostgreSQL (State Storage)
```

**Background Jobs:**
```
FastAPI Lifespan
    → Start Background Services
    → Periodic Sync Tasks
    → Cleanup on Shutdown
```

## Security

- OAuth 2.0 flow support
- Service principal authentication
- Azure Entra ID integration
- API key validation
- Request authentication
- CORS configuration
- Secrets management (AWS Secrets Manager)

## Observability

- Structured logging with structlog
- Request/response logging
- Database query logging
- Background job monitoring
- Error tracking with context
- Health check endpoints

---

**Total Lines of Code:** ~40,000+
**API Endpoints:** 150+
**Database Tables:** 20+
**Background Services:** 7
**Git Providers:** 3
**Auth Methods:** 4

This is a **production-ready, enterprise-grade** backend! 🚀
