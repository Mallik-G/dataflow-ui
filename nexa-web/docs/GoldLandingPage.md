# GoldLandingPage Component Documentation

## Overview

The `GoldLandingPage` (also known as `ConsumptionLandingPage`) is a critical component that manages the consumption layer of the data transformation platform. It handles the creation, management, and processing of consumption entities that serve as the final business-ready data layer for analytics and reporting.

## Component Details

- **File**: `src/screens/GoldLandingPage.jsx`
- **Route**: `/consumption_landing_page`
- **Type**: React Functional Component
- **Size**: ~4,900 lines (complex component)
- **Alias**: `ConsumptionLandingPage`

## Purpose

This component serves as the primary interface for:

1. **Consumption Entity Management**: Creating and managing consumption entities from curated data
2. **Multi-Entity Joins**: Handling complex relationships between multiple curated entities
3. **Business Logic Application**: Applying business rules and aggregations
4. **Artifact Generation**: Generating consumption-ready artifacts and SQL scripts
5. **GitHub Integration**: Managing version control for consumption artifacts
6. **AI-Powered Consumption Files**: Managing AI-generated consumption file suggestions

## Key Features

### 1. Consumption Entity Creation

- **Multi-Entity Selection**: Select multiple curated entities for consumption
- **Join Relationship Management**: Define complex join relationships between entities
- **Output Column Mapping**: Map columns from multiple sources to consumption output
- **Business Rule Application**: Apply business logic and aggregations

### 2. AI Integration

- **AI-Generated Consumption Files**: Leverage AI to suggest consumption file structures
- **Smart Entity Selection**: AI-powered recommendations for entity combinations
- **Automated Mapping**: AI-generated column mappings and transformations

### 3. Artifact Generation

- **SQL Script Generation**: Generate complex SQL scripts for consumption entities
- **PySpark Code Generation**: Generate PySpark code for big data processing
- **GitHub Integration**: Push consumption artifacts to version control

### 4. Data Processing Pipeline

- **Silver to Gold Processing**: Transform curated (silver) data to consumption (gold) data
- **Batch Processing**: Handle multiple consumption files simultaneously
- **Progress Tracking**: Real-time progress monitoring for processing operations

## State Management

The component manages extensive state across multiple categories:

### Core Data State

```javascript
const [consumptionFiles, setConsumptionFiles] = useState([]); // Consumption files
const [silverDataFiles, setSilverDataFiles] = useState([]); // Silver data files
const [aiConsumptionFiles, setAiConsumptionFiles] = useState([]); // AI-generated files
const [entityColumnsMap, setEntityColumnsMap] = useState({}); // Entity column mappings
const [records, setRecords] = useState([]); // Sample records
const [viewingRecords, setViewingRecords] = useState(null); // Currently viewing records
```

### UI State

```javascript
const [loading, setLoading] = useState(false); // Loading state
const [isGeneratingArtifacts, setIsGeneratingArtifacts] = useState(false); // Artifact generation
const [isPushingArtifacts, setIsPushingArtifacts] = useState(false); // GitHub push status
const [showRecordsModal, setShowRecordsModal] = useState(false); // Records modal
const [showJoinRelationsModal, setShowJoinRelationsModal] = useState(false); // Join relations modal
const [showAddEntityModal, setShowAddEntityModal] = useState(false); // Add entity modal
```

### Consumption File Creation State

```javascript
const [selectedEntities, setSelectedEntities] = useState([]); // Selected entities
const [joinRelationships, setJoinRelationships] = useState([]); // Join relationships
const [outputColumns, setOutputColumns] = useState([]); // Output columns
const [currentStep, setCurrentStep] = useState(1); // Current creation step
const [consumptionFileName, setConsumptionFileName] = useState(""); // File name
```

### GitHub Integration State

```javascript
const [githubConnection, setGithubConnection] = useState(null); // GitHub connection
const [githubStatus, setGithubStatus] = useState("disconnected"); // Connection status
const [artifactStatus, setArtifactStatus] = useState({}); // Artifact generation status
```

## Key Functions

### 1. Consumption File Management

#### `handleCreateConsumptionFile()`

- **Purpose**: Initiates the consumption file creation process
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Resets creation state and shows creation modal

```javascript
const handleCreateConsumptionFile = () => {
  setSelectedEntities([]);
  setJoinRelationships([]);
  setOutputColumns([]);
  setCurrentStep(1);
  setConsumptionFileName("");
  setShowAddEntityModal(true);
};
```

#### `saveConsumptionFile()`

- **Purpose**: Saves the created consumption file configuration
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Creates consumption file and updates state

```javascript
const saveConsumptionFile = () => {
  if (!consumptionFileName.trim()) {
    alert("Please enter a consumption file name");
    return;
  }

  const consumptionFile = {
    id: Date.now().toString(),
    name: consumptionFileName,
    entities: selectedEntities,
    joinRelationships: joinRelationships,
    outputColumns: outputColumns,
    createdAt: new Date().toISOString(),
    status: "draft",
  };

  setConsumptionFiles((prev) => [...prev, consumptionFile]);
  setShowAddEntityModal(false);
  setCurrentStep(1);
};
```

### 2. Entity Management

#### `addEntityToConsumption()`

- **Purpose**: Adds an entity to the consumption file
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Updates selected entities and fetches columns

```javascript
const addEntityToConsumption = () => {
  if (selectedEntities.length === 0) {
    alert("Please select at least one entity");
    return;
  }

  // Fetch columns for selected entities
  selectedEntities.forEach((entity) => {
    fetchColumnsForEntity(entity);
  });

  setCurrentStep(2);
};
```

#### `fetchColumnsForEntity(entityName)`

- **Purpose**: Fetches columns for a specific entity
- **Parameters**:
  - `entityName` (string): Name of the entity
- **Returns**: Promise<void>
- **Side Effects**: Updates entity columns map

```javascript
const fetchColumnsForEntity = async (entityName) => {
  try {
    const response = await axios.get(`/api/curated-schemas/${entityName}`);
    const columns = response.data.columns || [];

    setEntityColumnsMap((prev) => ({
      ...prev,
      [entityName]: columns,
    }));
  } catch (error) {
    console.error(`Error fetching columns for ${entityName}:`, error);
  }
};
```

### 3. Join Relationship Management

#### `saveMapping()`

- **Purpose**: Saves join relationship mappings
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Updates join relationships and output columns

```javascript
const saveMapping = () => {
  if (joinRelationships.length === 0) {
    alert("Please define at least one join relationship");
    return;
  }

  // Generate output columns based on join relationships
  const generatedOutputColumns = generateOutputColumns(joinRelationships);
  setOutputColumns(generatedOutputColumns);
  setCurrentStep(3);
};
```

#### `addJoinRelationship()`

- **Purpose**: Adds a new join relationship
- **Parameters**: None
- **Returns**: void
- **Side Effects**: Updates join relationships state

```javascript
const addJoinRelationship = () => {
  const newRelationship = {
    id: Date.now().toString(),
    sourceEntity: "",
    targetEntity: "",
    sourceColumn: "",
    targetColumn: "",
    joinType: "INNER",
  };

  setJoinRelationships((prev) => [...prev, newRelationship]);
};
```

### 4. Artifact Generation

#### `generateAllArtifacts()`

- **Purpose**: Generates artifacts for all consumption files
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Generates SQL and PySpark artifacts

```javascript
const generateAllArtifacts = async () => {
  setIsGeneratingArtifacts(true);

  try {
    for (const file of consumptionFiles) {
      // Generate SQL artifacts
      const sqlResponse = await axios.post(
        "/api/consumption-artifacts/generate-sql",
        {
          consumptionFile: file,
          entityColumnsMap: entityColumnsMap,
        }
      );

      // Generate PySpark artifacts
      const pysparkResponse = await axios.post(
        "/api/consumption-artifacts/generate-pyspark",
        {
          consumptionFile: file,
          entityColumnsMap: entityColumnsMap,
        }
      );

      setArtifactStatus((prev) => ({
        ...prev,
        [file.id]: "generated",
      }));
    }
  } catch (error) {
    console.error("Error generating artifacts:", error);
  } finally {
    setIsGeneratingArtifacts(false);
  }
};
```

### 5. GitHub Integration

#### `pushAllArtifactsToGitHub()`

- **Purpose**: Pushes all consumption artifacts to GitHub
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Updates GitHub status and artifact status

```javascript
const pushAllArtifactsToGitHub = async () => {
  if (!githubConnection) {
    alert("GitHub connection not established");
    return;
  }

  setIsPushingArtifacts(true);

  try {
    for (const file of consumptionFiles) {
      await axios.post("/api/consumption-artifacts/push-to-github", {
        consumptionFile: file,
        artifacts: {
          sql: file.sqlArtifacts,
          pyspark: file.pysparkArtifacts,
        },
      });

      setArtifactStatus((prev) => ({
        ...prev,
        [file.id]: "pushed",
      }));
    }
  } catch (error) {
    console.error("Error pushing artifacts to GitHub:", error);
  } finally {
    setIsPushingArtifacts(false);
  }
};
```

### 6. AI Integration

#### `fetchAIConsumptionFiles()`

- **Purpose**: Fetches AI-generated consumption file suggestions
- **Parameters**:
  - `page` (number): Page number for pagination
  - `limit` (number): Number of items per page
  - `search` (string): Search term
- **Returns**: Promise<void>
- **Side Effects**: Updates AI consumption files state

```javascript
const fetchAIConsumptionFiles = async (page = 1, limit = 15, search = "") => {
  try {
    const response = await axios.get("/api/ai-consumption-files", {
      params: { page, limit, search },
    });

    setAiConsumptionFiles(response.data.files);
  } catch (error) {
    console.error("Error fetching AI consumption files:", error);
  }
};
```

#### `handleAcceptEntityNLP(nlpData)`

- **Purpose**: Accepts AI-generated NLP suggestions for consumption files
- **Parameters**:
  - `nlpData` (object): NLP-generated data
- **Returns**: Promise<void>
- **Side Effects**: Updates consumption files with AI suggestions

```javascript
const handleAcceptEntityNLP = async (nlpData) => {
  try {
    const response = await axios.post("/api/ai-consumption-files/accept", {
      nlpData: nlpData,
      consumptionFileId: nlpData.consumptionFileId,
    });

    // Update local state with accepted suggestions
    setConsumptionFiles((prev) =>
      prev.map((file) =>
        file.id === nlpData.consumptionFileId
          ? { ...file, ...response.data.updates }
          : file
      )
    );
  } catch (error) {
    console.error("Error accepting NLP suggestions:", error);
  }
};
```

## API Integration

### Endpoints Used

#### Consumption File Management

- `GET /api/consumption-files` - Get all consumption files
- `POST /api/consumption-files` - Create new consumption file
- `PUT /api/consumption-files/{id}` - Update consumption file
- `DELETE /api/consumption-files/{id}` - Delete consumption file

#### Entity Schema Management

- `GET /api/curated-schemas/{entityName}` - Get curated entity schema
- `GET /api/entity-columns/{entityName}` - Get entity columns
- `POST /api/entity-columns/batch` - Get multiple entity columns

#### Artifact Generation

- `POST /api/consumption-artifacts/generate-sql` - Generate SQL artifacts
- `POST /api/consumption-artifacts/generate-pyspark` - Generate PySpark artifacts
- `POST /api/consumption-artifacts/push-to-github` - Push artifacts to GitHub

#### AI Integration

- `GET /api/ai-consumption-files` - Get AI-generated consumption files
- `POST /api/ai-consumption-files/accept` - Accept AI suggestions
- `POST /api/ai-consumption-files/reject` - Reject AI suggestions

#### GitHub Integration

- `GET /api/github/connection` - Check GitHub connection
- `POST /api/github/connect` - Connect to GitHub
- `GET /api/github/repositories` - Get available repositories

## Component Lifecycle

### Initialization

1. **Component Mount**: `useEffect` hooks initialize state
2. **Data Loading**: Load consumption files and silver data files
3. **GitHub Connection**: Check GitHub connection status
4. **AI Files Loading**: Load AI-generated consumption file suggestions

### User Interactions

1. **Create Consumption File**: User initiates file creation
2. **Entity Selection**: User selects curated entities
3. **Join Definition**: User defines join relationships
4. **Column Mapping**: User maps output columns
5. **Artifact Generation**: System generates SQL and PySpark artifacts
6. **GitHub Push**: Artifacts are pushed to GitHub

### State Updates

1. **Real-time Updates**: State updates trigger re-renders
2. **Progress Tracking**: Artifact generation and GitHub push progress
3. **Error Handling**: Error states are managed and displayed
4. **Success Feedback**: Success states provide user feedback

## Data Models

### Consumption File Structure

```javascript
interface ConsumptionFile {
  id: string;
  name: string;
  entities: string[]; // Array of curated entity names
  joinRelationships: JoinRelationship[];
  outputColumns: OutputColumn[];
  sqlArtifacts?: string;
  pysparkArtifacts?: string;
  status: "draft" | "generated" | "pushed";
  createdAt: string;
  updatedAt: string;
}
```

### Join Relationship Structure

```javascript
interface JoinRelationship {
  id: string;
  sourceEntity: string;
  targetEntity: string;
  sourceColumn: string;
  targetColumn: string;
  joinType: "INNER" | "LEFT" | "RIGHT" | "FULL";
  joinCondition?: string;
}
```

### Output Column Structure

```javascript
interface OutputColumn {
  name: string;
  sourceEntity: string;
  sourceColumn: string;
  dataType: string;
  transformation?: string;
  aggregation?: string;
  isPrimaryKey: boolean;
}
```

## Error Handling

### Error Types

1. **API Errors**: Network and server errors
2. **Validation Errors**: Input validation failures
3. **Join Relationship Errors**: Invalid join configurations
4. **Artifact Generation Errors**: SQL/PySpark generation failures
5. **GitHub Integration Errors**: Version control failures

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

1. **Lazy Loading**: Load entity columns only when needed
2. **Debounced Search**: Search input is debounced to prevent excessive API calls
3. **Batch Processing**: Process multiple consumption files in batches
4. **Memoization**: Cache expensive calculations and API responses

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
- Consumption file creation tests
- GitHub integration tests

### End-to-End Tests

- Complete consumption file creation workflow
- Cross-browser compatibility
- Performance testing
- Accessibility testing

## Common Issues and Solutions

### Issue 1: Join Relationship Validation Fails

**Problem**: Invalid join relationships between entities
**Solution**: Validate entity schemas and column compatibility

### Issue 2: Artifact Generation Timeout

**Problem**: SQL/PySpark generation takes too long
**Solution**: Implement progress tracking and timeout handling

### Issue 3: GitHub Push Failures

**Problem**: Artifacts fail to push to GitHub
**Solution**: Verify GitHub connection and repository permissions

### Issue 4: AI Suggestions Not Loading

**Problem**: AI-generated consumption files not appearing
**Solution**: Check AI service connectivity and API endpoints

## Best Practices

### Code Organization

1. **Function Grouping**: Group related functions together
2. **State Management**: Keep state organized by functionality
3. **Error Handling**: Implement comprehensive error handling
4. **Documentation**: Document complex functions and state

### User Experience

1. **Loading States**: Show loading indicators for long operations
2. **Progress Tracking**: Provide progress feedback for batch operations
3. **Error Messages**: Display clear, actionable error messages
4. **Success Feedback**: Confirm successful operations

### Performance

1. **Debouncing**: Debounce user input to prevent excessive API calls
2. **Batch Processing**: Process multiple items in batches
3. **Memoization**: Use memoization for expensive calculations
4. **Lazy Loading**: Load data on demand

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
