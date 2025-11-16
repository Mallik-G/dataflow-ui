/**
 * Field Mappings Hook
 *
 * Manages automatic field mapping generation and validation
 */

import { useCallback } from 'react';
import { MappingRule } from '../../core/types';
import { generateFieldMappings, findBestMatch } from '../../shared/canvasUtils';

export interface UseFieldMappingsReturn {
  generateMappings: (sourceColumns: string[], targetColumns: string[]) => MappingRule[];
  findMapping: (sourceColumn: string, targetColumns: string[]) => { column: string; confidence: number } | null;
  validateMapping: (mapping: MappingRule) => boolean;
}

export function useFieldMappings(): UseFieldMappingsReturn {
  /**
   * Generate automatic field mappings between source and target columns
   */
  const generateMappings = useCallback((
    sourceColumns: string[],
    targetColumns: string[]
  ): MappingRule[] => {
    return generateFieldMappings(sourceColumns, targetColumns);
  }, []);

  /**
   * Find best matching target column for a source column
   */
  const findMapping = useCallback((
    sourceColumn: string,
    targetColumns: string[]
  ): { column: string; confidence: number } | null => {
    return findBestMatch(sourceColumn, targetColumns);
  }, []);

  /**
   * Validate a mapping rule
   */
  const validateMapping = useCallback((mapping: MappingRule): boolean => {
    // Check that source and target columns are defined
    if (!mapping.sourceColumn || !mapping.targetColumn) {
      return false;
    }

    // Check that transformation type is valid
    const validTransformations = ['direct', 'concat', 'split', 'calculate', 'lookup', 'nlp'];
    if (mapping.transformationType && !validTransformations.includes(mapping.transformationType)) {
      return false;
    }

    // All checks passed
    return true;
  }, []);

  return {
    generateMappings,
    findMapping,
    validateMapping,
  };
}
