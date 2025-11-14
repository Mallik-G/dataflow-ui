import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { CustomNode, CustomEdge, ValidationError } from '../types';

interface CanvasState {
  nodes: CustomNode[];
  edges: CustomEdge[];
  selectedNode: CustomNode | null;
  validationErrors: ValidationError[];

  setNodes: (nodes: CustomNode[]) => void;
  setEdges: (edges: CustomEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeClick: (_event: React.MouseEvent, node: CustomNode) => void;
  addNode: (node: CustomNode) => void;
  addEdge: (edge: CustomEdge) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  setSelectedNode: (node: CustomNode | null) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  validationErrors: [],

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
    set({ selectedNode: node });
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
    set({ selectedNode: node });
  },

  setValidationErrors: (errors) => {
    set({ validationErrors: errors });
  },
}));
