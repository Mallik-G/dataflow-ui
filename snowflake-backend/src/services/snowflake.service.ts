import snowflake from 'snowflake-sdk';
import { logger } from '../config/logger';
import { SnowflakeConfig } from '../models/types';

export class SnowflakeService {
  private createConnection(config: SnowflakeConfig): snowflake.Connection {
    return snowflake.createConnection({
      account: config.accountIdentifier,
      username: config.username,
      password: config.password,
      warehouse: config.warehouse,
      database: config.database,
      schema: config.schema,
      role: config.role,
    });
  }

  async testConnection(config: SnowflakeConfig): Promise<{ success: boolean; message: string }> {
    const connection = this.createConnection(config);

    return new Promise((resolve, reject) => {
      connection.connect((err, conn) => {
        if (err) {
          logger.error('Snowflake connection failed', { error: err.message });
          resolve({ success: false, message: err.message });
        } else {
          logger.info('Snowflake connection successful');
          conn.destroy((destroyErr) => {
            if (destroyErr) {
              logger.warn('Error destroying connection', { error: destroyErr.message });
            }
          });
          resolve({ success: true, message: 'Connection successful' });
        }
      });
    });
  }

  async executeQuery(config: SnowflakeConfig, sql: string): Promise<any[]> {
    const connection = this.createConnection(config);

    return new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) {
          logger.error('Failed to connect', { error: err.message });
          return reject(err);
        }

        connection.execute({
          sqlText: sql,
          complete: (execErr, stmt, rows) => {
            connection.destroy((destroyErr) => {
              if (destroyErr) {
                logger.warn('Error destroying connection', { error: destroyErr.message });
              }
            });

            if (execErr) {
              logger.error('Query execution failed', { error: execErr.message, sql });
              return reject(execErr);
            }

            logger.info('Query executed successfully', { rowCount: rows?.length });
            resolve(rows || []);
          },
        });
      });
    });
  }

  async getTableMetadata(
    config: SnowflakeConfig,
    database: string,
    schema: string,
    table: string
  ): Promise<any> {
    const sql = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM ${database}.INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${table}'
      ORDER BY ORDINAL_POSITION
    `;

    const rows = await this.executeQuery(config, sql);
    return rows;
  }

  async listTables(config: SnowflakeConfig, database: string, schema: string): Promise<string[]> {
    const sql = `SHOW TABLES IN ${database}.${schema}`;
    const rows = await this.executeQuery(config, sql);
    return rows.map((row: any) => row.name);
  }

  async createTable(config: SnowflakeConfig, sql: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.executeQuery(config, sql);
      return { success: true, message: 'Table created successfully' };
    } catch (error: any) {
      logger.error('Table creation failed', { error: error.message });
      return { success: false, message: error.message };
    }
  }
}
