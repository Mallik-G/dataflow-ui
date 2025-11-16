/**
 * Canvas Configuration
 *
 * Shared configuration constants for all canvas implementations
 */

import { LayoutConfig } from './types';

// ============================================================================
// Layout Configuration
// ============================================================================

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeWidth: 280,
  nodeHeight: 400,
  horizontalSpacing: 250,
  verticalSpacing: 50,
  columnWidth: 600,
};

export const BRONZE_LAYOUT_CONFIG: LayoutConfig = {
  nodeWidth: 280,
  nodeHeight: 400,
  horizontalSpacing: 400,
  verticalSpacing: 50,
  columnWidth: 700,
};

export const GOLD_LAYOUT_CONFIG: LayoutConfig = {
  nodeWidth: 300,
  nodeHeight: 450,
  horizontalSpacing: 350,
  verticalSpacing: 40,
  columnWidth: 750,
};

// ============================================================================
// Node Styling
// ============================================================================

export const NODE_STYLES = {
  raw: {
    background: '#ffffff',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    headerBg: '#f5f5f5',
    headerColor: '#333333',
  },
  curated: {
    background: '#ffffff',
    border: '2px solid #4CAF50',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(76,175,80,0.2)',
    headerBg: '#E8F5E9',
    headerColor: '#2E7D32',
  },
  consumption: {
    background: '#ffffff',
    border: '2px solid #2196F3',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(33,150,243,0.2)',
    headerBg: '#E3F2FD',
    headerColor: '#1565C0',
  },
  gold: {
    background: '#ffffff',
    border: '2px solid #FF9800',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(255,152,0,0.2)',
    headerBg: '#FFF3E0',
    headerColor: '#E65100',
  },
  selected: {
    border: '3px solid #1976D2',
    boxShadow: '0 6px 16px rgba(25,118,210,0.3)',
  },
};

// ============================================================================
// Edge Styling
// ============================================================================

export const EDGE_STYLES = {
  default: {
    stroke: '#b1b1b7',
    strokeWidth: 2,
  },
  fieldMapping: {
    stroke: '#4CAF50',
    strokeWidth: 2,
    strokeDasharray: '5,5',
  },
  entityMapping: {
    stroke: '#2196F3',
    strokeWidth: 3,
  },
  transformation: {
    stroke: '#FF9800',
    strokeWidth: 2,
    strokeDasharray: '10,5',
  },
  aggregation: {
    stroke: '#9C27B0',
    strokeWidth: 2,
    strokeDasharray: '15,5',
  },
  selected: {
    stroke: '#1976D2',
    strokeWidth: 4,
  },
};

// ============================================================================
// React Flow Configuration
// ============================================================================

export const REACT_FLOW_CONFIG = {
  defaultViewport: { x: 0, y: 0, zoom: 0.8 },
  minZoom: 0.3,
  maxZoom: 1.5,
  snapToGrid: true,
  snapGrid: [20, 20] as [number, number],
  connectionLineStyle: {
    stroke: '#4CAF50',
    strokeWidth: 2,
  },
  defaultEdgeOptions: {
    type: 'smoothstep',
    animated: false,
    style: EDGE_STYLES.default,
  },
};

// ============================================================================
// Data Type Icons
// ============================================================================

export const DATA_TYPE_ICONS: Record<string, string> = {
  string: '📝',
  integer: '🔢',
  float: '💯',
  boolean: '✓',
  date: '📅',
  timestamp: '⏰',
  json: '{}',
  array: '[]',
};

// ============================================================================
// Column Matching Configuration
// ============================================================================

export const COLUMN_MATCHING = {
  exactMatchScore: 1.0,
  caseSensitive: false,
  similarityThreshold: 0.7,
  commonPrefixes: ['src_', 'tgt_', 'stg_', 'raw_', 'curated_', 'gold_'],
  commonSuffixes: ['_id', '_key', '_name', '_date', '_timestamp'],
};

// ============================================================================
// Auto-generation Configuration
// ============================================================================

export const AUTO_GENERATION = {
  maxMappingsToGenerate: 100,
  confidenceThreshold: 0.6,
  preferExactMatches: true,
  generateDescriptions: true,
  inferDataTypes: true,
};

// ============================================================================
// Performance Configuration
// ============================================================================

export const PERFORMANCE = {
  maxVisibleNodes: 200,
  virtualScrollThreshold: 50,
  debounceLayoutMs: 300,
  throttleRenderMs: 16, // ~60fps
};

// ============================================================================
// Validation Rules
// ============================================================================

export const VALIDATION = {
  maxNodeNameLength: 100,
  maxAttributeNameLength: 64,
  maxAttributesPerNode: 200,
  maxEdgesPerNode: 50,
  reservedKeywords: ['select', 'from', 'where', 'join', 'table', 'database'],
};

// ============================================================================
// Export all configs
// ============================================================================

export const CANVAS_CONFIG = {
  layout: DEFAULT_LAYOUT_CONFIG,
  bronzeLayout: BRONZE_LAYOUT_CONFIG,
  goldLayout: GOLD_LAYOUT_CONFIG,
  nodeStyles: NODE_STYLES,
  edgeStyles: EDGE_STYLES,
  reactFlow: REACT_FLOW_CONFIG,
  dataTypeIcons: DATA_TYPE_ICONS,
  columnMatching: COLUMN_MATCHING,
  autoGeneration: AUTO_GENERATION,
  performance: PERFORMANCE,
  validation: VALIDATION,
} as const;
