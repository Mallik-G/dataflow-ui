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
          strokeWidth: 2,
          strokeDasharray: '5,5',
        };
      case 'transform':
        return {
          stroke: '#a78bfa',
          strokeWidth: 2,
        };
      case 'derived':
        return {
          stroke: '#eab308',
          strokeWidth: 2,
        };
      case 'map':
      default:
        return {
          stroke: '#64748b',
          strokeWidth: 2,
        };
    }
  };

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={getEdgeStyle()}
      />
      {data?.transformation && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-40}
            y={-12}
            width={80}
            height={24}
            fill="#fff"
            stroke="#94a3b8"
            strokeWidth={1}
            rx={4}
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fontSize={10}
            fill="#475569"
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
