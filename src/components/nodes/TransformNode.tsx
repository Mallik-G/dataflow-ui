import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { TransformNodeData } from '../../types';

interface TransformNodeProps {
  data: TransformNodeData;
  selected: boolean;
}

const TransformNode = memo(({ data, selected }: TransformNodeProps) => {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        border: `2px solid ${selected ? '#7c3aed' : '#a78bfa'}`,
        backgroundColor: '#ede9fe',
        minWidth: '180px',
        boxShadow: selected ? '0 4px 6px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#7c3aed', fontSize: '12px' }}>
        Transform
      </div>
      <div
        style={{
          fontSize: '11px',
          fontFamily: 'monospace',
          backgroundColor: '#fff',
          padding: '6px',
          borderRadius: '4px',
          marginBottom: '6px',
          maxWidth: '180px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {data.expression}
      </div>
      {data.functions.length > 0 && (
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          Functions: {data.functions.join(', ')}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

TransformNode.displayName = 'TransformNode';

export default TransformNode;
