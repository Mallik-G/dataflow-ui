import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { TransformNodeData } from '../../types';

interface TransformNodeProps {
  data: TransformNodeData;
  selected: boolean;
}

const TransformNode = memo(({ data, selected }: TransformNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0',
        borderRadius: '12px',
        border: `2px solid ${selected ? '#7c3aed' : isHovered ? '#a78bfa' : '#ddd6fe'}`,
        backgroundColor: '#ffffff',
        minWidth: '200px',
        maxWidth: '240px',
        boxShadow: selected
          ? '0 8px 24px rgba(124, 58, 237, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)'
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
          backgroundColor: '#8b5cf6',
          border: '2px solid #ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      />

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #ddd6fe',
        background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
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
            background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#fff',
            fontWeight: 'bold',
          }}>
            ƒ
          </div>
          <div style={{
            fontWeight: '600',
            fontSize: '13px',
            color: '#1e293b',
            flex: 1,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Transform
          </div>
        </div>
      </div>

      {/* Expression */}
      <div style={{ padding: '12px' }}>
        <div
          style={{
            fontSize: '11px',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
            backgroundColor: '#f8fafc',
            border: '1px solid #e0e7ff',
            padding: '10px',
            borderRadius: '6px',
            marginBottom: '10px',
            wordBreak: 'break-all',
            lineHeight: '1.5',
            color: '#334155',
          }}
        >
          {data.expression}
        </div>

        {/* Functions */}
        {data.functions.length > 0 && (
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: '600',
              color: '#64748b',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Functions
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {data.functions.map((fn, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f5f3ff',
                    color: '#7c3aed',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '500',
                    fontFamily: 'monospace',
                    border: '1px solid #ddd6fe',
                  }}
                >
                  {fn}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: '#8b5cf6',
          border: '2px solid #ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
      />
    </div>
  );
});

TransformNode.displayName = 'TransformNode';

export default TransformNode;
