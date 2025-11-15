import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';
import { DatabricksConfig } from '../models/types';

export class DatabricksService {
  private createClient(config: DatabricksConfig): AxiosInstance {
    return axios.create({
      baseURL: `${config.host}/api/2.0`,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(config: DatabricksConfig): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.createClient(config);
      await client.get('/clusters/get', { params: { cluster_id: config.clusterId } });
      logger.info('Databricks connection successful');
      return { success: true, message: 'Connection successful' };
    } catch (error: any) {
      logger.error('Databricks connection failed', { error: error.message });
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  async executeQuery(config: DatabricksConfig, sql: string): Promise<any[]> {
    const client = this.createClient(config);

    try {
      const response = await client.post('/sql/statements', {
        statement: sql,
        warehouse_id: config.clusterId,
        catalog: config.catalog,
        schema: config.schema,
      });

      const statementId = response.data.statement_id;

      // Poll for completion
      let result;
      let retries = 0;
      while (retries < 60) {
        const statusResponse = await client.get(`/sql/statements/${statementId}`);
        const status = statusResponse.data.status.state;

        if (status === 'SUCCEEDED') {
          result = statusResponse.data.result;
          break;
        } else if (status === 'FAILED' || status === 'CANCELED') {
          throw new Error(`Query failed with status: ${status}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        retries++;
      }

      logger.info('Query executed successfully');
      return result?.data_array || [];
    } catch (error: any) {
      logger.error('Query execution failed', { error: error.message });
      throw error;
    }
  }

  async getTableMetadata(config: DatabricksConfig, catalog: string, schema: string, table: string): Promise<any> {
    const sql = `DESCRIBE TABLE ${catalog}.${schema}.${table}`;
    return this.executeQuery(config, sql);
  }

  async listTables(config: DatabricksConfig, catalog: string, schema: string): Promise<string[]> {
    const sql = `SHOW TABLES IN ${catalog}.${schema}`;
    const rows = await this.executeQuery(config, sql);
    return rows.map((row: any) => row[1]); // Table name is typically in second column
  }

  async createDLTPipeline(
    config: DatabricksConfig,
    name: string,
    pythonCode: string
  ): Promise<{ success: boolean; pipelineId?: string; message: string }> {
    const client = this.createClient(config);

    try {
      const response = await client.post('/pipelines', {
        name,
        storage: `/pipelines/${name}`,
        configuration: {},
        clusters: [
          {
            label: 'default',
            num_workers: 1,
          },
        ],
        libraries: [
          {
            notebook: {
              path: `/pipelines/${name}/notebook`,
            },
          },
        ],
        continuous: false,
      });

      logger.info('DLT pipeline created', { pipelineId: response.data.pipeline_id });
      return {
        success: true,
        pipelineId: response.data.pipeline_id,
        message: 'Pipeline created successfully',
      };
    } catch (error: any) {
      logger.error('DLT pipeline creation failed', { error: error.message });
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }

  async uploadNotebook(
    config: DatabricksConfig,
    path: string,
    content: string,
    language: 'PYTHON' | 'SQL' | 'SCALA'
  ): Promise<{ success: boolean; message: string }> {
    const client = this.createClient(config);

    try {
      const encodedContent = Buffer.from(content).toString('base64');

      await client.post('/workspace/import', {
        path,
        format: 'SOURCE',
        language,
        content: encodedContent,
        overwrite: true,
      });

      logger.info('Notebook uploaded successfully', { path });
      return { success: true, message: 'Notebook uploaded successfully' };
    } catch (error: any) {
      logger.error('Notebook upload failed', { error: error.message });
      return { success: false, message: error.response?.data?.message || error.message };
    }
  }
}
