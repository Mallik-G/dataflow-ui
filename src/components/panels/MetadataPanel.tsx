import { useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { colors, borderRadius } from '../../theme/colors';
import {
  SourceTableNodeData,
  SilverTableNodeData,
  GoldEntityNodeData,
  TransformNodeData
} from '../../types';

const MetadataPanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedNode = useCanvasStore(state => state.selectedNode);
  const selectedEdge = useCanvasStore(state => state.selectedEdge);
  const nodes = useCanvasStore(state => state.nodes);

  const hasSelection = selectedNode || selectedEdge;

  if (isCollapsed || !hasSelection) {
    return (
      <div style={{
        width: '60px',
        height: '100%',
        backgroundColor: colors.background.tertiary,
        borderLeft: `1px solid ${colors.border.main}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '12px',
      }}>
        <button
          onClick={() => setIsCollapsed(false)}
          title={hasSelection ? 'Context Details' : 'Context Panel'}
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: hasSelection ? colors.primary.lighter : colors.background.secondary,
            border: hasSelection ? `2px solid ${colors.primary.main}` : `2px solid ${colors.border.main}`,
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.background.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = hasSelection ? colors.primary.lighter : colors.background.secondary;
          }}
        >
          ⓘ
        </button>
      </div>
    );
  }

  // Render edge details if edge is selected
  if (selectedEdge) {
    const sourceNode = nodes.find(n => n.id === selectedEdge.source);
    const targetNode = nodes.find(n => n.id === selectedEdge.target);

    return (
      <div style={{
        width: '360px',
        height: '100%',
        backgroundColor: '#ffffff',
        borderLeft: `1px solid ${colors.border.main}`,
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${colors.border.main}`,
          backgroundColor: colors.background.tertiary,
          position: 'relative',
        }}>
          <button
            onClick={() => setIsCollapsed(true)}
            title="Collapse context panel"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '4px 8px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.text.muted,
              fontSize: '16px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.text.muted;
            }}
          >
            ▶
          </button>
          <div style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: borderRadius.sm,
            backgroundColor: colors.primary.lighter,
            border: `1px solid ${colors.primary.main}`,
            fontSize: '10px',
            fontWeight: '600',
            color: colors.primary.dark,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
          }}>
            LINEAGE CONNECTION
          </div>
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: colors.text.primary,
            marginBottom: '4px',
            paddingRight: '40px',
          }}>
            {sourceNode?.data.label} → {targetNode?.data.label}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: colors.text.secondary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Column Mappings
          </div>

          {/* Sample column mappings */}
          {[
            { source: 'customer_id', target: 'id', type: 'direct' },
            { source: 'email', target: 'contact_email', type: 'direct' },
            { source: 'created_at', target: 'registration_date', type: 'cast' },
          ].map((mapping, idx) => (
            <div key={idx} style={{
              padding: '14px',
              backgroundColor: colors.background.tertiary,
              borderRadius: borderRadius.md,
              marginBottom: '10px',
              border: `1px solid ${colors.border.main}`,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}>
                <div style={{
                  flex: 1,
                  fontSize: '13px',
                  fontWeight: '600',
                  fontFamily: 'monospace',
                  color: colors.text.primary,
                }}>
                  {mapping.source}
                </div>
                <div style={{ fontSize: '12px', color: colors.text.muted }}>→</div>
                <div style={{
                  flex: 1,
                  fontSize: '13px',
                  fontWeight: '600',
                  fontFamily: 'monospace',
                  color: colors.text.primary,
                }}>
                  {mapping.target}
                </div>
              </div>
              <div style={{
                fontSize: '10px',
                color: colors.text.secondary,
                backgroundColor: colors.background.secondary,
                padding: '3px 8px',
                borderRadius: borderRadius.sm,
                display: 'inline-block',
                textTransform: 'uppercase',
                fontWeight: '600',
              }}>
                {mapping.type}
              </div>
            </div>
          ))}

          <div style={{
            marginTop: '24px',
            fontSize: '11px',
            fontWeight: '600',
            color: colors.text.secondary,
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Transformation Logic
          </div>
          <div style={{
            padding: '12px',
            backgroundColor: '#1e293b',
            color: '#e2e8f0',
            borderRadius: borderRadius.md,
            fontSize: '12px',
            fontFamily: 'monospace',
            lineHeight: '1.6',
          }}>
            SELECT customer_id AS id,<br />
            &nbsp;&nbsp;email AS contact_email,<br />
            &nbsp;&nbsp;CAST(created_at AS DATE) AS registration_date<br />
            FROM source_table
          </div>

          {selectedEdge.data?.joins && (
            <>
              <div style={{
                marginTop: '24px',
                fontSize: '11px',
                fontWeight: '600',
                color: colors.text.secondary,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Join Conditions
              </div>
              <div style={{
                padding: '12px',
                backgroundColor: colors.background.tertiary,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.border.main}`,
                fontSize: '12px',
                fontFamily: 'monospace',
                color: colors.text.primary,
              }}>
                {selectedEdge.data.joins}
              </div>
            </>
          )}

          {selectedEdge.data?.filters && (
            <>
              <div style={{
                marginTop: '24px',
                fontSize: '11px',
                fontWeight: '600',
                color: colors.text.secondary,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Filters Applied
              </div>
              <div style={{
                padding: '12px',
                backgroundColor: colors.background.tertiary,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.border.main}`,
                fontSize: '12px',
                fontFamily: 'monospace',
                color: colors.text.primary,
              }}>
                {selectedEdge.data.filters}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // If we reach here, selectedNode must exist (hasSelection is true and selectedEdge is false)
  if (!selectedNode) {
    return null;
  }

  const renderNodeMetadata = () => {
    switch (selectedNode.type) {
      case 'source': {
        const data = selectedNode.data as SourceTableNodeData;
        return (
          <>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                Schema
              </div>
              <div style={{ fontWeight: '500' }}>{data.schema}</div>
            </div>
            <div>
              <div style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Columns ({data.columns.length})
              </div>
              {data.columns.map((col, idx) => (
                <div key={idx} style={{
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}>
                  <div style={{
                    fontWeight: '600',
                    marginBottom: '4px',
                    color: '#1e293b',
                    fontSize: '13px',
                  }}>{col.name}</div>
                  <div style={{
                    fontSize: '11px',
                    color: '#64748b',
                    fontFamily: 'monospace',
                    backgroundColor: '#e0e7ff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'inline-block',
                  }}>{col.type}</div>
                </div>
              ))}
            </div>
          </>
        );
      }

      case 'silver': {
        const data = selectedNode.data as SilverTableNodeData;
        return (
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#64748b',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Columns ({data.columns.length})
            </div>
            {data.columns.map((col, idx) => (
              <div key={idx} style={{
                padding: '12px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                marginBottom: '8px',
                border: '1px solid #e2e8f0',
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
              }}>
                <div style={{
                  fontWeight: '600',
                  marginBottom: '4px',
                  color: '#1e293b',
                  fontSize: '13px',
                }}>{col.name}</div>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontFamily: 'monospace',
                  backgroundColor: '#e2e8f0',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-block',
                }}>{col.type}</div>
              </div>
            ))}
          </div>
        );
      }

      case 'gold': {
        const data = selectedNode.data as GoldEntityNodeData;
        return (
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#64748b',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Attributes ({data.attributes.length})
            </div>
            {data.attributes.map((attr, idx) => (
              <div key={idx} style={{
                padding: '12px',
                backgroundColor: '#fefce8',
                borderRadius: '8px',
                marginBottom: '8px',
                border: '1px solid #fef08a',
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
              }}>
                <div style={{
                  fontWeight: '600',
                  marginBottom: '4px',
                  color: '#1e293b',
                  fontSize: '13px',
                }}>{attr.name}</div>
                <div style={{
                  fontSize: '11px',
                  color: '#92400e',
                  fontFamily: 'monospace',
                  backgroundColor: '#fef3c7',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginBottom: attr.lineageDetails ? '6px' : '0',
                }}>{attr.type}</div>
                {attr.lineageDetails && (
                  <div style={{
                    fontSize: '11px',
                    color: '#92400e',
                    marginTop: '6px',
                    fontStyle: 'italic',
                    paddingTop: '6px',
                    borderTop: '1px solid #fde047',
                  }}>
                    → {attr.lineageDetails}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }

      case 'transform': {
        const data = selectedNode.data as TransformNodeData;
        return (
          <>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                Expression
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                backgroundColor: '#fff',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                wordBreak: 'break-all',
              }}>
                {data.expression}
              </div>
            </div>
            {data.functions.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  Functions Used
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {data.functions.map((fn, idx) => (
                    <span key={idx} style={{
                      padding: '4px 8px',
                      backgroundColor: '#ede9fe',
                      color: '#7c3aed',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}>
                      {fn}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      }
    }
  };

  const getTypeColor = () => {
    switch (selectedNode.type) {
      case 'source': return { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' };
      case 'silver': return { bg: '#f8fafc', border: '#64748b', text: '#475569' };
      case 'gold': return { bg: '#fef9c3', border: '#f59e0b', text: '#92400e' };
      case 'transform': return { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9' };
      default: return { bg: '#f8fafc', border: '#64748b', text: '#475569' };
    }
  };

  const typeColor = getTypeColor();

  return (
    <div style={{
      width: '360px',
      height: '100%',
      backgroundColor: '#ffffff',
      borderLeft: `1px solid ${colors.border.main}`,
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px',
        paddingBottom: '16px',
        borderBottom: `1px solid ${colors.border.main}`,
        backgroundColor: colors.background.tertiary,
        position: 'relative',
      }}>
        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse context panel"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: colors.text.muted,
            fontSize: '16px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.text.muted;
          }}
        >
          ▶
        </button>
        <div style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: borderRadius.sm,
          backgroundColor: typeColor.bg,
          border: `1px solid ${typeColor.border}`,
          fontSize: '10px',
          fontWeight: '600',
          color: typeColor.text,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '12px',
        }}>
          {selectedNode.type}
        </div>
        <div style={{
          fontSize: '20px',
          fontWeight: '600',
          color: colors.text.primary,
          marginBottom: '4px',
          paddingRight: '40px',
        }}>
          {selectedNode.data.label}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {renderNodeMetadata()}
      </div>
    </div>
  );
};

export default MetadataPanel;
