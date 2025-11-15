-- Star Schema Tables for Platform-Agnostic Usage Tracking
-- Run this script to create the star schema tables

-- Dimension Table: Pipelines
CREATE TABLE IF NOT EXISTS nexa_admin.dim_pipelines (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    workspace_id VARCHAR(100) NOT NULL,
    pipeline_id VARCHAR(200) NOT NULL,
    pipeline_name VARCHAR(500),
    dlt_tier VARCHAR(30),
    is_serverless BOOLEAN,
    uc_catalog VARCHAR(200),
    uc_schema VARCHAR(200),
    uc_table_name VARCHAR(200),
    uc_full_name VARCHAR(600),
    owned_by VARCHAR(200),
    pipeline_update_id VARCHAR(200),
    pipeline_maintenance_id VARCHAR(200),
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(platform, workspace_id, pipeline_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_pipeline_id ON nexa_admin.dim_pipelines(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_dim_pipeline_name ON nexa_admin.dim_pipelines(pipeline_name);

-- Dimension Table: Jobs
CREATE TABLE IF NOT EXISTS nexa_admin.dim_jobs (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    workspace_id VARCHAR(100) NOT NULL,
    job_id VARCHAR(100) NOT NULL,
    job_name VARCHAR(500),
    job_type VARCHAR(50),
    job_schedule VARCHAR(200),
    owned_by VARCHAR(200),
    created_by VARCHAR(200),
    is_on_all_purpose_compute BOOLEAN,
    created_at_timestamp TIMESTAMP,
    deleted_at_timestamp TIMESTAMP,
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(platform, workspace_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_job_id ON nexa_admin.dim_jobs(job_id);

-- Dimension Table: Warehouses
CREATE TABLE IF NOT EXISTS nexa_admin.dim_warehouses (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    workspace_id VARCHAR(100) NOT NULL,
    warehouse_id VARCHAR(200) NOT NULL,
    warehouse_name VARCHAR(500),
    warehouse_type VARCHAR(50),
    warehouse_size VARCHAR(20),
    owned_by VARCHAR(200),
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(platform, workspace_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_warehouse_id ON nexa_admin.dim_warehouses(warehouse_id);

-- Dimension Table: Clusters
CREATE TABLE IF NOT EXISTS nexa_admin.dim_clusters (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    workspace_id VARCHAR(100) NOT NULL,
    cluster_id VARCHAR(200) NOT NULL,
    cluster_name VARCHAR(500),
    cluster_type VARCHAR(50),
    owned_by VARCHAR(200),
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(platform, workspace_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_cluster_id ON nexa_admin.dim_clusters(cluster_id);

-- Dimension Table: Endpoints
CREATE TABLE IF NOT EXISTS nexa_admin.dim_endpoints (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    workspace_id VARCHAR(100) NOT NULL,
    endpoint_id VARCHAR(200) NOT NULL,
    endpoint_name VARCHAR(500),
    endpoint_type VARCHAR(50),
    owned_by VARCHAR(200),
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(platform, workspace_id, endpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_endpoint_id ON nexa_admin.dim_endpoints(endpoint_id);

-- Fact Table: Usage Facts
CREATE TABLE IF NOT EXISTS nexa_admin.usage_facts (
    id BIGSERIAL PRIMARY KEY,

    -- Core dimensions (present in ALL records)
    platform VARCHAR(20) NOT NULL,
    workspace_id VARCHAR(100) NOT NULL,
    environment VARCHAR(50),
    usage_date DATE NOT NULL,
    usage_start_time TIMESTAMP NOT NULL,
    usage_end_time TIMESTAMP,
    year_month VARCHAR(7) NOT NULL,

    -- Product/SKU (present in ALL records)
    billing_origin_product VARCHAR(50) NOT NULL,
    sku_name VARCHAR(150) NOT NULL,
    usage_unit VARCHAR(20) NOT NULL,
    cloud_provider VARCHAR(20),

    -- Resource identification (ONE will be populated)
    resource_type VARCHAR(50) NOT NULL,
    resource_dimension_id BIGINT,

    -- Ownership (common across all resource types)
    executed_by VARCHAR(200),
    team_tag VARCHAR(100),

    -- Metrics (present in ALL records)
    usage_quantity NUMERIC(18,6) NOT NULL,
    unit_price NUMERIC(12,6),
    list_cost NUMERIC(18,4),

    -- Metadata (sparse data goes here as JSON)
    custom_tags JSONB,

    -- Record management
    record_type VARCHAR(20) NOT NULL DEFAULT 'ORIGINAL',
    sync_batch_id VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for usage_facts
CREATE INDEX IF NOT EXISTS idx_facts_platform_date ON nexa_admin.usage_facts(platform, usage_date);
CREATE INDEX IF NOT EXISTS idx_facts_workspace_date ON nexa_admin.usage_facts(workspace_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_facts_product_date ON nexa_admin.usage_facts(billing_origin_product, usage_date);
CREATE INDEX IF NOT EXISTS idx_facts_resource ON nexa_admin.usage_facts(resource_type, resource_dimension_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_facts_year_month ON nexa_admin.usage_facts(year_month);
