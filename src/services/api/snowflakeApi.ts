import { SnowflakeConfig } from '../../types/settings';

export class SnowflakeAPI {
  private config: SnowflakeConfig;

  constructor(config: SnowflakeConfig) {
    this.config = config;
  }

  /**
   * Test connection to Snowflake
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // In production, this would call your backend API endpoint
      // which connects to Snowflake using snowflake-sdk
      const response = await fetch('/api/snowflake/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.config),
      });

      if (!response.ok) {
        throw new Error('Connection test failed');
      }

      return { success: true, message: 'Connected successfully' };
    } catch (error) {
      return { success: false, message: `Failed: ${error}` };
    }
  }

  /**
   * Execute SQL query
   */
  async executeQuery(sql: string): Promise<any[]> {
    try {
      const response = await fetch('/api/snowflake/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.config,
          sql,
        }),
      });

      if (!response.ok) {
        throw new Error('Query execution failed');
      }

      const data = await response.json();
      return data.rows || [];
    } catch (error) {
      console.error('Snowflake query error:', error);
      throw error;
    }
  }

  /**
   * Get table metadata
   */
  async getTableMetadata(
    database: string,
    schema: string,
    table: string
  ): Promise<any> {
    const sql = `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM ${database}.INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}'
        AND TABLE_NAME = '${table}'
      ORDER BY ORDINAL_POSITION
    `;

    return this.executeQuery(sql);
  }

  /**
   * List tables in schema
   */
  async listTables(database: string, schema: string): Promise<string[]> {
    const sql = `
      SELECT TABLE_NAME
      FROM ${database}.INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}'
      ORDER BY TABLE_NAME
    `;

    const rows = await this.executeQuery(sql);
    return rows.map((row) => row.TABLE_NAME);
  }

  /**
   * Create or replace table from SQL
   */
  async createTable(sql: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.executeQuery(sql);
      return { success: true, message: 'Table created successfully' };
    } catch (error) {
      return { success: false, message: `Failed: ${error}` };
    }
  }
}
