import { Node, Edge } from 'reactflow';

export type NodeType = 'source' | 'silver' | 'gold' | 'transform';
export type EdgeType = 'map' | 'transform' | 'derived' | 'llmGenerated' | 'custom';

export interface ColumnInfo {
  name: string;
  type: string;
  lineageDetails?: string;
}

// LLM Metadata
export interface LLMMetadata {
  confidence: number; // 0-100
  explanation: string;
  reasoning: string;
  alternativeApproaches?: string[];
  warnings?: string[];
  generatedAt: string;
  version: number;
}

// User Edit Tracking
export interface UserEdit {
  editedBy: string;
  editedAt: string;
  originalCode?: string;
  modifiedCode: string;
  reason?: string;
}

// Execution State
export interface ExecutionState {
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  rowCountIn?: number;
  rowCountOut?: number;
  duration?: number;
  lastRun?: string;
  errorMessage?: string;
  dataQualityScore?: number; // 0-100
}

// Approval State
export interface ApprovalState {
  status: 'pending_review' | 'approved' | 'rejected' | 'changes_requested';
  reviewer?: string;
  reviewedAt?: string;
  feedback?: string;
  checklist?: {
    businessLogic: boolean;
    joinConditions: boolean;
    dataQuality: boolean;
    performance: boolean;
  };
}

export interface SourceTableNodeData {
  label: string;
  schema: string;
  columns: ColumnInfo[];
  llmMetadata?: LLMMetadata;
  executionState?: ExecutionState;
}

export interface SilverTableNodeData {
  label: string;
  columns: ColumnInfo[];
  llmMetadata?: LLMMetadata;
  executionState?: ExecutionState;
}

export interface GoldEntityNodeData {
  label: string;
  attributes: ColumnInfo[];
  llmMetadata?: LLMMetadata;
  executionState?: ExecutionState;
  approvalState?: ApprovalState;
}

export interface TransformNodeData {
  label: string;
  expression: string;
  functions: string[];
  llmMetadata?: LLMMetadata;
  userEdits?: UserEdit[];
  sqlCode?: string;
  isUserModified?: boolean;
  executionState?: ExecutionState;
}

export type CustomNodeData =
  | SourceTableNodeData
  | SilverTableNodeData
  | GoldEntityNodeData
  | TransformNodeData;

export interface CustomNode extends Node {
  type: NodeType;
  data: CustomNodeData;
}

export type CustomEdge = Edge & {
  type?: EdgeType;
  data?: {
    transformation?: string;
    mappingRule?: string;
    llmMetadata?: LLMMetadata;
    rowCount?: number;
  };
}

export interface MappingYAML {
  gold_model: string;
  entities: Array<{
    attribute: string;
    type: string;
    mapped_from: Array<{
      column?: string;
      table?: string;
      transform?: string;
      inputs?: Array<{
        table: string;
        column: string;
      }>;
    }>;
  }>;
}

export interface ValidationError {
  nodeId: string;
  type: 'missing_mapping' | 'type_mismatch' | 'expression_error' | 'orphan';
  message: string;
  severity: 'error' | 'warning';
}
