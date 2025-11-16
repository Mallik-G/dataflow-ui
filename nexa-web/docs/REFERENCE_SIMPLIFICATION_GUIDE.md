# Reference Simplification Guide

## Overview

This document identifies complex references and dependencies in the AA Website codebase and provides simplified alternatives and best practices for better maintainability and understanding.

## Complex References Identified

### 1. Complex State Management in CuratedLandingZonePage

**Current Issue**: The component has 20+ state variables with complex interdependencies.

**Current State Structure**:

```javascript
// Complex state management (20+ variables)
const [entities, setEntities] = useState([]);
const [rawEntities, setRawEntities] = useState([]);
const [curatedEntities, setCuratedEntities] = useState([]);
const [uploadedFiles, setUploadedFiles] = useState([]);
const [fileData, setFileData] = useState([]);
const [curatedFileStatus, setCuratedFileStatus] = useState({});
const [editingEntity, setEditingEntity] = useState(null);
const [newProcessedName, setNewProcessedName] = useState("");
const [inputValues, setInputValues] = useState({});
const [viewingRecords, setViewingRecords] = useState(null);
const [sampleRecords, setSampleRecords] = useState([]);
const [loadingRecords, setLoadingRecords] = useState(false);
const [recordsError, setRecordsError] = useState("");
const [debugInfo, setDebugInfo] = useState({});
const [openRows, setOpenRows] = useState({});
const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
const [autoMappedEntities, setAutoMappedEntities] = useState(new Set());
const [isAutoMapping, setIsAutoMapping] = useState(false);
const [autoMappingSuccess, setAutoMappingSuccess] = useState(null);
const [autoMappingProgress, setAutoMappingProgress] = useState({
  current: 0,
  total: 0,
  currentEntity: "",
});
// ... and more
```

**Simplified Solution**: Group related state using custom hooks

```javascript
// Simplified state management using custom hooks
const useEntityManagement = () => {
  const [entities, setEntities] = useState([]);
  const [rawEntities, setRawEntities] = useState([]);
  const [curatedEntities, setCuratedEntities] = useState([]);

  const loadEntities = useCallback(async () => {
    // Implementation
  }, []);

  return {
    entities,
    rawEntities,
    curatedEntities,
    loadEntities,
  };
};

const useFileManagement = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileData, setFileData] = useState([]);
  const [curatedFileStatus, setCuratedFileStatus] = useState({});

  const uploadFiles = useCallback(async (files) => {
    // Implementation
  }, []);

  return {
    uploadedFiles,
    fileData,
    curatedFileStatus,
    uploadFiles,
  };
};

const useAutoMapping = () => {
  const [autoMappedEntities, setAutoMappedEntities] = useState(new Set());
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [autoMappingProgress, setAutoMappingProgress] = useState({
    current: 0,
    total: 0,
    currentEntity: "",
  });

  const performAutoMapping = useCallback(async () => {
    // Implementation
  }, []);

  return {
    autoMappedEntities,
    isAutoMapping,
    autoMappingProgress,
    performAutoMapping,
  };
};

// Usage in component
function CuratedLandingZonePage() {
  const entityManagement = useEntityManagement();
  const fileManagement = useFileManagement();
  const autoMapping = useAutoMapping();

  // Component logic
}
```

### 2. Complex API Integration Patterns

**Current Issue**: Scattered API calls throughout components with inconsistent error handling.

**Current Pattern**:

```javascript
// Scattered API calls with inconsistent error handling
const loadEntities = async () => {
  try {
    const response = await axios.get("/api/entities");
    setEntities(response.data);
  } catch (error) {
    console.error("Error loading entities:", error);
    setError("Failed to load entities");
  }
};

const generateArtifacts = async (entityName) => {
  try {
    const ddlResponse = await axios.post("/api/artifacts/generate-ddl", {
      entityName,
      curatedEntityName: `curated.${entityName.replace("raw.", "")}`,
    });
    // Handle response...
  } catch (error) {
    console.error("Artifact generation failed:", error);
    setError("Failed to generate artifacts");
  }
};
```

**Simplified Solution**: Centralized API service with consistent error handling

```javascript
// Centralized API service
class ApiService {
  static async request(endpoint, options = {}) {
    try {
      const response = await axios({
        url: endpoint,
        ...options,
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      return response.data;
    } catch (error) {
      throw new ApiError(error);
    }
  }

  static async getEntities() {
    return this.request("/api/entities");
  }

  static async generateArtifacts(entityName, curatedEntityName) {
    return this.request("/api/artifacts/generate-ddl", {
      method: "POST",
      data: { entityName, curatedEntityName },
    });
  }
}

// Custom error class
class ApiError extends Error {
  constructor(error) {
    super(error.message);
    this.status = error.response?.status;
    this.data = error.response?.data;
  }
}

// Usage in components
const loadEntities = async () => {
  try {
    const entities = await ApiService.getEntities();
    setEntities(entities);
  } catch (error) {
    handleApiError(error);
  }
};
```

### 3. Complex Transformation Logic

**Current Issue**: Complex transformation rules scattered across multiple files with inconsistent patterns.

**Current Pattern**:

```javascript
// Complex transformation logic scattered across files
const generateComplexMappingView = (entityName, transformations) => {
  const sourceEntities = transformations.sourceEntities || [];
  const mappings = transformations.mappings || [];

  let viewSql = `SELECT\n`;

  const columnSelections = mappings.map((mapping) => {
    if (mapping.transformation === "direct_mapping") {
      return `  ${mapping.sourceEntity}.${mapping.source} AS ${mapping.target}`;
    } else if (mapping.transformation === "concatenation") {
      const sources = mapping.sourceFields || [mapping.source];
      const concatExpr = sources
        .map((field) => `COALESCE(${mapping.sourceEntity}.${field}, '')`)
        .join(" || ' ' || ");
      return `  ${concatExpr} AS ${mapping.target}`;
    } else if (mapping.transformation === "aggregation") {
      const aggFunc = mapping.aggregationFunction || "MAX";
      return `  ${aggFunc}(${mapping.sourceEntity}.${mapping.source}) AS ${mapping.target}`;
    }
    // ... more complex logic
  });

  // More complex logic...
};
```

**Simplified Solution**: Transformation rule engine with clear patterns

```javascript
// Simplified transformation rule engine
class TransformationRuleEngine {
  static rules = {
    direct_mapping: (mapping) =>
      `${mapping.sourceEntity}.${mapping.source} AS ${mapping.target}`,

    concatenation: (mapping) => {
      const sources = mapping.sourceFields || [mapping.source];
      const concatExpr = sources
        .map((field) => `COALESCE(${mapping.sourceEntity}.${field}, '')`)
        .join(" || ' ' || ");
      return `${concatExpr} AS ${mapping.target}`;
    },

    aggregation: (mapping) => {
      const aggFunc = mapping.aggregationFunction || "MAX";
      return `${aggFunc}(${mapping.sourceEntity}.${mapping.source}) AS ${mapping.target}`;
    },

    case_statement: (mapping) => {
      const conditions = mapping.caseConditions
        ?.map((cond) => `WHEN '${cond.when}' THEN '${cond.then}'`)
        .join("\n    ");
      return `CASE ${mapping.sourceEntity}.${
        mapping.source
      }\n    ${conditions}\n    ELSE '${
        mapping.defaultValue || "Unknown"
      }' END AS ${mapping.target}`;
    },
  };

  static generateColumnSelection(mapping) {
    const rule = this.rules[mapping.transformation];
    if (!rule) {
      throw new Error(`Unknown transformation type: ${mapping.transformation}`);
    }
    return rule(mapping);
  }

  static generateView(entityName, transformations) {
    const mappings = transformations.mappings || [];
    const columnSelections = mappings.map((mapping) =>
      this.generateColumnSelection(mapping)
    );

    return {
      selectClause: columnSelections.join(",\n"),
      fromClause: this.generateFromClause(transformations.sourceEntities),
      whereClause: this.generateWhereClause(transformations.filterConditions),
    };
  }
}
```

### 4. Complex Component Dependencies

**Current Issue**: Components have complex interdependencies making them hard to understand and maintain.

**Current Pattern**:

```javascript
// Complex component dependencies
import EditEntityMappingsPage from "./EditEntityMappingsPage";
import ColumnETLModal from "../components/ColumnETLModal";
import NLPArtifactsManager from "../components/NLPArtifactsManager";
import CanvasArtifactsGenerator from "../components/CanvasArtifactsGenerator";
import ConsumptionCanvasEmbedded from "../components/ConsumptionCanvasEmbedded";
// ... many more imports
```

**Simplified Solution**: Dependency injection and clear interfaces

```javascript
// Simplified component dependencies with clear interfaces
interface EntityMappingProps {
  entityName: string;
  onMappingUpdate: (mapping: Mapping) => void;
  onError: (error: Error) => void;
}

interface ArtifactGenerationProps {
  entityName: string;
  onArtifactGenerated: (artifacts: Artifacts) => void;
  onError: (error: Error) => void;
}

// Component with clear dependencies
function CuratedLandingZonePage() {
  const entityMappingService = useEntityMappingService();
  const artifactGenerationService = useArtifactGenerationService();
  const fileManagementService = useFileManagementService();

  // Clear service usage
  const handleEntityMapping = useCallback(
    async (entityName) => {
      try {
        const mapping = await entityMappingService.getMapping(entityName);
        // Handle mapping
      } catch (error) {
        handleError(error);
      }
    },
    [entityMappingService]
  );
}
```

### 5. Complex Data Models

**Current Issue**: Data models have complex nested structures that are hard to understand and validate.

**Current Pattern**:

```javascript
// Complex nested data model
const transformationData = {
  entityName,
  curatedEntityName:
    transformations.curatedEntityName ||
    `curated.${entityName.replace("raw.", "")}`,
  fileType: "curated",
  sourceAttributes: transformations.rawAttributes || [],
  curatedAttributes: transformations.curatedAttributes || [],
  mappings: transformations.mappings || [],
  columnRules: transformations.columnRules || {},
  operatorRules: transformations.operatorRules || {},
  concatenationRules: transformations.concatenationRules || [],
  entityNLPRules: transformations.entityNLPRules || [],
  columnDescriptions: transformations.columnDescriptions || {},
  newColumns: transformations.newColumns || [],
  entityLevelMetadata: transformations.entityLevelMetadata || {},
  fileData: transformations.fileData || {},
  createdBy: "system",
  notes: "Saved via transformData endpoint",
};
```

**Simplified Solution**: Clear data model interfaces and validation

```javascript
// Simplified data model with clear interfaces
interface TransformationData {
  entityName: string;
  curatedEntityName: string;
  fileType: "raw" | "curated" | "consumption";
  attributes: {
    source: string[],
    curated: string[],
  };
  mappings: Mapping[];
  rules: {
    column: ColumnRule[],
    operator: OperatorRule[],
    concatenation: ConcatenationRule[],
    nlp: NLPRule[],
  };
  metadata: {
    descriptions: Record<string, string>,
    newColumns: NewColumn[],
    entityLevel: EntityMetadata,
  };
  audit: {
    createdBy: string,
    createdAt: Date,
    notes?: string,
  };
}

// Validation function
function validateTransformationData(data: any): TransformationData {
  if (!data.entityName) {
    throw new Error("Entity name is required");
  }

  if (!data.curatedEntityName) {
    data.curatedEntityName = `curated.${data.entityName.replace("raw.", "")}`;
  }

  return {
    entityName: data.entityName,
    curatedEntityName: data.curatedEntityName,
    fileType: data.fileType || "curated",
    attributes: {
      source: data.sourceAttributes || [],
      curated: data.curatedAttributes || [],
    },
    mappings: data.mappings || [],
    rules: {
      column: data.columnRules || [],
      operator: data.operatorRules || [],
      concatenation: data.concatenationRules || [],
      nlp: data.entityNLPRules || [],
    },
    metadata: {
      descriptions: data.columnDescriptions || {},
      newColumns: data.newColumns || [],
      entityLevel: data.entityLevelMetadata || {},
    },
    audit: {
      createdBy: data.createdBy || "system",
      createdAt: new Date(),
      notes: data.notes,
    },
  };
}
```

## Best Practices for Reference Simplification

### 1. Use Custom Hooks for State Management

```javascript
// Instead of complex state management
const useEntityState = (initialEntity) => {
  const [entity, setEntity] = useState(initialEntity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateEntity = useCallback(
    async (updates) => {
      setLoading(true);
      setError(null);

      try {
        const response = await ApiService.updateEntity(entity.id, updates);
        setEntity(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [entity.id]
  );

  return { entity, loading, error, updateEntity };
};
```

### 2. Implement Service Layer Pattern

```javascript
// Centralized service layer
class EntityService {
  static async getEntity(entityName) {
    return ApiService.request(`/api/entities/${entityName}`);
  }

  static async updateEntity(entityName, updates) {
    return ApiService.request(`/api/entities/${entityName}`, {
      method: "PUT",
      data: updates,
    });
  }

  static async deleteEntity(entityName) {
    return ApiService.request(`/api/entities/${entityName}`, {
      method: "DELETE",
    });
  }
}
```

### 3. Use TypeScript for Type Safety

```typescript
// Clear type definitions
interface Entity {
  id: string;
  name: string;
  type: "raw" | "curated" | "consumption";
  attributes: Attribute[];
  mappings: Mapping[];
  createdAt: Date;
  updatedAt: Date;
}

interface Mapping {
  id: string;
  source: string;
  target: string;
  transformation: TransformationType;
  rules: TransformationRule[];
}

type TransformationType =
  | "direct_mapping"
  | "concatenation"
  | "aggregation"
  | "case_statement"
  | "calculation";
```

### 4. Implement Error Boundary Pattern

```javascript
// Centralized error handling
class ErrorHandler {
  static handle(error, context = "") {
    console.error(`Error in ${context}:`, error);

    if (error instanceof ApiError) {
      return this.handleApiError(error);
    }

    if (error instanceof ValidationError) {
      return this.handleValidationError(error);
    }

    return this.handleGenericError(error);
  }

  static handleApiError(error) {
    switch (error.status) {
      case 401:
        return "Authentication required";
      case 403:
        return "Access denied";
      case 404:
        return "Resource not found";
      case 500:
        return "Server error";
      default:
        return "An error occurred";
    }
  }
}
```

### 5. Use Configuration Objects

```javascript
// Configuration-driven approach
const TRANSFORMATION_CONFIG = {
  rules: {
    direct_mapping: {
      template: "{sourceEntity}.{source} AS {target}",
      validation: ["source", "target"],
    },
    concatenation: {
      template: "CONCAT({sourceFields}) AS {target}",
      validation: ["sourceFields", "target"],
      separator: " ",
    },
  },

  validation: {
    required: ["entityName", "curatedEntityName"],
    optional: ["fileType", "metadata"],
  },
};

// Usage
function generateTransformation(mapping, config = TRANSFORMATION_CONFIG) {
  const rule = config.rules[mapping.transformation];
  if (!rule) {
    throw new Error(`Unknown transformation: ${mapping.transformation}`);
  }

  return rule.template
    .replace("{sourceEntity}", mapping.sourceEntity)
    .replace("{source}", mapping.source)
    .replace("{target}", mapping.target);
}
```

## Implementation Roadmap

### Phase 1: State Management Simplification

1. Create custom hooks for complex state
2. Implement state management patterns
3. Add state validation

### Phase 2: API Layer Simplification

1. Create centralized API service
2. Implement consistent error handling
3. Add request/response validation

### Phase 3: Component Dependency Simplification

1. Implement dependency injection
2. Create clear component interfaces
3. Add component composition patterns

### Phase 4: Data Model Simplification

1. Create clear data model interfaces
2. Implement validation functions
3. Add data transformation utilities

### Phase 5: Testing and Documentation

1. Add comprehensive tests
2. Update documentation
3. Create migration guides

## Benefits of Simplification

### For Developers

- **Easier Understanding**: Clear patterns and interfaces
- **Faster Development**: Reusable components and services
- **Better Debugging**: Centralized error handling
- **Type Safety**: TypeScript interfaces

### For Maintenance

- **Reduced Complexity**: Simpler state management
- **Better Testing**: Isolated components and services
- **Easier Refactoring**: Clear dependencies
- **Documentation**: Self-documenting code

### For Performance

- **Optimized Re-renders**: Better state management
- **Reduced Bundle Size**: Tree-shakable code
- **Better Caching**: Centralized API layer
- **Memory Efficiency**: Proper cleanup

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
