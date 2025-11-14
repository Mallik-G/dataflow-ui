import { useCanvasStore } from '../../stores/canvasStore';
import {
  SourceTableNodeData,
  SilverTableNodeData,
  GoldEntityNodeData,
  TransformNodeData
} from '../../types';

const MetadataPanel = () => {
  const selectedNode = useCanvasStore(state => state.selectedNode);

  if (!selectedNode) {
    return (
      <div style={{
        width: '360px',
        height: '100%',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        padding: '24px',
        overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#94a3b8',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            fontSize: '32px',
          }}>
            ⓘ
          </div>
          <div style={{ fontSize: '14px', fontWeight: '500' }}>
            No selection
          </div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            Click on a node to view its metadata
          </div>
        </div>
      </div>
    );
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
      borderLeft: '1px solid #e2e8f0',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#fafbfc',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '6px',
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
          color: '#1e293b',
          marginBottom: '4px',
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
