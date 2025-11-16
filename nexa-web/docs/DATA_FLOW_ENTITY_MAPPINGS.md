# Data Flow and Entity Mappings Documentation

## Overview

This document provides a comprehensive guide to understanding the data flow patterns, entity mapping processes, and transformation logic within the AA Website platform. It covers the complete data pipeline from raw data ingestion to curated artifact generation.

## Data Flow Architecture

### High-Level Data Flow

```
Raw Data Files (CSV)
    ↓
File Upload & Schema Detection
    ↓
Raw Entity Creation
    ↓
Entity Mapping & Transformation Rules
    ↓
Curated Entity Generation
    ↓
Artifact Generation (DDL/DML)
    ↓
GitHub Integration & Version Control
    ↓
Consumption Layer Processing
    ↓
Gold Data Generation
```

## Data Layers

### 1. Raw Data Layer

**Purpose**: Initial data ingestion and schema detection

**Characteristics**:

- Source data files (primarily CSV)
- Automatic schema detection
- Column type inference
- Data quality assessment

**Example Structure**:

```javascript
// Raw Entity: raw.customers
{
  entityName: "raw.customers",
  sourceFile: "customers.csv",
  attributes: [
    { name: "id", type: "INTEGER", nullable: false },
    { name: "first_name", type: "VARCHAR(50)", nullable: true },
    { name: "last_name", type: "VARCHAR(50)", nullable: true },
    { name: "email", type: "VARCHAR(100)", nullable: true },
    { name: "phone", type: "VARCHAR(20)", nullable: true }
  ],
  metadata: {
    rowCount: 1000,
    fileSize: "2.5MB",
    uploadDate: "2024-01-01T00:00:00Z"
  }
}
```

### 2. Curated Data Layer

**Purpose**: Cleaned, standardized, and enriched data

**Characteristics**:

- Standardized naming conventions
- Data type consistency
- Business rule application
- Control column addition

**Example Structure**:

```javascript
// Curated Entity: curated.customers
{
  entityName: "curated.customers",
  sourceEntity: "raw.customers",
  attributes: [
    { name: "customer_id", type: "INTEGER", constraints: ["PRIMARY KEY"] },
    { name: "full_name", type: "VARCHAR(255)", constraints: ["NOT NULL"] },
    { name: "email_address", type: "VARCHAR(255)", constraints: ["UNIQUE"] },
    { name: "phone_number", type: "VARCHAR(20)", constraints: [] },
    // Control columns
    { name: "_ingest_timestamp", type: "TIMESTAMP", constraints: ["NOT NULL"] },
    { name: "_source_system", type: "VARCHAR(50)", constraints: ["NOT NULL"] },
    { name: "_record_status", type: "VARCHAR(20)", constraints: ["NOT NULL"] },
    { name: "_update_timestamp", type: "TIMESTAMP", constraints: [] },
    { name: "_batch_id", type: "VARCHAR(50)", constraints: [] },
    { name: "_created_by", type: "VARCHAR(50)", constraints: [] },
    { name: "_updated_by", type: "VARCHAR(50)", constraints: [] }
  ],
  transformations: {
    mappings: [...],
    rules: [...],
    businessLogic: [...]
  }
}
```

### 3. Consumption Data Layer

**Purpose**: Business-ready data for analytics and reporting

**Characteristics**:

- Aggregated and summarized data
- Business metrics calculation
- Cross-entity relationships
- Performance optimization

**Example Structure**:

```javascript
// Consumption Entity: consumption.customer_metrics
{
  entityName: "consumption.customer_metrics",
  sourceEntities: ["curated.customers", "curated.orders"],
  attributes: [
    { name: "customer_id", type: "INTEGER", constraints: ["PRIMARY KEY"] },
    { name: "total_orders", type: "INTEGER", constraints: [] },
    { name: "total_spent", type: "DECIMAL(10,2)", constraints: [] },
    { name: "avg_order_value", type: "DECIMAL(10,2)", constraints: [] },
    { name: "last_order_date", type: "DATE", constraints: [] },
    { name: "customer_segment", type: "VARCHAR(50)", constraints: [] }
  ],
  aggregations: {
    total_orders: "COUNT(orders.id)",
    total_spent: "SUM(orders.amount)",
    avg_order_value: "AVG(orders.amount)"
  }
}
```

## Entity Mapping Process

### 1. Automatic Mapping

#### Name-Based Mapping

The system automatically maps columns based on name similarity:

```javascript
// Mapping Rules
const mappingRules = {
  // Exact matches
  "id" → "customer_id",
  "name" → "full_name",
  "email" → "email_address",

  // Pattern-based matches
  "first_name" + "last_name" → "full_name",
  "phone" → "phone_number",
  "created_at" → "_ingest_timestamp"
};
```

#### Semantic Mapping

AI-powered mapping based on column content analysis:

```javascript
// NLP-based mapping suggestions
{
  sourceColumn: "cust_email",
  suggestedTarget: "email_address",
  confidence: 0.95,
  reasoning: "Column contains email addresses based on pattern analysis"
}
```

### 2. Manual Mapping Override

Users can manually override automatic mappings:

```javascript
// Manual mapping configuration
{
  sourceColumn: "id",
  targetColumn: "customer_id",
  transformation: "direct_mapping",
  validation: {
    required: true,
    unique: true,
    dataType: "INTEGER"
  }
}
```

### 3. Complex Transformations

#### Concatenation Rules

```javascript
{
  ruleType: "concatenation",
  sourceColumns: ["first_name", "last_name"],
  targetColumn: "full_name",
  separator: " ",
  transformation: "CONCAT(first_name, ' ', last_name)"
}
```

#### Case Statement Rules

```javascript
{
  ruleType: "case_statement",
  sourceColumn: "status",
  targetColumn: "customer_status",
  conditions: [
    { when: "status = 'A'", then: "'Active'" },
    { when: "status = 'I'", then: "'Inactive'" },
    { else: "'Unknown'" }
  ]
}
```

#### Calculation Rules

```javascript
{
  ruleType: "calculation",
  sourceColumns: ["price", "quantity"],
  targetColumn: "total_amount",
  formula: "price * quantity",
  dataType: "DECIMAL(10,2)"
}
```

## Transformation Rules Engine

### 1. Column Rules

Define column-level transformations and constraints:

```javascript
const columnRules = {
  customer_id: {
    type: "primary_key",
    constraints: ["not_null", "unique"],
    validation: "integer_positive",
  },
  email_address: {
    type: "business_key",
    constraints: ["not_null", "unique"],
    validation: "email_format",
    transformation: "lowercase",
  },
  full_name: {
    type: "descriptive",
    constraints: ["not_null"],
    validation: "not_empty",
    transformation: "trim",
  },
};
```

### 2. Operator Rules

Define operator-based transformations:

```javascript
const operatorRules = {
  email_address: {
    operators: [
      { type: "lowercase", applied: true },
      { type: "trim", applied: true },
      { type: "validate_email", applied: true },
    ],
  },
  phone_number: {
    operators: [
      { type: "format_phone", pattern: "(XXX) XXX-XXXX", applied: true },
      { type: "remove_non_numeric", applied: true },
    ],
  },
};
```

### 3. Entity-Level Rules

Define entity-wide business rules:

```javascript
const entityRules = {
  "curated.customers": {
    businessRules: [
      {
        name: "email_uniqueness",
        description: "Email addresses must be unique across all customers",
        validation:
          "SELECT COUNT(*) FROM curated.customers WHERE email_address = ?",
        errorMessage: "Email address already exists",
      },
      {
        name: "active_customer_validation",
        description: "Active customers must have valid contact information",
        validation:
          "status = 'Active' AND (email_address IS NOT NULL OR phone_number IS NOT NULL)",
        errorMessage: "Active customers must have email or phone",
      },
    ],
    dataQualityRules: [
      {
        name: "email_format_validation",
        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        appliedTo: "email_address",
      },
    ],
  },
};
```

## Data Lineage Tracking

### 1. Source Tracking

Track data lineage from source to target:

```javascript
const dataLineage = {
  "curated.customers.customer_id": {
    source: "raw.customers.id",
    transformation: "direct_mapping",
    appliedAt: "2024-01-01T00:00:00Z",
    version: "1.0",
  },
  "curated.customers.full_name": {
    source: ["raw.customers.first_name", "raw.customers.last_name"],
    transformation: "concatenation",
    formula: "CONCAT(first_name, ' ', last_name)",
    appliedAt: "2024-01-01T00:00:00Z",
    version: "1.0",
  },
};
```

### 2. Impact Analysis

Analyze the impact of changes on downstream systems:

```javascript
const impactAnalysis = {
  "raw.customers.email": {
    directImpact: ["curated.customers.email_address"],
    indirectImpact: [
      "consumption.customer_metrics.email_domain",
      "consumption.customer_segments.email_based_segment",
    ],
    affectedArtifacts: [
      "artifacts/curated/customers_ddl.sql",
      "artifacts/curated/customers_dml.sql",
    ],
  },
};
```

## Artifact Generation Process

### 1. DDL Generation

Generate Data Definition Language scripts:

```sql
-- Generated DDL for curated.customers
CREATE TABLE curated.customers (
    customer_id INTEGER PRIMARY KEY NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email_address VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    _ingest_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _source_system VARCHAR(50) NOT NULL DEFAULT 'raw.customers',
    _record_status VARCHAR(20) NOT NULL DEFAULT 'active',
    _update_timestamp TIMESTAMP,
    _batch_id VARCHAR(50),
    _created_by VARCHAR(50),
    _updated_by VARCHAR(50)
);

-- Indexes
CREATE INDEX idx_customers_email ON curated.customers(email_address);
CREATE INDEX idx_customers_status ON curated.customers(_record_status);
```

### 2. DML Generation

Generate Data Manipulation Language scripts:

```sql
-- Generated DML for curated.customers
INSERT INTO curated.customers (
    customer_id,
    full_name,
    email_address,
    phone_number,
    _ingest_timestamp,
    _source_system,
    _record_status,
    _batch_id,
    _created_by
)
SELECT
    id as customer_id,
    CONCAT(first_name, ' ', last_name) as full_name,
    LOWER(TRIM(email)) as email_address,
    REGEXP_REPLACE(phone, '[^0-9]', '', 'g') as phone_number,
    CURRENT_TIMESTAMP as _ingest_timestamp,
    'raw.customers' as _source_system,
    'active' as _record_status,
    'batch_' || CURRENT_DATE as _batch_id,
    'system' as _created_by
FROM raw.customers
WHERE email IS NOT NULL
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
```

### 3. Transformation Scripts

Generate transformation logic:

```javascript
// Generated transformation script
const transformationScript = {
  entityName: "curated.customers",
  sourceEntity: "raw.customers",
  transformations: [
    {
      sourceColumn: "id",
      targetColumn: "customer_id",
      type: "direct_mapping",
      validation: "integer_positive",
    },
    {
      sourceColumns: ["first_name", "last_name"],
      targetColumn: "full_name",
      type: "concatenation",
      formula: "CONCAT(first_name, ' ', last_name)",
      validation: "not_empty",
    },
    {
      sourceColumn: "email",
      targetColumn: "email_address",
      type: "transformation",
      operations: ["lowercase", "trim", "validate_email"],
      validation: "email_format",
    },
  ],
  businessRules: [
    {
      name: "email_uniqueness",
      validation:
        "SELECT COUNT(*) FROM curated.customers WHERE email_address = ?",
      errorHandling: "skip_record",
    },
  ],
};
```

## Data Quality Management

### 1. Validation Rules

Define data quality validation rules:

```javascript
const validationRules = {
  email_address: {
    format: "email",
    required: true,
    unique: true,
    maxLength: 255,
  },
  phone_number: {
    format: "phone",
    required: false,
    pattern: "^\\+?[1-9]\\d{1,14}$",
  },
  customer_id: {
    type: "integer",
    required: true,
    min: 1,
    unique: true,
  },
};
```

### 2. Data Quality Metrics

Track data quality metrics:

```javascript
const dataQualityMetrics = {
  "curated.customers": {
    completeness: {
      email_address: 0.95, // 95% of records have email
      phone_number: 0.78, // 78% of records have phone
      full_name: 1.0, // 100% of records have name
    },
    validity: {
      email_address: 0.98, // 98% of emails are valid format
      phone_number: 0.92, // 92% of phones are valid format
      customer_id: 1.0, // 100% of IDs are valid integers
    },
    uniqueness: {
      email_address: 0.99, // 99% of emails are unique
      customer_id: 1.0, // 100% of IDs are unique
    },
  },
};
```

### 3. Error Handling

Handle data quality issues:

```javascript
const errorHandling = {
  email_format_error: {
    action: "skip_record",
    logLevel: "warning",
    notification: "Data quality issue detected",
  },
  duplicate_email: {
    action: "update_existing",
    logLevel: "info",
    notification: "Duplicate email updated",
  },
  missing_required_field: {
    action: "reject_record",
    logLevel: "error",
    notification: "Required field missing",
  },
};
```

## Performance Optimization

### 1. Batch Processing

Process data in batches for better performance:

```javascript
const batchProcessing = {
  batchSize: 1000,
  parallelProcessing: true,
  maxConcurrency: 5,
  retryPolicy: {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
  },
};
```

### 2. Caching Strategy

Cache frequently accessed data:

```javascript
const cachingStrategy = {
  entitySchemas: {
    ttl: 3600, // 1 hour
    maxSize: 100,
  },
  transformationRules: {
    ttl: 1800, // 30 minutes
    maxSize: 50,
  },
  fileMetadata: {
    ttl: 900, // 15 minutes
    maxSize: 200,
  },
};
```

### 3. Indexing Strategy

Optimize database performance:

```sql
-- Performance indexes
CREATE INDEX idx_customers_email_hash ON curated.customers USING hash(email_address);
CREATE INDEX idx_customers_status_btree ON curated.customers(_record_status);
CREATE INDEX idx_customers_ingest_time ON curated.customers(_ingest_timestamp);

-- Composite indexes for common queries
CREATE INDEX idx_customers_status_email ON curated.customers(_record_status, email_address);
```

## Monitoring and Alerting

### 1. Data Pipeline Monitoring

Monitor data pipeline health:

```javascript
const pipelineMonitoring = {
  metrics: [
    "processing_time",
    "record_count",
    "error_rate",
    "data_quality_score",
  ],
  alerts: [
    {
      metric: "error_rate",
      threshold: 0.05,
      action: "send_notification",
    },
    {
      metric: "processing_time",
      threshold: 300, // 5 minutes
      action: "escalate",
    },
  ],
};
```

### 2. Data Quality Monitoring

Monitor data quality metrics:

```javascript
const qualityMonitoring = {
  checks: [
    {
      name: "completeness_check",
      entity: "curated.customers",
      field: "email_address",
      threshold: 0.9,
      frequency: "daily",
    },
    {
      name: "validity_check",
      entity: "curated.customers",
      field: "email_address",
      threshold: 0.95,
      frequency: "daily",
    },
  ],
};
```

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
