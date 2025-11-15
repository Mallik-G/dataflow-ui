# Snowflake Backend

Backend API service for Snowflake operations in the DataFlow UI platform.

## Features

- ✅ Connection testing
- ✅ Query execution
- ✅ Table metadata retrieval
- ✅ Schema discovery
- ✅ DDL operations

## Architecture

```
src/
├── server.ts           # Express server setup
├── routes/             # API route definitions
│   └── snowflake.routes.ts
├── services/           # Business logic
│   └── snowflake.service.ts
├── models/             # TypeScript types
│   └── types.ts
├── config/             # Configuration
│   └── logger.ts
└── utils/              # Utilities
    └── errorHandler.ts
```

## API Endpoints

### Test Connection
```bash
POST /api/snowflake/test
Content-Type: application/json

{
  "accountIdentifier": "orgname-account_name",
  "username": "your_username",
  "password": "your_password",
  "warehouse": "COMPUTE_WH",
  "database": "MY_DATABASE",
  "schema": "PUBLIC",
  "role": "ACCOUNTADMIN"
}
```

### Execute Query
```bash
POST /api/snowflake/query
Content-Type: application/json

{
  "config": { ...snowflake config... },
  "sql": "SELECT * FROM customers LIMIT 10"
}
```

### Get Table Metadata
```bash
POST /api/snowflake/metadata/table
Content-Type: application/json

{
  "config": { ...snowflake config... },
  "database": "MY_DATABASE",
  "schema": "PUBLIC",
  "table": "CUSTOMERS"
}
```

### List Tables
```bash
POST /api/snowflake/tables/list
Content-Type: application/json

{
  "config": { ...snowflake config... },
  "database": "MY_DATABASE",
  "schema": "PUBLIC"
}
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3001
NODE_ENV=development

# Snowflake Configuration
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USERNAME=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_WAREHOUSE=
SNOWFLAKE_DATABASE=
SNOWFLAKE_SCHEMA=
SNOWFLAKE_ROLE=

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "snowflake-backend",
  "timestamp": "2025-11-15T04:13:11Z"
}
```

## Dependencies

- **express** - Web framework
- **snowflake-sdk** - Official Snowflake Node.js driver
- **winston** - Logging
- **zod** - Schema validation
- **cors** - CORS middleware

## Security

- Credentials are never logged
- All connections use SSL by default
- Password fields are sanitized in error messages

## Error Handling

All errors are logged and returned in a consistent format:

```json
{
  "success": false,
  "message": "Error description"
}
```
