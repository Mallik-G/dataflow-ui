import { memo, useState } from 'react';
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
  markerEnd,
}: CustomEdgeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath] = getBezierPath({
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
          strokeWidth: isHovered ? 3.5 : 2.5,
          strokeDasharray: '8,4',
          opacity: isHovered ? 1 : 0.8,
        };
      case 'transform':
        return {
          stroke: '#a78bfa',
          strokeWidth: isHovered ? 3.5 : 2.5,
          opacity: isHovered ? 1 : 0.9,
        };
      case 'derived':
        return {
          stroke: '#f59e0b',
          strokeWidth: isHovered ? 3.5 : 2.5,
          opacity: isHovered ? 1 : 0.9,
        };
      case 'map':
      case 'custom':
      default:
        return {
          stroke: '#94a3b8',
          strokeWidth: isHovered ? 3.5 : 2.5,
          opacity: isHovered ? 1 : 0.8,
        };
    }
  };

  return (
    <>
      {/* Background path for glow effect */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={isHovered ? 10 : 6}
        stroke={getEdgeStyle().stroke}
        strokeOpacity={0.1}
      />

      {/* Invisible clickable path */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <title>Click to show details</title>
      </path>

      {/* Main path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...getEdgeStyle(),
          fill: 'none',
          pointerEvents: 'none',
          transition: 'all 0.2s ease',
        }}
      />
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';

export default CustomEdge;
