# AA Website - Data Transformation Platform

A comprehensive data transformation and management platform that enables users to upload raw data, transform it into curated datasets, and generate consumption-ready artifacts with full GitHub integration.

## 🚀 Overview

The AA Website is a modern React-based platform that provides:

- **Data Ingestion**: Upload and process CSV files with automatic schema detection
- **Entity Mapping**: Map raw data columns to curated data columns with AI-powered suggestions
- **Transformation Rules**: Define complex transformation rules including concatenation, case statements, and calculations
- **Artifact Generation**: Generate DDL, DML, and transformation scripts
- **GitHub Integration**: Version control for all generated artifacts
- **NLP Integration**: AI-powered transformation suggestions and column descriptions
- **Data Lineage**: Track data flow from source to consumption layers

## 🏗️ Architecture

### Frontend (React)

- **React 18.3.1** with modern hooks and functional components
- **React Router DOM 7.5.2** for client-side routing
- **React Bootstrap 2.10.10** for UI components
- **Chart.js 4.5.0** for data visualization
- **React Flow Renderer 10.3.17** for data flow diagrams

### Backend (Node.js)

- **Express.js** web framework
- **Sequelize** ORM for database operations
- **PostgreSQL** database
- **AWS SDK** for S3 integration
- **GitHub API** for version control

### External Services

- **AWS S3** for file storage
- **GitHub** for artifact version control
- **PostgreSQL** for data persistence

## 📁 Project Structure

### Frontend (`src/`)

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

### Backend (`nodeJsInitial/`)

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

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- AWS S3 bucket
- GitHub repository

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

## 📚 Documentation

### Core Documentation

- **[Architecture Overview](docs/ARCHITECTURE_OVERVIEW.md)** - High-level system architecture and design patterns
- **[Developer Guide](docs/DEVELOPER_GUIDE.md)** - Comprehensive development guide with examples
- **[Service Layer & API](docs/SERVICE_LAYER_API.md)** - Backend services and API documentation
- **[Data Flow & Entity Mappings](docs/DATA_FLOW_ENTITY_MAPPINGS.md)** - Data transformation processes and mapping logic

### Component Documentation

- **[CuratedLandingZonePage](docs/CuratedLandingZonePage.md)** - Main data management component
- **[EditEntityMappingsPage](docs/EditEntityMappingsPage.md)** - Entity mapping interface (existing)

### Quick Reference

- **[Quick Reference](docs/Quick-Reference.md)** - Quick reference for common operations
- **[Usage Examples](docs/EditEntityMappingsPage-Usage-Examples.md)** - Practical usage examples

## 🔧 Key Features

### 1. Data Ingestion

- Upload CSV files to AWS S3
- Automatic schema detection and column type inference
- File metadata management and processing status tracking

### 2. Entity Mapping

- **Automatic Mapping**: AI-powered column mapping based on name similarity
- **Manual Override**: User-defined mapping rules and transformations
- **Complex Transformations**: Support for concatenation, case statements, and calculations

### 3. Artifact Generation

- **DDL Generation**: Data Definition Language scripts for database schema
- **DML Generation**: Data Manipulation Language scripts for data transformation
- **GitHub Integration**: Automatic version control for all generated artifacts

### 4. Data Quality Management

- **Validation Rules**: Column-level and entity-level validation
- **Data Quality Metrics**: Completeness, validity, and uniqueness tracking
- **Error Handling**: Comprehensive error management and user feedback

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# AWS Configuration
VITE_AWS_REGION=us-east-1
VITE_AWS_S3_BUCKET=your-bucket-name
VITE_AWS_ACCESS_KEY_ID=your-access-key
VITE_AWS_SECRET_ACCESS_KEY=your-secret-key

# GitHub Integration
GITHUB_TOKEN=your-github-token
GITHUB_REPOSITORY=user/repository-name
```

## 🔒 Security

- **JWT Authentication**: Secure API access with token-based authentication
- **Input Validation**: Comprehensive input validation and sanitization
- **AWS Security**: Secure S3 access with proper IAM policies
- **GitHub Security**: Secure repository access with personal access tokens

## 📊 Data Flow

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Use ESLint for code linting
- Follow React best practices
- Write comprehensive tests
- Document complex functions
- Use TypeScript for type safety

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Check the [documentation](docs/) for detailed guides
- Review the [troubleshooting guide](docs/DEVELOPER_GUIDE.md#troubleshooting)
- Open an issue for bug reports or feature requests

## 🔄 Version History

- **v1.0.0** - Initial release with core data transformation features
- **v1.1.0** - Added GitHub integration and artifact version control
- **v1.2.0** - Enhanced NLP integration and AI-powered suggestions

---

**Last Updated**: January 2024  
**Maintainer**: Development Team
