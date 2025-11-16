/**
 * Node Positioning Utilities
 *
 * Functions for calculating node positions in the Gold Canvas
 */

import { CanvasNode, LayoutConfig } from '../../core/types';
import { calculateNodePosition } from '../../shared/canvasUtils';
import { GOLD_LAYOUT_CONFIG } from '../../core/canvasConfig';

/**
 * Position consumption entities in the right column
 */
export function positionConsumptionNodes(
  consumptionNodes: CanvasNode[],
  config: LayoutConfig = GOLD_LAYOUT_CONFIG
): CanvasNode[] {
  const columnX = config.columnWidth * 2;

  return consumptionNodes.map((node, index) => {
    const position = calculateNodePosition(index, consumptionNodes.length, columnX, config);
    return {
      ...node,
      position,
    };
  });
}

/**
 * Position curated entities in the left column
 * Only positions visible (expanded) curated entities
 */
export function positionCuratedNodes(
  curatedNodes: CanvasNode[],
  visibleCuratedIds: Set<string>,
  edges: any[],
  config: LayoutConfig = GOLD_LAYOUT_CONFIG
): CanvasNode[] {
  const columnX = 0;

  // Filter to only visible curated nodes
  const visibleNodes = curatedNodes.filter(node => visibleCuratedIds.has(node.id));

  // Sort by their connections to consumption entities for better visual layout
  const sortedNodes = sortCuratedByConnections(visibleNodes, edges);

  return sortedNodes.map((node, index) => {
    const position = calculateNodePosition(index, sortedNodes.length, columnX, config);
    return {
      ...node,
      position,
      data: {
        ...node.data,
        isVisible: true,
      },
    };
  });
}

/**
 * Sort curated nodes by their connections to consumption entities
 * Nodes connected to the same consumption entity are grouped together
 */
function sortCuratedByConnections(
  curatedNodes: CanvasNode[],
  edges: any[]
): CanvasNode[] {
  const nodeConnections = new Map<string, number[]>();

  // Build a map of node ID to connected consumption entity positions
  curatedNodes.forEach(node => {
    const connectedConsumptionIds = edges
      .filter(e => e.source === node.id && e.data?.relationshipType === 'field_mapping')
      .map(e => e.target);

    nodeConnections.set(node.id, connectedConsumptionIds.map((_, idx) => idx));
  });

  // Sort nodes by their first connection
  return [...curatedNodes].sort((a, b) => {
    const aConnections = nodeConnections.get(a.id) || [];
    const bConnections = nodeConnections.get(b.id) || [];

    if (aConnections.length === 0) return 1;
    if (bConnections.length === 0) return -1;

    return Math.min(...aConnections) - Math.min(...bConnections);
  });
}

/**
 * Calculate layout for all Gold Canvas nodes
 */
export function calculateGoldLayout(
  consumptionNodes: CanvasNode[],
  curatedNodes: CanvasNode[],
  expandedCuratedIds: Set<string>,
  edges: any[],
  config: LayoutConfig = GOLD_LAYOUT_CONFIG
): { consumption: CanvasNode[]; curated: CanvasNode[] } {
  const positionedConsumption = positionConsumptionNodes(consumptionNodes, config);
  const positionedCurated = positionCuratedNodes(curatedNodes, expandedCuratedIds, edges, config);

  return {
    consumption: positionedConsumption,
    curated: positionedCurated,
  };
}

/**
 * Recalculate positions after expansion/collapse
 */
export function recalculateLayout(
  allNodes: CanvasNode[],
  expandedCuratedIds: Set<string>,
  edges: any[],
  config: LayoutConfig = GOLD_LAYOUT_CONFIG
): CanvasNode[] {
  const consumptionNodes = allNodes.filter(n => (n.data as any).isConsumptionFile);
  const curatedNodes = allNodes.filter(n => (n.data as any).isCuratedFile);
  const otherNodes = allNodes.filter(n => !(n.data as any).isConsumptionFile && !(n.data as any).isCuratedFile);

  const { consumption, curated } = calculateGoldLayout(
    consumptionNodes,
    curatedNodes,
    expandedCuratedIds,
    edges,
    config
  );

  return [...consumption, ...curated, ...otherNodes];
}
