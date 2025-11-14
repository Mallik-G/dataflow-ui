import { memo } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { EdgeType } from '../../types';

interface CustomEdgeProps extends EdgeProps {
  type?: EdgeType;
}

const CustomEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  type = 'map',
  data,
  markerEnd,
}: CustomEdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const getEdgeStyle = () => {
    switch (type) {
      case 'llmGenerated':
        return {
          stroke: '#8b5cf6',
          strokeWidth: 2.5,
          strokeDasharray: '8,4',
          opacity: 0.8,
        };
      case 'transform':
        return {
          stroke: '#a78bfa',
          strokeWidth: 2.5,
          opacity: 0.9,
        };
      case 'derived':
        return {
          stroke: '#f59e0b',
          strokeWidth: 2.5,
          opacity: 0.9,
        };
      case 'map':
      case 'custom':
      default:
        return {
          stroke: '#94a3b8',
          strokeWidth: 2.5,
          opacity: 0.8,
        };
    }
  };

  return (
    <>
      {/* Background path for glow effect */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={6}
        stroke={getEdgeStyle().stroke}
        strokeOpacity={0.1}
      />

      {/* Main path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...getEdgeStyle(),
          fill: 'none',
        }}
      />

      {data?.transformation && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          {/* Shadow */}
          <rect
            x={-45}
            y={-14}
            width={90}
            height={28}
            fill="rgba(0, 0, 0, 0.05)"
            rx={6}
          />
          {/* Background */}
          <rect
            x={-45}
            y={-15}
            width={90}
            height={28}
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth={1.5}
            rx={6}
            filter="drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))"
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fontFamily="monospace"
            fill="#334155"
          >
            {data.transformation}
          </text>
        </g>
      )}
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';

export default CustomEdge;
