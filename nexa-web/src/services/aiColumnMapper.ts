import {
  ColumnInfo,
  ColumnMapping,
  DataProfile,
  AIMapperResponse,
  TransformationType,
  DataType,
} from '../types/columnMapping';

/**
 * AI-powered column mapping service
 * Analyzes source and target columns to suggest intelligent mappings
 */
export class AIColumnMapper {
  /**
   * Calculate Levenshtein distance between two strings (similarity score)
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Calculate name similarity score (0-1, higher is better)
   */
  private static calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase();
    const n2 = name2.toLowerCase();

    // Exact match
    if (n1 === n2) return 1.0;

    // Substring match
    if (n1.includes(n2) || n2.includes(n1)) {
      return 0.9;
    }

    // Common patterns (e.g., customer_id vs id, email vs contact_email)
    const n1Parts = n1.split('_');
    const n2Parts = n2.split('_');

    const commonParts = n1Parts.filter(part => n2Parts.includes(part));
    if (commonParts.length > 0) {
      const ratio = commonParts.length / Math.max(n1Parts.length, n2Parts.length);
      return 0.7 + (ratio * 0.2);
    }

    // Levenshtein distance
    const distance = this.levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    return Math.max(0, 1 - (distance / maxLength));
  }

  /**
   * Check if two data types are compatible
   */
  private static areTypesCompatible(sourceType: DataType, targetType: DataType): boolean {
    if (sourceType === targetType) return true;

    // String can convert to anything
    if (sourceType === 'string') return true;

    // Number can convert to string
    if (sourceType === 'number' && targetType === 'string') return true;

    // Date/timestamp are interchangeable
    if ((sourceType === 'date' || sourceType === 'timestamp') &&
        (targetType === 'date' || targetType === 'timestamp')) {
      return true;
    }

    return false;
  }

  /**
   * Determine the best transformation type
   */
  private static determineTransformation(
    sourceCol: ColumnInfo,
    targetCol: ColumnInfo,
    nameSimilarity: number
  ): TransformationType {
    // Direct mapping if types match and names are similar
    if (sourceCol.type === targetCol.type && nameSimilarity > 0.8) {
      return 'direct';
    }

    // Type casting
    if (sourceCol.type !== targetCol.type) {
      // String to date
      if (sourceCol.type === 'string' &&
          (targetCol.type === 'date' || targetCol.type === 'timestamp')) {
        return 'date_format';
      }
      return 'cast';
    }

    // Check for common PII patterns that need hashing
    const piiPatterns = ['ssn', 'social_security', 'tax_id', 'password'];
    const lowerName = targetCol.name.toLowerCase();
    if (piiPatterns.some(pattern => lowerName.includes(pattern))) {
      return 'hash';
    }

    // String transformations
    if (sourceCol.type === 'string') {
      if (targetCol.name.includes('upper') || targetCol.name.includes('UPPER')) {
        return 'upper';
      }
      if (targetCol.name.includes('lower') || targetCol.name.includes('LOWER')) {
        return 'lower';
      }
      if (targetCol.name.includes('trim')) {
        return 'trim';
      }
    }

    return 'direct';
  }

  /**
   * Generate transformation expression
   */
  private static generateExpression(
    sourceCol: ColumnInfo,
    targetCol: ColumnInfo,
    transformationType: TransformationType
  ): string {
    const sourceColName = sourceCol.name;

    switch (transformationType) {
      case 'direct':
        return sourceColName;

      case 'cast':
        return `CAST(${sourceColName} AS ${targetCol.type.toUpperCase()})`;

      case 'trim':
        return `TRIM(${sourceColName})`;

      case 'upper':
        return `UPPER(${sourceColName})`;

      case 'lower':
        return `LOWER(${sourceColName})`;

      case 'hash':
        return `SHA2(${sourceColName}, 256)`;

      case 'date_format':
        return `TO_DATE(${sourceColName}, 'YYYY-MM-DD')`;

      case 'coalesce':
        return `COALESCE(${sourceColName}, 'DEFAULT')`;

      default:
        return sourceColName;
    }
  }

  /**
   * Main AI mapping algorithm
   */
  public static async analyzeAndMap(
    sourceProfile: DataProfile,
    targetProfile: DataProfile
  ): Promise<AIMapperResponse> {
    const mappings: ColumnMapping[] = [];
    const unmappedSourceColumns: string[] = [];
    const unmappedTargetColumns: string[] = [...targetProfile.columns.map(c => c.name)];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Track which columns have been mapped
    const mappedSourceCols = new Set<string>();
    const mappedTargetCols = new Set<string>();

    // Calculate similarity scores for all combinations
    const scoredMappings: Array<{
      sourceCol: ColumnInfo;
      targetCol: ColumnInfo;
      score: number;
    }> = [];

    for (const sourceCol of sourceProfile.columns) {
      for (const targetCol of targetProfile.columns) {
        const nameSimilarity = this.calculateNameSimilarity(sourceCol.name, targetCol.name);
        const typesCompatible = this.areTypesCompatible(sourceCol.type, targetCol.type);

        // Combined score (70% name similarity, 30% type compatibility)
        const score = (nameSimilarity * 0.7) + (typesCompatible ? 0.3 : 0);

        if (score > 0.4) { // Threshold for considering a mapping
          scoredMappings.push({
            sourceCol,
            targetCol,
            score,
          });
        }
      }
    }

    // Sort by score descending
    scoredMappings.sort((a, b) => b.score - a.score);

    // Greedy assignment: assign best matches first
    for (const { sourceCol, targetCol, score } of scoredMappings) {
      // Skip if either column is already mapped
      if (mappedSourceCols.has(sourceCol.name) || mappedTargetCols.has(targetCol.name)) {
        continue;
      }

      const transformationType = this.determineTransformation(
        sourceCol,
        targetCol,
        this.calculateNameSimilarity(sourceCol.name, targetCol.name)
      );

      const expression = this.generateExpression(sourceCol, targetCol, transformationType);

      const mapping: ColumnMapping = {
        id: `mapping-${sourceCol.name}-${targetCol.name}`,
        sourceColumn: sourceCol.name,
        targetColumn: targetCol.name,
        transformationType,
        transformationExpression: expression,
        confidence: score,
        isAIGenerated: true,
        isApproved: false,
      };

      mappings.push(mapping);
      mappedSourceCols.add(sourceCol.name);
      mappedTargetCols.add(targetCol.name);

      // Remove from unmapped target columns
      const idx = unmappedTargetColumns.indexOf(targetCol.name);
      if (idx > -1) {
        unmappedTargetColumns.splice(idx, 1);
      }

      // Add warnings for low confidence mappings
      if (score < 0.6) {
        warnings.push(
          `Low confidence (${(score * 100).toFixed(0)}%) mapping: ${sourceCol.name} → ${targetCol.name}`
        );
      }

      // Add suggestions for type mismatches
      if (sourceCol.type !== targetCol.type) {
        suggestions.push(
          `Consider validating type conversion: ${sourceCol.name} (${sourceCol.type}) → ${targetCol.name} (${targetCol.type})`
        );
      }
    }

    // Identify unmapped source columns
    for (const sourceCol of sourceProfile.columns) {
      if (!mappedSourceCols.has(sourceCol.name)) {
        unmappedSourceColumns.push(sourceCol.name);
      }
    }

    // Add suggestions for unmapped columns
    if (unmappedTargetColumns.length > 0) {
      suggestions.push(
        `${unmappedTargetColumns.length} target column(s) need manual mapping: ${unmappedTargetColumns.join(', ')}`
      );
    }

    if (unmappedSourceColumns.length > 0) {
      suggestions.push(
        `${unmappedSourceColumns.length} source column(s) will not be used: ${unmappedSourceColumns.join(', ')}`
      );
    }

    return {
      mappings,
      unmappedSourceColumns,
      unmappedTargetColumns,
      warnings,
      suggestions,
    };
  }

  /**
   * Generate sample target columns based on source columns
   * (Used when creating a new flow without predefined target)
   */
  public static generateTargetColumns(sourceColumns: ColumnInfo[]): ColumnInfo[] {
    return sourceColumns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      description: `Transformed from source.${col.name}`,
    }));
  }
}
