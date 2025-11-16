# Developer Guide - AA Website

## Quick Start Guide

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database
- AWS S3 bucket (for file storage)
- GitHub repository (for artifact version control)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd aa-website
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

## Project Structure

### Frontend Structure (`src/`)

```
src/
├── components/          # Reusable UI components
│   ├── dashboard/       # Dashboard-specific components
│   ├── Layout.jsx       # Main layout wrapper
│   ├── Header.tsx       # Application header
│   └── Sidebar.jsx      # Navigation sidebar
├── screens/             # Main page components
│   ├── CuratedLandingZonePage.jsx    # Main data management page
│   ├── EditEntityMappingsPage.jsx   # Entity mapping interface
│   ├── GoldLandingPage.jsx          # Consumption layer management
│   └── DashboardPage.jsx            # Main dashboard
├── services/            # API service layer
│   └── aws.jsx          # AWS S3 integration
├── routes/              # Route definitions
├── hooks/               # Custom React hooks
├── context/             # React context providers
├── utils/               # Utility functions
├── assets/              # Static assets
└── scss/                # Stylesheets
```

### Backend Structure (`nodeJsInitial/`)

```
nodeJsInitial/
├── controllers/         # API endpoint handlers
├── services/           # Business logic services
├── models/            # Database models
├── routes/            # Route definitions
├── middlewares/       # Request middleware
├── helpers/           # Utility functions
├── config/            # Configuration files
└── migrations/        # Database migrations
```

## Core Concepts

### 1. Data Layers

#### Raw Data Layer

- **Purpose**: Initial data ingestion from CSV files
- **Naming Convention**: `raw.{filename}`
- **Characteristics**: Unprocessed, original data format

#### Curated Data Layer

- **Purpose**: Cleaned, standardized data
- **Naming Convention**: `curated.{filename}`
- **Characteristics**: Business rules applied, control columns added

#### Consumption Data Layer

- **Purpose**: Analytics-ready data
- **Naming Convention**: `consumption.{entity_name}`
- **Characteristics**: Aggregated, business metrics calculated

### 2. Entity Mapping

#### Automatic Mapping

```javascript
// System automatically maps columns based on:
const autoMappingRules = {
  exactMatch: ["id", "name", "email"],
  patternMatch: {
    "first_name + last_name": "full_name",
    phone: "phone_number",
  },
  semanticMatch: {
    cust_email: "email_address", // AI-powered
    user_id: "customer_id",
  },
};
```

#### Manual Mapping Override

```javascript
// Users can override automatic mappings
const manualMapping = {
  sourceColumn: "id",
  targetColumn: "customer_id",
  transformation: "direct_mapping",
  validation: {
    required: true,
    unique: true,
    dataType: "INTEGER",
  },
};
```

### 3. Transformation Rules

#### Column Rules

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
};
```

#### Operator Rules

```javascript
const operatorRules = {
  email_address: {
    operators: [
      { type: "lowercase", applied: true },
      { type: "trim", applied: true },
      { type: "validate_email", applied: true },
    ],
  },
};
```

## Key Components

### 1. CuratedLandingZonePage

**Purpose**: Main interface for managing curated data entities

**Key Features**:

- Entity schema management
- Artifact generation (DDL, DML)
- GitHub integration
- NLP artifacts integration

**State Management**:

```javascript
// Core data state
const [entities, setEntities] = useState([]);
const [rawEntities, setRawEntities] = useState([]);
const [curatedEntities, setCuratedEntities] = useState([]);

// UI state
const [editingEntity, setEditingEntity] = useState(null);
const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);

// Auto-mapping state
const [autoMappedEntities, setAutoMappedEntities] = useState(new Set());
const [isAutoMapping, setIsAutoMapping] = useState(false);
```

**Key Functions**:

```javascript
// Load all entities
const loadEntities = async () => {
  const response = await axios.get("/api/entities");
  setEntities(response.data);
};

// Generate artifacts for entity
const generateArtifacts = async (entityName) => {
  const ddlResponse = await axios.post("/api/artifacts/generate-ddl", {
    entityName,
    curatedEntityName: `curated.${entityName.replace("raw.", "")}`,
  });
  // Handle response...
};
```

### 2. EditEntityMappingsPage

**Purpose**: Detailed entity mapping and transformation interface

**Props**:

```javascript
interface EditEntityMappingsPageProps {
  entityName?: string; // "raw.customers"
  curatedEntities?: string[]; // ["curated.customers"]
  fileData?: FileData[]; // File metadata array
}
```

**State Management**:

```javascript
// Core data state
const [rawAttributes, setRawAttributes] = useState([]);
const [curatedAttributes, setCuratedAttributes] = useState([]);
const [mappings, setMappings] = useState([]);

// Transformation state
const [columnRules, setColumnRules] = useState({});
const [operatorRules, setOperatorRules] = useState({});
const [concatenationRules, setConcatenationRules] = useState([]);
```

**Key Functions**:

```javascript
// Update mapping
const updateMapping = async (idx, field, value) => {
  const newMappings = [...mappings];
  newMappings[idx][field] = value;
  setMappings(newMappings);
  await autoSaveMappings(newMappings);
};

// Auto-save transformations
const autoSaveMappings = async (mappings, descriptions) => {
  await axios.post("/api/transformations/save", {
    entityName,
    mappings,
    columnDescriptions: descriptions,
  });
};
```

## API Integration

### 1. Authentication

All API calls require JWT authentication:

```javascript
// Add to axios defaults
axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
```

### 2. Core API Endpoints

#### Entity Management

```javascript
// Get all entities
GET / api / entities;

// Get entity schema
GET / api / raw - schemas / { entityName };

// Save transformations
POST / api / transformations / save;
```

#### File Management

```javascript
// Upload file
POST / api / files / upload;

// List files
GET / api / files / list;

// Get file schema
GET / api / files / { fileKey } / schema;
```

#### Artifact Generation

```javascript
// Generate DDL
POST / api / artifacts / generate - ddl;

// Generate DML
POST / api / artifacts / generate - dml;

// Push to GitHub
POST / api / artifacts / push - to - github;
```

### 3. Error Handling

```javascript
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    console.error("API Error:", error.response.data);
  } else if (error.request) {
    // Request was made but no response received
    console.error("Network Error:", error.request);
  } else {
    // Something else happened
    console.error("Error:", error.message);
  }
};
```

## Data Models

### 1. AttributeTransformation Model

```javascript
{
  id: "UUID",
  entityName: "raw.customers",
  curatedEntityName: "curated.customers",
  sourceAttributes: ["id", "name", "email"],
  curatedAttributes: ["customer_id", "full_name", "email_address"],
  mappings: [
    {
      raw: "id",
      curated: "customer_id",
      transformation: "direct_mapping"
    }
  ],
  columnRules: {
    "customer_id": {
      type: "primary_key",
      constraints: ["not_null", "unique"]
    }
  },
  transformationId: "unique-string",
  status: "draft",
  version: "1.0"
}
```

### 2. File Data Structure

```javascript
{
  key: "uploads/customers.csv",
  name: "customers.csv",
  size: 1024000,
  lastModified: "2024-01-01T00:00:00Z",
  entities: ["raw.customers"],
  attributes: [
    { name: "id", type: "INTEGER" },
    { name: "name", type: "VARCHAR" }
  ]
}
```

## Development Workflow

### 1. Adding New Features

#### Frontend Component

```javascript
// 1. Create component file
// src/components/NewFeature.jsx

import React, { useState, useEffect } from "react";
import axios from "axios";

function NewFeature({ entityName, onUpdate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [entityName]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/new-feature/${entityName}`);
      setData(response.data);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {loading ? <div>Loading...</div> : <div>{/* Component content */}</div>}
    </div>
  );
}

export default NewFeature;
```

#### Backend Controller

```javascript
// controllers/newFeatureController.js

const NewFeatureService = require("../services/newFeatureService");

const getNewFeature = async (req, res) => {
  try {
    const { entityName } = req.params;
    const result = await NewFeatureService.getData(entityName);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in getNewFeature:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getNewFeature,
};
```

#### Backend Service

```javascript
// services/newFeatureService.js

const NewFeatureModel = require("../models/NewFeature");

const getData = async (entityName) => {
  try {
    const data = await NewFeatureModel.findAll({
      where: { entityName },
    });

    return data;
  } catch (error) {
    throw new Error(`Failed to get data: ${error.message}`);
  }
};

module.exports = {
  getData,
};
```

### 2. Database Migrations

```javascript
// migrations/add_new_feature_table.js

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("new_feature", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      entityName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      data: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("new_feature");
  },
};
```

### 3. Testing

#### Unit Tests

```javascript
// tests/components/NewFeature.test.js

import { render, screen } from "@testing-library/react";
import NewFeature from "../../src/components/NewFeature";

describe("NewFeature Component", () => {
  test("renders loading state", () => {
    render(<NewFeature entityName="test" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("renders data when loaded", async () => {
    render(<NewFeature entityName="test" />);
    // Test implementation...
  });
});
```

#### API Tests

```javascript
// tests/api/newFeature.test.js

const request = require("supertest");
const app = require("../../app");

describe("NewFeature API", () => {
  test("GET /api/new-feature/:entityName", async () => {
    const response = await request(app)
      .get("/api/new-feature/test-entity")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });
});
```

## Common Patterns

### 1. State Management Pattern

```javascript
// Use this pattern for complex state management
const useEntityState = (initialEntity) => {
  const [entity, setEntity] = useState(initialEntity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateEntity = async (updates) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.put(`/api/entities/${entity.id}`, updates);
      setEntity(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { entity, loading, error, updateEntity };
};
```

### 2. API Service Pattern

```javascript
// Use this pattern for API service classes
class EntityService {
  static async getEntity(entityName) {
    try {
      const response = await axios.get(`/api/entities/${entityName}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get entity: ${error.message}`);
    }
  }

  static async updateEntity(entityName, updates) {
    try {
      const response = await axios.put(`/api/entities/${entityName}`, updates);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update entity: ${error.message}`);
    }
  }
}
```

### 3. Error Boundary Pattern

```javascript
// Use this pattern for error handling
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>Something went wrong.</h2>
          <details>{this.state.error && this.state.error.toString()}</details>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Performance Optimization

### 1. React Optimization

```javascript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* Expensive rendering */}</div>;
});

// Use useMemo for expensive calculations
const ExpensiveCalculation = ({ items }) => {
  const processedItems = useMemo(() => {
    return items.map((item) => expensiveProcessing(item));
  }, [items]);

  return <div>{processedItems}</div>;
};

// Use useCallback for event handlers
const ParentComponent = () => {
  const handleClick = useCallback((id) => {
    // Handle click
  }, []);

  return <ChildComponent onClick={handleClick} />;
};
```

### 2. API Optimization

```javascript
// Implement request debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Use in components
const SearchComponent = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearchTerm) {
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);
};
```

## Debugging

### 1. Frontend Debugging

```javascript
// Use React DevTools
// Install browser extension for React debugging

// Add debug logging
const debugLog = (message, data) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEBUG] ${message}:`, data);
  }
};

// Use in components
const MyComponent = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    debugLog("Component mounted", { state });
  }, [state]);
};
```

### 2. Backend Debugging

```javascript
// Use console logging
const debugLog = (message, data) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEBUG] ${message}:`, data);
  }
};

// Use in controllers
const getEntity = async (req, res) => {
  try {
    debugLog("Getting entity", { entityName: req.params.entityName });

    const entity = await EntityService.getEntity(req.params.entityName);

    debugLog("Entity retrieved", { entity });

    res.json({ success: true, data: entity });
  } catch (error) {
    debugLog("Error getting entity", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};
```

## Deployment

### 1. Environment Setup

```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:port/database
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
GITHUB_TOKEN=your_github_token
```

### 2. Build Process

```bash
# Frontend build
npm run build

# Backend build
npm run build:backend

# Docker build
docker build -t aa-website .
```

### 3. Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] AWS credentials set up
- [ ] GitHub integration configured
- [ ] SSL certificates installed
- [ ] Monitoring set up
- [ ] Backup strategy implemented

## Troubleshooting

### Common Issues

#### 1. Entity Not Loading

**Problem**: Entity data not appearing in UI
**Solutions**:

- Check API endpoint response
- Verify entity name format
- Check authentication token
- Review browser console for errors

#### 2. Auto-mapping Fails

**Problem**: Automatic mapping not working
**Solutions**:

- Check column name patterns
- Verify entity schema validity
- Review mapping rules configuration
- Check for special characters in column names

#### 3. Artifact Generation Errors

**Problem**: DDL/DML generation fails
**Solutions**:

- Verify transformation rules
- Check entity schema completeness
- Review database connection
- Check GitHub integration status

#### 4. File Upload Issues

**Problem**: Files not uploading to S3
**Solutions**:

- Verify AWS credentials
- Check S3 bucket permissions
- Review file size limits
- Check network connectivity

### Debug Steps

1. **Check Browser Console**

   ```javascript
   // Look for JavaScript errors
   console.error("Error message");
   ```

2. **Check Network Tab**

   - Look for failed API requests
   - Check response status codes
   - Verify request payloads

3. **Check Backend Logs**

   ```bash
   # Check application logs
   tail -f logs/app.log

   # Check error logs
   tail -f logs/error.log
   ```

4. **Database Debugging**

   ```sql
   -- Check entity data
   SELECT * FROM attribute_transformations WHERE entity_name = 'raw.customers';

   -- Check file data
   SELECT * FROM raw_file_schemas WHERE file_name = 'customers.csv';
   ```

## Contributing

### Code Standards

- Use ESLint for code linting
- Follow React best practices
- Write comprehensive tests
- Document complex functions
- Use TypeScript for type safety

### Pull Request Process

1. Create feature branch
2. Write tests for new functionality
3. Update documentation
4. Submit pull request
5. Address review feedback
6. Merge after approval

### Issue Reporting

1. Use clear, descriptive titles
2. Include reproduction steps
3. Provide error messages
4. Include environment details
5. Add screenshots if applicable

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
