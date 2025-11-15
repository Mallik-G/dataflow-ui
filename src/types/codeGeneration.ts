import { FlowConfig } from '../components/modals/CreateFlowModal';

export type PlatformType = 'snowflake' | 'databricks' | 'bigquery' | 'postgres' | 'dbt';

export type ArtifactType = 'sql' | 'python' | 'yaml' | 'config';

export interface GeneratedArtifact {
  type: ArtifactType;
  filename: string;
  content: string;
  language: 'sql' | 'python' | 'yaml' | 'json';
}

export interface CodeGenerationOptions {
  platform: PlatformType;
  includeTests?: boolean;
  includeDocs?: boolean;
  useIncrementalLoads?: boolean;
  materializationType?: 'table' | 'view' | 'incremental' | 'ephemeral';
}

export interface CodeGenerationResult {
  artifacts: GeneratedArtifact[];
  warnings: string[];
  metadata: {
    generatedAt: string;
    flowId: string;
    platform: PlatformType;
  };
}

export interface ICodeGenerator {
  generate(flow: FlowConfig, options: CodeGenerationOptions): Promise<CodeGenerationResult>;
  validate(flow: FlowConfig): { valid: boolean; errors: string[] };
}
