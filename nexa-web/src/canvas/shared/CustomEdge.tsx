/**
 * Custom Edge Component
 *
 * Reusable edge component for React Flow with curved paths
 */

import React, { useMemo } from 'react';
import { EdgeProps } from 'reactflow';
import { EdgeData } from '../core/types';
import { generateCurvedPath } from './canvasUtils';
import { EDGE_STYLES } from '../core/canvasConfig';

interface CustomEdgeProps extends EdgeProps {
  data?: EdgeData;
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}: CustomEdgeProps) {
  const edgePath = useMemo(() => {
    return generateCurvedPath(sourceX, sourceY, targetX, targetY);
  }, [sourceX, sourceY, targetX, targetY]);

  // Determine edge style based on relationship type
  const edgeStyle = useMemo(() => {
    if (selected) {
      return { ...style, ...EDGE_STYLES.selected };
    }

    if (data?.relationshipType) {
      const typeStyle = EDGE_STYLES[data.relationshipType] || EDGE_STYLES.default;
      return { ...style, ...typeStyle };
    }

    return { ...style, ...EDGE_STYLES.default };
  }, [selected, data?.relationshipType, style]);

  return (
    <>
      <path
        id={id}
        style={edgeStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd="url(#react-flow__arrowhead)"
      />
    </>
  );
}

export default CustomEdge;
