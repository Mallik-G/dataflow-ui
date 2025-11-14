import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { GoldEntityNodeData } from '../../types';

interface GoldEntityNodeProps {
  data: GoldEntityNodeData;
  selected: boolean;
}

const GoldEntityNode = memo(({ data, selected }: GoldEntityNodeProps) => {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        border: `2px solid ${selected ? '#ca8a04' : '#eab308'}`,
        backgroundColor: '#fef9c3',
        minWidth: '200px',
        boxShadow: selected ? '0 4px 6px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#ca8a04' }}>
        {data.label}
      </div>
      <div style={{ fontSize: '12px' }}>
        {data.attributes.slice(0, 5).map((attr, idx) => (
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
            <span>{attr.name}</span>
            <span style={{ color: '#64748b', fontSize: '10px' }}>{attr.type}</span>
          </div>
        ))}
        {data.attributes.length > 5 && (
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            +{data.attributes.length - 5} more...
          </div>
        )}
      </div>
    </div>
  );
});

GoldEntityNode.displayName = 'GoldEntityNode';

export default GoldEntityNode;
