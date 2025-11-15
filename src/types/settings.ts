export interface SnowflakeConfig {
  accountIdentifier: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
  role?: string;
}

export interface DatabricksConfig {
  host: string;
  token: string;
  clusterId: string;
  catalog?: string;
  schema?: string;
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  branch: string;
  basePath?: string;
}

export interface DatabaseConfig {
  type: 'postgres' | 'mysql' | 'snowflake' | 'databricks';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface PlatformSettings {
  snowflake?: SnowflakeConfig;
  databricks?: DatabricksConfig;
  github?: GitHubConfig;
  database?: DatabaseConfig;
  defaultPlatform?: 'snowflake' | 'databricks' | 'bigquery' | 'postgres';
}

export interface AppSettings {
  platform: PlatformSettings;
  theme?: 'light' | 'dark';
  lastUpdated?: string;
}
