import { Node, Edge } from 'reactflow';

export type NodeType = 'source' | 'silver' | 'gold' | 'transform';
export type EdgeType = 'map' | 'transform' | 'derived' | 'llmGenerated' | 'custom';

export interface ColumnInfo {
  name: string;
  type: string;
  lineageDetails?: string;
}

export interface SourceTableNodeData {
  label: string;
  schema: string;
  columns: ColumnInfo[];
}

export interface SilverTableNodeData {
  label: string;
  columns: ColumnInfo[];
}

export interface GoldEntityNodeData {
  label: string;
  attributes: ColumnInfo[];
}

export interface TransformNodeData {
  label: string;
  expression: string;
  functions: string[];
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
