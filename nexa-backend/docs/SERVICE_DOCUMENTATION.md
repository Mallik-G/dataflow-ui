# Service Documentation

## Overview

Services contain the business logic layer of the application. They handle complex operations, data processing, and external integrations while maintaining separation of concerns from controllers and models.

## Service Structure

### Service Files

- `services/attributeTransformationService.js` - Business logic for attribute transformations
- `services/githubService.js` - GitHub API integration and authentication
- `services/rawFileSchemaService.js` - Raw file schema operations
- `services/consumptionFileSchemaService.js` - Consumption file schema operations
- `services/batchProjectionService.js` - Batch projection management

## AttributeTransformationService

**File**: `services/attributeTransformationService.js`

**Purpose**: Handles business logic for attribute transformations including CRUD operations and transformation management.

### Key Methods

#### `saveTransformation(transformationData)`

- **Purpose**: Save or update attribute transformations
- **Parameters**:
  - `transformationData` (object): Complete transformation configuration
    - `entityName` (string): Name of the entity
    - `curatedEntityName` (string): Name of the curated entity
    - `fileType` (string): Type of file (curated/consumption)
    - `sourceAttributes` (array): Original source attributes
    - `curatedAttributes` (array): Target curated attributes
    - `mappings` (object): Column mapping rules
    - `columnRules` (object): Data quality rules
    - `operatorRules` (object): Operator-based validation rules
    - `concatenationRules` (object): Column concatenation rules
    - `entityNLPRules` (object): Entity-level NLP rules
    - `columnDescriptions` (object): Column descriptions
    - `newColumns` (object): New column definitions
    - `entityLevelMetadata` (object): Entity metadata
    - `fileData` (object): File processing metadata
    - `createdBy` (string): Creator user
    - `updatedBy` (string): Updater user
    - `notes` (string): Additional notes
- **Process**:
  1. Generates unique transformation ID using UUID
  2. Checks for existing transformation by entity name and file type
  3. Updates existing or creates new transformation
  4. Handles upsert logic with proper status management
- **Returns**: Success response with transformation data
- **Error Handling**: Throws errors for database operations

#### `getTransformation(entityName, fileType = 'curated')`

- **Purpose**: Get transformation by entity name and file type
- **Parameters**:
  - `entityName` (string): Name of the entity
  - `fileType` (string): Type of file (default: curated)
- **Process**:
  1. Queries database for transformation
  2. Orders by updatedAt DESC for latest version
  3. Returns most recent transformation
- **Returns**: Success response with transformation data or null
- **Error Handling**: Throws errors for database operations

#### `getAllTransformations(filters = {})`

- **Purpose**: Get all transformations with optional filtering
- **Parameters**:
  - `filters` (object): Filtering options
    - `entityName` (string): Filter by entity name
    - `fileType` (string): Filter by file type
    - `status` (string): Filter by status
    - `createdBy` (string): Filter by creator
- **Process**:
  1. Builds dynamic WHERE clause based on filters
  2. Queries database with filters applied
  3. Orders by updatedAt DESC
- **Returns**: Success response with array of transformations and count
- **Error Handling**: Throws errors for database operations

#### `updateTransformationStatus(entityName, fileType, status)`

- **Purpose**: Update transformation status
- **Parameters**:
  - `entityName` (string): Name of the entity
  - `fileType` (string): Type of file
  - `status` (string): New status value
- **Process**:
  1. Finds transformation by entity name and file type
  2. Updates status and updatedBy fields
  3. Throws error if transformation not found
- **Returns**: Success response with updated transformation
- **Error Handling**: Throws error if transformation not found

#### `markTransformationApplied(entityName, fileType)`

- **Purpose**: Mark transformation as applied
- **Parameters**:
  - `entityName` (string): Name of the entity
  - `fileType` (string): Type of file
- **Process**:
  1. Finds transformation by entity name and file type
  2. Updates lastAppliedAt timestamp
  3. Increments appliedCount
  4. Updates updatedBy field
- **Returns**: Success response with updated transformation
- **Error Handling**: Throws error if transformation not found

#### `deleteTransformation(entityName, fileType)`

- **Purpose**: Delete transformation
- **Parameters**:
  - `entityName` (string): Name of the entity
  - `fileType` (string): Type of file
- **Process**:
  1. Finds transformation by entity name and file type
  2. Performs hard delete from database
  3. Throws error if transformation not found
- **Returns**: Success response with deletion confirmation
- **Error Handling**: Throws error if transformation not found

#### `getTransformationStats()`

- **Purpose**: Get transformation statistics
- **Process**:
  1. Queries database for counts by fileType and status
  2. Gets total, active, and draft transformation counts
  3. Groups results by fileType and status
- **Returns**: Success response with comprehensive statistics
- **Error Handling**: Throws errors for database operations

## GitHubService

**File**: `services/githubService.js`

**Purpose**: Handles GitHub API integration, authentication, and repository operations.

### Key Methods

#### `testConnection(config)`

- **Purpose**: Test GitHub connection using provided credentials
- **Parameters**:
  - `config` (object): GitHub configuration
    - `repositoryUrl` (string): Repository URL
    - `branch` (string): Repository branch
    - `username` (string): GitHub username or token
    - `password` (string): GitHub password (if using username/password)
- **Process**:
  1. Extracts repository owner and name from URL
  2. Determines authentication method (token vs username/password)
  3. Tests authentication by accessing user info
  4. Tests repository access and branch existence
  5. Tests repository contents access
  6. Handles various error scenarios with specific messages
- **Returns**: Success response with connection details
- **Error Handling**:
  - 401: Authentication failed
  - 403: Access denied
  - 404: Repository or branch not found
  - 422: Invalid repository or branch name
  - Network errors: Connection timeout or unreachable

#### `saveConnection(config)`

- **Purpose**: Save GitHub connection configuration to database
- **Parameters**:
  - `config` (object): GitHub configuration object
- **Process**:
  1. Tests connection first using testConnection method
  2. Extracts repository information
  3. Determines authentication method
  4. Encrypts password if provided
  5. Deactivates existing active connections
  6. Saves new connection as active
  7. Stores test results and metadata
- **Returns**: Success response with saved connection details
- **Error Handling**: Throws errors for connection test failures or database operations

#### `updateConnection(config, connectionId)`

- **Purpose**: Update existing GitHub connection
- **Parameters**:
  - `config` (object): Updated GitHub configuration
  - `connectionId` (string): ID of connection to update
- **Process**:
  1. Gets existing connection to preserve password
  2. Tests new configuration
  3. Handles password updates (encrypts if changed)
  4. Updates connection with new data
  5. Preserves existing password if not provided
- **Returns**: Success response with updated connection
- **Error Handling**: Throws errors for connection not found or test failures

#### `getActiveConnection()`

- **Purpose**: Get the currently active GitHub connection
- **Process**:
  1. Queries database for active connection
  2. Decrypts password for return
  3. Returns null if no active connection
- **Returns**: Active connection object with decrypted password or null
- **Error Handling**: Throws errors for database operations

#### `resetConnection()`

- **Purpose**: Delete/Reset the active GitHub connection
- **Process**:
  1. Updates all active connections to inactive
  2. Returns count of deactivated connections
- **Returns**: Success response with deletion count
- **Error Handling**: Throws errors for database operations

#### `updateTestResult(connectionId, success, testResult, error)`

- **Purpose**: Update connection test results
- **Parameters**:
  - `connectionId` (string): Connection ID
  - `success` (boolean): Whether test was successful
  - `testResult` (object): Test result data (optional)
  - `error` (string): Error message if failed (optional)
- **Process**:
  1. Updates lastTestedAt timestamp
  2. Increments testCount
  3. Updates successCount or failureCount based on result
  4. Stores test result or error message
- **Returns**: No return value
- **Error Handling**: Logs errors but doesn't throw

#### `encryptPassword(password)`

- **Purpose**: Encrypt password for storage
- **Parameters**:
  - `password` (string): Plain text password
- **Process**:
  1. Uses AES-256-CBC encryption
  2. Generates random IV
  3. Encrypts password with environment key
  4. Returns IV + encrypted data
- **Returns**: Encrypted password string
- **Error Handling**: Uses environment variable or default key

#### `decryptPassword(encryptedPassword)`

- **Purpose**: Decrypt password from storage
- **Parameters**:
  - `encryptedPassword` (string): Encrypted password
- **Process**:
  1. Splits IV and encrypted data
  2. Uses AES-256-CBC decryption
  3. Decrypts with environment key
- **Returns**: Decrypted password string or null on error
- **Error Handling**: Returns null for decryption failures

#### `extractRepoInfo(url)`

- **Purpose**: Extract owner and repository name from GitHub URL
- **Parameters**:
  - `url` (string): Repository URL
- **Process**:
  1. Handles multiple GitHub URL formats
  2. Supports HTTPS and SSH URLs
  3. Handles .git suffix
- **Returns**: Object with owner and repo or null if invalid
- **Error Handling**: Returns null for invalid URLs

#### `getRepositoryInfo(config)`

- **Purpose**: Get repository information
- **Parameters**:
  - `config` (object): GitHub configuration
- **Process**:
  1. Extracts repository info from URL
  2. Determines authentication method
  3. Makes GitHub API call to get repository details
- **Returns**: Success response with repository data
- **Error Handling**: Throws errors for API failures

#### `listBranches(config)`

- **Purpose**: List branches for a repository
- **Parameters**:
  - `config` (object): GitHub configuration
- **Process**:
  1. Extracts repository info from URL
  2. Determines authentication method
  3. Makes GitHub API call to list branches
  4. Formats branch data with name, commit, and protection status
- **Returns**: Success response with array of branch objects
- **Error Handling**: Throws errors for API failures

#### `pushArtifactsToRepository(artifacts, githubConfig, folderPath)`

- **Purpose**: Push artifacts to GitHub repository
- **Parameters**:
  - `artifacts` (object): Generated artifacts
  - `githubConfig` (object): GitHub configuration
  - `folderPath` (string): Target folder path (default: 'curated')
- **Process**:
  1. Extracts repository information
  2. Determines authentication method
  3. Gets latest commit SHA for branch
  4. Creates tree with artifacts in organized folder structure
  5. Creates commit with changes
  6. Updates branch reference
- **Returns**: Success response with commit details
- **Error Handling**:
  - 401: Authentication failed
  - 403: Access denied with detailed guidance
  - 404: Repository or branch not found
  - 422: Invalid request (file exists, invalid content)
  - Network errors: Connection issues

#### `pushAllArtifactsToRepository(artifactsArray, githubConfig, newBranchName, createPR, targetBranch, folderPath)`

- **Purpose**: Push all artifacts to GitHub repository in single commit
- **Parameters**:
  - `artifactsArray` (array): Array of artifacts objects
  - `githubConfig` (object): GitHub configuration
  - `newBranchName` (string): Optional new branch name
  - `createPR` (boolean): Whether to create pull request
  - `targetBranch` (string): Target branch for PR (default: main)
  - `folderPath` (string): Target folder path
- **Process**:
  1. Determines source and base branches
  2. Gets base branch commit SHA
  3. Creates tree with all artifacts for all entities
  4. Creates single commit with all changes
  5. Creates new branch if specified
  6. Creates pull request if requested
- **Returns**: Success response with commit and PR details
- **Error Handling**: Same as pushArtifactsToRepository

#### `checkExistingFiles(githubConfig, entityName, folderPath)`

- **Purpose**: Check existing files in repository for entity
- **Parameters**:
  - `githubConfig` (object): GitHub configuration
  - `entityName` (string): Entity name to check
  - `folderPath` (string): Folder path to check
- **Process**:
  1. Gets latest commit SHA for branch
  2. Gets recursive tree contents
  3. Filters files for entity in all subfolder paths
  4. Returns existing files with metadata
- **Returns**: Success response with existing files information
- **Error Handling**: Throws errors for API failures

#### `getFileContent(fileUrl, auth)`

- **Purpose**: Get file content from GitHub
- **Parameters**:
  - `fileUrl` (string): GitHub file URL
  - `auth` (object): Authentication headers
- **Process**:
  1. Makes GitHub API call to get file content
  2. Decodes base64 content
  3. Returns file content as string
- **Returns**: File content string or null on error
- **Error Handling**: Returns null for API failures

#### `generateArtifactsDiff(artifacts, githubConfig, folderPath)`

- **Purpose**: Generate diff between existing and new artifacts
- **Parameters**:
  - `artifacts` (object): New artifacts
  - `githubConfig` (object): GitHub configuration
  - `folderPath` (string): Folder path
- **Process**:
  1. Checks existing files (gracefully handles auth failures)
  2. Defines new artifact files with folder structure
  3. Compares files and generates diff
  4. Stores previous versions for frontend display
  5. Categorizes files by type (DDL, DML, Transformations)
- **Returns**: Success response with diff information
- **Error Handling**: Provides detailed error messages for different scenarios

#### `testWritePermissions(config)`

- **Purpose**: Test write permissions to repository
- **Parameters**:
  - `config` (object): GitHub configuration
- **Process**:
  1. Tests repository access and permissions
  2. Checks branch access
  3. Tests Git tree creation (actual write operation)
  4. Verifies push permissions
- **Returns**: Success response with permission details
- **Error Handling**:
  - 403: Detailed guidance on token scopes and permissions
  - 404: Branch not found
  - Other GitHub API errors

## RawFileSchemaService

**File**: `services/rawFileSchemaService.js`

**Purpose**: Handles business logic for raw file schema operations including CRUD operations and schema extraction.

### Key Methods

#### `saveRawFileSchema(schemaData)`

- **Purpose**: Save or update raw file schema
- **Parameters**:
  - `schemaData` (object): Complete schema data
    - `entityName` (string): Name of the entity
    - `fileName` (string): Name of the file
    - `fileKey` (string): S3 key of the file
    - `fileLocation` (string): File location URL
    - `fileSize` (number): File size in bytes
    - `contentType` (string): MIME type
    - `schemaAttributes` (array): Schema attributes
    - `schemaMetadata` (object): Schema metadata
    - `fileData` (object): File processing metadata
    - `createdBy` (string): Creator user
    - `updatedBy` (string): Updater user
    - `notes` (string): Additional notes
    - `processingMode` (string): Processing mode
- **Process**:
  1. Generates unique schema ID using UUID
  2. Checks for existing schema by entity name
  3. Updates existing or creates new schema
  4. Handles processing mode and counters
- **Returns**: Success response with schema data
- **Error Handling**: Throws errors for database operations

#### `getRawFileSchema(entityName)`

- **Purpose**: Get raw file schema by entity name
- **Parameters**:
  - `entityName` (string): Name of the entity
- **Process**:
  1. Queries database excluding deleted records
  2. Orders by updatedAt DESC for latest version
- **Returns**: Success response with schema data or null
- **Error Handling**: Throws errors for database operations

#### `getAllRawFileSchemas(filters = {}, pagination = {})`

- **Purpose**: Get all raw file schemas with filtering and pagination
- **Parameters**:
  - `filters` (object): Filtering options
    - `search` (string): Search term for entity name or file name
    - `entityName` (string): Filter by entity name
    - `status` (string): Filter by status
    - `createdBy` (string): Filter by creator
    - `sortBy` (string): Sort field
  - `pagination` (object): Pagination options
    - `page` (number): Page number (default: 1)
    - `limit` (number): Items per page (default: 15)
    - `offset` (number): Offset for pagination
- **Process**:
  1. Builds dynamic WHERE clause with search functionality
  2. Handles pagination and sorting
  3. Integrates with transformation data to show "worked upon" status
  4. Enhances schemas with transformation information
  5. Supports custom sorting by worked upon status
- **Returns**: Success response with paginated schemas and metadata
- **Error Handling**: Throws errors for database operations

#### `updateRawFileSchemaStatus(entityName, status)`

- **Purpose**: Update raw file schema status
- **Parameters**:
  - `entityName` (string): Name of the entity
  - `status` (string): New status value
- **Process**:
  1. Finds schema by entity name excluding deleted
  2. Updates status and updatedBy fields
  3. Returns error if schema not found
- **Returns**: Success response with updated schema or error
- **Error Handling**: Returns error response if schema not found

#### `deleteRawFileSchema(entityName)`

- **Purpose**: Soft delete raw file schema
- **Parameters**:
  - `entityName` (string): Name of the entity
- **Process**:
  1. Finds schema by entity name excluding deleted
  2. Updates status to 'deleted'
  3. Updates updatedBy field
- **Returns**: Success response or error if not found
- **Error Handling**: Returns error response if schema not found

#### `getRawFileSchemaStats()`

- **Purpose**: Get raw file schema statistics
- **Process**:
  1. Counts total schemas excluding deleted
  2. Counts active and archived schemas
  3. Counts recent schemas (last 7 days)
- **Returns**: Success response with comprehensive statistics
- **Error Handling**: Throws errors for database operations

#### `extractSchemaFromContent(fileContent, fileName, contentType)`

- **Purpose**: Extract schema from file content
- **Parameters**:
  - `fileContent` (string): File content as string
  - `fileName` (string): Name of the file
  - `contentType` (string): MIME type of the file
- **Process**:
  1. Determines file type from extension and content type
  2. Parses CSV/TSV files with delimiter detection
  3. Parses JSON files (arrays and objects)
  4. Analyzes sample data for data type detection
  5. Generates column descriptions automatically
  6. Provides fallback schema for unsupported types
- **Returns**: Object with schemaAttributes and schemaMetadata
- **Error Handling**: Returns fallback schema on parsing errors

#### `determineDataType(values)`

- **Purpose**: Determine data type from sample values
- **Parameters**:
  - `values` (array): Array of sample values
- **Process**:
  1. Filters out null/empty values
  2. Checks for boolean values
  3. Checks for integer values
  4. Checks for decimal/float values
  5. Checks for date/datetime values
  6. Checks for email format
  7. Checks for URL format
  8. Defaults to string with statistics
- **Returns**: Object with type, nullable flag, and statistics
- **Error Handling**: Returns string type as fallback

#### `generateColumnDescription(columnName, dataType)`

- **Purpose**: Generate auto description for column based on name and data type
- **Parameters**:
  - `columnName` (string): Name of the column
  - `dataType` (object): Data type information
- **Process**:
  1. Analyzes column name patterns
  2. Generates contextual descriptions
  3. Handles common patterns (id, name, email, phone, etc.)
  4. Provides generic descriptions based on data type
- **Returns**: Generated description string
- **Error Handling**: Returns generic description as fallback

## ConsumptionFileSchemaService

**File**: `services/consumptionFileSchemaService.js`

**Purpose**: Handles business logic for consumption file schema operations.

### Key Methods

#### `saveConsumptionFileSchema(schemaData)`

- **Purpose**: Save or update consumption file schema
- **Parameters**:
  - `schemaData` (object): Complete consumption schema data
    - `entityName` (string): Name of the consumption entity
    - `fileName` (string): Name of the file
    - `fileKey` (string): S3 key of the file
    - `fileLocation` (string): File location URL
    - `fileSize` (number): File size in bytes
    - `contentType` (string): MIME type
    - `schemaAttributes` (array): Schema attributes
    - `schemaMetadata` (object): Schema metadata
    - `fileData` (object): File processing metadata
    - `sourceEntities` (array): Source entities used
    - `joinRelationships` (object): Join relationships
    - `transformations` (object): Transformations applied
    - `createdBy` (string): Creator user
    - `updatedBy` (string): Updater user
    - `notes` (string): Additional notes
- **Process**:
  1. Generates unique consumption schema ID
  2. Checks for existing schema by entity name
  3. Updates existing or creates new schema
  4. Handles processing counters
- **Returns**: Success response with schema data
- **Error Handling**: Throws errors for database operations

#### `getConsumptionFileSchema(entityName)`

- **Purpose**: Get consumption file schema by entity name
- **Parameters**:
  - `entityName` (string): Name of the consumption entity
- **Process**:
  1. Queries database excluding deleted records
  2. Orders by updatedAt DESC for latest version
- **Returns**: Success response with schema data or null
- **Error Handling**: Throws errors for database operations

#### `getAllConsumptionFileSchemas(filters = {}, pagination = {})`

- **Purpose**: Get all consumption file schemas with filtering and pagination
- **Parameters**:
  - `filters` (object): Filtering options
    - `search` (string): Search term for entity name or file name
    - `entityName` (string): Filter by entity name
    - `status` (string): Filter by status
    - `createdBy` (string): Filter by creator
  - `pagination` (object): Pagination options
    - `page` (number): Page number (default: 1)
    - `limit` (number): Items per page (default: 15)
    - `offset` (number): Offset for pagination
- **Process**:
  1. Builds dynamic WHERE clause with search functionality
  2. Handles pagination
  3. Queries database with filters applied
- **Returns**: Success response with paginated schemas
- **Error Handling**: Throws errors for database operations

#### `updateConsumptionFileSchemaStatus(entityName, status)`

- **Purpose**: Update consumption file schema status
- **Parameters**:
  - `entityName` (string): Name of the consumption entity
  - `status` (string): New status value
- **Process**:
  1. Finds schema by entity name excluding deleted
  2. Updates status and updatedBy fields
  3. Returns error if schema not found
- **Returns**: Success response with updated schema or error
- **Error Handling**: Returns error response if schema not found

#### `deleteConsumptionFileSchema(entityName)`

- **Purpose**: Soft delete consumption file schema
- **Parameters**:
  - `entityName` (string): Name of the consumption entity
- **Process**:
  1. Finds schema by entity name excluding deleted
  2. Updates status to 'deleted'
  3. Updates updatedBy field
- **Returns**: Success response or error if not found
- **Error Handling**: Returns error response if schema not found

#### `getConsumptionFileSchemaStats()`

- **Purpose**: Get consumption file schema statistics
- **Process**:
  1. Counts total schemas excluding deleted
  2. Counts active and archived schemas
  3. Counts recent schemas (last 7 days)
- **Returns**: Success response with comprehensive statistics
- **Error Handling**: Throws errors for database operations

#### `extractSchemaFromContent(fileContent, fileName, contentType)`

- **Purpose**: Extract schema from consumption file content
- **Parameters**:
  - `fileContent` (string): File content as string
  - `fileName` (string): Name of the file
  - `contentType` (string): MIME type of the file
- **Process**:
  1. Similar to raw file schema extraction
  2. Handles CSV/TSV and JSON files
  3. Analyzes sample data for data type detection
  4. Generates column descriptions
  5. Provides fallback schema for errors
- **Returns**: Object with schemaAttributes and schemaMetadata
- **Error Handling**: Returns fallback schema on parsing errors

#### `determineDataType(values)`

- **Purpose**: Determine data type based on sample values
- **Parameters**:
  - `values` (array): Array of sample values
- **Process**:
  1. Similar to raw file schema data type detection
  2. Handles boolean, integer, decimal, date, email, URL types
  3. Provides string fallback with statistics
- **Returns**: Object with type, nullable flag, and statistics
- **Error Handling**: Returns string type as fallback

#### `generateColumnDescription(columnName, dataType)`

- **Purpose**: Generate auto description for column based on name and data type
- **Parameters**:
  - `columnName` (string): Name of the column
  - `dataType` (object): Data type information
- **Process**:
  1. Analyzes column name patterns
  2. Generates contextual descriptions
  3. Handles common patterns
  4. Provides generic descriptions based on data type
- **Returns**: Generated description string
- **Error Handling**: Returns generic description as fallback

## BatchProjectionService

**File**: `services/batchProjectionService.js`

**Purpose**: Handles business logic for batch projection operations.

### Key Methods

#### `createProjection(projectionData)`

- **Purpose**: Create a new batch projection configuration
- **Parameters**:
  - `projectionData` (object): Projection configuration
    - `entityName` (string): Name of the projection entity
    - `selectedEntities` (array): Selected entities for projection
    - `settings` (object): Projection settings
    - `schedule` (object): Scheduling configuration
    - `output` (object): Output configuration
    - `createdBy` (string): Creator user
    - `updatedBy` (string): Updater user
- **Process**:
  1. Creates new projection record in database
  2. Sets default values for createdBy and updatedBy
- **Returns**: Success response with created projection
- **Error Handling**: Throws errors for database operations

#### `getAllProjections(filters = {})`

- **Purpose**: Get all batch projections with optional filtering
- **Parameters**:
  - `filters` (object): Filtering options
    - `status` (string): Filter by status
    - `entityName` (string): Filter by entity name
    - `createdBy` (string): Filter by creator
- **Process**:
  1. Builds dynamic WHERE clause based on filters
  2. Queries database with filters applied
  3. Orders by createdAt DESC
- **Returns**: Success response with array of projections and total count
- **Error Handling**: Throws errors for database operations

#### `getProjectionById(id)`

- **Purpose**: Get a single batch projection by ID
- **Parameters**:
  - `id` (number): ID of the projection
- **Process**:
  1. Queries database by primary key
  2. Returns error if projection not found
- **Returns**: Success response with projection or error
- **Error Handling**: Returns error response if projection not found

#### `updateProjection(id, updateData)`

- **Purpose**: Update a batch projection configuration
- **Parameters**:
  - `id` (number): ID of the projection
  - `updateData` (object): Update data
- **Process**:
  1. Finds projection by ID
  2. Updates with provided data
  3. Sets updatedBy and updatedAt fields
  4. Returns error if projection not found
- **Returns**: Success response with updated projection or error
- **Error Handling**: Returns error response if projection not found

#### `deleteProjection(id)`

- **Purpose**: Delete a batch projection configuration
- **Parameters**:
  - `id` (number): ID of the projection
- **Process**:
  1. Finds projection by ID
  2. Performs hard delete from database
  3. Returns error if projection not found
- **Returns**: Success response with deletion confirmation or error
- **Error Handling**: Returns error response if projection not found

#### `updateStatus(id, status, updatedBy = 'system')`

- **Purpose**: Update projection status
- **Parameters**:
  - `id` (number): ID of the projection
  - `status` (string): New status value
  - `updatedBy` (string): User updating status
- **Process**:
  1. Finds projection by ID
  2. Updates status and updatedBy fields
  3. Sets updatedAt timestamp
  4. Returns error if projection not found
- **Returns**: Success response with updated projection or error
- **Error Handling**: Returns error response if projection not found

#### `updateRunStats(id, runStats)`

- **Purpose**: Update projection run statistics
- **Parameters**:
  - `id` (number): ID of the projection
  - `runStats` (object): Run statistics
    - `lastRunAt` (date): Last run timestamp
    - `nextRunAt` (date): Next run timestamp
    - `success` (boolean): Whether run was successful
    - `error` (string): Error message if failed
- **Process**:
  1. Finds projection by ID
  2. Updates run timestamps and counters
  3. Handles success/failure statistics
  4. Updates error information
  5. Returns error if projection not found
- **Returns**: Success response with updated projection or error
- **Error Handling**: Returns error response if projection not found

#### `getDueProjections()`

- **Purpose**: Get projections that are due to run
- **Process**:
  1. Queries database for active projections
  2. Filters by nextRunAt <= current time
  3. Orders by nextRunAt ASC for priority
- **Returns**: Success response with array of due projections
- **Error Handling**: Throws errors for database operations

#### `getProjectionStats()`

- **Purpose**: Get projection statistics
- **Process**:
  1. Queries database for counts by status
  2. Gets total, active, and due projection counts
  3. Groups results by status
- **Returns**: Success response with comprehensive statistics
- **Error Handling**: Throws errors for database operations

## Service Patterns and Conventions

### Error Handling

All services follow consistent error handling patterns:

```javascript
try {
  // Service logic
  return {
    success: true,
    data: result,
    message: 'Success message',
  };
} catch (error) {
  console.error('Error in service:', error);
  throw error;
}
```

### Response Format

Services return consistent response objects:

**Success Response**:

```javascript
{
  success: true,
  data: result,
  message: 'Success message'
}
```

**Error Response**:

```javascript
{
  success: false,
  message: 'Error message',
  error: error.message
}
```

### Database Operations

- **Sequelize ORM**: All database operations use Sequelize
- **Transaction Support**: Complex operations can use transactions
- **Soft Deletes**: Uses status fields instead of hard deletes
- **Audit Trail**: Tracks created/updated by and timestamps

### External Integrations

- **GitHub API**: Comprehensive GitHub integration with error handling
- **AWS S3**: File operations through AWS SDK
- **Rate Limiting**: Respects API rate limits
- **Retry Logic**: Implements retry mechanisms for transient failures

### Security Considerations

- **Password Encryption**: Encrypts sensitive data before storage
- **Input Validation**: Validates all input parameters
- **SQL Injection Prevention**: Uses parameterized queries
- **Access Control**: Tracks user operations

### Performance Optimization

- **Database Indexes**: Optimized queries with proper indexes
- **Pagination**: Handles large result sets efficiently
- **Caching**: Implements caching where appropriate
- **Connection Pooling**: Efficient database connection management

### Logging and Monitoring

- **Error Logging**: Comprehensive error logging
- **Performance Metrics**: Tracks operation performance
- **Audit Logging**: Complete operation history
- **Debug Information**: Detailed debug information for troubleshooting
