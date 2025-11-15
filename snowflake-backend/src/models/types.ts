export interface SnowflakeConfig {
  accountIdentifier: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
  role?: string;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  executionTime: number;
}

export interface TableMetadata {
  columnName: string;
  dataType: string;
  isNullable: string;
  columnDefault: string | null;
}
