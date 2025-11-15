import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { logger } from '../config/logger';
import {
  DABBundle,
  DeploymentPlan,
  DeploymentResult,
  DeployedArtifact,
  DeploymentChange,
} from '../models/types';
import { DeploymentStateService } from './deploymentState.service';

const execAsync = promisify(exec);

export class DABService {
  private deploymentStateService: DeploymentStateService;

  constructor() {
    this.deploymentStateService = new DeploymentStateService();
  }

  /**
   * Generate DAB bundle from project YAML files
   * Converts Nexa project structure to Databricks Asset Bundle format
   */
  async generateBundle(projectPath: string, environment: 'dev' | 'uat' | 'prod'): Promise<DABBundle> {
    logger.info('Generating DAB bundle', { projectPath, environment });

    const bundlePath = path.join(projectPath, '.bundle', environment);
    await fs.mkdir(bundlePath, { recursive: true });

    // Read project YAML files
    const projectYaml = await this.loadProjectYaml(projectPath);

    // Generate bundle.yml
    const bundleConfig = this.createBundleConfig(projectYaml, environment);
    const bundleYamlPath = path.join(bundlePath, 'bundle.yml');
    await fs.writeFile(bundleYamlPath, yaml.dump(bundleConfig));

    // Generate target-specific config
    const targetConfig = this.createTargetConfig(environment);
    const targetYamlPath = path.join(bundlePath, `targets/${environment}.yml`);
    await fs.mkdir(path.dirname(targetYamlPath), { recursive: true });
    await fs.writeFile(targetYamlPath, yaml.dump(targetConfig));

    // Generate resources (jobs, pipelines, etc.)
    const resources = await this.generateResources(projectYaml, bundlePath);

    // Create manifest
    const manifest = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      environment,
      resources: resources.map((r) => ({
        type: r.type,
        name: r.name,
        path: r.path,
      })),
    };

    const manifestPath = path.join(bundlePath, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    logger.info('DAB bundle generated successfully', { bundlePath, resourceCount: resources.length });

    return {
      bundlePath,
      manifestPath,
      resources,
      environment,
    };
  }

  /**
   * Preview deployment plan without applying changes (dry run)
   * Equivalent to: databricks bundles plan --bundle .bundle
   */
  async previewPlan(bundlePath: string, environment: string): Promise<DeploymentPlan> {
    logger.info('Previewing deployment plan', { bundlePath, environment });

    try {
      const { stdout, stderr } = await execAsync(`databricks bundles plan --bundle ${bundlePath}`, {
        env: { ...process.env, DATABRICKS_BUNDLE_ENV: environment },
      });

      // Parse DAB plan output
      const plan = this.parsePlanOutput(stdout);

      logger.info('Deployment plan generated', {
        creates: plan.creates.length,
        updates: plan.updates.length,
        deletes: plan.deletes.length,
      });

      return plan;
    } catch (error: any) {
      logger.error('Failed to preview deployment plan', { error: error.message });
      throw error;
    }
  }

  /**
   * Deploy DAB bundle to Databricks
   * Follows Nexa deployment flow from strategy document
   */
  async deploy(
    bundlePath: string,
    environment: 'dev' | 'uat' | 'prod',
    commit: string,
    branch: string,
    user: string
  ): Promise<DeploymentResult> {
    const deploymentId = crypto.randomUUID();
    logger.info('Starting DAB deployment', { deploymentId, environment, commit });

    try {
      // Step 1: Record deployment start
      await this.deploymentStateService.recordDeploymentStart(deploymentId, {
        commit,
        branch,
        environment,
        user,
      });

      // Step 2: Execute DAB deploy
      const { stdout, stderr } = await execAsync(
        `databricks bundles deploy --bundle ${bundlePath} --apply`,
        {
          env: { ...process.env, DATABRICKS_BUNDLE_ENV: environment },
        }
      );

      // Step 3: Parse deployment output
      const artifacts = this.parseDeploymentOutput(stdout);

      // Step 4: Create deployment result
      const result: DeploymentResult = {
        success: true,
        deploymentId,
        commit,
        environment,
        deployedAt: new Date().toISOString(),
        artifacts,
      };

      // Step 5: Update state files (Git + DB)
      await this.deploymentStateService.updateEnvironmentState(environment, {
        env: environment,
        commit,
        deployedAt: result.deployedAt,
        artifacts,
      });

      // Step 6: Record deployment completion
      await this.deploymentStateService.recordDeploymentComplete(deploymentId, result);

      logger.info('DAB deployment completed successfully', {
        deploymentId,
        artifactCount: artifacts.length,
      });

      return result;
    } catch (error: any) {
      logger.error('DAB deployment failed', { deploymentId, error: error.message });

      await this.deploymentStateService.recordDeploymentFailure(deploymentId, error.message);

      throw error;
    }
  }

  /**
   * Validate bundle structure and configuration
   */
  async validateBundle(bundlePath: string): Promise<{ valid: boolean; errors: string[] }> {
    logger.info('Validating DAB bundle', { bundlePath });

    try {
      const { stdout, stderr } = await execAsync(`databricks bundles validate --bundle ${bundlePath}`);

      return { valid: true, errors: [] };
    } catch (error: any) {
      const errors = error.stderr?.split('\n').filter((line: string) => line.trim()) || [error.message];
      logger.warn('Bundle validation failed', { errors });
      return { valid: false, errors };
    }
  }

  // ===== Private Helper Methods =====

  private async loadProjectYaml(projectPath: string): Promise<any> {
    // Load project YAML files (pipelines, jobs, etc.)
    const projectYamlPath = path.join(projectPath, 'project.yml');
    const content = await fs.readFile(projectYamlPath, 'utf-8');
    return yaml.load(content);
  }

  private createBundleConfig(projectYaml: any, environment: string): any {
    return {
      bundle: {
        name: projectYaml.name || 'nexa-project',
        target: environment,
      },
      workspace: {
        host: '${var.databricks_host}',
        root_path: `/Workspace/nexa/${projectYaml.name}`,
      },
      include: ['./resources/**/*.yml'],
    };
  }

  private createTargetConfig(environment: string): any {
    return {
      targets: {
        [environment]: {
          mode: environment === 'prod' ? 'production' : 'development',
          workspace: {
            host: `\${var.databricks_host_${environment}}`,
          },
        },
      },
    };
  }

  private async generateResources(projectYaml: any, bundlePath: string): Promise<any[]> {
    const resources: any[] = [];
    const resourcesPath = path.join(bundlePath, 'resources');
    await fs.mkdir(resourcesPath, { recursive: true });

    // Generate pipeline resources
    if (projectYaml.pipelines) {
      for (const pipeline of projectYaml.pipelines) {
        const pipelineYaml = {
          resources: {
            pipelines: {
              [pipeline.name]: {
                name: pipeline.name,
                storage: `/pipelines/${pipeline.name}`,
                configuration: pipeline.configuration || {},
                libraries: pipeline.libraries || [],
              },
            },
          },
        };

        const pipelinePath = path.join(resourcesPath, `${pipeline.name}.yml`);
        await fs.writeFile(pipelinePath, yaml.dump(pipelineYaml));

        resources.push({
          type: 'pipeline',
          name: pipeline.name,
          path: pipelinePath,
          definition: pipelineYaml,
        });
      }
    }

    return resources;
  }

  private parsePlanOutput(output: string): DeploymentPlan {
    // Parse DAB plan output to extract creates/updates/deletes
    const plan: DeploymentPlan = {
      creates: [],
      updates: [],
      deletes: [],
      warnings: [],
    };

    const lines = output.split('\n');
    let currentSection: 'create' | 'update' | 'delete' | null = null;

    for (const line of lines) {
      if (line.includes('Resources to create:')) currentSection = 'create';
      else if (line.includes('Resources to update:')) currentSection = 'update';
      else if (line.includes('Resources to delete:')) currentSection = 'delete';
      else if (line.includes('Warning:')) plan.warnings.push(line);
      else if (currentSection && line.trim().startsWith('-')) {
        const change = this.parseChangeLineItem(line);
        if (currentSection === 'create') plan.creates.push(change);
        else if (currentSection === 'update') plan.updates.push(change);
        else if (currentSection === 'delete') plan.deletes.push(change);
      }
    }

    return plan;
  }

  private parseChangeLineItem(line: string): DeploymentChange {
    // Parse individual change line from DAB output
    // Example: "- jobs.orders_refresh (pipeline)"
    const match = line.match(/- (\w+)\.(\w+)\s*\((\w+)\)/);

    return {
      resourceType: match?.[1] || 'unknown',
      resourceName: match?.[2] || 'unknown',
      path: line.trim(),
      changes: {},
    };
  }

  private parseDeploymentOutput(output: string): DeployedArtifact[] {
    // Parse DAB deployment output to extract deployed artifacts
    const artifacts: DeployedArtifact[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('Created') || line.includes('Updated') || line.includes('Deleted')) {
        const artifact = this.parseArtifactLine(line);
        if (artifact) artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  private parseArtifactLine(line: string): DeployedArtifact | null {
    // Parse artifact line from deployment output
    // Example: "Created jobs.orders_refresh with ID 1234-5678"
    const actionMatch = line.match(/(Created|Updated|Deleted)\s+(\w+)\.(\w+)\s+with ID\s+(\S+)/);

    if (!actionMatch) return null;

    const action = actionMatch[1].toLowerCase() as 'created' | 'updated' | 'deleted';
    const resourceType = actionMatch[2];
    const resourceName = actionMatch[3];
    const runtimeId = actionMatch[4];

    return {
      path: `${resourceType}/${resourceName}`,
      runtimeId,
      hash: crypto.createHash('sha256').update(`${resourceType}.${resourceName}`).digest('hex'),
      action,
      resourceType,
    };
  }
}
