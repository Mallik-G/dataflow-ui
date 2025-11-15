export interface DatabricksConfig {
  host: string;
  token: string;
  clusterId: string;
  catalog?: string;
  schema?: string;
}

export interface DABBundle {
  bundlePath: string;
  manifestPath: string;
  resources: DABResource[];
  environment: 'dev' | 'uat' | 'prod';
}

export interface DABResource {
  type: 'job' | 'pipeline' | 'cluster' | 'notebook' | 'workflow';
  name: string;
  path: string;
  definition: any;
}

export interface DeploymentPlan {
  creates: DeploymentChange[];
  updates: DeploymentChange[];
  deletes: DeploymentChange[];
  warnings: string[];
}

export interface DeploymentChange {
  resourceType: string;
  resourceName: string;
  path: string;
  changes: any;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  commit: string;
  environment: string;
  deployedAt: string;
  artifacts: DeployedArtifact[];
  errors?: string[];
}

export interface DeployedArtifact {
  path: string;
  runtimeId: string;
  hash: string;
  action: 'created' | 'updated' | 'deleted';
  resourceType: string;
}

export interface EnvironmentState {
  env: 'dev' | 'uat' | 'prod';
  commit: string;
  deployedAt: string;
  artifacts: DeployedArtifact[];
  signature?: string;
}

export interface DeploymentHistory {
  id: string;
  commit: string;
  branch: string;
  environment: string;
  user: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  planSummary?: DeploymentPlan;
  result?: DeploymentResult;
}

export interface ResourceInventory {
  artifactPath: string;
  artifactHash: string;
  runtimeId: string;
  resourceType: string;
  env: string;
  status: 'active' | 'deleted';
  lastDeployedCommit: string;
  lastDeployedAt: string;
  action: string;
}
