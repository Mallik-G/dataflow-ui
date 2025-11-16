# AA Website - Architecture Overview

## Project Summary

The AA Website is a comprehensive data transformation and management platform that enables users to:

- Upload and manage raw data files
- Transform raw data into curated datasets
- Generate consumption-ready data artifacts
- Manage entity mappings and transformations
- Integrate with GitHub for artifact version control
- Create data lineage and transformation pipelines

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Dashboard     │  │  Data Landing   │  │   Canvas/Flow   │  │
│  │   Pages         │  │  Zone Pages     │  │   Management    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Entity Mapping │  │  Artifact       │  │  Settings &     │  │
│  │  Management     │  │  Generation     │  │  Configuration  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Controllers   │  │    Services     │  │    Models       │  │
│  │                 │  │                 │  │                 │  │
│  │ • Transformation│  │ • AWS Services  │  │ • AttributeTrans│  │
│  │ • File Schema   │  │ • GitHub        │  │ • NLP Artifacts │  │
│  │ • Artifacts     │  │ • Data Transf.  │  │ • Batch Proj.   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   AWS S3        │  │   GitHub        │  │   Database      │  │
│  │   Storage       │  │   Integration   │  │   (PostgreSQL)  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

### 1. Raw Data Ingestion

```
CSV Files → AWS S3 → Raw Schema Detection → Entity Creation
```

### 2. Data Transformation Pipeline

```
Raw Data → Entity Mapping → Transformation Rules → Curated Data
```

### 3. Artifact Generation

```
Curated Data → DDL Generation → DML Generation → GitHub Push
```

### 4. Consumption Layer

```
Curated Data → Consumption Mapping → Gold Data → Final Artifacts
```

## Core Components

### Frontend Components

#### 1. **CuratedLandingZonePage** (`src/screens/CuratedLandingZonePage.jsx`)

- **Purpose**: Main interface for managing curated data entities
- **Key Features**:
  - Entity schema management and mapping
  - Artifact generation (DDL, DML, Transformations)
  - GitHub integration for artifact version control
  - NLP artifacts integration
- **State Management**: Complex state with 20+ state variables
- **API Integration**: Multiple endpoints for schema, metadata, and transformations

#### 2. **EditEntityMappingsPage** (`src/screens/EditEntityMappingsPage.jsx`)

- **Purpose**: Detailed entity mapping and transformation interface
- **Key Features**:
  - Column mapping between raw and curated data
  - Transformation rule definition
  - Auto-save functionality
  - Column description management
- **Props**: `entityName`, `curatedEntities`, `fileData`
- **State**: Mappings, attributes, rules, descriptions

#### 3. **Canvas Components** (`src/components/Canvas*.jsx`)

- **Purpose**: Visual data flow and entity relationship management
- **Key Features**:
  - Drag-and-drop interface
  - Entity relationship visualization
  - Artifact generation from canvas
  - Consumption layer management

### Backend Components

#### 1. **Controllers** (`nodeJsInitial/controllers/`)

- **transformationController.js**: Handles data transformation logic
- **artifactController.js**: Manages artifact generation and GitHub integration
- **rawFileSchemaController.js**: Processes raw file schemas
- **consumptionETLTransformationController.js**: Manages consumption layer transformations

#### 2. **Services** (`nodeJsInitial/services/`)

- **attributeTransformationService.js**: Core transformation logic
- **githubService.js**: GitHub integration and artifact management
- **awsUploader.js**: AWS S3 file management

#### 3. **Models** (`nodeJsInitial/models/`)

- **AttributeTransformation.js**: Main transformation data model
- **NLPArtifact.js**: NLP-generated transformation artifacts
- **BatchProjection.js**: Batch processing configurations

## Data Models

### 1. **AttributeTransformation Model**

```javascript
{
  id: UUID,
  entityName: String,           // "raw.customers"
  curatedEntityName: String,    // "curated.customers"
  sourceAttributes: JSON,      // Raw column names
  curatedAttributes: JSON,     // Curated column names
  mappings: JSON,              // Column mapping rules
  columnRules: JSON,           // Transformation rules
  operatorRules: JSON,         // Operator-based rules
  concatenationRules: JSON,    // Field concatenation rules
  entityNLPRules: JSON,        // AI-generated rules
  columnDescriptions: JSON,    // Column metadata
  transformationId: String,    // Unique transformation ID
  status: String,              // "draft", "applied", "published"
  version: String              // Version control
}
```

### 2. **File Data Structure**

```javascript
{
  key: String,                 // S3 object key
  name: String,                // Original filename
  size: Number,                // File size in bytes
  lastModified: Date,          // Last modification date
  entities: Array,             // Detected entities
  attributes: Array,           // Column information
  metadata: Object             // Additional file metadata
}
```

## API Endpoints

### Core Transformation APIs

- `GET /api/raw-schemas/{entityName}` - Get raw entity schema
- `GET /api/raw-schemas/{entityName}/column-metadata` - Get column metadata
- `POST /api/transformations/save` - Save transformation rules
- `GET /api/transformations/{entityName}` - Get saved transformations
- `POST /api/transformations/apply` - Apply transformations

### Artifact Generation APIs

- `POST /api/artifacts/generate-ddl` - Generate DDL artifacts
- `POST /api/artifacts/generate-dml` - Generate DML artifacts
- `POST /api/artifacts/push-to-github` - Push artifacts to GitHub
- `GET /api/artifacts/diff/{entityName}` - Get artifact differences

### File Management APIs

- `POST /api/files/upload` - Upload files to S3
- `GET /api/files/list` - List uploaded files
- `GET /api/files/{fileId}/schema` - Get file schema

## Key Features

### 1. **Entity Mapping System**

- Automatic column mapping based on name similarity
- Manual override capabilities
- Support for complex transformations (concatenation, case statements, calculations)
- Control column management for metadata

### 2. **Artifact Generation**

- DDL (Data Definition Language) generation
- DML (Data Manipulation Language) generation
- Transformation script generation
- GitHub integration for version control

### 3. **NLP Integration**

- AI-powered transformation suggestions
- Automatic column description generation
- Smart mapping recommendations
- Natural language rule processing

### 4. **Data Lineage**

- Visual representation of data flow
- Entity relationship mapping
- Transformation traceability
- Impact analysis capabilities

## Technology Stack

### Frontend

- **React 18.3.1** - UI framework
- **React Router DOM 7.5.2** - Routing
- **React Bootstrap 2.10.10** - UI components
- **Axios 1.6.8** - HTTP client
- **Chart.js 4.5.0** - Data visualization
- **React Flow Renderer 10.3.17** - Flow diagrams
- **Sass 1.89.2** - CSS preprocessing

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Sequelize** - ORM
- **PostgreSQL** - Database
- **AWS SDK** - Cloud services integration

### External Services

- **AWS S3** - File storage
- **GitHub API** - Version control
- **Cognito** - Authentication (planned)

## Security Considerations

### Authentication

- JWT-based authentication
- 24-hour session expiration
- Protected routes implementation
- Local storage management

### Data Security

- Input validation and sanitization
- SQL injection prevention
- File upload security
- AWS credential management

### Access Control

- Entity-level access control
- User permission management
- Audit trail implementation
- Data privacy compliance

## Performance Considerations

### Frontend Optimization

- Component memoization
- Debounced API calls
- Efficient state management
- Lazy loading implementation

### Backend Optimization

- Database query optimization
- Caching strategies
- Batch processing
- Async operation handling

### Scalability

- Horizontal scaling support
- Database connection pooling
- File processing optimization
- Memory management

## Deployment Architecture

### Development Environment

- Local development with Vite
- Hot module replacement
- ESLint integration
- Source map support

### Production Environment

- Docker containerization
- AWS deployment
- CI/CD pipeline integration
- Environment variable management

## Monitoring and Logging

### Application Monitoring

- Error tracking and reporting
- Performance metrics
- User activity logging
- API response monitoring

### Infrastructure Monitoring

- Server health monitoring
- Database performance tracking
- AWS service monitoring
- Resource utilization tracking

## Future Enhancements

### Planned Features

- Real-time collaboration
- Advanced data quality rules
- Machine learning integration
- Enhanced visualization capabilities
- Multi-tenant support

### Technical Improvements

- Microservices architecture
- GraphQL API implementation
- Advanced caching strategies
- Enhanced security features
- Performance optimization

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
