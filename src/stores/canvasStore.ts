import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { CustomNode, CustomEdge, ValidationError } from '../types';
import { CatalogObject } from '../types/catalog';

type ViewMode = 'lineage' | 'dataflow' | 'none';

interface CanvasState {
  nodes: CustomNode[];
  edges: CustomEdge[];
  selectedNode: CustomNode | null;
  selectedEdge: CustomEdge | null;
  validationErrors: ValidationError[];

  // New state for browser-driven views
  viewMode: ViewMode;
  selectedCatalogObject: CatalogObject | null;
  selectedDataFlowId: string | null;
  upstreamLevels: number;
  downstreamLevels: number;

  setNodes: (nodes: CustomNode[]) => void;
  setEdges: (edges: CustomEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeClick: (_event: React.MouseEvent, node: CustomNode) => void;
  onEdgeClick: (_event: React.MouseEvent, edge: CustomEdge) => void;
  addNode: (node: CustomNode) => void;
  addEdge: (edge: CustomEdge) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  setSelectedNode: (node: CustomNode | null) => void;
  setSelectedEdge: (edge: CustomEdge | null) => void;
  setValidationErrors: (errors: ValidationError[]) => void;

  // New methods
  setViewMode: (mode: ViewMode) => void;
  setSelectedCatalogObject: (obj: CatalogObject | null) => void;
  setSelectedDataFlow: (flowId: string | null) => void;
  setUpstreamLevels: (levels: number) => void;
  setDownstreamLevels: (levels: number) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedEdge: null,
  validationErrors: [],

  // New state defaults
  viewMode: 'none',
  selectedCatalogObject: null,
  selectedDataFlowId: null,
  upstreamLevels: 2,
  downstreamLevels: 2,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as CustomNode[],
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges as any) as CustomEdge[],
    });
  },

  onNodeClick: (_event, node) => {
    set({ selectedNode: node, selectedEdge: null });
  },

  onEdgeClick: (_event, edge) => {
    set({ selectedEdge: edge, selectedNode: null });
  },

  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
  },

  addEdge: (edge) => {
    set({ edges: [...get().edges, edge] });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter(n => n.id !== nodeId),
      edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    });
  },

  removeEdge: (edgeId) => {
    set({ edges: get().edges.filter(e => e.id !== edgeId) });
  },

  setSelectedNode: (node) => {
    set({ selectedNode: node, selectedEdge: null });
  },

  setSelectedEdge: (edge) => {
    set({ selectedEdge: edge, selectedNode: null });
  },

  setValidationErrors: (errors) => {
    set({ validationErrors: errors });
  },

  // New methods
  setViewMode: (mode) => set({ viewMode: mode }),

  setSelectedCatalogObject: (obj) => {
    set({
      selectedCatalogObject: obj,
      selectedDataFlowId: null,
    });
  },

  setSelectedDataFlow: (flowId) => {
    set({
      selectedDataFlowId: flowId,
      selectedCatalogObject: null,
    });
  },

  setUpstreamLevels: (levels) => set({ upstreamLevels: levels }),
  setDownstreamLevels: (levels) => set({ downstreamLevels: levels }),
}));
