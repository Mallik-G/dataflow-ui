export type TransformationType =
  | 'direct'      // No transformation needed
  | 'cast'        // Type casting (e.g., varchar to int)
  | 'trim'        // String trimming
  | 'upper'       // Uppercase conversion
  | 'lower'       // Lowercase conversion
  | 'hash'        // Hashing for PII
  | 'concat'      // Concatenation
  | 'split'       // String splitting
  | 'date_format' // Date formatting
  | 'coalesce'    // NULL handling
  | 'custom';     // Custom expression

export type DataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'json'
  | 'array';

export interface ColumnInfo {
  name: string;
  type: DataType;
  nullable: boolean;
  description?: string;
  sampleValues?: any[];
}

export interface ColumnMapping {
  id: string;
  sourceColumn: string;
  targetColumn: string;
  transformationType: TransformationType;
  transformationExpression?: string;
  confidence: number; // 0-1 score from AI
  isAIGenerated: boolean;
  isApproved: boolean;
}

export interface DataProfile {
  tableName: string;
  columns: ColumnInfo[];
  rowCount?: number;
  sampleData?: Record<string, any>[];
}

export interface AIMapperResponse {
  mappings: ColumnMapping[];
  unmappedSourceColumns: string[];
  unmappedTargetColumns: string[];
  warnings: string[];
  suggestions: string[];
}

export interface MappingConnection {
  id: string;
  sourceColumnId: string;
  targetColumnId: string;
  transformationType: TransformationType;
  expression?: string;
}
