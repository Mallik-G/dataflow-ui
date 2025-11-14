import { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  addEdge,
  MarkerType,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useCanvasStore } from '../stores/canvasStore';
import SourceTableNode from './nodes/SourceTableNode';
import SilverTableNode from './nodes/SilverTableNode';
import GoldEntityNode from './nodes/GoldEntityNode';
import TransformNode from './nodes/TransformNode';
import CustomEdge from './edges/CustomEdge';
import MetadataPanel from './panels/MetadataPanel';
import Toolbar from './panels/Toolbar';
import { CustomEdge as CustomEdgeType } from '../types';

const nodeTypes = {
  source: SourceTableNode,
  silver: SilverTableNode,
  gold: GoldEntityNode,
  transform: TransformNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const CanvasContent = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeClick,
    setEdges,
  } = useCanvasStore();

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: CustomEdgeType = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        source: params.source || '',
        target: params.target || '',
        type: 'custom',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };
      setEdges(addEdge(newEdge, edges as any) as CustomEdgeType[]);
    },
    [edges, setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes as any}
          edges={edges as any}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick as any}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'source':
                  return '#3b82f6';
                case 'silver':
                  return '#94a3b8';
                case 'gold':
                  return '#eab308';
                case 'transform':
                  return '#a78bfa';
                default:
                  return '#64748b';
              }
            }}
          />
          <Toolbar />
        </ReactFlow>
      </div>
      <MetadataPanel />
    </div>
  );
};

const Canvas = () => {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
};

export default Canvas;
