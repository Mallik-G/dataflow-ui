# EditGoldEntityMappingsPage Component Documentation

## Overview

The `EditGoldEntityMappingsPage` (also known as `EditConsumptionEntityMappingsPage`) is a specialized component for managing entity mappings and transformations in the consumption (gold) layer. It provides detailed interfaces for mapping curated entities to consumption entities, applying business transformations, and generating consumption-ready artifacts.

## Component Details

- **File**: `src/screens/EditGoldEntityMappingsPage.jsx`
- **Route**: `/edit-consumption-entity-mappings/:entityName`
- **Type**: React Functional Component
- **Size**: ~2,600 lines (complex component)
- **Alias**: `EditConsumptionEntityMappingsPage`

## Purpose

This component serves as the primary interface for:

1. **Consumption Entity Mapping**: Map curated entities to consumption entities
2. **Business Transformation Rules**: Define complex business logic and transformations
3. **Column Mapping**: Map columns from multiple sources to consumption output
4. **Data Type Management**: Handle data type conversions and validations
5. **Artifact Generation**: Generate SQL and PySpark code for consumption processing
6. **NLP Integration**: Manage AI-generated transformation suggestions

## Key Features

### 1. Entity Mapping Management

- **Multi-Source Mapping**: Map columns from multiple curated entities
- **Transformation Rules**: Define complex transformation logic
- **Data Type Conversion**: Handle data type conversions and validations
- **Business Logic Application**: Apply business rules and aggregations

### 2. Advanced Transformations

- **Concatenation Rules**: Combine multiple columns into single output
- **Case Statement Rules**: Apply conditional logic based on data values
- **Calculation Rules**: Perform mathematical operations on data
- **Aggregation Rules**: Apply aggregation functions (SUM, AVG, COUNT, etc.)

### 3. Code Generation

- **SQL Generation**: Generate complex SQL scripts for data processing
- **PySpark Generation**: Generate PySpark code for big data processing
- **Transformation Scripts**: Generate transformation logic scripts

### 4. AI Integration

- **NLP Rule Management**: Manage AI-generated transformation rules
- **Smart Suggestions**: AI-powered mapping and transformation suggestions
- **Natural Language Processing**: Process transformation rules in natural language

## Props Interface

```javascript
interface EditGoldEntityMappingsPageProps {
  entityName?: string; // Name of the consumption entity
  consumptionData?: ConsumptionData; // Consumption file data
  records?: Record[]; // Sample records for preview
  onSwitchToCanvas?: (entityName: string, records: Record[]) => void; // Canvas navigation callback
}
```

## State Management

The component manages extensive state across multiple categories:

### Core Data State

```javascript
const [consumptionSchema, setConsumptionSchema] = useState([]); // Consumption schema
const [sourceEntities, setSourceEntities] = useState([]); // Source curated entities
const [mappings, setMappings] = useState([]); // Column mappings
const [transformations, setTransformations] = useState({}); // Transformation rules
const [loading, setLoading] = useState(true); // Loading state
```

### Transformation Rules State

```javascript
const [columnRules, setColumnRules] = useState({}); // Column-level rules
const [operatorRules, setOperatorRules] = useState({}); // Operator-based rules
const [concatenationRules, setConcatenationRules] = useState([]); // Concatenation rules
const [entityNLPRules, setEntityNLPRules] = useState([]); // NLP rules
const [columnDescriptions, setColumnDescriptions] = useState({}); // Column descriptions
```

### UI State

```javascript
const [actionModal, setActionModal] = useState({
  // Action modal state
  open: false,
  type: "",
  column: "",
  data: null,
});
const [descriptionModal, setDescriptionModal] = useState({
  // Description modal state
  open: false,
  column: "",
  description: "",
});
const [showCodeModal, setShowCodeModal] = useState(false); // Code generation modal
const [generatedCode, setGeneratedCode] = useState({}); // Generated code
```

## Key Functions

### 1. Data Initialization

#### `initializeData()`

- **Purpose**: Initializes component data and state
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Loads consumption schema and source entities

```javascript
const initializeData = async () => {
  setLoading(true);

  try {
    // Load consumption schema
    await loadConsumptionSchema();

    // Load source entities
    await loadSourceEntities();

    // Load saved transformations
    await loadSavedTransformations();
  } catch (error) {
    console.error("Error initializing data:", error);
    handleError(error, "Data initialization");
  } finally {
    setLoading(false);
  }
};
```

#### `loadConsumptionSchema()`

- **Purpose**: Loads the consumption entity schema
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Updates consumption schema state

```javascript
const loadConsumptionSchema = async (savedTransformationsFound = false) => {
  try {
    const response = await axios.get(`/api/consumption-schemas/${entityName}`);
    const schema = response.data;

    setConsumptionSchema(schema.columns || []);

    if (!savedTransformationsFound) {
      // Initialize default mappings
      const defaultMappings = schema.columns.map((column) => ({
        source: "",
        target: column.name,
        sourceEntity: "",
        transformation: "direct_mapping",
        dataType: column.type,
      }));
      setMappings(defaultMappings);
    }
  } catch (error) {
    console.error("Error loading consumption schema:", error);
  }
};
```

### 2. Mapping Management

#### `updateMapping(idx, field, value)`

- **Purpose**: Updates a specific mapping
- **Parameters**:
  - `idx` (number): Index of the mapping to update
  - `field` (string): Field to update
  - `value` (any): New value
- **Returns**: void
- **Side Effects**: Updates mappings state and triggers auto-save

```javascript
const updateMapping = (idx, field, value) => {
  setMappings((prev) => {
    const newMappings = [...prev];
    newMappings[idx] = { ...newMappings[idx], [field]: value };
    return newMappings;
  });

  // Trigger auto-save
  debouncedAutoSave();
};
```

#### `deleteMapping(idx)`

- **Purpose**: Deletes a mapping
- **Parameters**:
  - `idx` (number): Index of the mapping to delete
- **Returns**: void
- **Side Effects**: Updates mappings state

```javascript
const deleteMapping = (idx) => {
  setMappings((prev) => prev.filter((_, index) => index !== idx));
};
```

#### `addMapping()`

- **Purpose**: Adds a new mapping
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Updates mappings state

```javascript
const addMapping = () => {
  const newMapping = {
    source: "",
    target: "",
    sourceEntity: "",
    transformation: "direct_mapping",
    dataType: "VARCHAR(255)",
  };

  setMappings((prev) => [...prev, newMapping]);
};
```

### 3. Transformation Rules Management

#### `handleConcatenateColumns()`

- **Purpose**: Handles concatenation rule creation
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Opens concatenation modal

```javascript
const handleConcatenateColumns = () => {
  setActionModal({
    open: true,
    type: "concatenation",
    column: "",
    data: {
      sourceColumns: [],
      targetColumn: "",
      separator: " ",
    },
  });
};
```

#### `saveConcatenationRule(rule)`

- **Purpose**: Saves a concatenation rule
- **Parameters**:
  - `rule` (object): Concatenation rule data
- **Returns**: void
- **Side Effects**: Updates concatenation rules state

```javascript
const saveConcatenationRule = (rule) => {
  const newRule = {
    id: Date.now().toString(),
    ...rule,
    createdAt: new Date().toISOString(),
  };

  setConcatenationRules((prev) => [...prev, newRule]);
  setActionModal({ open: false, type: "", column: "", data: null });
};
```

### 4. Code Generation

#### `generateSQLCode()`

- **Purpose**: Generates SQL code for consumption processing
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Updates generated code state

```javascript
const generateSQLCode = () => {
  const sqlCode = `
-- Generated SQL for ${entityName}
CREATE TABLE ${entityName} AS
SELECT 
${mappings
  .map((mapping) => {
    if (mapping.transformation === "direct_mapping") {
      return `  ${mapping.sourceEntity}.${mapping.source} AS ${mapping.target}`;
    } else if (mapping.transformation === "concatenation") {
      const rule = concatenationRules.find(
        (r) => r.targetColumn === mapping.target
      );
      if (rule) {
        const concatExpr = rule.sourceColumns
          .map((col) => `COALESCE(${mapping.sourceEntity}.${col}, '')`)
          .join(` || '${rule.separator}' || `);
        return `  ${concatExpr} AS ${mapping.target}`;
      }
    } else if (mapping.transformation === "case_statement") {
      const rule = columnRules[mapping.target];
      if (rule && rule.caseConditions) {
        const conditions = rule.caseConditions
          .map(
            (cond) =>
              `    WHEN ${mapping.sourceEntity}.${mapping.source} = '${cond.when}' THEN '${cond.then}'`
          )
          .join("\n");
        return `  CASE ${mapping.sourceEntity}.${
          mapping.source
        }\n${conditions}\n    ELSE '${rule.defaultValue || "Unknown"}' END AS ${
          mapping.target
        }`;
      }
    }
    return `  ${mapping.sourceEntity}.${mapping.source} AS ${mapping.target}`;
  })
  .join(",\n")}
FROM ${sourceEntities.map((entity) => entity.name).join(", ")}
${joinRelationships
  .map(
    (rel) =>
      `JOIN ${rel.targetEntity} ON ${rel.sourceEntity}.${rel.sourceColumn} = ${rel.targetEntity}.${rel.targetColumn}`
  )
  .join("\n")}
WHERE ${filterConditions.join(" AND ")};
  `;

  setGeneratedCode((prev) => ({ ...prev, sql: sqlCode }));
  setShowCodeModal(true);
};
```

#### `generatePySparkCode()`

- **Purpose**: Generates PySpark code for big data processing
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Updates generated code state

```javascript
const generatePySparkCode = () => {
  const pysparkCode = `
# Generated PySpark code for ${entityName}
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

# Initialize Spark session
spark = SparkSession.builder.appName("${entityName}").getOrCreate()

# Read source data
${sourceEntities
  .map((entity) => `${entity.name} = spark.read.table("${entity.name}")`)
  .join("\n")}

# Apply transformations
result = ${sourceEntities[0]?.name || "source_table"}
${mappings
  .map((mapping) => {
    if (mapping.transformation === "direct_mapping") {
      return `.withColumn("${mapping.target}", col("${mapping.source}"))`;
    } else if (mapping.transformation === "concatenation") {
      const rule = concatenationRules.find(
        (r) => r.targetColumn === mapping.target
      );
      if (rule) {
        const concatExpr = rule.sourceColumns
          .map((col) => `coalesce(col("${col}"), lit(""))`)
          .join(` + lit("${rule.separator}") + `);
        return `.withColumn("${mapping.target}", ${concatExpr})`;
      }
    }
    return `.withColumn("${mapping.target}", col("${mapping.source}"))`;
  })
  .join("\n")}

# Write result
result.write.mode("overwrite").saveAsTable("${entityName}")
  `;

  setGeneratedCode((prev) => ({ ...prev, pyspark: pysparkCode }));
  setShowCodeModal(true);
};
```

### 5. NLP Integration

#### `handleEntityNLP()`

- **Purpose**: Handles NLP rule management
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Opens NLP modal

```javascript
const handleEntityNLP = () => {
  setActionModal({
    open: true,
    type: "nlp",
    column: "",
    data: {
      rules: entityNLPRules,
      suggestions: [],
    },
  });
};
```

#### `saveEntityNLP()`

- **Purpose**: Saves NLP rules
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Updates NLP rules state

```javascript
const saveEntityNLP = () => {
  const newRule = {
    id: Date.now().toString(),
    rule: actionModal.data.rule,
    confidence: actionModal.data.confidence || 0.8,
    status: "accepted",
    createdAt: new Date().toISOString(),
  };

  setEntityNLPRules((prev) => [...prev, newRule]);
  setActionModal({ open: false, type: "", column: "", data: null });
};
```

### 6. Data Persistence

#### `saveMappingsOnly()`

- **Purpose**: Saves only the mappings without generating artifacts
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Persists mappings to backend

```javascript
const saveMappingsOnly = async () => {
  try {
    const transformationData = {
      entityName,
      mappings,
      columnRules,
      operatorRules,
      concatenationRules,
      entityNLPRules,
      columnDescriptions,
      sourceEntities: sourceEntities.map((e) => e.name),
      createdAt: new Date().toISOString(),
    };

    await axios.post(
      "/api/consumption-transformations/save",
      transformationData
    );

    // Show success message
    setSuccessMessage("Mappings saved successfully");
  } catch (error) {
    console.error("Error saving mappings:", error);
    handleError(error, "Save mappings");
  }
};
```

#### `saveTransformationsAndGenerateConsumptionFile()`

- **Purpose**: Saves transformations and generates consumption file
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Saves transformations and generates consumption artifacts

```javascript
const saveTransformationsAndGenerateConsumptionFile = async () => {
  try {
    // Save transformations
    await saveMappingsOnly();

    // Generate consumption file
    const consumptionFile = {
      name: entityName,
      entities: sourceEntities.map((e) => e.name),
      mappings,
      transformations: {
        columnRules,
        operatorRules,
        concatenationRules,
        entityNLPRules,
      },
      outputColumns: mappings.map((m) => ({
        name: m.target,
        sourceEntity: m.sourceEntity,
        sourceColumn: m.source,
        dataType: m.dataType,
        transformation: m.transformation,
      })),
    };

    await axios.post("/api/consumption-files/generate", consumptionFile);

    // Show success message
    setSuccessMessage("Consumption file generated successfully");
  } catch (error) {
    console.error("Error generating consumption file:", error);
    handleError(error, "Generate consumption file");
  }
};
```

## API Integration

### Endpoints Used

#### Schema Management

- `GET /api/consumption-schemas/{entityName}` - Get consumption entity schema
- `GET /api/curated-schemas/{entityName}` - Get curated entity schema
- `GET /api/entity-columns/{entityName}` - Get entity columns

#### Transformation Management

- `POST /api/consumption-transformations/save` - Save transformation rules
- `GET /api/consumption-transformations/{entityName}` - Get saved transformations
- `PUT /api/consumption-transformations/{entityName}` - Update transformations

#### Code Generation

- `POST /api/consumption-artifacts/generate-sql` - Generate SQL code
- `POST /api/consumption-artifacts/generate-pyspark` - Generate PySpark code
- `POST /api/consumption-artifacts/validate` - Validate generated code

#### Consumption File Management

- `POST /api/consumption-files/generate` - Generate consumption file
- `GET /api/consumption-files/{entityName}` - Get consumption file
- `PUT /api/consumption-files/{entityName}` - Update consumption file

## Data Models

### Mapping Structure

```javascript
interface Mapping {
  id?: string;
  source: string; // Source column name
  target: string; // Target column name
  sourceEntity: string; // Source entity name
  transformation: TransformationType; // Transformation type
  dataType: string; // Target data type
  isPrimaryKey?: boolean; // Is primary key
  isRequired?: boolean; // Is required field
}
```

### Transformation Rules Structure

```javascript
interface TransformationRules {
  columnRules: Record<string, ColumnRule>;
  operatorRules: Record<string, OperatorRule[]>;
  concatenationRules: ConcatenationRule[];
  entityNLPRules: NLPRule[];
  columnDescriptions: Record<string, string>;
}
```

### Concatenation Rule Structure

```javascript
interface ConcatenationRule {
  id: string;
  sourceColumns: string[];
  targetColumn: string;
  separator: string;
  dataType: string;
  createdAt: string;
}
```

## Error Handling

### Error Types

1. **API Errors**: Network and server errors
2. **Validation Errors**: Input validation failures
3. **Transformation Errors**: Invalid transformation rules
4. **Code Generation Errors**: SQL/PySpark generation failures
5. **Schema Errors**: Invalid schema configurations

### Error Management

```javascript
const [error, setError] = useState("");
const [isError, setIsError] = useState(false);

const handleError = (error, context = "") => {
  console.error(`Error in ${context}:`, error);
  setError(error.message || "An unexpected error occurred");
  setIsError(true);

  // Auto-hide error after 5 seconds
  setTimeout(() => {
    setIsError(false);
    setError("");
  }, 5000);
};
```

## Performance Considerations

### Optimization Strategies

1. **Debounced Auto-save**: Prevent excessive API calls
2. **Memoized Computations**: Cache expensive calculations
3. **Lazy Loading**: Load data on demand
4. **Efficient State Updates**: Use functional updates

### Memory Management

1. **State Cleanup**: Unused state is cleaned up
2. **Event Listeners**: Event listeners are properly removed
3. **API Cancellation**: Ongoing API calls are cancelled when needed

## Testing Considerations

### Unit Tests

- Component rendering tests
- State management tests
- Function behavior tests
- Error handling tests

### Integration Tests

- API integration tests
- User workflow tests
- Code generation tests
- Transformation rule tests

### End-to-End Tests

- Complete mapping workflow
- Cross-browser compatibility
- Performance testing
- Accessibility testing

## Common Issues and Solutions

### Issue 1: Mapping Validation Fails

**Problem**: Invalid mappings between source and target columns
**Solution**: Validate column compatibility and data types

### Issue 2: Code Generation Errors

**Problem**: SQL/PySpark code generation fails
**Solution**: Check transformation rules and schema validity

### Issue 3: Auto-save Not Working

**Problem**: Changes not being saved automatically
**Solution**: Check network connectivity and API endpoints

### Issue 4: NLP Rules Not Applying

**Problem**: AI-generated rules not being applied
**Solution**: Verify NLP service connectivity and rule format

## Best Practices

### Code Organization

1. **Function Grouping**: Group related functions together
2. **State Management**: Keep state organized by functionality
3. **Error Handling**: Implement comprehensive error handling
4. **Documentation**: Document complex functions and state

### User Experience

1. **Loading States**: Show loading indicators for long operations
2. **Progress Tracking**: Provide progress feedback for operations
3. **Error Messages**: Display clear, actionable error messages
4. **Success Feedback**: Confirm successful operations

### Performance

1. **Debouncing**: Debounce user input to prevent excessive API calls
2. **Memoization**: Use memoization for expensive calculations
3. **Efficient Updates**: Use functional state updates
4. **Lazy Loading**: Load data on demand

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
