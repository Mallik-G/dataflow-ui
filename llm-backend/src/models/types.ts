export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
  type: 'direct' | 'custom' | 'aggregate' | 'window';
  expression?: string;
  reasoning: string;
  confidence: number;
  validationRules?: string[];
}

export interface YAMLGeneration {
  yaml: string;
  reasoning: string;
  warnings: string[];
  metadata: {
    version: string;
    generatedAt: string;
    complexity: 'simple' | 'medium' | 'complex';
    estimatedExecutionTime?: string;
  };
}

export interface FeedbackRequest {
  mappingId: string;
  yaml: string;
  userFeedback: string;
  correctedMapping?: ColumnMapping[];
}

export interface RAGDocument {
  id: string;
  content: string;
  metadata: {
    type: 'example' | 'pattern' | 'feedback';
    source: string;
    tags: string[];
    createdAt: string;
  };
  embedding?: number[];
}

export interface RAGQueryResult {
  documents: RAGDocument[];
  similarity: number[];
  totalResults: number;
}

export interface LLMRequest {
  sourceSchema: ColumnSchema[];
  targetSchema: ColumnSchema[];
  transformationContext?: string;
  businessRules?: string[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  description?: string;
  nullable?: boolean;
  primaryKey?: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}
