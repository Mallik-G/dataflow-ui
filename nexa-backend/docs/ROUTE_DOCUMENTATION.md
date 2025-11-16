# Route Documentation

## Overview

Routes define the API endpoints and map HTTP requests to controller functions. The routing system is organized into multiple route files for better maintainability and separation of concerns.

## Route Structure

### Main Route Files

- `routes/index.js` - Central router and main route definitions
- `routes/file.js` - File management and data transformation routes
- `routes/consumptionArtifacts.js` - Consumption artifact routes
- `routes/consumptionETLTransformations.js` - Consumption ETL transformation routes
- `routes/workspaceCode.js` - Workspace code management routes

## Main Router (`routes/index.js`)

**Purpose**: Central router that mounts other route modules and defines main API routes.

### Route Mounting

```javascript
router.use('/api', fileRoutes);
router.use('/api/api/consumption-etl', consumptionETLTransformationsRoutes);
router.use('/api/api/workspace-code', workspaceCodeRoutes);
router.use('/api/api/consumption-artifacts', consumptionArtifactsRoutes);
```

### Direct Routes

- `GET /api/curated/columns/all` - Get all curated file columns
  - **Controller**: `transformationController.getAllCuratedFileColumns`
  - **Purpose**: Extracts all column headers from local curated CSV files

## File Routes (`routes/file.js`)

**Purpose**: Comprehensive file management, schema operations, and data transformation routes.

### File Upload and Schema Extraction

#### `POST /upload`

- **Purpose**: Upload file to S3 and optionally save raw schema
- **Controller**: `fileController.uploadFile`
- **Middleware**: `fileUploadS3`
- **Parameters**:
  - `file`: Multipart file upload
  - `entityName`: Name of the entity
  - `saveSchema`: Boolean flag to save schema
- **Response**: File upload details and optional schema information

#### `POST /extract-schema`

- **Purpose**: Extract schema from file buffer without S3 upload
- **Controller**: `fileController.extractSchema`
- **Middleware**: `fileUploadBuffer`
- **Parameters**:
  - `file`: Multipart file upload
  - `entityName`: Name of the entity
- **Response**: Extracted schema attributes and metadata

### Raw File Schema Management

#### `POST /api/raw-schemas/save`

- **Purpose**: Save raw file schema to database
- **Controller**: `rawFileSchemaController.saveRawFileSchema`
- **Parameters**:
  - `entityName`: Name of the entity
  - `fileName`: Name of the file
  - `fileKey`: S3 key of the file
  - `schemaAttributes`: Array of schema attributes (optional)
  - `schemaMetadata`: Schema metadata object (optional)
- **Response**: Saved schema object

#### `GET /api/raw-schemas/:entityName`

- **Purpose**: Get raw file schema by entity name
- **Controller**: `rawFileSchemaController.getRawFileSchema`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Schema object or null

#### `GET /api/raw-schemas`

- **Purpose**: Get all raw file schemas with filtering and pagination
- **Controller**: `rawFileSchemaController.getAllRawFileSchemas`
- **Query Parameters**:
  - `search`: Search term for entity name or file name
  - `status`: Filter by status (active, archived, deleted)
  - `createdBy`: Filter by creator
  - `page`: Page number for pagination (default: 1)
  - `limit`: Number of items per page (default: 15)
  - `sortBy`: Sort field (updated_at, created_at, worked_upon)
- **Response**: Paginated list of schemas with metadata

#### `PUT /api/raw-schemas/:entityName/status`

- **Purpose**: Update raw file schema status
- **Controller**: `rawFileSchemaController.updateRawFileSchemaStatus`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
  - `status`: New status value (request body)
- **Response**: Updated schema object

#### `DELETE /api/raw-schemas/:entityName`

- **Purpose**: Soft delete raw file schema
- **Controller**: `rawFileSchemaController.deleteRawFileSchema`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Success message

#### `GET /api/raw-schemas/stats`

- **Purpose**: Get raw file schema statistics
- **Controller**: `rawFileSchemaController.getRawFileSchemaStats`
- **Response**: Statistics object with counts by status

#### `POST /api/raw-schemas/extract`

- **Purpose**: Extract schema from file content
- **Controller**: `rawFileSchemaController.extractSchemaFromFile`
- **Parameters**:
  - `fileContent`: File content as string
  - `fileName`: Name of the file
  - `contentType`: MIME type of the file
- **Response**: Extracted schema attributes and metadata

#### `GET /api/raw-schemas/:entityName/control-columns`

- **Purpose**: Generate mock control columns for entity
- **Controller**: `rawFileSchemaController.generateControlColumns`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Array of control column objects

#### `GET /api/raw-schemas/:entityName/column-metadata`

- **Purpose**: Generate column metadata for entity
- **Controller**: `rawFileSchemaController.generateColumnMetadata`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Enhanced schema with data types and descriptions

### Consumption File Schema Management

#### `POST /api/consumption-schemas/save`

- **Purpose**: Save consumption file schema to database
- **Controller**: `consumptionFileSchemaController.saveConsumptionFileSchema`
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `fileName`: Name of the file
  - `fileKey`: S3 key of the file
  - `sourceEntities`: Array of source entity names
  - `joinRelationships`: Object describing join relationships
  - `transformations`: Transformation rules applied
- **Response**: Saved consumption schema object

#### `GET /api/consumption-schemas/:entityName`

- **Purpose**: Get consumption file schema by entity name
- **Controller**: `consumptionFileSchemaController.getConsumptionFileSchema`
- **Parameters**:
  - `entityName`: Name of the consumption entity (URL parameter)
- **Response**: Consumption schema object or null

#### `GET /api/consumption-schemas`

- **Purpose**: Get all consumption file schemas with filtering and pagination
- **Controller**: `consumptionFileSchemaController.getAllConsumptionFileSchemas`
- **Query Parameters**:
  - `search`: Search term for entity name or file name
  - `status`: Filter by status
  - `createdBy`: Filter by creator
  - `page`: Page number for pagination
  - `limit`: Number of items per page
- **Response**: Paginated list of consumption schemas

#### `PUT /api/consumption-schemas/:entityName/status`

- **Purpose**: Update consumption file schema status
- **Controller**: `consumptionFileSchemaController.updateConsumptionFileSchemaStatus`
- **Parameters**:
  - `entityName`: Name of the consumption entity (URL parameter)
  - `status`: New status value (request body)
- **Response**: Updated consumption schema object

#### `DELETE /api/consumption-schemas/:entityName`

- **Purpose**: Soft delete consumption file schema
- **Controller**: `consumptionFileSchemaController.deleteConsumptionFileSchema`
- **Parameters**:
  - `entityName`: Name of the consumption entity (URL parameter)
- **Response**: Success message

#### `GET /api/consumption-schemas/stats`

- **Purpose**: Get consumption file schema statistics
- **Controller**: `consumptionFileSchemaController.getConsumptionFileSchemaStats`
- **Response**: Statistics object with counts by status

#### `POST /api/consumption-schemas/extract`

- **Purpose**: Extract schema from consumption file content
- **Controller**: `consumptionFileSchemaController.extractSchemaFromFile`
- **Parameters**:
  - `fileContent`: File content as string
  - `fileName`: Name of the file
  - `contentType`: MIME type of the file
- **Response**: Extracted schema attributes and metadata

### File Operations

#### `GET /documents`

- **Purpose**: List all files from S3
- **Controller**: `fileController.getAllDocuments`
- **Response**: Array of file objects from S3

#### `GET /api/file/:key`

- **Purpose**: Get specific file from S3
- **Controller**: `fileController.getFile`
- **Parameters**:
  - `key`: S3 object key (URL parameter)
- **Response**: File content or download link

#### `PUT /api/file/rename`

- **Purpose**: Rename file in S3
- **Controller**: `fileController.renameFile`
- **Parameters**:
  - `oldKey`: Current S3 key
  - `newKey`: New S3 key
- **Response**: Success message with new file details

### Data Transformation

#### `POST /api/transformations/save`

- **Purpose**: Save transformation metadata (legacy endpoint)
- **Controller**: `transformationController.transformData`
- **Parameters**: Transformation data object
- **Response**: Success message
- **Note**: This endpoint only saves metadata, doesn't generate files

#### `POST /api/transformations/save-mappings`

- **Purpose**: Save transformations for both curated and consumption
- **Controller**: `transformationController.saveTransformations`
- **Parameters**: Complete transformation object
- **Response**: Success response with saved transformation

#### `GET /api/transformations/:entityName`

- **Purpose**: Get saved transformations for entity
- **Controller**: `transformationController.getSavedTransformations`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Transformation data or empty object

#### `POST /api/curated/generate`

- **Purpose**: Generate curated file from raw data
- **Controller**: `transformationController.generateCuratedFile`
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Transformation rules object
- **Response**: Success response with generated file details

#### `POST /api/consumption/generate`

- **Purpose**: Generate consumption file from gold data
- **Controller**: `transformationController.generateConsumptionFile`
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Consumption transformation rules
- **Response**: Success response with generated file details

#### `GET /api/transformations`

- **Purpose**: Get all transformations with filtering
- **Controller**: `transformationController.getAllTransformations`
- **Query Parameters**:
  - `entityName`: Filter by entity name
  - `fileType`: Filter by file type (curated, consumption)
  - `status`: Filter by status
- **Response**: Array of transformation objects

#### `PUT /api/transformations/:entityName/status`

- **Purpose**: Update transformation status
- **Controller**: `transformationController.updateTransformationStatus`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
  - `status`: New status value (request body)
- **Response**: Success response with updated transformation

#### `DELETE /api/transformations/:entityName`

- **Purpose**: Delete transformation
- **Controller**: `transformationController.deleteTransformation`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Success message

#### `GET /api/transformations/stats`

- **Purpose**: Get transformation statistics
- **Controller**: `transformationController.getTransformationStats`
- **Response**: Statistics object with counts by status and type

### File Listing

#### `GET /api/curated/files`

- **Purpose**: List curated files from S3
- **Controller**: `transformationController.getCuratedFiles`
- **Response**: Array of curated file objects

#### `GET /api/consumption/files`

- **Purpose**: List consumption files from S3
- **Controller**: `transformationController.getConsumptionFiles`
- **Response**: Array of consumption file objects

#### `GET /api/gold/files`

- **Purpose**: List gold files from S3
- **Controller**: `transformationController.getGoldFiles`
- **Response**: Array of gold file objects

#### `GET /api/ai-consumption-files`

- **Purpose**: List AI-suggested consumption files
- **Controller**: `transformationController.getAIConsumptionFiles`
- **Query Parameters**:
  - `page`: Page number for pagination
  - `limit`: Number of items per page
  - `search`: Search term
- **Response**: Paginated list of AI-suggested consumption files

#### `GET /api/ai-curated-files`

- **Purpose**: List AI-suggested curated files
- **Controller**: `transformationController.getAICuratedFiles`
- **Response**: Array of AI-suggested curated files

#### `GET /api/consumption/files/:fileName/columns`

- **Purpose**: Get columns of a consumption file
- **Controller**: `transformationController.getConsumptionFileColumns`
- **Parameters**:
  - `fileName`: Name of the consumption file (URL parameter)
- **Response**: Array of column names

### Batch Projection Routes

#### `POST /api/batch-projections/test`

- **Purpose**: Test batch projection configuration
- **Controller**: `batchProjectionController.testProjection`
- **Parameters**:
  - `entityName`: Name of the entity
  - `selectedEntities`: Array of selected entities
  - `settings`: Projection settings
  - `output`: Output configuration
- **Response**: Test results with processed data

#### `POST /api/batch-projections/save`

- **Purpose**: Save batch projection settings
- **Controller**: `batchProjectionController.saveProjectionSettings`
- **Parameters**: Complete projection configuration object
- **Response**: Success response with saved projection

#### `GET /api/batch-projections`

- **Purpose**: Get all batch projection settings
- **Controller**: `batchProjectionController.getProjectionSettings`
- **Query Parameters**:
  - `status`: Filter by status
  - `entityName`: Filter by entity name
  - `createdBy`: Filter by creator
- **Response**: Array of projection configurations

#### `GET /api/batch-projections/stats`

- **Purpose**: Get projection statistics
- **Controller**: `batchProjectionController.getProjectionStats`
- **Response**: Statistics object with counts by status

#### `GET /api/batch-projections/:projectionId`

- **Purpose**: Get specific projection by ID
- **Controller**: `batchProjectionController.getProjectionById`
- **Parameters**:
  - `projectionId`: ID of the projection (URL parameter)
- **Response**: Projection configuration object

#### `PUT /api/batch-projections/:projectionId`

- **Purpose**: Update projection settings
- **Controller**: `batchProjectionController.updateProjectionSettings`
- **Parameters**:
  - `projectionId`: ID of the projection (URL parameter)
  - Update data object (request body)
- **Response**: Success response with updated projection

#### `PATCH /api/batch-projections/:projectionId/status`

- **Purpose**: Update projection status
- **Controller**: `batchProjectionController.updateProjectionStatus`
- **Parameters**:
  - `projectionId`: ID of the projection (URL parameter)
  - `status`: New status value (request body)
- **Response**: Success response with updated projection

#### `DELETE /api/batch-projections/:projectionId`

- **Purpose**: Delete batch projection settings
- **Controller**: `batchProjectionController.deleteProjectionSettings`
- **Parameters**:
  - `projectionId`: ID of the projection (URL parameter)
- **Response**: Success message

### GitHub Integration Routes

#### `POST /api/github/test`

- **Purpose**: Test GitHub connection
- **Controller**: `githubController.testGitHubConnection`
- **Parameters**:
  - `repositoryUrl`: GitHub repository URL
  - `branch`: Repository branch name
  - `username`: GitHub username or token
  - `password`: GitHub password (if using username/password)
- **Response**: Connection test results

#### `POST /api/github/test-write`

- **Purpose**: Test GitHub write permissions
- **Controller**: `githubController.testWritePermissions`
- **Parameters**: GitHub configuration object
- **Response**: Write permission test results

#### `POST /api/github/save`

- **Purpose**: Save GitHub connection
- **Controller**: `githubController.saveGitHubConnection`
- **Parameters**: GitHub configuration object
- **Response**: Success response with saved connection details

#### `PUT /api/github/update`

- **Purpose**: Update GitHub connection
- **Controller**: `githubController.updateGitHubConnection`
- **Parameters**:
  - `connectionId`: ID of connection to update
  - Updated configuration object
- **Response**: Success response with updated connection

#### `POST /api/github/repository-info`

- **Purpose**: Get repository information
- **Controller**: `githubController.getRepositoryInfo`
- **Parameters**:
  - `repositoryUrl`: GitHub repository URL
  - `username`: GitHub username or token
  - `password`: GitHub password (if using username/password)
- **Response**: Repository information object

#### `POST /api/github/branches`

- **Purpose**: List repository branches
- **Controller**: `githubController.listBranches`
- **Parameters**:
  - `repositoryUrl`: GitHub repository URL
  - `username`: GitHub username or token
  - `password`: GitHub password (if using username/password)
- **Response**: Array of branch objects

#### `GET /api/github/active`

- **Purpose**: Get active GitHub connection
- **Controller**: `githubController.getActiveConnection`
- **Response**: Active connection object with decrypted password

#### `GET /api/github/connection`

- **Purpose**: Alias for getActiveConnection
- **Controller**: `githubController.getActiveConnection`
- **Response**: Active connection object

#### `GET /api/github/debug`

- **Purpose**: Debug endpoint to list all GitHub connections
- **Controller**: `githubController.getAllConnections`
- **Response**: Array of all GitHub connections

#### `GET /api/github/file`

- **Purpose**: Get file content from GitHub
- **Controller**: `githubController.getFileContent`
- **Query Parameters**:
  - `path`: File path in repository
  - `branch`: Repository branch
- **Response**: File content

#### `DELETE /api/github/reset`

- **Purpose**: Reset active GitHub connection
- **Controller**: `githubController.resetConnection`
- **Response**: Success message with deletion count

### Artifact Generation Routes

#### `POST /api/artifacts/generate`

- **Purpose**: Generate all data engineering artifacts
- **Controller**: `artifactController.generateAllArtifacts`
- **Parameters**:
  - `entityName`: Name of the entity
  - `pushToGitHub`: Boolean flag for GitHub push
- **Response**: Success response with generated artifacts

#### `POST /api/artifacts/diff`

- **Purpose**: Generate diff between existing and new artifacts
- **Controller**: `artifactController.generateArtifactsDiff`
- **Parameters**:
  - `entityName`: Name of the entity
- **Response**: Diff information with previous versions

#### `POST /api/artifacts/generate-all-diffs`

- **Purpose**: Generate diffs for multiple entities
- **Controller**: `artifactController.generateAllDiffs`
- **Parameters**:
  - `entityNames`: Array of entity names
- **Response**: Array of diff information for each entity

#### `POST /api/artifacts/push-to-github`

- **Purpose**: Push artifacts to GitHub
- **Controller**: `artifactController.pushArtifactsToGitHub`
- **Parameters**:
  - `entityName`: Name of the entity
  - `artifacts`: Generated artifacts object
- **Response**: Success response with commit details

#### `POST /api/artifacts/push-all-to-github`

- **Purpose**: Push all artifacts to GitHub in single commit
- **Controller**: `artifactController.pushAllArtifactsToGitHub`
- **Parameters**:
  - `entityNames`: Array of entity names
  - `newBranchName`: Optional new branch name
  - `createPR`: Boolean flag to create pull request
- **Response**: Success response with commit and PR details

### NLP Artifact Routes

#### `POST /api/nlp-artifacts`

- **Purpose**: Save accepted NLP artifact
- **Controller**: `nlpArtifactController.saveNLPArtifact`
- **Parameters**:
  - `entityName`: Name of the entity
  - `artifactType`: Type of artifact (sql, pyspark)
  - `code`: Generated code
  - `description`: Description of the artifact
  - `columns`: Array of column names
- **Response**: Success response with saved artifact

#### `GET /api/nlp-artifacts`

- **Purpose**: Get all NLP artifacts with pagination
- **Controller**: `nlpArtifactController.getAllNLPArtifacts`
- **Query Parameters**:
  - `status`: Filter by status
  - `page`: Page number for pagination
  - `limit`: Number of items per page
- **Response**: Paginated list of NLP artifacts

#### `GET /api/nlp-artifacts/stats`

- **Purpose**: Get NLP artifacts statistics
- **Controller**: `nlpArtifactController.getNLPArtifactsStats`
- **Response**: Statistics object with counts by status and entity

#### `GET /api/nlp-artifacts/entity/:entityName`

- **Purpose**: Get NLP artifacts for specific entity
- **Controller**: `nlpArtifactController.getNLPArtifactsByEntity`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Array of NLP artifacts for the entity

#### `GET /api/nlp-artifacts/:id`

- **Purpose**: Get specific NLP artifact by ID
- **Controller**: `nlpArtifactController.getNLPArtifactById`
- **Parameters**:
  - `id`: ID of the artifact (URL parameter)
- **Response**: NLP artifact object

#### `PUT /api/nlp-artifacts/:id`

- **Purpose**: Update NLP artifact
- **Controller**: `nlpArtifactController.updateNLPArtifact`
- **Parameters**:
  - `id`: ID of the artifact (URL parameter)
  - Updated artifact data (request body)
- **Response**: Success response with updated artifact

#### `DELETE /api/nlp-artifacts/:id`

- **Purpose**: Delete NLP artifact
- **Controller**: `nlpArtifactController.deleteNLPArtifact`
- **Parameters**:
  - `id`: ID of the artifact (URL parameter)
- **Response**: Success message

## Consumption Artifact Routes (`routes/consumptionArtifacts.js`)

**Purpose**: Routes for generating and managing consumption-layer artifacts.

### Route Mounting

```javascript
router.use('/api/api/consumption-artifacts', consumptionArtifactsRoutes);
```

### Routes

#### `POST /generate`

- **Purpose**: Generate consumption artifacts
- **Controller**: `consumptionArtifactController.generateConsumptionArtifacts`
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `pushToGitHub`: Boolean flag for GitHub push
- **Response**: Success response with generated consumption artifacts

#### `POST /generate-diffs`

- **Purpose**: Generate consumption diffs for GitHub integration
- **Controller**: `consumptionArtifactController.generateConsumptionDiffs`
- **Parameters**:
  - `entityName`: Name of the consumption entity
- **Response**: Diff information for consumption artifacts

#### `GET /stored`

- **Purpose**: Get stored consumption artifacts for entity
- **Controller**: `consumptionArtifactController.getStoredConsumptionArtifacts`
- **Query Parameters**:
  - `entityName`: Name of the consumption entity
- **Response**: Mock stored consumption artifacts

## Consumption ETL Transformation Routes (`routes/consumptionETLTransformations.js`)

**Purpose**: Routes for managing consumption ETL transformations.

### Route Mounting

```javascript
router.use('/api/api/consumption-etl', consumptionETLTransformationsRoutes);
```

### Routes

#### `POST /save`

- **Purpose**: Save consumption ETL transformation
- **Controller**: `consumptionETLTransformationController.saveConsumptionETLTransformation`
- **Parameters**:
  - `entityName`: Name of the entity
  - `columnName`: Name of the column
  - `transformationType`: Type of transformation
  - `rules`: Transformation rules
  - `code`: Generated code
- **Response**: Success response with saved transformation

#### `GET /entity/:entityName`

- **Purpose**: Get all transformations for entity
- **Controller**: `consumptionETLTransformationController.getConsumptionETLTransformationsByEntity`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Array of ETL transformations for the entity

#### `GET /entity/:entityName/column/:columnName`

- **Purpose**: Get transformations for specific entity and column
- **Controller**: `consumptionETLTransformationController.getConsumptionETLTransformationsByEntityAndColumn`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
  - `columnName`: Name of the column (URL parameter)
- **Response**: Array of ETL transformations for the entity/column

#### `GET /all`

- **Purpose**: Get all consumption ETL transformations
- **Controller**: `consumptionETLTransformationController.getAllConsumptionETLTransformations`
- **Response**: Array of all ETL transformations

#### `PUT /:id/status`

- **Purpose**: Update transformation status
- **Controller**: `consumptionETLTransformationController.updateConsumptionETLTransformationStatus`
- **Parameters**:
  - `id`: ID of the transformation (URL parameter)
  - `status`: New status value (request body)
- **Response**: Success response with updated transformation

#### `DELETE /:id`

- **Purpose**: Delete transformation
- **Controller**: `consumptionETLTransformationController.deleteConsumptionETLTransformation`
- **Parameters**:
  - `id`: ID of the transformation (URL parameter)
- **Response**: Success message

## Workspace Code Routes (`routes/workspaceCode.js`)

**Purpose**: Routes for managing workspace code snippets.

### Route Mounting

```javascript
router.use('/api/api/workspace-code', workspaceCodeRoutes);
```

### Routes

#### `POST /save`

- **Purpose**: Save workspace code
- **Controller**: `workspaceCodeController.saveWorkspaceCode`
- **Parameters**:
  - `entityName`: Name of the entity
  - `codeType`: Type of code (sql, pyspark)
  - `code`: Code content
  - `description`: Description of the code
  - `tags`: Array of tags
- **Response**: Success response with saved code

#### `GET /entity/:entityName`

- **Purpose**: Get workspace codes by entity
- **Controller**: `workspaceCodeController.getWorkspaceCodesByEntity`
- **Parameters**:
  - `entityName`: Name of the entity (URL parameter)
- **Response**: Array of workspace codes for the entity

#### `GET /all`

- **Purpose**: Get all workspace codes
- **Controller**: `workspaceCodeController.getAllWorkspaceCodes`
- **Response**: Array of all workspace codes

#### `PUT /update/:id`

- **Purpose**: Update workspace code
- **Controller**: `workspaceCodeController.updateWorkspaceCode`
- **Parameters**:
  - `id`: ID of the workspace code (URL parameter)
  - Updated code data (request body)
- **Response**: Success response with updated code

#### `DELETE /delete/:id`

- **Purpose**: Delete workspace code
- **Controller**: `workspaceCodeController.deleteWorkspaceCode`
- **Parameters**:
  - `id`: ID of the workspace code (URL parameter)
- **Response**: Success message

## Route Patterns and Conventions

### URL Structure

- **Base Path**: `/api` for main API routes
- **Nested Paths**: `/api/api/` for specialized route groups
- **Resource-based**: Routes follow RESTful conventions where possible
- **Parameter-based**: Entity names and IDs passed as URL parameters

### HTTP Methods

- **GET**: Retrieve data
- **POST**: Create new resources
- **PUT**: Update existing resources
- **PATCH**: Partial updates (status changes)
- **DELETE**: Remove resources

### Response Format

All routes follow a consistent response format:

**Success Response**:

```json
{
  "success": true,
  "data": {...},
  "message": "Success message"
}
```

**Error Response**:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

### Query Parameters

- **Pagination**: `page`, `limit`, `offset`
- **Filtering**: `status`, `createdBy`, `entityName`
- **Search**: `search` for text-based searching
- **Sorting**: `sortBy` for custom sorting

### Middleware Usage

- **File Upload**: `fileUploadS3`, `fileUploadBuffer` for file handling
- **Authentication**: JWT middleware for protected routes
- **Validation**: Input validation middleware
- **CORS**: Cross-origin request handling

### Error Handling

- **400 Bad Request**: Invalid input parameters
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation errors
- **500 Internal Server Error**: Server-side errors

### Rate Limiting

- GitHub API routes include rate limiting considerations
- File upload routes have size limits (50MB)
- Database queries use pagination to prevent large result sets

### Security Considerations

- **Input Validation**: All routes validate input parameters
- **SQL Injection Prevention**: Uses Sequelize ORM with parameterized queries
- **File Upload Security**: Validates file types and sizes
- **GitHub Credentials**: Encrypts stored credentials
- **CORS Configuration**: Restricts cross-origin requests
