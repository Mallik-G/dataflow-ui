# Service Layer and API Documentation

## Overview

The service layer provides a comprehensive set of APIs for managing data transformations, file operations, artifact generation, and GitHub integration. This documentation covers all backend services, their endpoints, request/response formats, and integration patterns.

## Backend Architecture

### Service Structure

```
nodeJsInitial/
├── controllers/          # API endpoint handlers
├── services/            # Business logic services
├── models/             # Database models
├── helpers/            # Utility functions
├── middlewares/        # Request middleware
└── routes/             # Route definitions
```

## Core Services

### 1. Transformation Service

#### Purpose

Handles all data transformation operations, including entity mapping, rule application, and transformation persistence.

#### Key Files

- `controllers/transformationController.js`
- `services/attributeTransformationService.js`
- `models/AttributeTransformation.js`

#### API Endpoints

##### `POST /api/transformations/save`

**Purpose**: Save transformation rules and mappings for an entity

**Request Body**:

```javascript
{
  entityName: "raw.customers",
  curatedEntityName: "curated.customers",
  rawAttributes: ["id", "name", "email", "phone"],
  curatedAttributes: ["customer_id", "full_name", "email_address", "phone_number"],
  mappings: [
    {
      raw: "id",
      curated: "customer_id",
      transformation: "direct_mapping"
    },
    {
      raw: "name",
      curated: "full_name",
      transformation: "direct_mapping"
    }
  ],
  columnRules: {
    "customer_id": {
      type: "primary_key",
      constraints: ["not_null", "unique"]
    }
  },
  operatorRules: {
    "email_address": {
      validation: "email_format",
      transformation: "lowercase"
    }
  },
  concatenationRules: [
    {
      source: ["first_name", "last_name"],
      target: "full_name",
      separator: " "
    }
  ],
  entityNLPRules: [
    {
      rule: "Convert all email addresses to lowercase",
      applied: true
    }
  ],
  columnDescriptions: {
    "customer_id": "Unique identifier for the customer",
    "full_name": "Customer's complete name"
  },
  newColumns: [
    {
      name: "created_at",
      type: "TIMESTAMP",
      defaultValue: "CURRENT_TIMESTAMP"
    }
  ]
}
```

**Response**:

```javascript
{
  success: true,
  message: "Transformation saved successfully",
  data: {
    transformationId: "uuid-string",
    entityName: "raw.customers",
    curatedEntityName: "curated.customers",
    status: "draft",
    version: "1.0",
    createdAt: "2024-01-01T00:00:00Z"
  }
}
```

##### `GET /api/transformations/{entityName}`

**Purpose**: Retrieve saved transformations for an entity

**Parameters**:

- `entityName` (string): Name of the entity (e.g., "raw.customers")

**Response**:

```javascript
{
  success: true,
  data: {
    entityName: "raw.customers",
    curatedEntityName: "curated.customers",
    mappings: [...],
    columnRules: {...},
    operatorRules: {...},
    concatenationRules: [...],
    entityNLPRules: [...],
    columnDescriptions: {...},
    newColumns: [...],
    transformationId: "uuid-string",
    status: "draft",
    version: "1.0",
    lastModified: "2024-01-01T00:00:00Z"
  }
}
```

##### `POST /api/transformations/apply`

**Purpose**: Apply transformations to data and generate curated output

**Request Body**:

```javascript
{
  entityName: "raw.customers",
  transformations: {
    // Same structure as save endpoint
  },
  outputFormat: "csv", // or "json", "sql"
  includeMetadata: true
}
```

**Response**:

```javascript
{
  success: true,
  message: "Transformation applied successfully",
  data: {
    outputFile: "s3://bucket/curated/customers.csv",
    recordCount: 1000,
    processingTime: "2.5s",
    appliedRules: [
      "direct_mapping",
      "email_validation",
      "name_concatenation"
    ]
  }
}
```

### 2. File Schema Service

#### Purpose

Manages file uploads, schema detection, and file metadata processing.

#### Key Files

- `controllers/rawFileSchemaController.js`
- `services/rawFileSchemaService.js`
- `models/RawFileSchema.js`

#### API Endpoints

##### `POST /api/files/upload`

**Purpose**: Upload files to S3 and process initial schema

**Request**: Multipart form data

- `file`: File object
- `fileName`: Optional custom filename
- `entityName`: Optional entity name

**Response**:

```javascript
{
  success: true,
  message: "File uploaded successfully",
  data: {
    fileKey: "uploads/customers.csv",
    fileName: "customers.csv",
    fileSize: 1024000,
    uploadUrl: "s3://bucket/uploads/customers.csv",
    schema: {
      columns: [
        {
          name: "id",
          type: "INTEGER",
          nullable: false,
          sampleValues: ["1", "2", "3"]
        },
        {
          name: "name",
          type: "VARCHAR",
          nullable: true,
          sampleValues: ["John Doe", "Jane Smith"]
        }
      ],
      rowCount: 1000,
      fileType: "csv"
    }
  }
}
```

##### `GET /api/files/list`

**Purpose**: List all uploaded files with metadata

**Response**:

```javascript
{
  success: true,
  data: [
    {
      fileKey: "uploads/customers.csv",
      fileName: "customers.csv",
      fileSize: 1024000,
      uploadDate: "2024-01-01T00:00:00Z",
      entityName: "raw.customers",
      status: "processed",
      schema: {...}
    }
  ]
}
```

##### `GET /api/files/{fileKey}/schema`

**Purpose**: Get detailed schema information for a file

**Parameters**:

- `fileKey`: S3 object key for the file

**Response**:

```javascript
{
  success: true,
  data: {
    fileKey: "uploads/customers.csv",
    schema: {
      columns: [...],
      constraints: [...],
      dataTypes: {...},
      sampleData: [...],
      statistics: {
        rowCount: 1000,
        columnCount: 5,
        nullValues: {...},
        uniqueValues: {...}
      }
    }
  }
}
```

### 3. Artifact Generation Service

#### Purpose

Generates DDL, DML, and transformation artifacts for entities.

#### Key Files

- `controllers/artifactController.js`
- `services/githubService.js`

#### API Endpoints

##### `POST /api/artifacts/generate-ddl`

**Purpose**: Generate Data Definition Language scripts

**Request Body**:

```javascript
{
  entityName: "raw.customers",
  curatedEntityName: "curated.customers",
  attributes: [
    {
      name: "customer_id",
      type: "INTEGER",
      constraints: ["PRIMARY KEY", "NOT NULL"]
    },
    {
      name: "full_name",
      type: "VARCHAR(255)",
      constraints: ["NOT NULL"]
    }
  ],
  databaseType: "postgresql" // or "mysql", "sqlserver"
}
```

**Response**:

```javascript
{
  success: true,
  data: {
    ddl: "CREATE TABLE curated.customers (\n  customer_id INTEGER PRIMARY KEY NOT NULL,\n  full_name VARCHAR(255) NOT NULL,\n  email_address VARCHAR(255),\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);",
    entityName: "curated.customers",
    generatedAt: "2024-01-01T00:00:00Z",
    version: "1.0"
  }
}
```

##### `POST /api/artifacts/generate-dml`

**Purpose**: Generate Data Manipulation Language scripts

**Request Body**:

```javascript
{
  entityName: "raw.customers",
  curatedEntityName: "curated.customers",
  transformations: {
    mappings: [...],
    rules: [...],
    filters: [...]
  }
}
```

**Response**:

```javascript
{
  success: true,
  data: {
    dml: "INSERT INTO curated.customers (customer_id, full_name, email_address)\nSELECT \n  id as customer_id,\n  CONCAT(first_name, ' ', last_name) as full_name,\n  LOWER(email) as email_address\nFROM raw.customers\nWHERE email IS NOT NULL;",
    entityName: "curated.customers",
    generatedAt: "2024-01-01T00:00:00Z",
    version: "1.0"
  }
}
```

##### `POST /api/artifacts/push-to-github`

**Purpose**: Push generated artifacts to GitHub repository

**Request Body**:

```javascript
{
  entityName: "curated.customers",
  artifacts: {
    ddl: "CREATE TABLE...",
    dml: "INSERT INTO...",
    transformations: "..."
  },
  commitMessage: "Add customer entity artifacts",
  branch: "main"
}
```

**Response**:

```javascript
{
  success: true,
  data: {
    commitHash: "abc123def456",
    branch: "main",
    filesPushed: [
      "artifacts/curated/customers_ddl.sql",
      "artifacts/curated/customers_dml.sql",
      "artifacts/curated/customers_transformations.json"
    ],
    githubUrl: "https://github.com/user/repo/commit/abc123def456"
  }
}
```

### 4. GitHub Integration Service

#### Purpose

Manages GitHub repository connections and artifact version control.

#### Key Files

- `controllers/githubController.js`
- `services/githubService.js`
- `models/GitHubConnection.js`

#### API Endpoints

##### `GET /api/github/connection`

**Purpose**: Check GitHub connection status

**Response**:

```javascript
{
  success: true,
  data: {
    connected: true,
    repository: "user/data-artifacts",
    branch: "main",
    lastSync: "2024-01-01T00:00:00Z",
    permissions: ["read", "write"]
  }
}
```

##### `POST /api/github/connect`

**Purpose**: Connect to GitHub repository

**Request Body**:

```javascript
{
  repository: "user/data-artifacts",
  branch: "main",
  accessToken: "ghp_xxxxxxxxxxxx",
  artifactPath: "artifacts/"
}
```

**Response**:

```javascript
{
  success: true,
  message: "GitHub connection established",
  data: {
    repository: "user/data-artifacts",
    branch: "main",
    artifactPath: "artifacts/",
    connectedAt: "2024-01-01T00:00:00Z"
  }
}
```

### 5. NLP Artifacts Service

#### Purpose

Manages AI-generated transformation artifacts and NLP processing.

#### Key Files

- `controllers/nlpArtifactController.js`
- `models/NLPArtifact.js`

#### API Endpoints

##### `GET /api/nlp-artifacts/{entityName}`

**Purpose**: Get NLP-generated artifacts for an entity

**Response**:

```javascript
{
  success: true,
  data: {
    entityName: "raw.customers",
    artifacts: [
      {
        id: "uuid-string",
        type: "transformation_rule",
        content: "Convert email addresses to lowercase",
        confidence: 0.95,
        status: "accepted",
        generatedAt: "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

##### `POST /api/nlp-artifacts/accept`

**Purpose**: Accept an NLP-generated artifact

**Request Body**:

```javascript
{
  artifactId: "uuid-string",
  entityName: "raw.customers",
  action: "accept" // or "reject"
}
```

## Data Models

### AttributeTransformation Model

```javascript
{
  id: "UUID",
  entityName: "String",           // "raw.customers"
  curatedEntityName: "String",    // "curated.customers"
  fileType: "String",             // "curated"
  sourceAttributes: "JSON",       // ["id", "name", "email"]
  curatedAttributes: "JSON",      // ["customer_id", "full_name", "email_address"]
  mappings: "JSON",               // Mapping rules
  columnRules: "JSON",            // Column-level rules
  operatorRules: "JSON",          // Operator-based rules
  concatenationRules: "JSON",    // Concatenation rules
  entityNLPRules: "JSON",         // NLP-generated rules
  columnDescriptions: "JSON",    // Column descriptions
  newColumns: "JSON",             // New column definitions
  entityLevelMetadata: "JSON",  // Entity metadata
  fileData: "JSON",               // File information
  transformationId: "String",     // Unique transformation ID
  status: "String",               // "draft", "applied", "published"
  version: "String",              // Version number
  lastAppliedAt: "Date",         // Last application timestamp
  createdBy: "String",            // Creator identifier
  createdAt: "Date",              // Creation timestamp
  updatedAt: "Date"               // Last update timestamp
}
```

### NLPArtifact Model

```javascript
{
  id: "UUID",
  entityName: "String",           // Target entity name
  artifactType: "String",         // "transformation_rule", "mapping_suggestion"
  content: "String",               // Artifact content
  confidence: "Float",            // AI confidence score (0-1)
  status: "String",               // "pending", "accepted", "rejected"
  metadata: "JSON",              // Additional metadata
  generatedAt: "Date",            // Generation timestamp
  acceptedAt: "Date",             // Acceptance timestamp
  createdBy: "String",            // Creator identifier
  createdAt: "Date",              // Creation timestamp
  updatedAt: "Date"               // Last update timestamp
}
```

## Error Handling

### Standard Error Response Format

```javascript
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input parameters",
    details: {
      field: "entityName",
      issue: "Entity name cannot be empty"
    },
    timestamp: "2024-01-01T00:00:00Z"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `ENTITY_NOT_FOUND`: Entity does not exist
- `TRANSFORMATION_FAILED`: Transformation process failed
- `GITHUB_CONNECTION_FAILED`: GitHub connection error
- `FILE_UPLOAD_FAILED`: File upload error
- `SCHEMA_PROCESSING_FAILED`: Schema processing error
- `ARTIFACT_GENERATION_FAILED`: Artifact generation error

## Authentication and Authorization

### JWT Token Authentication

All API endpoints require JWT token authentication:

```javascript
// Request headers
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

### Permission Levels

- **Read**: View entities, schemas, and artifacts
- **Write**: Create and modify transformations
- **Admin**: Manage system settings and user permissions

## Rate Limiting

### API Rate Limits

- **File Upload**: 10 requests per minute
- **Artifact Generation**: 5 requests per minute
- **GitHub Operations**: 20 requests per minute
- **General API**: 100 requests per minute

### Rate Limit Headers

```javascript
{
  "X-RateLimit-Limit": "100",
  "X-RateLimit-Remaining": "95",
  "X-RateLimit-Reset": "1640995200"
}
```

## Performance Considerations

### Response Time Targets

- **Simple Queries**: < 200ms
- **Complex Transformations**: < 5s
- **File Processing**: < 30s
- **Artifact Generation**: < 10s

### Caching Strategy

- **Entity Schemas**: Cached for 1 hour
- **File Metadata**: Cached for 30 minutes
- **Transformation Rules**: Cached for 15 minutes
- **GitHub Status**: Cached for 5 minutes

## Testing

### API Testing

- **Unit Tests**: Individual endpoint testing
- **Integration Tests**: Cross-service testing
- **Load Tests**: Performance under load
- **Security Tests**: Authentication and authorization

### Test Data

- **Mock Entities**: Test entity data
- **Sample Files**: Test CSV files
- **Test Transformations**: Sample transformation rules
- **Mock GitHub**: Test GitHub responses

## Monitoring and Logging

### Logging Levels

- **ERROR**: System errors and failures
- **WARN**: Warning conditions
- **INFO**: General information
- **DEBUG**: Detailed debugging information

### Metrics Tracking

- **API Response Times**: Endpoint performance
- **Error Rates**: Error frequency by endpoint
- **User Activity**: User interaction patterns
- **System Health**: Resource utilization

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
