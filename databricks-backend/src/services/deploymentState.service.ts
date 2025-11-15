import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import simpleGit, { SimpleGit } from 'simple-git';
import { Pool } from 'pg';
import { logger } from '../config/logger';
import {
  EnvironmentState,
  DeploymentHistory,
  DeploymentResult,
  ResourceInventory,
} from '../models/types';

export class DeploymentStateService {
  private git: SimpleGit;
  private db: Pool;
  private stateRepoPath: string;

  constructor() {
    this.stateRepoPath = process.env.GIT_REPO_PATH || './nexa-state';
    this.git = simpleGit(this.stateRepoPath);

    // Initialize database connection pool
    this.db = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'nexa_state',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

    this.initializeDatabase();
  }

  private async initializeDatabase() {
    // Create tables if they don't exist
    const createTablesSQL = `
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
    `;

    try {
      await this.db.query(createTablesSQL);
      logger.info('Database tables initialized');
    } catch (error: any) {
      logger.error('Failed to initialize database', { error: error.message });
    }
  }

  /**
   * Update environment state files (Git-based canonical state)
   * Stores state in .nexa-state/{env}.state.json
   */
  async updateEnvironmentState(environment: string, state: EnvironmentState): Promise<void> {
    logger.info('Updating environment state', { environment, commit: state.commit });

    const stateFilePath = path.join(this.stateRepoPath, '.nexa-state', `${environment}.state.json`);

    // Ensure directory exists
    await fs.mkdir(path.dirname(stateFilePath), { recursive: true });

    // Add HMAC signature to prevent tampering
    const signature = this.generateStateSignature(state);
    const signedState = { ...state, signature };

    // Write state file
    await fs.writeFile(stateFilePath, JSON.stringify(signedState, null, 2));

    // Commit to Git
    try {
      await this.git.add('.nexa-state/*');
      await this.git.commit(`Update ${environment} state - ${state.commit}`, {
        '--author': `"${process.env.GIT_USER_NAME}" <${process.env.GIT_USER_EMAIL}>`,
      });
      await this.git.push();

      logger.info('Environment state committed to Git', { environment, commit: state.commit });
    } catch (error: any) {
      logger.error('Failed to commit state to Git', { error: error.message });
    }

    // Also update DB cache
    await this.updateResourceInventory(environment, state);
  }

  /**
   * Get current environment state from Git
   */
  async getEnvironmentState(environment: string): Promise<EnvironmentState | null> {
    try {
      const stateFilePath = path.join(this.stateRepoPath, '.nexa-state', `${environment}.state.json`);
      const content = await fs.readFile(stateFilePath, 'utf-8');
      const state = JSON.parse(content);

      // Verify signature
      const isValid = this.verifyStateSignature(state);
      if (!isValid) {
        logger.warn('State file signature verification failed', { environment });
      }

      return state;
    } catch (error: any) {
      logger.warn('Failed to read environment state', { environment, error: error.message });
      return null;
    }
  }

  /**
   * Record deployment start in DB
   */
  async recordDeploymentStart(
    deploymentId: string,
    params: { commit: string; branch: string; environment: string; user: string }
  ): Promise<void> {
    const sql = `
      INSERT INTO deployment_history (id, commit, branch, environment, user_name, status, started_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await this.db.query(sql, [
      deploymentId,
      params.commit,
      params.branch,
      params.environment,
      params.user,
      'in_progress',
      new Date(),
    ]);

    logger.info('Deployment started', { deploymentId });
  }

  /**
   * Record deployment completion in DB
   */
  async recordDeploymentComplete(deploymentId: string, result: DeploymentResult): Promise<void> {
    const sql = `
      UPDATE deployment_history
      SET status = $1, completed_at = $2, result = $3
      WHERE id = $4
    `;

    await this.db.query(sql, ['completed', new Date(), JSON.stringify(result), deploymentId]);

    // Insert deployed resources
    for (const artifact of result.artifacts) {
      await this.db.query(
        `
        INSERT INTO deployed_resources (deployment_id, artifact_path, artifact_hash, runtime_id, resource_type, env, action, deployed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          deploymentId,
          artifact.path,
          artifact.hash,
          artifact.runtimeId,
          artifact.resourceType,
          result.environment,
          artifact.action,
          new Date(),
        ]
      );
    }

    logger.info('Deployment completed', { deploymentId, artifactCount: result.artifacts.length });
  }

  /**
   * Record deployment failure in DB
   */
  async recordDeploymentFailure(deploymentId: string, errorMessage: string): Promise<void> {
    const sql = `
      UPDATE deployment_history
      SET status = $1, completed_at = $2, error_message = $3
      WHERE id = $4
    `;

    await this.db.query(sql, ['failed', new Date(), errorMessage, deploymentId]);

    logger.info('Deployment failed', { deploymentId, error: errorMessage });
  }

  /**
   * Get deployment history for environment
   */
  async getDeploymentHistory(environment: string, limit: number = 50): Promise<DeploymentHistory[]> {
    const sql = `
      SELECT *
      FROM deployment_history
      WHERE environment = $1
      ORDER BY started_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(sql, [environment, limit]);

    return result.rows.map((row) => ({
      id: row.id,
      commit: row.commit,
      branch: row.branch,
      environment: row.environment,
      user: row.user_name,
      status: row.status,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      planSummary: row.plan_summary,
      result: row.result,
    }));
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<DeploymentHistory | null> {
    const sql = `SELECT * FROM deployment_history WHERE id = $1`;
    const result = await this.db.query(sql, [deploymentId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      commit: row.commit,
      branch: row.branch,
      environment: row.environment,
      user: row.user_name,
      status: row.status,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      planSummary: row.plan_summary,
      result: row.result,
    };
  }

  /**
   * Get resource inventory for environment
   */
  async getResourceInventory(environment: string, resourceType?: string): Promise<ResourceInventory[]> {
    let sql = `
      SELECT *
      FROM resource_inventory
      WHERE env = $1 AND status = 'active'
    `;
    const params: any[] = [environment];

    if (resourceType) {
      sql += ` AND resource_type = $2`;
      params.push(resourceType);
    }

    sql += ` ORDER BY last_deployed_at DESC`;

    const result = await this.db.query(sql, params);

    return result.rows.map((row) => ({
      artifactPath: row.artifact_path,
      artifactHash: row.artifact_hash,
      runtimeId: row.runtime_id,
      resourceType: row.resource_type,
      env: row.env,
      status: row.status,
      lastDeployedCommit: row.last_deployed_commit,
      lastDeployedAt: row.last_deployed_at.toISOString(),
      action: row.action,
    }));
  }

  /**
   * Update resource inventory from environment state
   */
  private async updateResourceInventory(environment: string, state: EnvironmentState): Promise<void> {
    for (const artifact of state.artifacts) {
      const sql = `
        INSERT INTO resource_inventory (artifact_path, artifact_hash, runtime_id, resource_type, env, status, last_deployed_commit, last_deployed_at, action)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (artifact_path, env)
        DO UPDATE SET
          artifact_hash = EXCLUDED.artifact_hash,
          runtime_id = EXCLUDED.runtime_id,
          status = EXCLUDED.status,
          last_deployed_commit = EXCLUDED.last_deployed_commit,
          last_deployed_at = EXCLUDED.last_deployed_at,
          action = EXCLUDED.action
      `;

      await this.db.query(sql, [
        artifact.path,
        artifact.hash,
        artifact.runtimeId,
        artifact.resourceType,
        environment,
        artifact.action === 'deleted' ? 'deleted' : 'active',
        state.commit,
        new Date(state.deployedAt),
        artifact.action,
      ]);
    }

    logger.info('Resource inventory updated', {
      environment,
      resourceCount: state.artifacts.length,
    });
  }

  /**
   * Detect drift between Git state and Databricks reality
   */
  async detectDrift(environment: string): Promise<{
    hasDrift: boolean;
    driftedResources: any[];
    missingResources: any[];
  }> {
    // This would query Databricks API and compare with state file
    // Simplified implementation - would need actual Databricks API calls

    logger.info('Detecting drift', { environment });

    return {
      hasDrift: false,
      driftedResources: [],
      missingResources: [],
    };
  }

  /**
   * Generate HMAC signature for state file
   */
  private generateStateSignature(state: EnvironmentState): string {
    const secret = process.env.STATE_SIGNATURE_SECRET || 'nexa-secret-key';
    const data = JSON.stringify({
      env: state.env,
      commit: state.commit,
      deployedAt: state.deployedAt,
      artifacts: state.artifacts,
    });

    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature of state file
   */
  private verifyStateSignature(state: EnvironmentState & { signature?: string }): boolean {
    if (!state.signature) return false;

    const expectedSignature = this.generateStateSignature(state);
    return crypto.timingSafeEqual(Buffer.from(state.signature), Buffer.from(expectedSignature));
  }
}
