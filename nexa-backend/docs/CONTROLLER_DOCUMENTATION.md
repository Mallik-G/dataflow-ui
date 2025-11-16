# Controller Documentation

## Overview

Controllers handle HTTP requests and responses, containing the business logic for each API endpoint. They interact with services and models to process data and return appropriate responses.

## TransformationController

**File**: `controllers/transformationController.js`

**Purpose**: Handles data transformation logic, file generation, and transformation management.

### Key Functions

#### `applyNLPTransformations(value, rules)`

- **Purpose**: Applies NLP transformation rules to data values
- **Parameters**:
  - `value` (string): The data value to transform
  - `rules` (array): Array of NLP rules to apply
- **Returns**: Transformed value
- **Rules Supported**:
  - `uppercase`: Convert to uppercase
  - `lowercase`: Convert to lowercase
  - `trim`: Remove leading/trailing whitespace

#### `applyDataQualityChecks(value, rules)`

- **Purpose**: Applies data quality validation rules
- **Parameters**:
  - `value` (string): The data value to validate
  - `rules` (array): Array of DQ rules to apply
- **Returns**: Validation result object
- **Rules Supported**:
  - `not_null`: Check for null/empty values
  - `email_format`: Validate email format
  - `numeric_only`: Check if value is numeric

#### `applyOperatorRules(value, rules)`

- **Purpose**: Applies operator-based validation rules
- **Parameters**:
  - `value` (string): The data value to validate
  - `rules` (array): Array of operator rules
- **Returns**: Validation result object
- **Rules Supported**:
  - `greater_than`: Check if value > threshold
  - `less_than`: Check if value < threshold
  - `not_equals`: Check if value != threshold

#### `applyConcatenationRules(row, rules)`

- **Purpose**: Concatenates columns based on rules
- **Parameters**:
  - `row` (object): Data row object
  - `rules` (array): Array of concatenation rules
- **Returns**: Row with concatenated values
- **Rule Format**: `{sourceColumns: ['col1', 'col2'], targetColumn: 'new_col', separator: ' '}`

#### `transformData(req, res)`

- **Purpose**: Legacy endpoint for saving transformation metadata
- **Method**: POST
- **Route**: `/api/transformations/save`
- **Parameters**: Request body with transformation data
- **Returns**: Success/error response
- **Note**: This endpoint only saves metadata, doesn't generate files

#### `generateCuratedFile(req, res)`

- **Purpose**: Generates curated CSV file from raw data
- **Method**: POST
- **Route**: `/api/curated/generate`
- **Process**:
  1. Downloads raw file from S3
  2. Applies transformation rules (mappings, NLP, DQ, operators, concatenations, new columns)
  3. Generates curated CSV
  4. Uploads to S3 under `curated/` prefix
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Transformation rules object
- **Returns**: Success response with file details

#### `generateConsumptionFile(req, res)`

- **Purpose**: Generates consumption CSV file from gold data
- **Method**: POST
- **Route**: `/api/consumption/generate`
- **Process**:
  1. Downloads gold file from S3 (or uses local data)
  2. Applies consumption transformations
  3. Generates consumption CSV
  4. Uploads to S3 under `consumption/` prefix
  5. Saves consumption file schema to database
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Consumption transformation rules
- **Returns**: Success response with file details

#### `getSavedTransformations(req, res)`

- **Purpose**: Retrieves saved transformations from database
- **Method**: GET
- **Route**: `/api/transformations/:entityName`
- **Parameters**:
  - `entityName`: Name of the entity
- **Returns**: Transformation data or empty object

#### `getCuratedFiles(req, res)`

- **Purpose**: Lists curated files from S3
- **Method**: GET
- **Route**: `/api/curated/files`
- **Returns**: Array of curated file objects

#### `getAllCuratedFileColumns(req, res)`

- **Purpose**: Extracts all column headers from local curated CSV files
- **Method**: GET
- **Route**: `/api/curated/columns/all`
- **Process**: Reads local CSV files and extracts unique column names
- **Returns**: Array of unique column names

#### `getConsumptionFiles(req, res)`

- **Purpose**: Lists consumption files from S3
- **Method**: GET
- **Route**: `/api/consumption/files`
- **Returns**: Array of consumption file objects

#### `saveTransformations(req, res)`

- **Purpose**: Saves transformation metadata to database
- **Method**: POST
- **Route**: `/api/transformations/save-mappings`
- **Parameters**: Complete transformation object
- **Returns**: Success response with saved transformation

#### `getAIConsumptionFiles(req, res)`

- **Purpose**: Simulates AI generation of consumption files
- **Method**: GET
- **Route**: `/api/ai-consumption-files`
- **Process**: Reads local CSVs from `data/consumptionfiles` and adds metadata
- **Features**: Pagination, search, filtering
- **Returns**: Paginated list of AI-suggested consumption files

#### `getAICuratedFiles(req, res)`

- **Purpose**: Simulates AI generation of curated files
- **Method**: GET
- **Route**: `/api/ai-curated-files`
- **Process**: Reads local CSVs from `data/curatedfiles` and adds metadata
- **Returns**: Array of AI-suggested curated files

#### `getConsumptionFileColumns(req, res)`

- **Purpose**: Extracts column headers from a specific consumption file
- **Method**: GET
- **Route**: `/api/consumption/files/:fileName/columns`
- **Parameters**:
  - `fileName`: Name of the consumption file
- **Returns**: Array of column names

## RawFileSchemaController

**File**: `controllers/rawFileSchemaController.js`

**Purpose**: Manages raw file schema operations including CRUD operations and schema extraction.

### Key Functions

#### `saveRawFileSchema(req, res)`

- **Purpose**: Saves raw file schema to database
- **Method**: POST
- **Route**: `/api/raw-schemas/save`
- **Process**:
  1. Validates required parameters
  2. If schema attributes not provided, extracts from S3 file
  3. Saves/updates schema in database
- **Parameters**:
  - `entityName`: Name of the entity
  - `fileName`: Name of the file
  - `fileKey`: S3 key of the file
  - `schemaAttributes`: Array of schema attributes (optional)
  - `schemaMetadata`: Schema metadata object (optional)
- **Returns**: Success response with saved schema

#### `getRawFileSchema(req, res)`

- **Purpose**: Retrieves raw file schema by entity name
- **Method**: GET
- **Route**: `/api/raw-schemas/:entityName`
- **Parameters**:
  - `entityName`: Name of the entity
- **Returns**: Schema object or null if not found

#### `getAllRawFileSchemas(req, res)`

- **Purpose**: Retrieves all raw file schemas with filtering and pagination
- **Method**: GET
- **Route**: `/api/raw-schemas`
- **Query Parameters**:
  - `search`: Search term for entity name or file name
  - `status`: Filter by status
  - `createdBy`: Filter by creator
  - `page`: Page number for pagination
  - `limit`: Number of items per page
  - `sortBy`: Sort field (updated_at, created_at, worked_upon)
- **Features**:
  - Pagination support
  - Search functionality
  - Status filtering
  - Sorting options
  - Integration with transformation data
- **Returns**: Paginated list of schemas with metadata

#### `updateRawFileSchemaStatus(req, res)`

- **Purpose**: Updates the status of a raw file schema
- **Method**: PUT
- **Route**: `/api/raw-schemas/:entityName/status`
- **Parameters**:
  - `entityName`: Name of the entity
  - `status`: New status value
- **Returns**: Success response with updated schema

#### `deleteRawFileSchema(req, res)`

- **Purpose**: Soft deletes a raw file schema
- **Method**: DELETE
- **Route**: `/api/raw-schemas/:entityName`
- **Parameters**:
  - `entityName`: Name of the entity
- **Process**: Sets status to 'deleted' instead of removing record
- **Returns**: Success response

#### `getRawFileSchemaStats(req, res)`

- **Purpose**: Retrieves statistics about raw file schemas
- **Method**: GET
- **Route**: `/api/raw-schemas/stats`
- **Returns**: Statistics object with counts by status

#### `extractSchemaFromFile(req, res)`

- **Purpose**: Utility endpoint to extract schema from file content
- **Method**: POST
- **Route**: `/api/raw-schemas/extract`
- **Parameters**:
  - `fileContent`: File content as string
  - `fileName`: Name of the file
  - `contentType`: MIME type of the file
- **Returns**: Extracted schema attributes and metadata

#### `generateControlColumns(req, res)`

- **Purpose**: Generates mock LLM-suggested control columns
- **Method**: GET
- **Route**: `/api/raw-schemas/:entityName/control-columns`
- **Parameters**:
  - `entityName`: Name of the entity
- **Process**: Generates control columns based on entity type
- **Returns**: Array of control column objects

#### `generateColumnMetadata(req, res)`

- **Purpose**: Generates data types and descriptions for columns
- **Method**: GET
- **Route**: `/api/raw-schemas/:entityName/column-metadata`
- **Parameters**:
  - `entityName`: Name of the entity
- **Process**: Analyzes existing schema and generates metadata
- **Returns**: Enhanced schema with data types and descriptions

## ConsumptionFileSchemaController

**File**: `controllers/consumptionFileSchemaController.js`

**Purpose**: Manages consumption file schema operations for the consumption layer.

### Key Functions

#### `saveConsumptionFileSchema(req, res)`

- **Purpose**: Saves consumption file schema to database
- **Method**: POST
- **Route**: `/api/consumption-schemas/save`
- **Process**:
  1. Validates required parameters
  2. If schema attributes not provided, extracts from S3 file
  3. Saves/updates consumption schema in database
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `fileName`: Name of the file
  - `fileKey`: S3 key of the file
  - `sourceEntities`: Array of source entity names
  - `joinRelationships`: Object describing join relationships
  - `transformations`: Transformation rules applied
- **Returns**: Success response with saved schema

#### `getConsumptionFileSchema(req, res)`

- **Purpose**: Retrieves consumption file schema by entity name
- **Method**: GET
- **Route**: `/api/consumption-schemas/:entityName`
- **Parameters**:
  - `entityName`: Name of the consumption entity
- **Returns**: Consumption schema object or null if not found

#### `getAllConsumptionFileSchemas(req, res)`

- **Purpose**: Retrieves all consumption file schemas with filtering and pagination
- **Method**: GET
- **Route**: `/api/consumption-schemas`
- **Query Parameters**:
  - `search`: Search term for entity name or file name
  - `status`: Filter by status
  - `createdBy`: Filter by creator
  - `page`: Page number for pagination
  - `limit`: Number of items per page
- **Returns**: Paginated list of consumption schemas

#### `updateConsumptionFileSchemaStatus(req, res)`

- **Purpose**: Updates the status of a consumption file schema
- **Method**: PUT
- **Route**: `/api/consumption-schemas/:entityName/status`
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `status`: New status value
- **Returns**: Success response with updated schema

#### `deleteConsumptionFileSchema(req, res)`

- **Purpose**: Soft deletes a consumption file schema
- **Method**: DELETE
- **Route**: `/api/consumption-schemas/:entityName`
- **Parameters**:
  - `entityName`: Name of the consumption entity
- **Returns**: Success response

#### `getConsumptionFileSchemaStats(req, res)`

- **Purpose**: Retrieves statistics about consumption file schemas
- **Method**: GET
- **Route**: `/api/consumption-schemas/stats`
- **Returns**: Statistics object with counts by status

#### `extractSchemaFromFile(req, res)`

- **Purpose**: Utility endpoint to extract schema from consumption file content
- **Method**: POST
- **Route**: `/api/consumption-schemas/extract`
- **Parameters**:
  - `fileContent`: File content as string
  - `fileName`: Name of the file
  - `contentType`: MIME type of the file
- **Returns**: Extracted schema attributes and metadata

## BatchProjectionController

**File**: `controllers/batchProjectionController.js`

**Purpose**: Manages batch projection operations including testing, configuration, and execution.

### Key Functions

#### `readCSVFromS3(bucket, key)`

- **Purpose**: Helper function to read CSV data from S3
- **Parameters**:
  - `bucket`: S3 bucket name
  - `key`: S3 object key
- **Returns**: Parsed CSV data as array of objects

#### `readAIData(entityName)`

- **Purpose**: Helper function to read AI-generated data
- **Parameters**:
  - `entityName`: Name of the entity
- **Special Handling**:
  - `gold_customers_360`: Joins multiple local CSV files
  - `products_360`: Joins multiple local CSV files
- **Returns**: Parsed data as array of objects

#### `convertToFormat(data, format, compression)`

- **Purpose**: Helper function to convert data to different formats
- **Parameters**:
  - `data`: Array of data objects
  - `format`: Output format (csv, json, parquet)
  - `compression`: Compression type (gzip, zip, none)
- **Returns**: Converted data in specified format

#### `testProjection(req, res)`

- **Purpose**: Tests a batch projection configuration
- **Method**: POST
- **Route**: `/api/batch-projections/test`
- **Process**:
  1. Reads data from specified sources (S3 or AI)
  2. Applies attribute filtering
  3. Converts to desired output format
  4. Uploads results to S3 under `projections/` prefix
- **Parameters**:
  - `entityName`: Name of the entity
  - `selectedEntities`: Array of selected entities
  - `settings`: Projection settings
  - `output`: Output configuration
- **Returns**: Success response with test results

#### `saveProjectionSettings(req, res)`

- **Purpose**: Saves batch projection configuration to database
- **Method**: POST
- **Route**: `/api/batch-projections/save`
- **Parameters**: Complete projection configuration object
- **Returns**: Success response with saved projection

#### `getProjectionSettings(req, res)`

- **Purpose**: Retrieves all batch projection configurations
- **Method**: GET
- **Route**: `/api/batch-projections`
- **Query Parameters**:
  - `status`: Filter by status
  - `entityName`: Filter by entity name
  - `createdBy`: Filter by creator
- **Returns**: Array of projection configurations

#### `deleteProjectionSettings(req, res)`

- **Purpose**: Deletes batch projection configuration
- **Method**: DELETE
- **Route**: `/api/batch-projections/:projectionId`
- **Parameters**:
  - `projectionId`: ID of the projection
- **Returns**: Success response

#### `getProjectionById(req, res)`

- **Purpose**: Retrieves a specific batch projection by ID
- **Method**: GET
- **Route**: `/api/batch-projections/:projectionId`
- **Parameters**:
  - `projectionId`: ID of the projection
- **Returns**: Projection configuration object

#### `updateProjectionSettings(req, res)`

- **Purpose**: Updates batch projection configuration
- **Method**: PUT
- **Route**: `/api/batch-projections/:projectionId`
- **Parameters**:
  - `projectionId`: ID of the projection
  - Update data object
- **Returns**: Success response with updated projection

#### `updateProjectionStatus(req, res)`

- **Purpose**: Updates the status of a batch projection
- **Method**: PATCH
- **Route**: `/api/batch-projections/:projectionId/status`
- **Parameters**:
  - `projectionId`: ID of the projection
  - `status`: New status value
- **Returns**: Success response with updated projection

#### `getProjectionStats(req, res)`

- **Purpose**: Retrieves statistics about batch projections
- **Method**: GET
- **Route**: `/api/batch-projections/stats`
- **Returns**: Statistics object with counts by status

## GitHubController

**File**: `controllers/githubController.js`

**Purpose**: Handles GitHub integration operations including connection testing, repository management, and credential handling.

### Key Functions

#### `testGitHubConnection(req, res)`

- **Purpose**: Tests GitHub connection with provided credentials
- **Method**: POST
- **Route**: `/api/github/test`
- **Process**:
  1. Validates repository URL format
  2. Tests authentication (token or username/password)
  3. Verifies repository access
  4. Checks branch existence
  5. Tests repository contents access
- **Parameters**:
  - `repositoryUrl`: GitHub repository URL
  - `branch`: Repository branch name
  - `username`: GitHub username or token
  - `password`: GitHub password (if using username/password)
- **Returns**: Success response with connection details

#### `saveGitHubConnection(req, res)`

- **Purpose**: Saves GitHub connection configuration to database
- **Method**: POST
- **Route**: `/api/github/save`
- **Process**:
  1. Tests connection first
  2. Encrypts password if provided
  3. Deactivates existing active connections
  4. Saves new connection as active
- **Parameters**: GitHub configuration object
- **Returns**: Success response with saved connection details

#### `updateGitHubConnection(req, res)`

- **Purpose**: Updates existing GitHub connection
- **Method**: PUT
- **Route**: `/api/github/update`
- **Process**:
  1. Tests new configuration
  2. Updates connection details
  3. Preserves existing password if not changed
- **Parameters**:
  - `connectionId`: ID of connection to update
  - Updated configuration object
- **Returns**: Success response with updated connection

#### `getRepositoryInfo(req, res)`

- **Purpose**: Retrieves information about a GitHub repository
- **Method**: POST
- **Route**: `/api/github/repository-info`
- **Parameters**:
  - `repositoryUrl`: GitHub repository URL
  - `username`: GitHub username or token
  - `password`: GitHub password (if using username/password)
- **Returns**: Repository information object

#### `listBranches(req, res)`

- **Purpose**: Lists branches for a GitHub repository
- **Method**: POST
- **Route**: `/api/github/branches`
- **Parameters**:
  - `repositoryUrl`: GitHub repository URL
  - `username`: GitHub username or token
  - `password`: GitHub password (if using username/password)
- **Returns**: Array of branch objects

#### `testWritePermissions(req, res)`

- **Purpose**: Tests write permissions to GitHub repository
- **Method**: POST
- **Route**: `/api/github/test-write`
- **Process**:
  1. Checks repository permissions
  2. Tests branch access
  3. Attempts Git tree creation
- **Parameters**: GitHub configuration object
- **Returns**: Success response with permission details

#### `getActiveConnection(req, res)`

- **Purpose**: Retrieves the currently active GitHub connection
- **Method**: GET
- **Route**: `/api/github/active`
- **Process**: Decrypts password for return
- **Returns**: Active connection object with decrypted password

#### `resetConnection(req, res)`

- **Purpose**: Deactivates/deletes the current active GitHub connection
- **Method**: DELETE
- **Route**: `/api/github/reset`
- **Returns**: Success response with deletion count

## ArtifactController

**File**: `controllers/artifactController.js`

**Purpose**: Generates data engineering artifacts and manages GitHub integration for artifact deployment.

### Key Functions

#### `generateSQLCode(entityName, transformations)`

- **Purpose**: Generates SQL DDL and INSERT statements
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Transformation rules object
- **Returns**: SQL code string
- **Features**:
  - CREATE TABLE statement
  - INSERT statements with transformed data
  - NLP transformation integration

#### `generatePySparkCode(entityName, transformations)`

- **Purpose**: Generates PySpark data processing code
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Transformation rules object
- **Returns**: PySpark code string
- **Features**:
  - Data reading from S3
  - NLP transformations
  - Data quality checks
  - Operator rules
  - Concatenation rules
  - New column creation

#### `generateDockerfile(entityName)`

- **Purpose**: Generates Dockerfile for data pipeline
- **Parameters**:
  - `entityName`: Name of the entity
- **Returns**: Dockerfile content string

#### `generateCICDPipeline(entityName)`

- **Purpose**: Generates GitHub Actions CI/CD pipeline configuration
- **Parameters**:
  - `entityName`: Name of the entity
- **Returns**: YAML pipeline configuration

#### `generateDocumentation(entityName, transformations)`

- **Purpose**: Generates Markdown documentation for data pipeline
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Transformation rules object
- **Returns**: Markdown documentation string

#### `generateConfigFiles(entityName, transformations)`

- **Purpose**: Generates configuration files
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Transformation rules object
- **Returns**: Object with config.yaml and requirements.txt

#### `isControlColumn(columnName)`

- **Purpose**: Helper function to identify control columns
- **Parameters**:
  - `columnName`: Name of the column
- **Returns**: Boolean indicating if column is a control column

#### `pushArtifactsToGitHub(artifacts, githubConfig, folderPath)`

- **Purpose**: Helper function to push artifacts to GitHub
- **Parameters**:
  - `artifacts`: Generated artifacts object
  - `githubConfig`: GitHub configuration
  - `folderPath`: Target folder path in repository
- **Returns**: Success response with commit details

#### `generateDMLSQL(entityName, transformations)`

- **Purpose**: Generates DML SQL for insert, update, and soft delete operations
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Transformation rules object
- **Returns**: DML SQL code string

#### `generateDMLPySpark(entityName, transformations)`

- **Purpose**: Generates DML PySpark code for insert, update, and soft delete operations
- **Parameters**:
  - `entityName`: Name of the entity
  - `transformations`: Transformation rules object
- **Returns**: DML PySpark code string

#### `generateAllArtifacts(req, res)`

- **Purpose**: Orchestrates generation of all artifact types
- **Method**: POST
- **Route**: `/api/artifacts/generate`
- **Process**:
  1. Fetches accepted NLP artifacts from database
  2. Generates all artifact types (DDL, DML, NLP, config, docs, CI/CD, Dockerfile)
  3. Optionally pushes to GitHub
- **Parameters**:
  - `entityName`: Name of the entity
  - `pushToGitHub`: Boolean flag for GitHub push
- **Returns**: Success response with generated artifacts

#### `generateArtifactsDiff(req, res)`

- **Purpose**: Generates diff between newly generated and existing artifacts
- **Method**: POST
- **Route**: `/api/artifacts/diff`
- **Process**:
  1. Generates new artifacts
  2. Compares with existing files in GitHub
  3. Returns diff information
- **Parameters**:
  - `entityName`: Name of the entity
- **Returns**: Diff information with previous versions

#### `generateAllDiffs(req, res)`

- **Purpose**: Generates diffs for multiple entities simultaneously
- **Method**: POST
- **Route**: `/api/artifacts/generate-all-diffs`
- **Parameters**:
  - `entityNames`: Array of entity names
- **Returns**: Array of diff information for each entity

## NLPArtifactController

**File**: `controllers/nlpArtifactController.js`

**Purpose**: Manages NLP-generated code artifacts including storage, retrieval, and management.

### Key Functions

#### `saveNLPArtifact(req, res)`

- **Purpose**: Saves NLP artifact to database and file system
- **Method**: POST
- **Route**: `/api/nlp-artifacts`
- **Process**:
  1. Saves artifact to database
  2. Writes JSON file to `accepted_artifacts/<entityName>/nlp/`
- **Parameters**:
  - `entityName`: Name of the entity
  - `artifactType`: Type of artifact (sql, pyspark)
  - `code`: Generated code
  - `description`: Description of the artifact
  - `columns`: Array of column names
- **Returns**: Success response with saved artifact

#### `getNLPArtifactsByEntity(req, res)`

- **Purpose**: Retrieves all accepted NLP artifacts for a specific entity
- **Method**: GET
- **Route**: `/api/nlp-artifacts/entity/:entityName`
- **Parameters**:
  - `entityName`: Name of the entity
- **Returns**: Array of NLP artifacts for the entity

#### `getAllNLPArtifacts(req, res)`

- **Purpose**: Retrieves all NLP artifacts with optional filtering and pagination
- **Method**: GET
- **Route**: `/api/nlp-artifacts`
- **Query Parameters**:
  - `status`: Filter by status
  - `page`: Page number for pagination
  - `limit`: Number of items per page
- **Returns**: Paginated list of NLP artifacts

#### `getNLPArtifactById(req, res)`

- **Purpose**: Retrieves a specific NLP artifact by ID
- **Method**: GET
- **Route**: `/api/nlp-artifacts/:id`
- **Parameters**:
  - `id`: ID of the artifact
- **Returns**: NLP artifact object

#### `updateNLPArtifact(req, res)`

- **Purpose**: Updates an existing NLP artifact
- **Method**: PUT
- **Route**: `/api/nlp-artifacts/:id`
- **Process**:
  1. Updates database record
  2. Updates corresponding file
- **Parameters**:
  - `id`: ID of the artifact
  - Updated artifact data
- **Returns**: Success response with updated artifact

#### `deleteNLPArtifact(req, res)`

- **Purpose**: Soft deletes an NLP artifact
- **Method**: DELETE
- **Route**: `/api/nlp-artifacts/:id`
- **Parameters**:
  - `id`: ID of the artifact
- **Process**: Sets status to 'deleted'
- **Returns**: Success response

#### `getNLPArtifactsStats(req, res)`

- **Purpose**: Provides statistics on NLP artifacts
- **Method**: GET
- **Route**: `/api/nlp-artifacts/stats`
- **Returns**: Statistics object with counts by status and entity

## ConsumptionArtifactController

**File**: `controllers/consumptionArtifactController.js`

**Purpose**: Manages consumption-layer artifact generation and GitHub integration.

### Key Functions

#### `pushConsumptionArtifactsToGitHub(artifacts, githubConfig, folderPath)`

- **Purpose**: Helper function to push consumption artifacts to GitHub
- **Parameters**:
  - `artifacts`: Generated consumption artifacts
  - `githubConfig`: GitHub configuration
  - `folderPath`: Target folder path in repository
- **Returns**: Success response with commit details

#### `generateConsumptionArtifacts(req, res)`

- **Purpose**: Generates consumption artifacts and optionally pushes to GitHub
- **Method**: POST
- **Route**: `/api/api/consumption-artifacts/generate`
- **Process**:
  1. Generates SQL, PySpark, DML SQL, and DML PySpark code
  2. Optionally pushes to GitHub
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `pushToGitHub`: Boolean flag for GitHub push
- **Returns**: Success response with generated artifacts

#### `generateConsumptionDiffs(req, res)`

- **Purpose**: Generates diffs for consumption entities
- **Method**: POST
- **Route**: `/api/api/consumption-artifacts/generate-diffs`
- **Process**:
  1. Simulates comparison with existing files
  2. Optionally pushes to GitHub
- **Parameters**:
  - `entityName`: Name of the consumption entity
- **Returns**: Diff information

#### `getStoredConsumptionArtifacts(req, res)`

- **Purpose**: Returns mock stored consumption artifacts for an entity
- **Method**: GET
- **Route**: `/api/api/consumption-artifacts/stored`
- **Parameters**:
  - `entityName`: Name of the consumption entity
- **Returns**: Mock stored artifacts

#### `generateConsumptionSQLCode(entityName, transformations)`

- **Purpose**: Generates SQL DDL for consumption table and complex view
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `transformations`: Transformation rules object
- **Returns**: SQL code string with DDL and view

#### `generateComplexMappingView(entityName, transformations)`

- **Purpose**: Helper function to generate SQL view for M:1 mappings
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `transformations`: Transformation rules object
- **Returns**: SQL view code string

#### `generateConsumptionPySparkCode(entityName, transformations)`

- **Purpose**: Generates PySpark code for consumption data processing
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `transformations`: Transformation rules object
- **Returns**: PySpark code string

#### `generateConsumptionDMLSQL(entityName, transformations)`

- **Purpose**: Generates DML SQL for consumption entities
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `transformations`: Transformation rules object
- **Returns**: DML SQL code string

#### `generateConsumptionDMLPySpark(entityName, transformations)`

- **Purpose**: Generates DML PySpark code for consumption entities
- **Parameters**:
  - `entityName`: Name of the consumption entity
  - `transformations`: Transformation rules object
- **Returns**: DML PySpark code string

## ConsumptionETLTransformationController

**File**: `controllers/consumptionETLTransformationController.js`

**Purpose**: Manages consumption ETL transformations including storage and retrieval.

### Key Functions

#### `saveConsumptionETLTransformation(req, res)`

- **Purpose**: Saves consumption ETL transformation to database and file system
- **Method**: POST
- **Route**: `/api/api/consumption-etl/save`
- **Process**:
  1. Saves transformation to database
  2. Writes JSON file to `accepted_transformations/<entityName>/etl/`
- **Parameters**:
  - `entityName`: Name of the entity
  - `columnName`: Name of the column
  - `transformationType`: Type of transformation
  - `rules`: Transformation rules
  - `code`: Generated code
- **Returns**: Success response with saved transformation

#### `getConsumptionETLTransformationsByEntity(req, res)`

- **Purpose**: Retrieves all accepted ETL transformations for a specific entity
- **Method**: GET
- **Route**: `/api/api/consumption-etl/entity/:entityName`
- **Parameters**:
  - `entityName`: Name of the entity
- **Returns**: Array of ETL transformations for the entity

#### `getConsumptionETLTransformationsByEntityAndColumn(req, res)`

- **Purpose**: Retrieves ETL transformations for a specific entity and column
- **Method**: GET
- **Route**: `/api/api/consumption-etl/entity/:entityName/column/:columnName`
- **Parameters**:
  - `entityName`: Name of the entity
  - `columnName`: Name of the column
- **Returns**: Array of ETL transformations for the entity/column

#### `getAllConsumptionETLTransformations(req, res)`

- **Purpose**: Retrieves all accepted consumption ETL transformations
- **Method**: GET
- **Route**: `/api/api/consumption-etl/all`
- **Returns**: Array of all ETL transformations

#### `updateConsumptionETLTransformationStatus(req, res)`

- **Purpose**: Updates the status of a consumption ETL transformation
- **Method**: PUT
- **Route**: `/api/api/consumption-etl/:id/status`
- **Parameters**:
  - `id`: ID of the transformation
  - `status`: New status value
- **Returns**: Success response with updated transformation

#### `deleteConsumptionETLTransformation(req, res)`

- **Purpose**: Soft deletes a consumption ETL transformation
- **Method**: DELETE
- **Route**: `/api/api/consumption-etl/:id`
- **Parameters**:
  - `id`: ID of the transformation
- **Process**: Sets status to 'deleted'
- **Returns**: Success response

## WorkspaceCodeController

**File**: `controllers/workspaceCodeController.js`

**Purpose**: Manages workspace code snippets including CRUD operations.

### Key Functions

#### `saveWorkspaceCode(req, res)`

- **Purpose**: Saves a new workspace code entry to database
- **Method**: POST
- **Route**: `/api/api/workspace-code/save`
- **Parameters**:
  - `entityName`: Name of the entity
  - `codeType`: Type of code (sql, pyspark)
  - `code`: Code content
  - `description`: Description of the code
  - `tags`: Array of tags
- **Returns**: Success response with saved code

#### `getWorkspaceCodesByEntity(req, res)`

- **Purpose**: Retrieves workspace codes associated with a specific entity
- **Method**: GET
- **Route**: `/api/api/workspace-code/entity/:entityName`
- **Parameters**:
  - `entityName`: Name of the entity
- **Returns**: Array of workspace codes for the entity

#### `getAllWorkspaceCodes(req, res)`

- **Purpose**: Retrieves all saved workspace codes
- **Method**: GET
- **Route**: `/api/api/workspace-code/all`
- **Returns**: Array of all workspace codes

#### `updateWorkspaceCode(req, res)`

- **Purpose**: Updates an existing workspace code entry
- **Method**: PUT
- **Route**: `/api/api/workspace-code/update/:id`
- **Parameters**:
  - `id`: ID of the workspace code
  - Updated code data
- **Returns**: Success response with updated code

#### `deleteWorkspaceCode(req, res)`

- **Purpose**: Deletes a workspace code entry
- **Method**: DELETE
- **Route**: `/api/api/workspace-code/delete/:id`
- **Parameters**:
  - `id`: ID of the workspace code
- **Returns**: Success response

## Error Handling Patterns

### Standard Error Response Format

All controllers follow a consistent error handling pattern:

```javascript
try {
  // Controller logic
  return res.status(200).json({
    success: true,
    data: result,
    message: 'Success message',
  });
} catch (error) {
  console.error('Error in controller:', error);
  return res.status(500).json({
    success: false,
    message: 'Error message',
    error: error.message,
  });
}
```

### Common Error Scenarios

- **400 Bad Request**: Invalid input parameters
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side errors
- **Database Errors**: Sequelize validation errors
- **S3 Errors**: AWS SDK errors
- **GitHub API Errors**: GitHub API specific errors

### Input Validation

Controllers validate required parameters and return appropriate error responses for missing or invalid data.

### Service Integration

Controllers delegate business logic to service classes and handle service-level errors appropriately.
