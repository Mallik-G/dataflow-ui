import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { SilverTableNodeData } from '../../types';
import { colors, borderRadius } from '../../theme/colors';

interface SilverTableNodeProps {
  data: SilverTableNodeData;
  selected: boolean;
}

const SilverTableNode = memo(({ data, selected }: SilverTableNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showExpandButtons, setShowExpandButtons] = useState(false);

  const handleExpand = (direction: 'upstream' | 'downstream') => {
    console.log(`Expanding ${direction} from ${data.label}`);
    alert(`🚀 Expanding ${direction} lineage for ${data.label}\n\nThis will dynamically load connected nodes.`);
  };

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        setShowExpandButtons(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowExpandButtons(false);
      }}
      style={{
        padding: '0',
        borderRadius: borderRadius.xl,
        border: `2px solid ${selected ? colors.node.silver.main : isHovered ? colors.node.silver.border : colors.node.silver.light}`,
        backgroundColor: colors.background.tertiary,
        minWidth: '240px',
        maxWidth: '280px',
        boxShadow: selected
          ? `${colors.shadow.xl}, 0 0 0 1px ${colors.node.silver.main}`
          : isHovered
          ? colors.shadow.md
          : colors.shadow.sm,
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
          backgroundColor: colors.node.silver.main,
          border: `2px solid ${colors.background.tertiary}`,
          boxShadow: colors.shadow.md,
        }}
      />

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${colors.node.silver.light}`,
        background: `linear-gradient(135deg, ${colors.node.silver.light} 0%, ${colors.node.silver.light} 100%)`,
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
            borderRadius: borderRadius.md,
            background: `linear-gradient(135deg, ${colors.node.silver.main} 0%, ${colors.node.silver.main} 100%)`,
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
            color: colors.text.primary,
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
              e.currentTarget.style.backgroundColor = colors.node.silver.light;
              e.currentTarget.style.borderColor = colors.node.silver.border;
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
                backgroundColor: colors.node.silver.main,
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
              backgroundColor: colors.node.silver.light,
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

      {/* Expand Buttons */}
      {showExpandButtons && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExpand('upstream');
            }}
            style={{
              position: 'absolute',
              left: '-32px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '24px',
              height: '24px',
              borderRadius: borderRadius.full,
              backgroundColor: colors.primary.main,
              color: '#ffffff',
              border: `2px solid ${colors.background.tertiary}`,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: colors.shadow.md,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
            title="Expand upstream lineage"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExpand('downstream');
            }}
            style={{
              position: 'absolute',
              right: '-32px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '24px',
              height: '24px',
              borderRadius: borderRadius.full,
              backgroundColor: colors.primary.main,
              color: '#ffffff',
              border: `2px solid ${colors.background.tertiary}`,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: colors.shadow.md,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
            title="Expand downstream lineage"
          >
            +
          </button>
        </>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: colors.node.silver.main,
          border: `2px solid ${colors.background.tertiary}`,
          boxShadow: colors.shadow.md,
        }}
      />
    </div>
  );
});

SilverTableNode.displayName = 'SilverTableNode';

export default SilverTableNode;
