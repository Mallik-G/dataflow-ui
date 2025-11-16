/**
 * Hierarchy Manager Hook
 *
 * Manages the smart expansion/collapse logic for Gold Canvas
 * This is the core logic that shows/hides curated entities based on
 * which consumption entities are expanded
 */

import { useState, useCallback } from 'react';
import { CanvasNode, CanvasEdge, LayoutConfig } from '../../core/types';
import { layoutNodesInColumn } from '../../shared/canvasUtils';

export interface UseHierarchyManagerReturn {
  expandedConsumptionEntities: Set<string>;
  expandedCuratedEntities: Set<string>;
  toggleConsumptionEntity: (entityId: string) => void;
  toggleCuratedEntity: (entityId: string) => void;
  getVisibleNodes: (allNodes: CanvasNode[], edges: CanvasEdge[]) => CanvasNode[];
  isConsumptionExpanded: (entityId: string) => boolean;
  isCuratedExpanded: (entityId: string) => boolean;
}

export function useHierarchyManager(
  edges: CanvasEdge[]
): UseHierarchyManagerReturn {
  const [expandedConsumptionEntities, setExpandedConsumptionEntities] = useState<Set<string>>(new Set());
  const [expandedCuratedEntities, setExpandedCuratedEntities] = useState<Set<string>>(new Set());

  /**
   * Toggle consumption entity expansion
   * When expanding, also expand related curated entities
   * When collapsing, collapse curated entities that are only visible due to this consumption entity
   */
  const toggleConsumptionEntity = useCallback((entityId: string) => {
    setExpandedConsumptionEntities((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(entityId)) {
        // Collapsing - remove the consumption entity
        newSet.delete(entityId);

        // Also collapse curated entities that are only visible because of this consumption entity
        setExpandedCuratedEntities((curatedPrev) => {
          const curatedSet = new Set(curatedPrev);

          // Find curated entities mapped to this consumption entity
          const relatedCuratedEntities = edges
            .filter(
              (e) =>
                e.data?.relationshipType === 'field_mapping' &&
                e.target === entityId
            )
            .map((e) => e.source);

          // Remove curated entities that are only visible because of this consumption entity
          relatedCuratedEntities.forEach((curatedId) => {
            // Check if this curated entity has mappings to other expanded consumption entities
            const hasOtherMappings = edges.some(
              (e) =>
                e.data?.relationshipType === 'field_mapping' &&
                e.source === curatedId &&
                e.target !== entityId &&
                newSet.has(e.target)
            );

            // Only remove if no other consumption entities are using it
            if (!hasOtherMappings) {
              curatedSet.delete(curatedId);
            }
          });

          return curatedSet;
        });
      } else {
        // Expanding - add the consumption entity
        newSet.add(entityId);

        // Also expand related curated entities
        setExpandedCuratedEntities((curatedPrev) => {
          const curatedSet = new Set(curatedPrev);

          // Find all curated entities mapped to this consumption entity
          const relatedCuratedEntities = edges
            .filter(
              (e) =>
                e.data?.relationshipType === 'field_mapping' &&
                e.target === entityId
            )
            .map((e) => e.source);

          // Add them to the expanded set
          relatedCuratedEntities.forEach((curatedId) => {
            curatedSet.add(curatedId);
          });

          return curatedSet;
        });
      }

      return newSet;
    });
  }, [edges]);

  /**
   * Toggle curated entity expansion
   */
  const toggleCuratedEntity = useCallback((entityId: string) => {
    setExpandedCuratedEntities((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entityId)) {
        newSet.delete(entityId);
      } else {
        newSet.add(entityId);
      }
      return newSet;
    });
  }, []);

  /**
   * Check if consumption entity is expanded
   */
  const isConsumptionExpanded = useCallback((entityId: string) => {
    return expandedConsumptionEntities.has(entityId);
  }, [expandedConsumptionEntities]);

  /**
   * Check if curated entity is expanded
   */
  const isCuratedExpanded = useCallback((entityId: string) => {
    return expandedCuratedEntities.has(entityId);
  }, [expandedCuratedEntities]);

  /**
   * Get visible nodes based on expansion state
   * Filters nodes to only show:
   * - All consumption entities (always visible)
   * - Only curated entities that are expanded
   */
  const getVisibleNodes = useCallback((allNodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] => {
    return allNodes.filter((node) => {
      const data = node.data as any;

      // All consumption entities are always visible
      if (data.isConsumptionFile) {
        return true;
      }

      // Curated entities are only visible if expanded
      if (data.isCuratedFile) {
        return expandedCuratedEntities.has(node.id);
      }

      // Show all other node types
      return true;
    });
  }, [expandedCuratedEntities]);

  return {
    expandedConsumptionEntities,
    expandedCuratedEntities,
    toggleConsumptionEntity,
    toggleCuratedEntity,
    getVisibleNodes,
    isConsumptionExpanded,
    isCuratedExpanded,
  };
}
