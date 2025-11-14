import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { SourceTableNodeData } from '../../types';

interface SourceTableNodeProps {
  data: SourceTableNodeData;
  selected: boolean;
}

const SourceTableNode = memo(({ data, selected }: SourceTableNodeProps) => {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        border: `2px solid ${selected ? '#1e40af' : '#3b82f6'}`,
        backgroundColor: '#dbeafe',
        minWidth: '200px',
        boxShadow: selected ? '0 4px 6px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e40af' }}>
        {data.label}
      </div>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
        Schema: {data.schema}
      </div>
      <div style={{ fontSize: '12px' }}>
        {data.columns.slice(0, 5).map((col, idx) => (
          <div
            key={idx}
            style={{
              padding: '4px',
              marginBottom: '2px',
              backgroundColor: '#fff',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{col.name}</span>
            <span style={{ color: '#64748b', fontSize: '10px' }}>{col.type}</span>
          </div>
        ))}
        {data.columns.length > 5 && (
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            +{data.columns.length - 5} more...
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});

SourceTableNode.displayName = 'SourceTableNode';

export default SourceTableNode;
