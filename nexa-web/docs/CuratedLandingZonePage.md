# CuratedLandingZonePage Component Documentation

## Overview

The `CuratedLandingZonePage` is the central component of the data transformation platform, serving as the main interface for managing curated data entities, artifact generation, and GitHub integration. This component handles the complete lifecycle from raw data ingestion to curated data artifact generation.

## Component Details

- **File**: `src/screens/CuratedLandingZonePage.jsx`
- **Route**: `/curated_landing_zone`
- **Type**: React Functional Component
- **Size**: ~4,000 lines (complex component)

## Purpose

This component serves as the primary interface for:

1. **Entity Schema Management**: Managing raw and curated entity schemas
2. **Artifact Generation**: Generating DDL, DML, and transformation artifacts
3. **GitHub Integration**: Pushing artifacts to GitHub repositories
4. **NLP Artifacts Integration**: Managing AI-generated transformation artifacts
5. **Data Pipeline Management**: Orchestrating the complete data transformation pipeline

## Key Features

### 1. Entity Management

- **Raw Entity Processing**: Handles uploaded CSV files and extracts schemas
- **Curated Entity Creation**: Creates curated versions of raw entities
- **Entity Mapping**: Maps raw columns to curated columns
- **Auto-mapping**: Automatically suggests mappings based on column name similarity

### 2. Artifact Generation

- **DDL Generation**: Creates Data Definition Language scripts
- **DML Generation**: Creates Data Manipulation Language scripts
- **Transformation Scripts**: Generates data transformation logic
- **GitHub Integration**: Pushes artifacts to version control

### 3. NLP Integration

- **AI-Powered Transformations**: Integrates NLP-generated transformation artifacts
- **Smart Mapping**: Uses AI to suggest optimal column mappings
- **Natural Language Processing**: Processes transformation rules in natural language

### 4. Data Pipeline Orchestration

- **Batch Processing**: Handles multiple entities simultaneously
- **Progress Tracking**: Shows real-time progress of operations
- **Error Handling**: Comprehensive error management and user feedback

## State Management

The component manages extensive state across multiple categories:

### Core Data State

```javascript
const [entities, setEntities] = useState([]); // All entities
const [rawEntities, setRawEntities] = useState([]); // Raw entities
const [curatedEntities, setCuratedEntities] = useState([]); // Curated entities
const [uploadedFiles, setUploadedFiles] = useState([]); // Uploaded files
const [fileData, setFileData] = useState([]); // File metadata
const [curatedFileStatus, setCuratedFileStatus] = useState({}); // File processing status
```

### UI State

```javascript
const [editingEntity, setEditingEntity] = useState(null); // Currently editing entity
const [viewingRecords, setViewingRecords] = useState(null); // Records being viewed
const [sampleRecords, setSampleRecords] = useState([]); // Sample data
const [loadingRecords, setLoadingRecords] = useState(false); // Loading state
const [openRows, setOpenRows] = useState({}); // Expanded table rows
const [isLoadingSchemas, setIsLoadingSchemas] = useState(false); // Schema loading
```

### Auto-mapping State

```javascript
const [autoMappedEntities, setAutoMappedEntities] = useState(new Set()); // Auto-mapped entities
const [isAutoMapping, setIsAutoMapping] = useState(false); // Auto-mapping status
const [autoMappingSuccess, setAutoMappingSuccess] = useState(null); // Success status
const [autoMappingProgress, setAutoMappingProgress] = useState({
  // Progress tracking
  current: 0,
  total: 0,
  currentEntity: "",
});
```

### Search and Pagination

```javascript
const [searchTerm, setSearchTerm] = useState(""); // Search input
const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(""); // Debounced search
const [currentPage, setCurrentPage] = useState(1); // Current page
const [entitiesPerPage] = useState(15); // Items per page
const [sortBy, setSortBy] = useState("worked_upon"); // Sort criteria
```

### Modal States

```javascript
const [editNameModal, setEditNameModal] = useState({
  // Edit name modal
  open: false,
  entityName: "",
  newName: "",
});
const [deleteModal, setDeleteModal] = useState({
  // Delete confirmation modal
  open: false,
  entityName: "",
  entityType: "",
});
const [artifactsModal, setArtifactsModal] = useState({
  // Artifacts modal
  open: false,
  entityName: "",
  artifacts: {},
});
```

## Key Functions

### 1. Entity Management Functions

#### `loadEntities()`

- **Purpose**: Loads all entities from the backend
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Updates `entities`, `rawEntities`, `curatedEntities` state

```javascript
const loadEntities = async () => {
  try {
    const response = await axios.get("/api/entities");
    const entitiesData = response.data;

    setEntities(entitiesData);
    setRawEntities(entitiesData.filter((e) => e.startsWith("raw.")));
    setCuratedEntities(entitiesData.filter((e) => e.startsWith("curated.")));
  } catch (error) {
    console.error("Error loading entities:", error);
    setError("Failed to load entities");
  }
};
```

#### `handleEditMappings(entityName)`

- **Purpose**: Navigates to entity mapping page
- **Parameters**:
  - `entityName` (string): Name of the entity to edit
- **Returns**: void
- **Side Effects**: Navigation to mapping page

```javascript
const handleEditMappings = (entityName) => {
  navigate(`/edit-entity-mappings/${encodeURIComponent(entityName)}`, {
    state: {
      curatedEntities,
      fileData,
    },
  });
};
```

### 2. Auto-mapping Functions

#### `performAutoMapping()`

- **Purpose**: Automatically maps raw entities to curated entities
- **Parameters**: None
- **Returns**: Promise<void>
- **Side Effects**: Updates mapping progress and results

```javascript
const performAutoMapping = async () => {
  setIsAutoMapping(true);
  setAutoMappingProgress({
    current: 0,
    total: rawEntities.length,
    currentEntity: "",
  });

  try {
    for (let i = 0; i < rawEntities.length; i++) {
      const entityName = rawEntities[i];
      setAutoMappingProgress({
        current: i + 1,
        total: rawEntities.length,
        currentEntity: entityName,
      });

      await performEntityAutoMapping(entityName);
      setAutoMappedEntities((prev) => new Set([...prev, entityName]));
    }

    setAutoMappingSuccess(true);
  } catch (error) {
    setAutoMappingSuccess(false);
    console.error("Auto-mapping failed:", error);
  } finally {
    setIsAutoMapping(false);
  }
};
```

### 3. Artifact Generation Functions

#### `generateArtifacts(entityName)`

- **Purpose**: Generates DDL, DML, and transformation artifacts for an entity
- **Parameters**:
  - `entityName` (string): Name of the entity
- **Returns**: Promise<void>
- **Side Effects**: Updates artifact status, pushes to GitHub

```javascript
const generateArtifacts = async (entityName) => {
  try {
    setIsGeneratingArtifacts(true);

    // Generate DDL
    const ddlResponse = await axios.post("/api/artifacts/generate-ddl", {
      entityName,
      curatedEntityName: `curated.${entityName.replace("raw.", "")}`,
    });

    // Generate DML
    const dmlResponse = await axios.post("/api/artifacts/generate-dml", {
      entityName,
      curatedEntityName: `curated.${entityName.replace("raw.", "")}`,
    });

    // Push to GitHub if connected
    if (githubConnection) {
      await axios.post("/api/artifacts/push-to-github", {
        entityName,
        artifacts: {
          ddl: ddlResponse.data,
          dml: dmlResponse.data,
        },
      });
    }

    setArtifactStatus((prev) => ({
      ...prev,
      [entityName]: "generated",
    }));
  } catch (error) {
    console.error("Artifact generation failed:", error);
    setError("Failed to generate artifacts");
  } finally {
    setIsGeneratingArtifacts(false);
  }
};
```

### 4. File Management Functions

#### `handleFileUpload(files)`

- **Purpose**: Handles file upload to S3 and processes schemas
- **Parameters**:
  - `files` (FileList): Files to upload
- **Returns**: Promise<void>
- **Side Effects**: Updates file data, triggers schema processing

```javascript
const handleFileUpload = async (files) => {
  try {
    setIsUploading(true);

    for (const file of files) {
      // Upload to S3
      const uploadResponse = await axios.post("/api/files/upload", {
        file: file,
        fileName: file.name,
      });

      // Process schema
      const schemaResponse = await axios.post("/api/files/process-schema", {
        fileKey: uploadResponse.data.key,
        fileName: file.name,
      });

      setFileData((prev) => [
        ...prev,
        {
          key: uploadResponse.data.key,
          name: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified),
          schema: schemaResponse.data,
        },
      ]);
    }

    // Reload entities after upload
    await loadEntities();
  } catch (error) {
    console.error("File upload failed:", error);
    setError("Failed to upload files");
  } finally {
    setIsUploading(false);
  }
};
```

## API Integration

### Endpoints Used

#### Entity Management

- `GET /api/entities` - Get all entities
- `POST /api/entities/create` - Create new entity
- `DELETE /api/entities/{entityName}` - Delete entity

#### Schema Management

- `GET /api/raw-schemas/{entityName}` - Get raw entity schema
- `GET /api/curated-schemas/{entityName}` - Get curated entity schema
- `POST /api/schemas/process` - Process file schema

#### Artifact Generation

- `POST /api/artifacts/generate-ddl` - Generate DDL artifacts
- `POST /api/artifacts/generate-dml` - Generate DML artifacts
- `POST /api/artifacts/push-to-github` - Push artifacts to GitHub
- `GET /api/artifacts/diff/{entityName}` - Get artifact differences

#### File Management

- `POST /api/files/upload` - Upload files to S3
- `GET /api/files/list` - List uploaded files
- `POST /api/files/process-schema` - Process file schema

#### GitHub Integration

- `GET /api/github/connection` - Check GitHub connection
- `POST /api/github/connect` - Connect to GitHub
- `POST /api/github/push` - Push artifacts to GitHub

## Component Lifecycle

### Initialization

1. **Component Mount**: `useEffect` hooks initialize state
2. **Entity Loading**: `loadEntities()` fetches all entities
3. **File Data Loading**: `loadFileData()` fetches uploaded files
4. **GitHub Connection**: Checks GitHub connection status

### User Interactions

1. **File Upload**: User uploads CSV files
2. **Schema Processing**: System processes file schemas
3. **Entity Creation**: Raw entities are created
4. **Mapping**: User maps raw to curated entities
5. **Artifact Generation**: System generates artifacts
6. **GitHub Push**: Artifacts are pushed to GitHub

### State Updates

1. **Real-time Updates**: State updates trigger re-renders
2. **Progress Tracking**: Auto-mapping and artifact generation progress
3. **Error Handling**: Error states are managed and displayed
4. **Success Feedback**: Success states provide user feedback

## Error Handling

### Error Types

1. **API Errors**: Network and server errors
2. **Validation Errors**: Input validation failures
3. **File Processing Errors**: Schema processing failures
4. **GitHub Integration Errors**: Version control failures

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

1. **Debounced Search**: Search input is debounced to prevent excessive API calls
2. **Pagination**: Large entity lists are paginated
3. **Memoization**: Expensive calculations are memoized
4. **Lazy Loading**: Components are loaded on demand

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
- File upload tests
- GitHub integration tests

### End-to-End Tests

- Complete user journeys
- Cross-browser compatibility
- Performance testing
- Accessibility testing

## Common Issues and Solutions

### Issue 1: Auto-mapping Fails

**Problem**: Auto-mapping process fails for certain entities
**Solution**: Check entity schema validity and column name patterns

### Issue 2: Artifact Generation Timeout

**Problem**: Artifact generation takes too long
**Solution**: Implement progress tracking and timeout handling

### Issue 3: GitHub Push Failures

**Problem**: Artifacts fail to push to GitHub
**Solution**: Verify GitHub connection and repository permissions

### Issue 4: File Upload Errors

**Problem**: File upload fails or schema processing errors
**Solution**: Validate file format and size limits

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
2. **Pagination**: Implement pagination for large datasets
3. **Memoization**: Use memoization for expensive calculations
4. **Lazy Loading**: Load components and data on demand

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
