# DataFlow UI - Backend Services

This repository contains three backend services for the DataFlow UI platform:

## Services

### 1. Snowflake Backend (Port 3001)
Handles all Snowflake operations including connection testing, query execution, and metadata retrieval.

📁 [snowflake-backend/](./snowflake-backend/)

### 2. Databricks Backend (Port 3002)
Manages Databricks operations with full DAB (Databricks Asset Bundles) deployment engine, state tracking, and resource inventory management.

📁 [databricks-backend/](./databricks-backend/)

### 3. LLM Backend (Port 3003)
Provides AI-powered data engineering capabilities using OpenAI with RAG (Retrieval-Augmented Generation) for continuous learning.

📁 [llm-backend/](./llm-backend/)

## Quick Start

### Using Docker Compose (Recommended)

1. **Set up environment files**

Create `.env` files for each backend based on the `.env.example` files:

```bash
cp snowflake-backend/.env.example snowflake-backend/.env
cp databricks-backend/.env.example databricks-backend/.env
cp llm-backend/.env.example llm-backend/.env
```

2. **Configure your credentials**

Edit each `.env` file with your actual credentials.

3. **Start all services**

```bash
docker-compose up -d
```

This will start:
- PostgreSQL with pgvector (for state tracking and RAG)
- Snowflake Backend (port 3001)
- Databricks Backend (port 3002)
- LLM Backend (port 3003)

4. **Check service health**

```bash
# Snowflake Backend
curl http://localhost:3001/health

# Databricks Backend
curl http://localhost:3002/health

# LLM Backend
curl http://localhost:3003/health
```

### Manual Setup

If you prefer to run services manually:

1. **Install PostgreSQL with pgvector**

```bash
# Install PostgreSQL 16 with pgvector extension
# See: https://github.com/pgvector/pgvector
```

2. **Initialize databases**

```bash
psql -U postgres -f init-db.sql
```

3. **Install and start each backend**

```bash
# Snowflake Backend
cd snowflake-backend
npm install
npm run dev

# Databricks Backend
cd databricks-backend
npm install
npm run dev

# LLM Backend
cd llm-backend
npm install
npm run dev
```

## Architecture

```
┌─────────────────┐
│   Frontend UI   │
│  (React/Vite)   │
│   Port: 5173    │
└────────┬────────┘
         │
    ┌────┴────────────────────────┐
    │                             │
┌───┴────────┐  ┌──────────┴─────┐  ┌───────────┴──┐
│ Snowflake  │  │  Databricks    │  │   LLM        │
│  Backend   │  │   Backend      │  │  Backend     │
│ Port: 3001 │  │  Port: 3002    │  │ Port: 3003   │
└────────────┘  └───────┬────────┘  └──────┬───────┘
                        │                   │
                   ┌────┴───────────────────┴────┐
                   │      PostgreSQL             │
                   │  - nexa_state (deployments) │
                   │  - nexa_rag (AI learning)   │
                   │      Port: 5432             │
                   └─────────────────────────────┘
```

## Key Features

### Databricks Backend - DAB Deployment

The Databricks backend implements a complete DAB deployment strategy:

- **Bundle Generation**: Converts project YAML to DAB format
- **Plan/Apply Workflow**: Preview changes before deployment
- **State Tracking**: Git + Database dual-layer state management
- **Resource Inventory**: Track all deployed resources
- **Drift Detection**: Compare actual vs. desired state
- **Audit Trail**: Complete deployment history

See [Databricks Backend README](./databricks-backend/README.md) for details.

### LLM Backend - RAG Learning

The LLM backend uses RAG for continuous improvement:

- **Intelligent Mapping**: AI generates column mappings from schemas
- **YAML Generation**: Automated transformation definitions
- **Feedback Loop**: Learns from user corrections
- **Vector Search**: Finds similar patterns using embeddings
- **Continuous Learning**: Improves accuracy over time

See [LLM Backend README](./llm-backend/README.md) for details.

## Development

### Running Tests

```bash
# Each backend has its own tests
cd snowflake-backend && npm test
cd databricks-backend && npm test
cd llm-backend && npm test
```

### Building for Production

```bash
# Build all backends
docker-compose build

# Or build individually
cd snowflake-backend && npm run build
cd databricks-backend && npm run build
cd llm-backend && npm run build
```

### Logs

When running with Docker Compose, logs are available at:

- `snowflake-backend/logs/`
- `databricks-backend/logs/`
- `llm-backend/logs/`

View live logs:

```bash
docker-compose logs -f snowflake-backend
docker-compose logs -f databricks-backend
docker-compose logs -f llm-backend
```

## Environment Variables

### Required for All Backends

- `PORT` - Service port (3001, 3002, 3003)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Frontend URL (http://localhost:5173)

### Snowflake Backend

- `SNOWFLAKE_ACCOUNT` - Snowflake account identifier
- `SNOWFLAKE_USERNAME` - Username
- `SNOWFLAKE_PASSWORD` - Password
- `SNOWFLAKE_WAREHOUSE` - Warehouse name
- `SNOWFLAKE_DATABASE` - Database name
- `SNOWFLAKE_SCHEMA` - Schema name

### Databricks Backend

- `DATABRICKS_HOST` - Workspace URL
- `DATABRICKS_TOKEN` - Access token
- `DATABRICKS_CLUSTER_ID` - Cluster ID
- `DB_HOST` - PostgreSQL host
- `DB_NAME` - Database name (nexa_state)
- `GIT_REPO_PATH` - Path for state files

### LLM Backend

- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_MODEL` - Model name (gpt-4-turbo-preview)
- `OPENAI_EMBEDDING_MODEL` - Embedding model (text-embedding-3-small)
- `DB_HOST` - PostgreSQL host
- `DB_NAME` - Database name (nexa_rag)

## Security Considerations

- Never commit `.env` files
- Use secrets management in production
- Enable SSL for database connections
- Rotate API keys regularly
- Use read-only database users where possible
- Enable rate limiting in production
- Validate all user inputs
- Sanitize logs to prevent credential leakage

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Backend Service Issues

```bash
# Check service status
docker-compose ps

# View specific service logs
docker-compose logs -f <service-name>

# Restart specific service
docker-compose restart <service-name>

# Rebuild and restart
docker-compose up -d --build <service-name>
```

### Database Migration Issues

```bash
# Reset databases (WARNING: destroys all data)
docker-compose down -v
docker-compose up -d
```

## Contributing

When adding new backend functionality:

1. Update the appropriate backend's README
2. Add new environment variables to `.env.example`
3. Update database schema in `init-db.sql` if needed
4. Add tests for new functionality
5. Update this README if architecture changes

## License

See main repository LICENSE file.
