export interface CatalogObject {
  id: string;
  name: string;
  type: 'database' | 'schema' | 'table' | 'view';
  fullyQualifiedName: string;
  children?: CatalogObject[];
}

export interface DataFlow {
  id: string;
  name: string;
  targetTable: string;
  description: string;
  lastRun?: string;
  status: 'active' | 'inactive' | 'error';
}

export interface FlowStep {
  id: string;
  type: 'source' | 'join' | 'transform' | 'filter' | 'aggregate' | 'target';
  tableName?: string;
  expression?: string;
  joinType?: 'inner' | 'left' | 'right' | 'full';
  joinCondition?: string;
  columns?: string[];
}
