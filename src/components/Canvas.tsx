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
import Legend from './panels/Legend';
import ControlPanel from './panels/ControlPanel';
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
    <div style={{ width: '100vw', height: '100vh', display: 'flex', backgroundColor: '#fafbfc' }}>
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
          defaultEdgeOptions={{
            type: 'custom',
            animated: false,
          }}
        >
          <Background
            gap={16}
            size={1}
            color="#e2e8f0"
            style={{ backgroundColor: '#fafbfc' }}
          />
          <Controls
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
            showInteractive={false}
          />
          <MiniMap
            nodeColor={(node) => {
              switch (node.type) {
                case 'source':
                  return '#3b82f6';
                case 'silver':
                  return '#64748b';
                case 'gold':
                  return '#f59e0b';
                case 'transform':
                  return '#8b5cf6';
                default:
                  return '#64748b';
              }
            }}
            maskColor="rgba(248, 250, 252, 0.8)"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          />
          <Toolbar />
          <Legend />
          <ControlPanel />
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
