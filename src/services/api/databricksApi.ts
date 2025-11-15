import { DatabricksConfig } from '../../types/settings';

export class DatabricksAPI {
  private config: DatabricksConfig;

  constructor(config: DatabricksConfig) {
    this.config = config;
  }

  /**
   * Test connection to Databricks
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // In production, call your backend API endpoint
      const response = await fetch('/api/databricks/test', {
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
   * Execute SQL query using SQL API
   */
  async executeQuery(sql: string): Promise<any[]> {
    try {
      const response = await fetch('/api/databricks/query', {
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
      console.error('Databricks query error:', error);
      throw error;
    }
  }

  /**
   * Get table metadata from Unity Catalog
   */
  async getTableMetadata(
    catalog: string,
    schema: string,
    table: string
  ): Promise<any> {
    const sql = `DESCRIBE TABLE ${catalog}.${schema}.${table}`;
    return this.executeQuery(sql);
  }

  /**
   * List tables in schema
   */
  async listTables(catalog: string, schema: string): Promise<string[]> {
    const sql = `SHOW TABLES IN ${catalog}.${schema}`;
    const rows = await this.executeQuery(sql);
    return rows.map((row) => row.tableName);
  }

  /**
   * Create Delta Live Tables pipeline
   */
  async createDLTPipeline(
    name: string,
    pythonCode: string
  ): Promise<{ success: boolean; pipelineId?: string; message: string }> {
    try {
      const response = await fetch('/api/databricks/dlt/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.config,
          name,
          code: pythonCode,
        }),
      });

      if (!response.ok) {
        throw new Error('DLT pipeline creation failed');
      }

      const data = await response.json();
      return {
        success: true,
        pipelineId: data.pipelineId,
        message: 'DLT pipeline created successfully',
      };
    } catch (error) {
      return { success: false, message: `Failed: ${error}` };
    }
  }

  /**
   * Upload notebook to workspace
   */
  async uploadNotebook(
    path: string,
    content: string,
    language: 'PYTHON' | 'SQL' | 'SCALA'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/databricks/notebook/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.config,
          path,
          content,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error('Notebook upload failed');
      }

      return { success: true, message: 'Notebook uploaded successfully' };
    } catch (error) {
      return { success: false, message: `Failed: ${error}` };
    }
  }
}
