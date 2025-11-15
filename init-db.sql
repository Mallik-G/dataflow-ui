-- Initialize databases and extensions

-- Create nexa_rag database
CREATE DATABASE nexa_rag;

-- Connect to nexa_state and set up tables
\c nexa_state;

-- Create deployment tracking tables
CREATE TABLE IF NOT EXISTS deployment_history (
  id VARCHAR(36) PRIMARY KEY,
  commit VARCHAR(40) NOT NULL,
  branch VARCHAR(255) NOT NULL,
  environment VARCHAR(20) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  plan_summary JSONB,
  result JSONB,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS deployed_resources (
  id SERIAL PRIMARY KEY,
  deployment_id VARCHAR(36) REFERENCES deployment_history(id),
  artifact_path VARCHAR(500) NOT NULL,
  artifact_hash VARCHAR(64) NOT NULL,
  runtime_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  env VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  action VARCHAR(20) NOT NULL,
  deployed_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_inventory (
  id SERIAL PRIMARY KEY,
  artifact_path VARCHAR(500) NOT NULL,
  artifact_hash VARCHAR(64) NOT NULL,
  runtime_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  env VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_deployed_commit VARCHAR(40) NOT NULL,
  last_deployed_at TIMESTAMP NOT NULL,
  action VARCHAR(20) NOT NULL,
  UNIQUE (artifact_path, env)
);

CREATE INDEX IF NOT EXISTS idx_deployment_env ON deployment_history(environment, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_env ON resource_inventory(env, resource_type);
CREATE INDEX IF NOT EXISTS idx_deployed_resources_deployment ON deployed_resources(deployment_id);

-- Connect to nexa_rag and set up RAG tables
\c nexa_rag;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create RAG tables
CREATE TABLE IF NOT EXISTS rag_documents (
  id VARCHAR(36) PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback_history (
  id SERIAL PRIMARY KEY,
  mapping_id VARCHAR(36) NOT NULL,
  yaml TEXT NOT NULL,
  user_feedback TEXT NOT NULL,
  corrected_mapping JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_metadata ON rag_documents USING gin (metadata);
