# LLM Backend

Backend API service for AI-powered data engineering operations using Large Language Models and RAG (Retrieval-Augmented Generation).

## Features

- ✅ AI-powered column mapping generation
- ✅ YAML transformation definition generation
- ✅ Automated reasoning and explanations
- ✅ Validation and improvement suggestions
- ✅ RAG-based learning from user feedback
- ✅ Vector similarity search for patterns
- ✅ Continuous improvement through feedback loop

## Architecture

```
src/
├── server.ts           # Express server setup
├── routes/             # API route definitions
│   ├── llm.routes.ts
│   └── rag.routes.ts
├── services/           # Business logic
│   ├── llm.service.ts
│   └── rag.service.ts
├── models/             # TypeScript types
│   └── types.ts
├── config/             # Configuration
│   └── logger.ts
└── utils/              # Utilities
    └── errorHandler.ts
```

## How It Works

### 1. Column Mapping Generation

The LLM analyzes source and target schemas to generate intelligent mappings:

- Direct mappings for obvious column matches
- Transformations for data type conversions
- Aggregations for summary calculations
- Window functions for analytical operations
- Business logic with CASE statements

### 2. RAG Integration

Before generating mappings, the system queries the RAG database for similar patterns:

- Vector similarity search using embeddings
- Learns from previous successful mappings
- Incorporates user feedback and corrections
- Improves over time with usage

### 3. Feedback Loop

Users can provide feedback on generated mappings:

- System stores feedback in RAG database
- Creates embeddings for future similarity search
- Uses corrections to improve future generations
- Tracks learning statistics

## API Endpoints

### LLM Operations

#### Generate Column Mappings
```bash
POST /api/llm/mappings/generate

{
  "sourceSchema": [
    {
      "name": "customer_id",
      "type": "INTEGER",
      "description": "Unique customer identifier"
    }
  ],
  "targetSchema": [
    {
      "name": "customer_key",
      "type": "BIGINT",
      "description": "Customer dimension key"
    }
  ],
  "transformationContext": "Building customer dimension table",
  "businessRules": ["Include only active customers"]
}
```

Response:
```json
{
  "mappings": [
    {
      "sourceColumn": "customer_id",
      "targetColumn": "customer_key",
      "type": "direct",
      "reasoning": "Direct mapping with type conversion from INTEGER to BIGINT",
      "confidence": 0.95,
      "validationRules": ["NOT NULL", "UNIQUE"]
    }
  ]
}
```

#### Generate YAML
```bash
POST /api/llm/yaml/generate

{
  "mappings": [...],
  "sourceTable": "raw.customers",
  "targetTable": "analytics.dim_customers",
  "transformationType": "complex"
}
```

#### Generate Reasoning
```bash
POST /api/llm/reasoning/generate

{
  "yaml": "...",
  "context": "Customer 360 transformation"
}
```

#### Validate and Suggest
```bash
POST /api/llm/validate

{
  "yaml": "...",
  "mappings": [...]
}
```

Response:
```json
{
  "isValid": true,
  "errors": [],
  "warnings": ["Consider adding index on customer_key"],
  "suggestions": [
    "Use incremental refresh for better performance",
    "Add data quality checks for email format"
  ]
}
```

### RAG Operations

#### Store Feedback
```bash
POST /api/rag/feedback

{
  "mappingId": "uuid",
  "yaml": "...",
  "userFeedback": "The aggregation should use SUM instead of AVG",
  "correctedMapping": [...]
}
```

#### Query Similar Patterns
```bash
POST /api/rag/query

{
  "query": "customer lifetime value calculation",
  "limit": 5,
  "filter": {
    "type": "feedback",
    "tags": ["aggregation"]
  }
}
```

#### Index Document
```bash
POST /api/rag/index

{
  "content": "Example of customer segmentation using CASE...",
  "metadata": {
    "type": "example",
    "source": "documentation",
    "tags": ["customer", "segmentation"]
  }
}
```

#### Get Learning Statistics
```bash
GET /api/rag/stats
```

Response:
```json
{
  "totalDocuments": 1247,
  "documentsByType": {
    "example": 450,
    "pattern": 320,
    "feedback": 477
  },
  "totalFeedback": 477,
  "recentFeedback": 23
}
```

## Environment Variables

```env
PORT=3003
NODE_ENV=development

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Database for RAG
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nexa_rag
DB_USER=postgres
DB_PASSWORD=

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Database Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION vector;

-- RAG documents with embeddings
CREATE TABLE rag_documents (
  id VARCHAR(36) PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feedback history
CREATE TABLE feedback_history (
  id SERIAL PRIMARY KEY,
  mapping_id VARCHAR(36) NOT NULL,
  yaml TEXT NOT NULL,
  user_feedback TEXT NOT NULL,
  corrected_mapping JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_rag_embedding ON rag_documents
  USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_rag_metadata ON rag_documents
  USING gin (metadata);
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Dependencies

- **express** - Web framework
- **openai** - OpenAI API client
- **pg** - PostgreSQL client
- **pg-vector** - Vector extension for PostgreSQL
- **js-yaml** - YAML processing
- **winston** - Logging

## How RAG Works

1. **Document Indexing**
   - Content is converted to embeddings using OpenAI
   - Stored in PostgreSQL with pgvector extension
   - Metadata allows filtering by type/tags

2. **Similarity Search**
   - Query is converted to embedding
   - Vector cosine similarity finds closest matches
   - Results ranked by relevance

3. **Continuous Learning**
   - User feedback is indexed as new documents
   - Future queries benefit from corrections
   - System improves accuracy over time

## Performance Tips

- Use `gpt-4-turbo-preview` for best quality
- Use `text-embedding-3-small` for fast embeddings
- Set temperature=0.2-0.3 for consistent results
- Limit RAG context to top 3-5 documents
- Index common patterns for faster lookups

## Security

- API keys are never logged
- Rate limiting recommended for production
- Validate all user inputs
- Sanitize feedback before indexing
