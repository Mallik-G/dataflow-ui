import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { SilverTableNodeData } from '../../types';

interface SilverTableNodeProps {
  data: SilverTableNodeData;
  selected: boolean;
}

const SilverTableNode = memo(({ data, selected }: SilverTableNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0',
        borderRadius: '12px',
        border: `2px solid ${selected ? '#64748b' : isHovered ? '#94a3b8' : '#e2e8f0'}`,
        backgroundColor: '#ffffff',
        minWidth: '240px',
        maxWidth: '280px',
        boxShadow: selected
          ? '0 8px 24px rgba(100, 116, 139, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)'
          : isHovered
          ? '0 4px 12px rgba(0, 0, 0, 0.12)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: '#64748b',
          border: '2px solid #ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      />

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '10px 10px 0 0',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#fff',
            fontWeight: 'bold',
          }}>
            Ag
          </div>
          <div style={{
            fontWeight: '600',
            fontSize: '14px',
            color: '#1e293b',
            flex: 1,
          }}>
            {data.label}
          </div>
        </div>
      </div>

      {/* Columns */}
      <div style={{ padding: '12px' }}>
        {data.columns.slice(0, 6).map((col, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 10px',
              marginBottom: '4px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: '#64748b',
              }} />
              <span style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#334155',
              }}>
                {col.name}
              </span>
            </div>
            <span style={{
              fontSize: '10px',
              color: '#64748b',
              backgroundColor: '#e2e8f0',
              padding: '2px 8px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontWeight: '500',
            }}>
              {col.type}
            </span>
          </div>
        ))}
        {data.columns.length > 6 && (
          <div style={{
            fontSize: '11px',
            color: '#94a3b8',
            marginTop: '8px',
            textAlign: 'center',
            fontWeight: '500',
          }}>
            +{data.columns.length - 6} more columns
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: '#64748b',
          border: '2px solid #ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      />
    </div>
  );
});

SilverTableNode.displayName = 'SilverTableNode';

export default SilverTableNode;
