# ConsumptionCanvasEmbedded Component Documentation

## Overview

The `ConsumptionCanvasEmbedded` component is a sophisticated visual data flow management interface that provides drag-and-drop functionality for managing entity relationships, field mappings, and data transformations in the consumption layer. It serves as the visual representation of the data pipeline from curated entities to consumption entities.

## Component Details

- **File**: `src/components/ConsumptionCanvasEmbedded.jsx`
- **Type**: React Functional Component
- **Size**: ~4,700 lines (complex component)
- **Dependencies**: React Flow Renderer, React Bootstrap

## Purpose

This component serves as the primary interface for:

1. **Visual Data Flow Management**: Drag-and-drop interface for entity relationships
2. **Field Mapping Visualization**: Visual representation of column mappings
3. **Entity Relationship Management**: Define and manage relationships between entities
4. **Smart Mapping Engine**: AI-powered automatic field mapping suggestions
5. **Artifact Generation**: Generate artifacts from visual canvas configuration
6. **Real-time Validation**: Validate relationships and mappings in real-time

## Key Features

### 1. Visual Canvas Interface

- **Drag-and-Drop Nodes**: Interactive entity nodes with expandable attributes
- **Connection Management**: Visual connections between entities and fields
- **Zoom and Pan**: Navigate large data flow diagrams
- **Node Expansion**: Expand/collapse entity nodes to show/hide attributes

### 2. Smart Mapping Engine

- **Automatic Field Mapping**: AI-powered suggestions for field mappings
- **Similarity Scoring**: Calculate similarity scores between field names
- **Pattern Recognition**: Recognize common naming patterns and transformations
- **Conflict Resolution**: Handle mapping conflicts and duplicates

### 3. Entity Management

- **Multi-Entity Support**: Handle multiple curated and consumption entities
- **Relationship Types**: Support for different relationship types (1:1, 1:M, M:M)
- **Join Condition Management**: Define complex join conditions
- **Primary Key Detection**: Automatic primary key identification

### 4. Real-time Validation

- **Edge Validation**: Validate connections between entities
- **Mapping Validation**: Ensure valid field mappings
- **Schema Validation**: Validate against entity schemas
- **Constraint Checking**: Check business constraints and rules

## Props Interface

```javascript
interface ConsumptionCanvasEmbeddedProps {
  uploadedFiles?: FileData[]; // Uploaded file data
  rawEntities?: string[]; // Raw entity names
  curatedEntities?: string[]; // Curated entity names
  fileData?: FileData[]; // File metadata
  consumptionFiles?: ConsumptionFile[]; // Consumption files
  searchTerm?: string; // Search term for filtering
  setExpandedCanvasHeader?: (expanded: boolean) => void; // Header expansion callback
}
```

## State Management

The component manages extensive state across multiple categories:

### Canvas State

```javascript
const [nodes, setNodes] = useState([]); // Canvas nodes
const [edges, setEdges] = useState([]); // Canvas edges
const [selectedNodes, setSelectedNodes] = useState([]); // Selected nodes
const [selectedEdges, setSelectedEdges] = useState([]); // Selected edges
const [expandedNodes, setExpandedNodes] = useState(new Set()); // Expanded nodes
```

### Entity State

```javascript
const [curatedEntities, setCuratedEntities] = useState([]); // Curated entities
const [consumptionEntities, setConsumptionEntities] = useState([]); // Consumption entities
const [entityColumnsMap, setEntityColumnsMap] = useState({}); // Entity columns
const [entitySchemas, setEntitySchemas] = useState({}); // Entity schemas
```

### UI State

```javascript
const [showOffcanvas, setShowOffcanvas] = useState(false); // Offcanvas visibility
const [offcanvasEntityData, setOffcanvasEntityData] = useState(null); // Offcanvas data
const [offcanvasAction, setOffcanvasAction] = useState(""); // Offcanvas action
const [showDeleteModal, setShowDeleteModal] = useState(false); // Delete modal
const [edgeToDelete, setEdgeToDelete] = useState(null); // Edge to delete
const [etlModal, setEtlModal] = useState({ open: false, data: null }); // ETL modal
```

## Key Functions

### 1. Node Management

#### `createNodesFromFiles()`

- **Purpose**: Creates canvas nodes from file data
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Updates nodes state with entity nodes

```javascript
const createNodesFromFiles = async () => {
  const newNodes = [];

  // Create curated entity nodes
  curatedEntities.forEach((entity, index) => {
    const node = {
      id: entity,
      type: "curatedEntity",
      position: { x: 100, y: 100 + index * 200 },
      data: {
        label: entity,
        entityType: "curated",
        attributes: entityColumnsMap[entity] || [],
        expanded: expandedNodes.has(entity),
      },
    };
    newNodes.push(node);
  });

  // Create consumption entity nodes
  consumptionFiles.forEach((file, index) => {
    const node = {
      id: file.name,
      type: "consumptionEntity",
      position: { x: 600, y: 100 + index * 200 },
      data: {
        label: file.name,
        entityType: "consumption",
        attributes: file.outputColumns || [],
        expanded: expandedNodes.has(file.name),
      },
    };
    newNodes.push(node);
  });

  setNodes(newNodes);
};
```

#### `calculateEntityHeight(node)`

- **Purpose**: Calculates the height of an entity node based on attributes
- **Parameters**:
  - `node` (object): Node data
- **Returns**: number
- **Side Effects**: None

```javascript
const calculateEntityHeight = (node) => {
  const baseHeight = 60; // Base height for node header
  const attributeHeight = 30; // Height per attribute
  const maxVisibleAttributes = 5; // Maximum visible attributes

  if (!node.data.attributes || node.data.attributes.length === 0) {
    return baseHeight;
  }

  const visibleAttributes = node.data.expanded
    ? node.data.attributes.length
    : Math.min(node.data.attributes.length, maxVisibleAttributes);

  return baseHeight + visibleAttributes * attributeHeight;
};
```

### 2. Edge Management

#### `createEdgeTypes()`

- **Purpose**: Creates custom edge types for different relationship types
- **Parameters**:
  - `setEdges` (function): Edge setter function
  - `setShowDeleteModal` (function): Delete modal setter
  - `setEdgeToDelete` (function): Edge to delete setter
  - `expandedConsumptionEntities` (Set): Expanded consumption entities
  - `expandedCuratedEntities` (Set): Expanded curated entities
- **Returns**: object
- **Side Effects**: None

```javascript
const createEdgeTypes = (
  setEdges,
  setShowDeleteModal,
  setEdgeToDelete,
  expandedConsumptionEntities,
  expandedCuratedEntities
) => ({
  fieldMapping: {
    type: "smoothstep",
    animated: true,
    style: { stroke: "#007bff", strokeWidth: 2 },
    markerEnd: {
      type: "arrowclosed",
      color: "#007bff",
    },
    onDoubleClick: (event, edge) => {
      setEdgeToDelete(edge);
      setShowDeleteModal(true);
    },
  },
  entityRelationship: {
    type: "smoothstep",
    animated: false,
    style: { stroke: "#28a745", strokeWidth: 3 },
    markerEnd: {
      type: "arrowclosed",
      color: "#28a745",
    },
  },
  goldToGold: {
    type: "smoothstep",
    animated: true,
    style: { stroke: "#ffc107", strokeWidth: 2 },
    markerEnd: {
      type: "arrowclosed",
      color: "#ffc107",
    },
  },
});
```

#### `validateEdge(edge, nodes)`

- **Purpose**: Validates an edge connection
- **Parameters**:
  - `edge` (object): Edge data
  - `nodes` (array): Canvas nodes
- **Returns**: boolean
- **Side Effects**: None

```javascript
const validateEdge = (edge, nodes) => {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!sourceNode || !targetNode) {
    return false;
  }

  // Validate field mapping
  if (edge.data?.relationshipType === "field_mapping") {
    const sourceColumn = edge.data.sourceColumn;
    const targetColumn = edge.data.targetColumn;

    if (!sourceColumn || !targetColumn) {
      return false;
    }

    // Check if columns exist in respective entities
    const sourceEntity = sourceNode.data.attributes.find(
      (attr) => attr.name === sourceColumn
    );
    const targetEntity = targetNode.data.attributes.find(
      (attr) => attr.name === targetColumn
    );

    return sourceEntity && targetEntity;
  }

  return true;
};
```

### 3. Smart Mapping Engine

#### `smartMappingEngine(curatedColumns, consumptionColumns, existingMappings)`

- **Purpose**: Generates intelligent field mappings between entities
- **Parameters**:
  - `curatedColumns` (array): Source columns
  - `consumptionColumns` (array): Target columns
  - `existingMappings` (array): Existing mappings
- **Returns**: array
- **Side Effects**: None

```javascript
const smartMappingEngine = (
  curatedColumns,
  consumptionColumns,
  existingMappings
) => {
  const mappings = [];
  const usedTargets = new Set(existingMappings.map((m) => m.target));

  curatedColumns.forEach((sourceCol) => {
    let bestMatch = null;
    let bestScore = 0;

    consumptionColumns.forEach((targetCol) => {
      if (usedTargets.has(targetCol.name)) {
        return; // Skip already mapped targets
      }

      const score = calculateSimilarityScore(sourceCol.name, targetCol.name);

      if (score > bestScore && score > 0.7) {
        // Minimum similarity threshold
        bestMatch = targetCol;
        bestScore = score;
      }
    });

    if (bestMatch) {
      mappings.push({
        source: sourceCol.name,
        target: bestMatch.name,
        sourceEntity: sourceCol.entityName,
        targetEntity: bestMatch.entityName,
        transformation: "direct_mapping",
        confidence: bestScore,
        reason: getSimilarityReason(sourceCol.name, bestMatch.name),
      });
      usedTargets.add(bestMatch.name);
    }
  });

  return mappings;
};
```

#### `calculateSimilarityScore(name1, name2)`

- **Purpose**: Calculates similarity score between two field names
- **Parameters**:
  - `name1` (string): First field name
  - `name2` (string): Second field name
- **Returns**: number
- **Side Effects**: None

```javascript
const calculateSimilarityScore = (name1, name2) => {
  const normalized1 = name1.toLowerCase().replace(/[_\s]/g, "");
  const normalized2 = name2.toLowerCase().replace(/[_\s]/g, "");

  // Exact match
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Substring match
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.9;
  }

  // Levenshtein distance
  const levenshteinScore = calculateLevenshteinSimilarity(
    normalized1,
    normalized2
  );

  // Pattern matching
  const patternScore = calculatePatternSimilarity(normalized1, normalized2);

  // Weighted combination
  return levenshteinScore * 0.6 + patternScore * 0.4;
};
```

#### `calculateLevenshteinSimilarity(str1, str2)`

- **Purpose**: Calculates Levenshtein distance similarity
- **Parameters**:
  - `str1` (string): First string
  - `str2` (string): Second string
- **Returns**: number
- **Side Effects**: None

```javascript
const calculateLevenshteinSimilarity = (str1, str2) => {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);

  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
};
```

### 4. Field Mapping Generation

#### `generateFieldMappings(curatedNode, consumptionNode, existingEdges)`

- **Purpose**: Generates field mappings between two entities
- **Parameters**:
  - `curatedNode` (object): Source entity node
  - `consumptionNode` (object): Target entity node
  - `existingEdges` (array): Existing edges
- **Returns**: array
- **Side Effects**: None

```javascript
const generateFieldMappings = (
  curatedNode,
  consumptionNode,
  existingEdges = []
) => {
  const mappings = [];
  const curatedAttrs = curatedNode.data.attributes || [];
  const consumptionAttrs = consumptionNode.data.attributes || [];

  // Create a set of existing mappings to check for duplicates
  const existingMappingKeys = new Set();
  const existingMappingValues = new Set();

  existingEdges.forEach((edge) => {
    if (edge.data?.relationshipType === "field_mapping") {
      const key = `${edge.source}-${edge.data.sourceColumn}-${edge.target}-${edge.data.targetColumn}`;
      existingMappingKeys.add(key);

      if (edge.data.sourceEntity && edge.data.targetEntity) {
        const valueKey = `${edge.data.sourceEntity}-${edge.data.sourceColumn}-${edge.data.targetEntity}-${edge.data.targetColumn}`;
        existingMappingValues.add(valueKey);
      }
    }
  });

  // Enhanced mapping configuration for different transformation types
  const mappingConfig = {
    direct: {
      priority: 1,
      conditions: ["exact_match", "id_field_match", "semantic_match"],
    },
    concatenation: {
      priority: 2,
      conditions: ["name_fields", "address_fields", "contact_fields"],
    },
    aggregation: {
      priority: 3,
      conditions: ["numeric_fields", "date_fields", "status_fields"],
    },
    case_statement: {
      priority: 4,
      conditions: ["status_fields", "type_fields", "category_fields"],
    },
    calculation: {
      priority: 5,
      conditions: ["numeric_fields", "financial_fields"],
    },
  };

  // Generate mappings using smart mapping engine
  const smartMappings = smartMappingEngine(
    curatedAttrs,
    consumptionAttrs,
    existingEdges
  );

  smartMappings.forEach((mapping) => {
    const key = `${curatedNode.id}-${mapping.source}-${consumptionNode.id}-${mapping.target}`;
    const valueKey = `${mapping.sourceEntity}-${mapping.source}-${mapping.targetEntity}-${mapping.target}`;

    if (!existingMappingKeys.has(key) && !existingMappingValues.has(valueKey)) {
      mappings.push({
        id: `${curatedNode.id}-${consumptionNode.id}-${mapping.source}-${mapping.target}`,
        source: curatedNode.id,
        target: consumptionNode.id,
        sourceHandle: `${curatedNode.id}-${mapping.source}`,
        targetHandle: `${consumptionNode.id}-${mapping.target}`,
        type: "fieldMapping",
        data: {
          relationshipType: "field_mapping",
          sourceColumn: mapping.source,
          targetColumn: mapping.target,
          sourceEntity: mapping.sourceEntity,
          targetEntity: mapping.targetEntity,
          transformation: mapping.transformation,
          confidence: mapping.confidence,
          reason: mapping.reason,
        },
      });
    }
  });

  return mappings;
};
```

### 5. Artifact Generation

#### `collectAllMappingsForArtifacts(nodes, edges)`

- **Purpose**: Collects all mappings for artifact generation
- **Parameters**:
  - `nodes` (array): Canvas nodes
  - `edges` (array): Canvas edges
- **Returns**: object
- **Side Effects**: None

```javascript
const collectAllMappingsForArtifacts = (nodes, edges) => {
  const artifactData = {
    entities: {},
    mappings: [],
    relationships: [],
  };

  // Collect entity information
  nodes.forEach((node) => {
    artifactData.entities[node.id] = {
      type: node.data.entityType,
      attributes: node.data.attributes || [],
      position: node.position,
    };
  });

  // Collect mapping information
  edges.forEach((edge) => {
    if (edge.data?.relationshipType === "field_mapping") {
      artifactData.mappings.push({
        sourceEntity: edge.data.sourceEntity,
        targetEntity: edge.data.targetEntity,
        sourceColumn: edge.data.sourceColumn,
        targetColumn: edge.data.targetColumn,
        transformation: edge.data.transformation,
        confidence: edge.data.confidence,
      });
    } else if (edge.data?.relationshipType === "entity_relationship") {
      artifactData.relationships.push({
        sourceEntity: edge.source,
        targetEntity: edge.target,
        relationshipType: edge.data.relationshipType,
        joinCondition: edge.data.joinCondition,
      });
    }
  });

  return artifactData;
};
```

## Custom Components

### 1. Custom Edge Components

#### `CustomEdge`

- **Purpose**: Custom edge component for field mappings
- **Features**: Animated connections, click handlers, custom styling

#### `GoldToGoldEdge`

- **Purpose**: Custom edge component for gold-to-gold relationships
- **Features**: Different styling, animation, and interaction patterns

### 2. Custom Node Components

#### `CuratedEntityNode`

- **Purpose**: Node component for curated entities
- **Features**: Expandable attributes, drag handles, context menus

#### `ConsumptionEntityNode`

- **Purpose**: Node component for consumption entities
- **Features**: Different styling, attribute management, relationship indicators

## API Integration

### Endpoints Used

#### Entity Management

- `GET /api/curated-schemas/{entityName}` - Get curated entity schema
- `GET /api/consumption-schemas/{entityName}` - Get consumption entity schema
- `GET /api/entity-columns/{entityName}` - Get entity columns

#### Mapping Management

- `POST /api/canvas-mappings/save` - Save canvas mappings
- `GET /api/canvas-mappings/{canvasId}` - Get saved mappings
- `PUT /api/canvas-mappings/{canvasId}` - Update mappings

#### Artifact Generation

- `POST /api/canvas-artifacts/generate` - Generate artifacts from canvas
- `POST /api/canvas-artifacts/validate` - Validate canvas configuration
- `GET /api/canvas-artifacts/preview` - Preview generated artifacts

## Data Models

### Node Structure

```javascript
interface CanvasNode {
  id: string;
  type: "curatedEntity" | "consumptionEntity";
  position: { x: number, y: number };
  data: {
    label: string,
    entityType: "curated" | "consumption",
    attributes: Attribute[],
    expanded: boolean,
  };
}
```

### Edge Structure

```javascript
interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: "fieldMapping" | "entityRelationship" | "goldToGold";
  data: {
    relationshipType: "field_mapping" | "entity_relationship",
    sourceColumn?: string,
    targetColumn?: string,
    sourceEntity?: string,
    targetEntity?: string,
    transformation?: string,
    confidence?: number,
    reason?: string,
  };
}
```

### Mapping Structure

```javascript
interface FieldMapping {
  source: string;
  target: string;
  sourceEntity: string;
  targetEntity: string;
  transformation:
    | "direct_mapping"
    | "concatenation"
    | "aggregation"
    | "case_statement";
  confidence: number;
  reason: string;
}
```

## Error Handling

### Error Types

1. **Canvas Errors**: Node/edge validation failures
2. **Mapping Errors**: Invalid field mappings
3. **API Errors**: Network and server errors
4. **Validation Errors**: Schema validation failures

### Error Management

```javascript
const [error, setError] = useState("");
const [isError, setIsError] = useState(false);

const handleCanvasError = (error, context = "") => {
  console.error(`Canvas error in ${context}:`, error);
  setError(error.message || "Canvas operation failed");
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

1. **Node Virtualization**: Render only visible nodes
2. **Edge Optimization**: Optimize edge rendering for large graphs
3. **Debounced Updates**: Debounce state updates
4. **Memoized Calculations**: Cache expensive calculations

### Memory Management

1. **Node Cleanup**: Clean up unused nodes
2. **Edge Cleanup**: Remove invalid edges
3. **Event Listeners**: Properly remove event listeners
4. **State Cleanup**: Clean up unused state

## Testing Considerations

### Unit Tests

- Component rendering tests
- Node/edge management tests
- Smart mapping engine tests
- Validation function tests

### Integration Tests

- Canvas interaction tests
- API integration tests
- Artifact generation tests
- User workflow tests

### End-to-End Tests

- Complete canvas workflow
- Cross-browser compatibility
- Performance testing
- Accessibility testing

## Common Issues and Solutions

### Issue 1: Node Rendering Performance

**Problem**: Slow rendering with many nodes
**Solution**: Implement node virtualization and lazy loading

### Issue 2: Edge Validation Failures

**Problem**: Invalid edges being created
**Solution**: Implement real-time validation and user feedback

### Issue 3: Smart Mapping Accuracy

**Problem**: Poor mapping suggestions
**Solution**: Improve similarity algorithms and add user feedback

### Issue 4: Canvas State Management

**Problem**: Complex state management issues
**Solution**: Implement state management patterns and validation

## Best Practices

### Code Organization

1. **Component Separation**: Separate concerns into different components
2. **Hook Usage**: Use custom hooks for complex logic
3. **State Management**: Keep state organized and minimal
4. **Error Handling**: Implement comprehensive error handling

### User Experience

1. **Visual Feedback**: Provide clear visual feedback
2. **Loading States**: Show loading indicators
3. **Error Messages**: Display helpful error messages
4. **Success Feedback**: Confirm successful operations

### Performance

1. **Optimization**: Optimize rendering and calculations
2. **Memory Management**: Properly manage memory usage
3. **Event Handling**: Efficient event handling
4. **State Updates**: Minimize unnecessary re-renders

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
