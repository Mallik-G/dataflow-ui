# Backend Documentation

## Overview

This backend is a comprehensive data engineering platform built with Node.js, Express.js, and PostgreSQL. It provides APIs for data transformation, file management, schema extraction, GitHub integration, and artifact generation for data pipelines.

## Architecture

### Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Cloud Storage**: AWS S3
- **Authentication**: JWT tokens
- **File Processing**: Multer, CSV parsing
- **Version Control**: GitHub API integration

### Project Structure

```
nodeJsInitial/
├── app.js                 # Main Express application setup
├── server.js             # Server entry point
├── package.json          # Dependencies and scripts
├── config/               # Configuration files
│   ├── aws.js           # AWS S3 configuration
│   ├── dbConfig.js      # Database configuration
│   └── webSocket.js     # WebSocket configuration
├── controllers/         # Business logic controllers
├── routes/              # API route definitions
├── models/              # Database models (Sequelize)
├── services/            # Service layer for business logic
├── middlewares/         # Custom middleware functions
├── helpers/             # Utility functions
└── docs/                # Documentation
```

## Core Components

### 1. Application Setup (`app.js`)

**Purpose**: Main Express application configuration and middleware setup.

**Key Features**:

- CORS configuration for cross-origin requests
- Security headers using Helmet
- Request logging with Morgan
- JSON/URL-encoded body parsing (50MB limit)
- Database connection initialization
- Route mounting

**Middleware Stack**:

```javascript
app.use(cors(corsOptionsDelegate));
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(helmet.hidePoweredBy());
app.use(helmet.xssFilter());
app.use(helmet.hsts());
app.use(helmet.frameguard());
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy());
```

### 2. Server Entry Point (`server.js`)

**Purpose**: HTTP server initialization and startup.

**Key Features**:

- Environment variable loading
- Server creation and port binding
- Health check endpoint
- 404 handler for unmatched routes

### 3. Database Models

#### AttributeTransformation

- **Purpose**: Stores data transformation configurations
- **Key Fields**: entityName, fileType, mappings, columnRules, operatorRules, concatenationRules, entityNLPRules, newColumns
- **Status Values**: active, draft, archived, deleted

#### RawFileSchema

- **Purpose**: Stores raw file schema information
- **Key Fields**: entityName, fileName, fileKey, schemaAttributes, schemaMetadata, fileData
- **Status Values**: active, archived, deleted

#### ConsumptionFileSchema

- **Purpose**: Stores consumption layer file schema information
- **Key Fields**: entityName, fileName, sourceEntities, joinRelationships, transformations
- **Status Values**: active, archived, deleted

#### BatchProjection

- **Purpose**: Stores batch projection configurations
- **Key Fields**: entityName, selectedEntities, settings, schedule, output
- **Status Values**: active, paused, completed, failed

#### GitHubConnection

- **Purpose**: Stores GitHub integration credentials
- **Key Fields**: repositoryUrl, branch, username, password (encrypted), authMethod
- **Security**: Password encryption using AES-256-CBC

#### NLPArtifact

- **Purpose**: Stores AI-generated code artifacts
- **Key Fields**: entityName, artifactType, code, description, columns
- **Status Values**: accepted, archived, deleted

#### ConsumptionETLTransformation

- **Purpose**: Stores consumption ETL transformation rules
- **Key Fields**: entityName, columnName, transformationType, rules, code
- **Status Values**: accepted, archived, deleted

#### WorkspaceCode

- **Purpose**: Stores custom workspace code snippets
- **Key Fields**: entityName, codeType, code, description, tags
- **Status Values**: active, archived, deleted

## API Endpoints

### File Management Routes (`/api`)

#### File Upload and Schema Extraction

- `POST /upload` - Upload file to S3 and optionally save schema
- `POST /extract-schema` - Extract schema from file buffer without S3 upload

#### Raw File Schema Management

- `POST /api/raw-schemas/save` - Save raw file schema
- `GET /api/raw-schemas/:entityName` - Get schema by entity name
- `GET /api/raw-schemas` - Get all schemas with filtering/pagination
- `PUT /api/raw-schemas/:entityName/status` - Update schema status
- `DELETE /api/raw-schemas/:entityName` - Soft delete schema
- `GET /api/raw-schemas/stats` - Get schema statistics
- `POST /api/raw-schemas/extract` - Extract schema from content
- `GET /api/raw-schemas/:entityName/control-columns` - Generate control columns
- `GET /api/raw-schemas/:entityName/column-metadata` - Generate column metadata

#### Consumption File Schema Management

- `POST /api/consumption-schemas/save` - Save consumption schema
- `GET /api/consumption-schemas/:entityName` - Get consumption schema
- `GET /api/consumption-schemas` - Get all consumption schemas
- `PUT /api/consumption-schemas/:entityName/status` - Update consumption schema status
- `DELETE /api/consumption-schemas/:entityName` - Delete consumption schema
- `GET /api/consumption-schemas/stats` - Get consumption schema statistics
- `POST /api/consumption-schemas/extract` - Extract consumption schema from content

#### File Operations

- `GET /documents` - List all files from S3
- `GET /api/file/:key` - Get specific file from S3
- `PUT /api/file/rename` - Rename file in S3

#### Data Transformation

- `POST /api/transformations/save` - Save transformation (legacy)
- `POST /api/transformations/save-mappings` - Save transformations for curated/consumption
- `GET /api/transformations/:entityName` - Get saved transformations
- `POST /api/curated/generate` - Generate curated file
- `POST /api/consumption/generate` - Generate consumption file
- `GET /api/transformations` - Get all transformations
- `PUT /api/transformations/:entityName/status` - Update transformation status
- `DELETE /api/transformations/:entityName` - Delete transformation
- `GET /api/transformations/stats` - Get transformation statistics

#### File Listing

- `GET /api/curated/files` - List curated files from S3
- `GET /api/consumption/files` - List consumption files from S3
- `GET /api/gold/files` - List gold files from S3
- `GET /api/ai-consumption-files` - List AI-suggested consumption files
- `GET /api/ai-curated-files` - List AI-suggested curated files
- `GET /api/consumption/files/:fileName/columns` - Get consumption file columns

### Batch Projection Routes (`/api/batch-projections`)

- `POST /test` - Test batch projection
- `POST /save` - Save projection settings
- `GET /` - Get all projections
- `GET /stats` - Get projection statistics
- `GET /:projectionId` - Get specific projection
- `PUT /:projectionId` - Update projection settings
- `PATCH /:projectionId/status` - Update projection status
- `DELETE /:projectionId` - Delete projection

### GitHub Integration Routes (`/api/github`)

- `POST /test` - Test GitHub connection
- `POST /test-write` - Test write permissions
- `POST /save` - Save GitHub connection
- `PUT /update` - Update GitHub connection
- `POST /repository-info` - Get repository information
- `POST /branches` - List repository branches
- `GET /active` - Get active connection
- `GET /connection` - Alias for active connection
- `GET /debug` - Debug endpoint
- `GET /file` - Get file content from GitHub
- `DELETE /reset` - Reset active connection

### Artifact Generation Routes (`/api/artifacts`)

- `POST /generate` - Generate all data engineering artifacts
- `POST /diff` - Generate diff between existing and new artifacts
- `POST /generate-all-diffs` - Generate diffs for multiple entities
- `POST /push-to-github` - Push artifacts to GitHub
- `POST /push-all-to-github` - Push all artifacts to GitHub

### NLP Artifact Routes (`/api/nlp-artifacts`)

- `POST /` - Save accepted NLP artifact
- `GET /` - Get all NLP artifacts with pagination
- `GET /stats` - Get NLP artifacts statistics
- `GET /entity/:entityName` - Get NLP artifacts for entity
- `GET /:id` - Get specific NLP artifact by ID
- `PUT /:id` - Update NLP artifact
- `DELETE /:id` - Delete NLP artifact

### Consumption Artifact Routes (`/api/api/consumption-artifacts`)

- `POST /generate` - Generate consumption artifacts
- `POST /generate-diffs` - Generate consumption diffs
- `GET /stored` - Get stored consumption artifacts

### Consumption ETL Transformation Routes (`/api/api/consumption-etl`)

- `POST /save` - Save consumption ETL transformation
- `GET /entity/:entityName` - Get transformations for entity
- `GET /entity/:entityName/column/:columnName` - Get transformations for entity/column
- `GET /all` - Get all consumption ETL transformations
- `PUT /:id/status` - Update transformation status
- `DELETE /:id` - Delete transformation

### Workspace Code Routes (`/api/api/workspace-code`)

- `POST /save` - Save workspace code
- `GET /entity/:entityName` - Get workspace codes by entity
- `GET /all` - Get all workspace codes
- `PUT /update/:id` - Update workspace code
- `DELETE /delete/:id` - Delete workspace code

## Controllers

### TransformationController

**Purpose**: Handles data transformation logic and file generation.

**Key Functions**:

- `applyNLPTransformations()` - Apply NLP rules (uppercase, lowercase, trim)
- `applyDataQualityChecks()` - Apply DQ rules (not null, email format, numeric only)
- `applyOperatorRules()` - Apply operator rules (greater than, less than, not equals)
- `applyConcatenationRules()` - Concatenate columns based on rules
- `generateCuratedFile()` - Generate curated CSV from raw data
- `generateConsumptionFile()` - Generate consumption CSV from gold data
- `getAllCuratedFileColumns()` - Extract all column headers from curated files

### RawFileSchemaController

**Purpose**: Manages raw file schema operations.

**Key Functions**:

- `saveRawFileSchema()` - Save/update raw file schema
- `getRawFileSchema()` - Retrieve schema by entity name
- `getAllRawFileSchemas()` - Get all schemas with filtering/pagination
- `updateRawFileSchemaStatus()` - Update schema status
- `deleteRawFileSchema()` - Soft delete schema
- `extractSchemaFromFile()` - Extract schema from file content
- `generateControlColumns()` - Generate mock control columns
- `generateColumnMetadata()` - Generate column metadata

### ConsumptionFileSchemaController

**Purpose**: Manages consumption file schema operations.

**Key Functions**:

- `saveConsumptionFileSchema()` - Save/update consumption schema
- `getConsumptionFileSchema()` - Retrieve consumption schema
- `getAllConsumptionFileSchemas()` - Get all consumption schemas
- `updateConsumptionFileSchemaStatus()` - Update consumption schema status
- `deleteConsumptionFileSchema()` - Delete consumption schema
- `extractSchemaFromFile()` - Extract consumption schema from content

### BatchProjectionController

**Purpose**: Manages batch projection operations.

**Key Functions**:

- `testProjection()` - Test batch projection with data processing
- `saveProjectionSettings()` - Save projection configuration
- `getProjectionSettings()` - Retrieve all projections
- `getProjectionById()` - Get specific projection
- `updateProjectionSettings()` - Update projection configuration
- `updateProjectionStatus()` - Update projection status
- `deleteProjectionSettings()` - Delete projection
- `getProjectionStats()` - Get projection statistics

### GitHubController

**Purpose**: Handles GitHub integration operations.

**Key Functions**:

- `testGitHubConnection()` - Test GitHub credentials and repository access
- `saveGitHubConnection()` - Save GitHub connection details
- `updateGitHubConnection()` - Update existing connection
- `getRepositoryInfo()` - Get repository information
- `listBranches()` - List repository branches
- `testWritePermissions()` - Test write access to repository
- `getActiveConnection()` - Get currently active connection
- `resetConnection()` - Reset/deactivate connection

### ArtifactController

**Purpose**: Generates data engineering artifacts and manages GitHub integration.

**Key Functions**:

- `generateSQLCode()` - Generate SQL DDL and INSERT statements
- `generatePySparkCode()` - Generate PySpark data processing code
- `generateDockerfile()` - Generate Dockerfile for data pipeline
- `generateCICDPipeline()` - Generate GitHub Actions CI/CD pipeline
- `generateDocumentation()` - Generate Markdown documentation
- `generateConfigFiles()` - Generate config.yaml and requirements.txt
- `generateDMLSQL()` - Generate DML SQL for insert/update/delete operations
- `generateDMLPySpark()` - Generate DML PySpark code
- `generateAllArtifacts()` - Orchestrate generation of all artifact types
- `generateArtifactsDiff()` - Generate diff between existing and new artifacts

### NLPArtifactController

**Purpose**: Manages NLP-generated code artifacts.

**Key Functions**:

- `saveNLPArtifact()` - Save NLP artifact to database and file system
- `getNLPArtifactsByEntity()` - Get NLP artifacts for specific entity
- `getAllNLPArtifacts()` - Get all NLP artifacts with pagination
- `getNLPArtifactById()` - Get specific NLP artifact
- `updateNLPArtifact()` - Update NLP artifact
- `deleteNLPArtifact()` - Soft delete NLP artifact
- `getNLPArtifactsStats()` - Get NLP artifacts statistics

### ConsumptionArtifactController

**Purpose**: Manages consumption-layer artifact generation.

**Key Functions**:

- `generateConsumptionArtifacts()` - Generate consumption SQL/PySpark/DML code
- `generateConsumptionDiffs()` - Generate consumption diffs
- `getStoredConsumptionArtifacts()` - Get stored consumption artifacts
- `generateConsumptionSQLCode()` - Generate consumption SQL DDL
- `generateComplexMappingView()` - Generate SQL view for M:1 mappings
- `generateConsumptionPySparkCode()` - Generate consumption PySpark code
- `generateConsumptionDMLSQL()` - Generate consumption DML SQL
- `generateConsumptionDMLPySpark()` - Generate consumption DML PySpark

### ConsumptionETLTransformationController

**Purpose**: Manages consumption ETL transformations.

**Key Functions**:

- `saveConsumptionETLTransformation()` - Save ETL transformation
- `getConsumptionETLTransformationsByEntity()` - Get transformations for entity
- `getConsumptionETLTransformationsByEntityAndColumn()` - Get transformations for entity/column
- `getAllConsumptionETLTransformations()` - Get all ETL transformations
- `updateConsumptionETLTransformationStatus()` - Update transformation status
- `deleteConsumptionETLTransformation()` - Delete transformation

### WorkspaceCodeController

**Purpose**: Manages workspace code snippets.

**Key Functions**:

- `saveWorkspaceCode()` - Save workspace code
- `getWorkspaceCodesByEntity()` - Get codes by entity
- `getAllWorkspaceCodes()` - Get all workspace codes
- `updateWorkspaceCode()` - Update workspace code
- `deleteWorkspaceCode()` - Delete workspace code

## Services

### AttributeTransformationService

**Purpose**: Business logic for attribute transformations.

**Key Methods**:

- `saveTransformation()` - Save/update transformation with UUID generation
- `getTransformation()` - Get transformation by entity and file type
- `getAllTransformations()` - Get all transformations with filtering
- `updateTransformationStatus()` - Update transformation status
- `markTransformationApplied()` - Mark transformation as applied
- `deleteTransformation()` - Delete transformation
- `getTransformationStats()` - Get transformation statistics

### GitHubService

**Purpose**: GitHub API integration and authentication.

**Key Methods**:

- `testConnection()` - Test GitHub credentials and repository access
- `saveConnection()` - Save encrypted GitHub connection
- `updateConnection()` - Update existing connection
- `getActiveConnection()` - Get active connection with decrypted password
- `resetConnection()` - Deactivate connection
- `encryptPassword()` / `decryptPassword()` - Password encryption/decryption
- `extractRepoInfo()` - Parse GitHub URL to extract owner/repo
- `getRepositoryInfo()` - Get repository information
- `listBranches()` - List repository branches
- `testWritePermissions()` - Test write access with Git operations
- `pushArtifactsToRepository()` - Push artifacts to GitHub
- `pushAllArtifactsToRepository()` - Push multiple artifacts in single commit
- `checkExistingFiles()` - Check existing files in repository
- `getFileContent()` - Get file content from GitHub
- `generateArtifactsDiff()` - Generate diff between existing and new artifacts

### RawFileSchemaService

**Purpose**: Business logic for raw file schema operations.

**Key Methods**:

- `saveRawFileSchema()` - Save/update raw file schema
- `getRawFileSchema()` - Get schema by entity name
- `getAllRawFileSchemas()` - Get all schemas with filtering/pagination
- `updateRawFileSchemaStatus()` - Update schema status
- `deleteRawFileSchema()` - Soft delete schema
- `getRawFileSchemaStats()` - Get schema statistics
- `extractSchemaFromContent()` - Extract schema from file content
- `determineDataType()` - Determine data type from sample values
- `generateColumnDescription()` - Generate column descriptions

### ConsumptionFileSchemaService

**Purpose**: Business logic for consumption file schema operations.

**Key Methods**:

- `saveConsumptionFileSchema()` - Save/update consumption schema
- `getConsumptionFileSchema()` - Get consumption schema by entity
- `getAllConsumptionFileSchemas()` - Get all consumption schemas
- `updateConsumptionFileSchemaStatus()` - Update consumption schema status
- `deleteConsumptionFileSchema()` - Delete consumption schema
- `getConsumptionFileSchemaStats()` - Get consumption schema statistics
- `extractSchemaFromContent()` - Extract consumption schema from content
- `determineDataType()` - Determine data type from sample values
- `generateColumnDescription()` - Generate column descriptions

### BatchProjectionService

**Purpose**: Business logic for batch projection operations.

**Key Methods**:

- `createProjection()` - Create new batch projection
- `getAllProjections()` - Get all projections with filtering
- `getProjectionById()` - Get specific projection
- `updateProjection()` - Update projection configuration
- `deleteProjection()` - Delete projection
- `updateStatus()` - Update projection status
- `updateRunStats()` - Update run statistics
- `getDueProjections()` - Get projections due to run
- `getProjectionStats()` - Get projection statistics

## Data Flow

### 1. Raw Data Processing

1. File uploaded via `/upload` endpoint
2. File stored in S3 with metadata
3. Schema extracted and saved to `RawFileSchema` table
4. User can view/edit schema attributes
5. Transformation rules defined and saved to `AttributeTransformation` table

### 2. Curated Data Generation

1. Transformation rules applied to raw data
2. NLP transformations (uppercase, lowercase, trim)
3. Data quality checks (not null, email format, numeric only)
4. Operator rules (greater than, less than, not equals)
5. Column concatenation rules
6. New column creation
7. Curated CSV generated and stored in S3

### 3. Consumption Data Generation

1. Gold data processed with consumption transformations
2. M:1 mappings applied for complex relationships
3. Consumption CSV generated and stored in S3
4. Schema saved to `ConsumptionFileSchema` table

### 4. Artifact Generation

1. SQL DDL and DML code generated
2. PySpark data processing code generated
3. Configuration files (config.yaml, requirements.txt)
4. Documentation (README.md)
5. CI/CD pipeline (GitHub Actions)
6. Dockerfile for containerization
7. Artifacts pushed to GitHub repository

### 5. Batch Processing

1. Projection configurations saved to `BatchProjection` table
2. Scheduled execution based on cron expressions
3. Data read from S3 or AI-generated sources
4. Attribute filtering applied
5. Output format conversion (CSV, JSON, Parquet)
6. Results uploaded to S3 under `projections/` prefix

## Security Features

### Authentication & Authorization

- JWT token-based authentication
- Password encryption using AES-256-CBC
- CORS configuration for cross-origin requests
- Security headers using Helmet middleware

### Data Protection

- Soft deletes for data retention
- Encrypted password storage for GitHub connections
- Input validation and sanitization
- File size limits (50MB)

### GitHub Integration Security

- Token-based authentication preferred over username/password
- Write permission testing before operations
- Encrypted credential storage
- Repository access validation

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

### Common Error Scenarios

- **400 Bad Request**: Invalid input parameters
- **401 Unauthorized**: Authentication failure
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation errors
- **500 Internal Server Error**: Server-side errors

### GitHub API Error Handling

- Detailed error messages for different HTTP status codes
- Network error handling for connection issues
- Authentication error handling with specific guidance
- Repository access error handling

## Performance Considerations

### Database Optimization

- Indexed queries on frequently accessed fields
- Pagination for large result sets
- Soft deletes to maintain data integrity
- Connection pooling for database connections

### File Processing

- Streaming for large file uploads
- Chunked processing for large datasets
- S3 multipart uploads for large files
- Memory-efficient CSV parsing

### Caching

- In-memory caching for frequently accessed data
- GitHub API rate limiting considerations
- S3 object caching for file operations

## Monitoring & Logging

### Logging

- Morgan middleware for HTTP request logging
- Console logging for error tracking
- Structured logging for debugging

### Health Checks

- `/health-check` endpoint for server status
- Database connection monitoring
- S3 connectivity monitoring

### Statistics

- Transformation statistics
- Schema statistics
- Projection run statistics
- GitHub connection statistics

## Development Guidelines

### Code Organization

- Controllers handle HTTP requests/responses
- Services contain business logic
- Models define database schema
- Routes define API endpoints
- Middleware handles cross-cutting concerns

### Error Handling

- Consistent error response format
- Proper HTTP status codes
- Detailed error messages for debugging
- Graceful error handling for external services

### Testing

- Unit tests for service methods
- Integration tests for API endpoints
- Mock external service dependencies
- Test data cleanup after tests

### Documentation

- JSDoc comments for functions
- API endpoint documentation
- Database schema documentation
- Deployment and configuration guides

## Deployment

### Environment Variables

- `PORT`: Server port (default: 4000)
- `NODE_ENV`: Environment (development/production)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: Database configuration
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`: AWS S3 configuration
- `ENCRYPTION_KEY`: Password encryption key
- `CORS_ORIGINS`: Allowed CORS origins

### Docker Support

- Dockerfile included for containerization
- Multi-stage build for optimization
- Environment variable configuration
- Health check endpoint

### Production Considerations

- Database connection pooling
- S3 bucket configuration
- GitHub token management
- Log aggregation and monitoring
- Backup and recovery procedures

## API Usage Examples

### Upload File and Extract Schema

```bash
curl -X POST http://localhost:4000/upload \
  -F "file=@data.csv" \
  -F "entityName=customers" \
  -F "saveSchema=true"
```

### Save Transformation Rules

```bash
curl -X POST http://localhost:4000/api/transformations/save-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "customers",
    "fileType": "curated",
    "mappings": {
      "customer_id": "id",
      "customer_name": "name",
      "email_address": "email"
    },
    "columnRules": {
      "email": ["not_null", "email_format"]
    }
  }'
```

### Generate Curated File

```bash
curl -X POST http://localhost:4000/api/curated/generate \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "customers",
    "transformations": {
      "mappings": {...},
      "columnRules": {...}
    }
  }'
```

### Test GitHub Connection

```bash
curl -X POST http://localhost:4000/api/github/test \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/owner/repo",
    "branch": "main",
    "username": "token_or_username",
    "password": "password_if_not_token"
  }'
```

### Generate Artifacts

```bash
curl -X POST http://localhost:4000/api/artifacts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "customers",
    "pushToGitHub": true
  }'
```

This documentation provides a comprehensive overview of the backend system, including all controllers, routes, models, services, and their purposes. It should help new developers understand the codebase quickly and enable the existing team to better understand their own code for tackling complex issues.
