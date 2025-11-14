import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { GoldEntityNodeData } from '../../types';

interface GoldEntityNodeProps {
  data: GoldEntityNodeData;
  selected: boolean;
}

const GoldEntityNode = memo(({ data, selected }: GoldEntityNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0',
        borderRadius: '12px',
        border: `2px solid ${selected ? '#d97706' : isHovered ? '#fbbf24' : '#fde68a'}`,
        backgroundColor: '#ffffff',
        minWidth: '240px',
        maxWidth: '280px',
        boxShadow: selected
          ? '0 8px 24px rgba(217, 119, 6, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)'
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
          backgroundColor: '#f59e0b',
          border: '2px solid #ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      />

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #fde68a',
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
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
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#fff',
            fontWeight: 'bold',
          }}>
            Au
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

      {/* Attributes */}
      <div style={{ padding: '12px' }}>
        {data.attributes.slice(0, 6).map((attr, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 10px',
              marginBottom: '4px',
              backgroundColor: '#fefce8',
              borderRadius: '6px',
              border: '1px solid #fef08a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fef9c3';
              e.currentTarget.style.borderColor = '#fde047';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fefce8';
              e.currentTarget.style.borderColor = '#fef08a';
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: '#f59e0b',
                }} />
                <span style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#334155',
                }}>
                  {attr.name}
                </span>
              </div>
              {attr.lineageDetails && (
                <span style={{
                  fontSize: '10px',
                  color: '#92400e',
                  marginLeft: '10px',
                  fontStyle: 'italic',
                }}>
                  {attr.lineageDetails}
                </span>
              )}
            </div>
            <span style={{
              fontSize: '10px',
              color: '#92400e',
              backgroundColor: '#fef3c7',
              padding: '2px 8px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontWeight: '500',
            }}>
              {attr.type}
            </span>
          </div>
        ))}
        {data.attributes.length > 6 && (
          <div style={{
            fontSize: '11px',
            color: '#b45309',
            marginTop: '8px',
            textAlign: 'center',
            fontWeight: '500',
          }}>
            +{data.attributes.length - 6} more attributes
          </div>
        )}
      </div>
    </div>
  );
});

GoldEntityNode.displayName = 'GoldEntityNode';

export default GoldEntityNode;
