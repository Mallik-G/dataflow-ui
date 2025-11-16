# Model Documentation

## Overview

Models define the database schema and data structure using Sequelize ORM. They represent the data entities and their relationships in the application.

## Model Structure

### Model Files

- `models/index.js` - Model exports and associations
- `models/AttributeTransformation.js` - Data transformation configurations
- `models/RawFileSchema.js` - Raw file schema definitions
- `models/ConsumptionFileSchema.js` - Consumption file schema definitions
- `models/BatchProjection.js` - Batch projection configurations
- `models/GitHubConnection.js` - GitHub integration credentials
- `models/NLPArtifact.js` - AI-generated code artifacts
- `models/ConsumptionETLTransformation.js` - Consumption ETL transformations
- `models/WorkspaceCode.js` - Workspace code snippets

## Model Index (`models/index.js`)

**Purpose**: Central model registry that exports all models and defines associations.

### Exports

```javascript
module.exports = {
  sq, // Sequelize instance
  BatchProjection, // Batch projection model
  AttributeTransformation, // Attribute transformation model
  RawFileSchema, // Raw file schema model
  ConsumptionFileSchema, // Consumption file schema model
  GitHubConnection, // GitHub connection model
  NLPArtifact, // NLP artifact model
  ConsumptionETLTransformation, // Consumption ETL transformation model
  WorkspaceCode, // Workspace code model
};
```

### Associations

Currently no explicit associations are defined, but models can be related through foreign keys and entity names.

## AttributeTransformation Model

**File**: `models/AttributeTransformation.js`

**Purpose**: Stores data transformation configurations for entities.

### Schema Definition

```javascript
const AttributeTransformation = sq.define(
  'AttributeTransformation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the source entity',
    },
    curatedEntityName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Name of the curated entity',
    },
    fileType: {
      type: DataTypes.ENUM('curated', 'consumption'),
      defaultValue: 'curated',
      comment: 'Type of file being transformed',
    },
    sourceAttributes: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Original source attributes',
    },
    curatedAttributes: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Target curated attributes',
    },
    mappings: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Column mapping rules',
    },
    columnRules: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Data quality and validation rules',
    },
    operatorRules: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Operator-based validation rules',
    },
    concatenationRules: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Column concatenation rules',
    },
    entityNLPRules: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Entity-level NLP transformation rules',
    },
    columnDescriptions: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Column descriptions and metadata',
    },
    newColumns: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'New columns to be created',
    },
    entityLevelMetadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Entity-level metadata',
    },
    fileData: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'File processing metadata',
    },
    transformationId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Unique transformation identifier',
    },
    status: {
      type: DataTypes.ENUM('active', 'draft', 'archived', 'deleted'),
      defaultValue: 'draft',
      comment: 'Transformation status',
    },
    lastAppliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last time transformation was applied',
    },
    appliedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of times transformation was applied',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who created the transformation',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who last updated the transformation',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes',
    },
  },
  {
    tableName: 'attribute_transformations',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        unique: true,
        fields: ['entityName', 'fileType'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdBy'],
      },
      {
        fields: ['updatedAt'],
      },
    ],
  }
);
```

### Key Features

- **Unique Constraint**: Combination of `entityName` and `fileType` must be unique
- **JSONB Fields**: Flexible storage for complex transformation rules
- **Status Management**: Tracks transformation lifecycle
- **Audit Trail**: Created/updated by tracking
- **Indexes**: Optimized for common query patterns

### Data Types

- **mappings**: Column mapping between source and target
- **columnRules**: Data quality rules (not_null, email_format, numeric_only)
- **operatorRules**: Operator-based validation (greater_than, less_than, not_equals)
- **concatenationRules**: Column concatenation configuration
- **entityNLPRules**: NLP transformation rules (uppercase, lowercase, trim)
- **newColumns**: New column definitions with formulas

## RawFileSchema Model

**File**: `models/RawFileSchema.js`

**Purpose**: Stores raw file schema information and metadata.

### Schema Definition

```javascript
const RawFileSchema = sq.define(
  'RawFileSchema',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the entity',
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Original file name',
    },
    fileKey: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'S3 object key',
    },
    fileLocation: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'File location URL',
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'File size in bytes',
    },
    contentType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'MIME type of the file',
    },
    schemaAttributes: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Extracted schema attributes',
    },
    schemaMetadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Schema metadata and statistics',
    },
    fileData: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'File processing metadata',
    },
    schemaId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Unique schema identifier',
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'deleted'),
      defaultValue: 'active',
      comment: 'Schema status',
    },
    processingMode: {
      type: DataTypes.ENUM('file-only', 'schema-only', 'file-and-schema'),
      defaultValue: 'file-and-schema',
      comment: 'Processing mode',
    },
    lastProcessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last processing timestamp',
    },
    processedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of processing operations',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who created the schema',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who last updated the schema',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes',
    },
  },
  {
    tableName: 'raw_file_schemas',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        unique: true,
        fields: ['entityName'],
        where: {
          status: {
            [Op.ne]: 'deleted',
          },
        },
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdBy'],
      },
      {
        fields: ['updatedAt'],
      },
      {
        fields: ['fileKey'],
      },
    ],
  }
);
```

### Key Features

- **Unique Constraint**: One active schema per entity (excludes deleted)
- **File Metadata**: Complete file information including S3 details
- **Schema Attributes**: Structured schema definition with data types
- **Processing Tracking**: Tracks processing operations and timestamps
- **Soft Delete**: Uses status field instead of hard delete

### Schema Attributes Structure

```javascript
schemaAttributes: [
  {
    name: 'column_name',
    dataType: 'string|integer|decimal|boolean|datetime|email|url',
    nullable: true | false,
    description: 'Column description',
    sampleValues: ['value1', 'value2'],
    statistics: {
      nullCount: 0,
      uniqueValues: 100,
      maxLength: 50,
      avgLength: 25,
    },
  },
];
```

### Schema Metadata Structure

```javascript
schemaMetadata: {
  totalRows: 1000,
  delimiter: ',',
  fileType: 'csv',
  analyzedRows: 100,
  dataTypes: [
    {
      column: 'column_name',
      type: 'string',
      nullable: true
    }
  ]
}
```

## ConsumptionFileSchema Model

**File**: `models/ConsumptionFileSchema.js`

**Purpose**: Stores consumption layer file schema information.

### Schema Definition

```javascript
const ConsumptionFileSchema = sq.define(
  'ConsumptionFileSchema',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the consumption entity',
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Consumption file name',
    },
    fileKey: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'S3 object key',
    },
    fileLocation: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'File location URL',
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'File size in bytes',
    },
    contentType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'MIME type of the file',
    },
    schemaAttributes: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Consumption schema attributes',
    },
    schemaMetadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Schema metadata and statistics',
    },
    fileData: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'File processing metadata',
    },
    sourceEntities: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Source entities used in consumption layer',
    },
    joinRelationships: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Join relationships between entities',
    },
    transformations: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Transformations applied to create consumption layer',
    },
    schemaId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Unique consumption schema identifier',
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'deleted'),
      defaultValue: 'active',
      comment: 'Schema status',
    },
    lastProcessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last processing timestamp',
    },
    processedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of processing operations',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who created the schema',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who last updated the schema',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes',
    },
  },
  {
    tableName: 'consumption_file_schemas',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        unique: true,
        fields: ['entityName'],
        where: {
          status: {
            [Op.ne]: 'deleted',
          },
        },
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdBy'],
      },
      {
        fields: ['updatedAt'],
      },
      {
        fields: ['fileKey'],
      },
    ],
  }
);
```

### Key Features

- **Consumption Layer**: Specifically for consumption layer entities
- **Source Entities**: Tracks which entities are used as sources
- **Join Relationships**: Defines how entities are joined
- **Transformations**: Stores consumption-specific transformations
- **M:1 Mappings**: Handles many-to-one relationship mappings

### Source Entities Structure

```javascript
sourceEntities: [
  {
    entityName: 'customers',
    role: 'primary',
    weight: 1.0,
  },
  {
    entityName: 'orders',
    role: 'secondary',
    weight: 0.8,
  },
];
```

### Join Relationships Structure

```javascript
joinRelationships: [
  {
    leftEntity: 'customers',
    rightEntity: 'orders',
    joinType: 'LEFT JOIN',
    joinCondition: 'customers.id = orders.customer_id',
    cardinality: '1:M',
  },
];
```

## BatchProjection Model

**File**: `models/BatchProjection.js`

**Purpose**: Stores batch projection configurations and execution metadata.

### Schema Definition

```javascript
const BatchProjection = sq.define(
  'BatchProjection',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the projection entity',
    },
    selectedEntities: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Selected entities for projection',
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Projection settings and configuration',
    },
    schedule: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Scheduling configuration',
    },
    output: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Output format and destination configuration',
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'completed', 'failed'),
      defaultValue: 'active',
      comment: 'Projection status',
    },
    lastRunAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last execution timestamp',
    },
    nextRunAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Next scheduled execution',
    },
    runCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of executions',
    },
    errorCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of failed executions',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Last error message',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who created the projection',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who last updated the projection',
    },
  },
  {
    tableName: 'batch_projections',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['status'],
      },
      {
        fields: ['entityName'],
      },
      {
        fields: ['createdBy'],
      },
      {
        fields: ['nextRunAt'],
      },
      {
        fields: ['lastRunAt'],
      },
    ],
  }
);
```

### Key Features

- **Scheduling**: Cron-based scheduling configuration
- **Execution Tracking**: Tracks run history and errors
- **Status Management**: Active, paused, completed, failed states
- **Output Configuration**: Flexible output format settings
- **Error Handling**: Tracks and stores error information

### Settings Structure

```javascript
settings: {
  dataSource: 's3|ai',
  filters: {
    attributes: ['column1', 'column2'],
    conditions: [
      {
        column: 'status',
        operator: 'equals',
        value: 'active'
      }
    ]
  },
  transformations: {
    aggregations: [
      {
        column: 'amount',
        function: 'sum',
        groupBy: ['category']
      }
    ]
  }
}
```

### Schedule Structure

```javascript
schedule: {
  type: 'cron',
  expression: '0 0 * * *', // Daily at midnight
  timezone: 'UTC',
  enabled: true
}
```

### Output Structure

```javascript
output: {
  format: 'csv|json|parquet',
  compression: 'gzip|zip|none',
  destination: 's3',
  bucket: 'projections-bucket',
  prefix: 'projections/',
  filename: '{entityName}_{timestamp}'
}
```

## GitHubConnection Model

**File**: `models/GitHubConnection.js`

**Purpose**: Stores GitHub integration credentials and connection metadata.

### Schema Definition

```javascript
const GitHubConnection = sq.define(
  'GitHubConnection',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    repositoryUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'GitHub repository URL',
    },
    repositoryOwner: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Repository owner',
    },
    repositoryName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Repository name',
    },
    branch: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Repository branch',
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'GitHub username or token',
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Encrypted GitHub password',
    },
    authMethod: {
      type: DataTypes.ENUM('token', 'password'),
      allowNull: false,
      comment: 'Authentication method',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is the active connection',
    },
    lastTestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last connection test timestamp',
    },
    lastTestResult: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Last test result data',
    },
    testCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of connection tests',
    },
    successCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of successful tests',
    },
    failureCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of failed tests',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Last error message',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional connection metadata',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who created the connection',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who last updated the connection',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes',
    },
  },
  {
    tableName: 'github_connections',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['isActive'],
      },
      {
        fields: ['repositoryOwner', 'repositoryName'],
      },
      {
        fields: ['createdBy'],
      },
      {
        fields: ['lastTestedAt'],
      },
    ],
  }
);
```

### Key Features

- **Security**: Encrypted password storage
- **Authentication**: Supports both token and username/password
- **Connection Testing**: Tracks test history and results
- **Active Connection**: Only one active connection at a time
- **Repository Metadata**: Stores repository information

### Last Test Result Structure

```javascript
lastTestResult: {
  repository: 'owner/repo',
  branch: 'main',
  defaultBranch: 'main',
  private: false,
  permissions: {
    admin: false,
    push: true,
    pull: true
  },
  lastCommit: 'abc1234'
}
```

### Metadata Structure

```javascript
metadata: {
  defaultBranch: 'main',
  private: false,
  permissions: {
    admin: false,
    push: true,
    pull: true
  },
  lastSync: '2024-01-01T00:00:00Z'
}
```

## NLPArtifact Model

**File**: `models/NLPArtifact.js`

**Purpose**: Stores AI-generated code artifacts.

### Schema Definition

```javascript
const NLPArtifact = sq.define(
  'NLPArtifact',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the entity',
    },
    artifactType: {
      type: DataTypes.ENUM('sql', 'pyspark'),
      allowNull: false,
      comment: 'Type of generated artifact',
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Generated code content',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of the artifact',
    },
    columns: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Columns involved in the artifact',
    },
    status: {
      type: DataTypes.ENUM('accepted', 'archived', 'deleted'),
      defaultValue: 'accepted',
      comment: 'Artifact status',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who created the artifact',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who last updated the artifact',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes',
    },
  },
  {
    tableName: 'nlp_artifacts',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['entityName'],
      },
      {
        fields: ['artifactType'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdBy'],
      },
      {
        fields: ['updatedAt'],
      },
    ],
  }
);
```

### Key Features

- **Code Storage**: Stores generated SQL and PySpark code
- **Entity Association**: Links artifacts to specific entities
- **Status Management**: Tracks artifact lifecycle
- **Column Metadata**: Stores column information used in generation

### Columns Structure

```javascript
columns: [
  {
    name: 'column_name',
    dataType: 'string',
    description: 'Column description',
    isRequired: true,
  },
];
```

## ConsumptionETLTransformation Model

**File**: `models/ConsumptionETLTransformation.js`

**Purpose**: Stores consumption ETL transformation rules.

### Schema Definition

```javascript
const ConsumptionETLTransformation = sq.define(
  'ConsumptionETLTransformation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the entity',
    },
    columnName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the column',
    },
    transformationType: {
      type: DataTypes.ENUM('mapping', 'aggregation', 'calculation', 'filter'),
      allowNull: false,
      comment: 'Type of transformation',
    },
    rules: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Transformation rules',
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Generated transformation code',
    },
    status: {
      type: DataTypes.ENUM('accepted', 'archived', 'deleted'),
      defaultValue: 'accepted',
      comment: 'Transformation status',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who created the transformation',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who last updated the transformation',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes',
    },
  },
  {
    tableName: 'consumption_etl_transformations',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['entityName'],
      },
      {
        fields: ['columnName'],
      },
      {
        fields: ['transformationType'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['entityName', 'columnName'],
      },
      {
        fields: ['createdBy'],
      },
    ],
  }
);
```

### Key Features

- **Column-specific**: Transformations are defined per column
- **Transformation Types**: Mapping, aggregation, calculation, filter
- **Code Generation**: Stores generated transformation code
- **Entity-Column Index**: Optimized for entity/column queries

### Rules Structure

```javascript
rules: {
  mapping: {
    sourceColumn: 'source_col',
    targetColumn: 'target_col',
    transformation: 'uppercase'
  },
  aggregation: {
    function: 'sum',
    groupBy: ['category'],
    condition: 'status = "active"'
  },
  calculation: {
    formula: 'amount * tax_rate',
    dependencies: ['amount', 'tax_rate']
  },
  filter: {
    condition: 'amount > 100',
    operator: 'greater_than'
  }
}
```

## WorkspaceCode Model

**File**: `models/WorkspaceCode.js`

**Purpose**: Stores custom workspace code snippets.

### Schema Definition

```javascript
const WorkspaceCode = sq.define(
  'WorkspaceCode',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Name of the entity',
    },
    codeType: {
      type: DataTypes.ENUM('sql', 'pyspark'),
      allowNull: false,
      comment: 'Type of code',
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Code content',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of the code',
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Tags for categorization',
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'deleted'),
      defaultValue: 'active',
      comment: 'Code status',
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who created the code',
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'system',
      comment: 'User who last updated the code',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes',
    },
  },
  {
    tableName: 'workspace_codes',
    timestamps: true,
    paranoid: false,
    indexes: [
      {
        fields: ['entityName'],
      },
      {
        fields: ['codeType'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdBy'],
      },
      {
        fields: ['updatedAt'],
      },
    ],
  }
);
```

### Key Features

- **Custom Code**: User-defined SQL and PySpark code
- **Entity Association**: Links code to specific entities
- **Tagging System**: Flexible categorization with tags
- **Status Management**: Active, archived, deleted states

### Tags Structure

```javascript
tags: ['data-quality', 'transformation', 'custom-logic', 'optimization'];
```

## Model Relationships

### Implicit Relationships

While no explicit foreign key relationships are defined, models are related through:

1. **Entity Names**: Common entity names link related records across models
2. **User Tracking**: Created/updated by fields track user relationships
3. **Status Fields**: Common status management patterns
4. **Timestamps**: Created/updated timestamps for audit trails

### Common Patterns

#### Entity-based Relationships

- `AttributeTransformation.entityName` → `RawFileSchema.entityName`
- `ConsumptionFileSchema.entityName` → `AttributeTransformation.entityName`
- `NLPArtifact.entityName` → `RawFileSchema.entityName`
- `ConsumptionETLTransformation.entityName` → `ConsumptionFileSchema.entityName`
- `WorkspaceCode.entityName` → `RawFileSchema.entityName`

#### User-based Relationships

- All models track `createdBy` and `updatedBy` for user relationships
- User activity can be tracked across all models

#### Status-based Relationships

- All models use status fields for lifecycle management
- Common status values: active, archived, deleted
- Some models have additional status values (draft, paused, completed, failed)

## Database Indexes

### Performance Optimization

All models include strategic indexes for common query patterns:

1. **Entity-based Queries**: Indexes on entity names
2. **Status Filtering**: Indexes on status fields
3. **User Filtering**: Indexes on created/updated by fields
4. **Time-based Queries**: Indexes on timestamps
5. **Unique Constraints**: Prevents duplicate records

### Index Strategies

- **Composite Indexes**: Multi-column indexes for complex queries
- **Partial Indexes**: Conditional indexes (e.g., excluding deleted records)
- **Covering Indexes**: Include frequently accessed columns

## Data Validation

### Model-level Validation

- **Required Fields**: Non-nullable fields with appropriate defaults
- **Enum Values**: Restricted values for status and type fields
- **Unique Constraints**: Prevents duplicate records
- **Data Types**: Appropriate data types for different field types

### Application-level Validation

- **JSONB Validation**: Validates structure of JSONB fields
- **Business Rules**: Enforced in service layer
- **Input Sanitization**: Handled in controllers

## Migration Strategy

### Schema Evolution

- **Additive Changes**: New fields can be added safely
- **Backward Compatibility**: Existing data remains valid
- **Default Values**: New fields include appropriate defaults
- **Index Management**: New indexes added without downtime

### Data Migration

- **Soft Deletes**: Uses status fields instead of hard deletes
- **Data Preservation**: Historical data maintained
- **Audit Trail**: Complete change history tracked

## Security Considerations

### Data Protection

- **Encrypted Fields**: Sensitive data (passwords) encrypted
- **Access Control**: User-based access tracking
- **Audit Logging**: Complete change history
- **Input Validation**: Prevents injection attacks

### Database Security

- **Parameterized Queries**: Sequelize ORM prevents SQL injection
- **Connection Security**: Encrypted database connections
- **Access Control**: Database user permissions
- **Backup Security**: Encrypted backups
