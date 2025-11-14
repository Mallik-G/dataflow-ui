import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { TransformNodeData } from '../../types';
import { colors, borderRadius } from '../../theme/colors';

interface TransformNodeProps {
  data: TransformNodeData;
  selected: boolean;
}

const TransformNode = memo(({ data, selected }: TransformNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const confidence = data.llmMetadata?.confidence || 0;
  const getBorderColor = () => {
    if (selected) return colors.primary.main;
    if (data.isUserModified) return colors.status.warning;
    if (confidence >= 90) return colors.status.success;
    if (confidence >= 70) return colors.status.warning;
    return colors.status.error;
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0',
        borderRadius: borderRadius.xl,
        border: `2px solid ${getBorderColor()}`,
        backgroundColor: colors.background.tertiary,
        minWidth: '200px',
        maxWidth: '240px',
        boxShadow: selected
          ? `${colors.shadow.xl}, 0 0 0 1px ${colors.primary.main}`
          : isHovered
          ? colors.shadow.md
          : colors.shadow.sm,
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        position: 'relative',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: colors.node.transform.main,
          border: `2px solid ${colors.background.tertiary}`,
          boxShadow: colors.shadow.md,
        }}
      />

      {/* Badges */}
      {(data.llmMetadata || data.isUserModified) && (
        <div style={{
          position: 'absolute',
          top: '-10px',
          right: '8px',
          display: 'flex',
          gap: '4px',
        }}>
          {data.isUserModified && (
            <div style={{
              padding: '2px 8px',
              backgroundColor: colors.status.warningLight,
              border: `1px solid ${colors.status.warning}`,
              borderRadius: borderRadius.xl,
              fontSize: '10px',
              fontWeight: '600',
              color: '#92400e',
            }}>
              ✏️ MODIFIED
            </div>
          )}
          {data.llmMetadata && (
            <div style={{
              padding: '2px 8px',
              backgroundColor: confidence >= 90 ? colors.status.successLight : confidence >= 70 ? colors.status.warningLight : colors.status.errorLight,
              border: `1px solid ${confidence >= 90 ? colors.status.success : confidence >= 70 ? colors.status.warning : colors.status.error}`,
              borderRadius: borderRadius.xl,
              fontSize: '10px',
              fontWeight: '600',
              color: confidence >= 90 ? '#166534' : confidence >= 70 ? '#92400e' : '#991b1b',
            }}>
              🤖 {confidence}%
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${colors.node.transform.light}`,
        background: `linear-gradient(135deg, ${colors.node.transform.light} 0%, ${colors.primary.lighter} 100%)`,
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
            background: `linear-gradient(135deg, ${colors.primary.light} 0%, ${colors.primary.main} 100%)`,
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
            color: colors.text.primary,
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
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.node.transform.light}`,
            padding: '10px',
            borderRadius: borderRadius.md,
            marginBottom: '10px',
            wordBreak: 'break-all',
            lineHeight: '1.5',
            color: colors.text.primary,
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
              color: colors.text.secondary,
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
                    backgroundColor: colors.node.transform.light,
                    color: colors.primary.main,
                    borderRadius: borderRadius.sm,
                    fontSize: '10px',
                    fontWeight: '500',
                    fontFamily: 'monospace',
                    border: `1px solid ${colors.node.transform.border}`,
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
          backgroundColor: colors.node.transform.main,
          border: `2px solid ${colors.background.tertiary}`,
          boxShadow: colors.shadow.md,
        }}
      />
    </div>
  );
});

TransformNode.displayName = 'TransformNode';

export default TransformNode;
