# Nexa-Web Main UI

**Status:** ✅ Fully Integrated (January 2025)

nexa-web is now the **primary and only UI** for the Nexa platform. All screens from the previous dataflow-ui have been successfully integrated into nexa-web's navigation and layout structure.

## Navigation Structure

### Main Dashboard (`/dashboard`)
The nexa-web dashboard serves as the central hub with:
- **Talk to your Data** - Nexa AI chat interface
- **New/Change Data Flows** - Quick access to data pipeline creation
- **Recent Changes** - Latest modifications across the platform
- **Data Assets** - Summary of total data assets
- **Executed Queries** - Query execution statistics
- **Outbound Connectors** - Active connector status
- **Recent Jobs** - Latest job executions
- **Top Active Agents** - Most active AI agents

### Complete Sidebar Navigation

The sidebar provides access to all platform features in a logical, workflow-based order:

#### 1. Core Data Management
- **Dashboard** (`/dashboard`) - Main overview and quick actions
- **Data Flow** (`/data-flow`) - Data flow management interface
- **Canvas** (`/consumption_landing_page`) - Visual canvas for Bronze/Gold zones

#### 2. Pipeline & Job Management
- **Pipelines** (`/pipelines`) - Delta Live Tables pipeline management
  - View all pipelines (continuous/triggered mode)
  - Pipeline health and status monitoring
  - Configuration: tables, libraries, clusters, updates, events
- **Jobs** (`/jobs`) - Databricks job management and monitoring
  - Job execution history and task details
  - Health scores and failure tracking
  - Task dependencies and run timing breakdowns
- **Observe** (`/observe`) - Operational health dashboard
  - Job KPIs: total, running, failed, consecutive failures
  - Pipeline KPIs: total, running, failed, health metrics
  - Clickable metrics navigate to filtered views

#### 3. Deployment Management
- **Deploy** (`/deploy`) - Databricks Asset Bundle deployment
  - Deploy to development, QA, and production environments
  - Bundle validation and deployment history
  - Configuration file management
- **Promotions** (`/promotions`) - Cross-environment promotions
  - Promote deployments: Dev → QA → Prod
  - Approval workflows and rollback capabilities
  - Deployment versioning and tracking

#### 4. Connectivity & Configuration
- **Connections** (`/connections`) - Data source/target connections
  - Manage database connections
  - Connection testing and validation
  - Credential management
- **Connectors** (`/connectors`) - Data connector catalog
  - Available connector types
  - Connector configuration and setup
  - Active connector monitoring

#### 5. Analytics & Governance
- **Projections** (`/projections`) - Data projections and forecasting
  - Batch projection settings
  - Projection analysis and visualization
- **Business Glossary** (`/business-glossary`) - Metadata and definitions
  - Business term definitions
  - Data lineage and cataloging
  - Searchable glossary interface

#### 6. AI & Automation
- **Agents** (`/agents`) - AI agent management
  - Configure and monitor AI agents
  - Agent performance tracking
  - Agent-to-data connections

#### 7. Platform Management
- **Apps** (`/apps`) - Platform applications
  - Available platform apps and extensions
  - App configuration and settings
- **Usage & Costs** (`/usage-costs`) - Cost monitoring and optimization
  - Resource usage tracking
  - Cost breakdowns and analysis
  - Budget alerts and optimization recommendations
- **Settings** (`/settings`) - Platform settings and preferences
  - User preferences
  - System configuration
  - Integration settings

## Integration Details

### Screens Migrated from dataflow-ui to nexa-web

All TypeScript screens from dataflow-ui are now fully integrated into nexa-web:

1. **Deploy** (`screens/Deploy.tsx`)
   - Source: dataflow-ui
   - Technology: TypeScript + React
   - Features: DAB deployment, environment management

2. **Promotions** (`screens/Promotions.tsx`)
   - Source: dataflow-ui
   - Technology: TypeScript + React
   - Features: Cross-environment promotion workflows

3. **Observe** (`screens/Observe.tsx`)
   - Source: dataflow-ui (enhanced in nexa-web)
   - Technology: TypeScript + React
   - Features: Operational health KPIs, clickable navigation

4. **Connections** (`screens/Connections.tsx`)
   - Source: dataflow-ui
   - Technology: TypeScript + React
   - Features: Connection management, testing, validation

5. **Pipelines** (`screens/Pipelines.jsx`)
   - Source: Created new in nexa-web
   - Technology: JavaScript + React
   - Features: Full DLT pipeline management with detailed views

### Native nexa-web Screens

These screens are original to nexa-web:

- Dashboard
- Data Flow
- Canvas (Bronze/Gold)
- Jobs (enhanced)
- Connectors
- Projections
- Business Glossary
- Agents
- Apps
- Usage & Costs
- Settings

### Canvas Architecture

nexa-web includes sophisticated canvas visualizations:

- **Bronze Canvas** (`CanvasPage.jsx`) - Raw → Curated data flow
- **Gold Canvas** (`CanvasPageGold.jsx`) - Curated → Consumption data flow
- **Smart Hierarchy** - Intelligent expand/collapse for complex flows
- **Collaborative Editing** - Real-time presence indicators
- **React Flow v11** - Modern, performant visualization

## Technology Stack

### Frontend
- **React 18.3.1** - Core UI framework
- **React Router 7.5.2** - Routing and navigation
- **React Flow 11.10.4** - Canvas visualization (upgraded from v10)
- **TypeScript 5.2.2** - Type safety (gradual adoption)
- **React Bootstrap 2.10.10** - UI components
- **Zustand 4.5.0** - State management
- **Axios 1.6.8** - HTTP client

### Build & Development
- **Vite 6.3.1** - Build tool and dev server
- **Sass 1.89.2** - Styling
- **ESLint** - Code quality

### Backend Integration
- **Databricks APIs** - Jobs, Pipelines, DLT
- **AWS S3** - File storage and retrieval
- **Azure AD** - Authentication (MSAL)

## Access & Authentication

### Entry Point
- **URL:** `/` redirects to `/login` or `/dashboard` (if authenticated)
- **Login:** `/login` - Azure AD authentication
- **Session:** 24-hour authentication timeout

### Protected Routes
All routes except `/login` and `/register` require authentication via Azure AD.

### User Experience
1. User logs in via Azure AD
2. Redirected to Dashboard (`/dashboard`)
3. Navigate via sidebar to any platform feature
4. All dataflow-ui screens now seamlessly integrated

## Key Features

### 1. Unified Navigation
Single sidebar provides access to all platform features without switching UIs

### 2. Consistent Layout
All screens use the same Layout component with:
- Sidebar navigation
- Top header with user profile
- Breadcrumb navigation
- Theme switcher (Light/Dark)

### 3. Collaborative Editing
Real-time presence indicators on canvas pages show:
- Who else is viewing/editing
- User avatars with initials
- Warning banners for concurrent editors
- Polling-based updates every 10 seconds

### 4. Operational Monitoring
Comprehensive monitoring through:
- Observe screen: High-level KPIs
- Jobs page: Detailed task and run information
- Pipelines page: Full pipeline lifecycle management

### 5. Deployment Workflow
End-to-end deployment capabilities:
- Deploy to dev/QA/prod environments
- Promote between environments
- Track deployment history

## Migration Complete

### What Changed
- ✅ All dataflow-ui screens integrated into nexa-web
- ✅ React Flow upgraded to v11 across all canvas files
- ✅ TypeScript infrastructure created for gradual migration
- ✅ Connections and Settings added to sidebar
- ✅ Sidebar reorganized for logical workflow
- ✅ Collaborative presence feature added
- ✅ Canvas architecture modernized

### What Stayed the Same
- ✅ nexa-web's dashboard and core UX unchanged
- ✅ All existing nexa-web features fully functional
- ✅ Authentication and authorization unchanged
- ✅ API integrations preserved

### dataflow-ui Status
- **Retirement Plan:** Q2 2025 (per ARCHITECTURE.md)
- **Current Status:** All features migrated, repository can be archived
- **Reference Use:** Can be used as TypeScript reference during transition

## Developer Guide

### Running Locally
```bash
cd nexa-web
npm install
npm run dev
```

### Building for Production
```bash
npm run build
npm run preview  # Test production build
```

### Adding New Features
1. Create screen component in `src/screens/`
2. Add route in `src/App.jsx`
3. Add sidebar link in `src/components/Sidebar.jsx`
4. Wrap in Layout and ProtectedRoute for authentication

### File Structure
```
nexa-web/src/
├── screens/           # All page components
│   ├── Deploy.tsx
│   ├── Promotions.tsx
│   ├── Observe.tsx
│   ├── Connections.tsx
│   ├── Pipelines.jsx
│   ├── Jobs.jsx
│   ├── DashboardPage.jsx
│   └── ...
├── components/        # Reusable components
│   ├── Sidebar.jsx
│   ├── Layout.jsx
│   ├── PresenceIndicator.jsx
│   └── ...
├── canvas/           # Canvas architecture (TypeScript)
│   ├── core/
│   ├── gold/
│   └── shared/
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
└── App.jsx           # Main app with routing
```

## Summary

**nexa-web is now the complete, unified UI for the Nexa platform.** All previously separate dataflow-ui functionality has been integrated, providing users with:

- Single point of access for all features
- Consistent navigation and UX
- Modern, performant canvas visualizations
- Comprehensive monitoring and deployment tools
- Collaborative editing capabilities

Users no longer need to switch between different UIs - everything is accessible through the nexa-web sidebar navigation.
