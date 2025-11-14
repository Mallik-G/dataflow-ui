import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { SourceTableNodeData } from '../../types';
import { colors, borderRadius } from '../../theme/colors';

interface SourceTableNodeProps {
  data: SourceTableNodeData;
  selected: boolean;
}

const SourceTableNode = memo(({ data, selected }: SourceTableNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0',
        borderRadius: borderRadius.xl,
        border: `2px solid ${selected ? colors.node.source.main : isHovered ? colors.node.source.border : colors.node.source.light}`,
        backgroundColor: colors.background.tertiary,
        minWidth: '240px',
        maxWidth: '280px',
        boxShadow: selected
          ? `${colors.shadow.xl}, 0 0 0 1px ${colors.node.source.main}`
          : isHovered
          ? colors.shadow.md
          : colors.shadow.sm,
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${colors.node.source.light}`,
        background: `linear-gradient(135deg, ${colors.node.source.light} 0%, ${colors.node.source.light} 100%)`,
        borderRadius: '10px 10px 0 0',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: borderRadius.md,
            background: `linear-gradient(135deg, ${colors.node.source.main} 0%, ${colors.node.source.main} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#fff',
            fontWeight: 'bold',
          }}>
            S
          </div>
          <div style={{
            fontWeight: '600',
            fontSize: '14px',
            color: colors.text.primary,
            flex: 1,
          }}>
            {data.label}
          </div>
        </div>
        <div style={{
          fontSize: '11px',
          color: colors.text.secondary,
          fontFamily: 'monospace',
          marginLeft: '32px',
        }}>
          {data.schema}
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
              backgroundColor: colors.background.secondary,
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.border.main}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.node.source.light;
              e.currentTarget.style.borderColor = colors.node.source.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.secondary;
              e.currentTarget.style.borderColor = colors.border.main;
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: colors.node.source.main,
              }} />
              <span style={{
                fontSize: '12px',
                fontWeight: '500',
                color: colors.text.primary,
              }}>
                {col.name}
              </span>
            </div>
            <span style={{
              fontSize: '10px',
              color: colors.text.muted,
              backgroundColor: colors.node.source.light,
              padding: '2px 8px',
              borderRadius: borderRadius.sm,
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
            color: colors.text.muted,
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
          backgroundColor: colors.node.source.main,
          border: `2px solid ${colors.background.tertiary}`,
          boxShadow: colors.shadow.md,
        }}
      />
    </div>
  );
});

SourceTableNode.displayName = 'SourceTableNode';

export default SourceTableNode;
