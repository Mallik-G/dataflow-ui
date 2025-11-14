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
        width: '320px',
        height: '100%',
        backgroundColor: '#f8fafc',
        borderLeft: '1px solid #e2e8f0',
        padding: '16px',
        overflowY: 'auto',
      }}>
        <div style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>
          Select a node to view metadata
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
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                Columns ({data.columns.length})
              </div>
              {data.columns.map((col, idx) => (
                <div key={idx} style={{
                  padding: '8px',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  border: '1px solid #e2e8f0',
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '2px' }}>{col.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{col.type}</div>
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
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
              Columns ({data.columns.length})
            </div>
            {data.columns.map((col, idx) => (
              <div key={idx} style={{
                padding: '8px',
                backgroundColor: '#fff',
                borderRadius: '6px',
                marginBottom: '6px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontWeight: '500', marginBottom: '2px' }}>{col.name}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{col.type}</div>
              </div>
            ))}
          </div>
        );
      }

      case 'gold': {
        const data = selectedNode.data as GoldEntityNodeData;
        return (
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
              Attributes ({data.attributes.length})
            </div>
            {data.attributes.map((attr, idx) => (
              <div key={idx} style={{
                padding: '8px',
                backgroundColor: '#fff',
                borderRadius: '6px',
                marginBottom: '6px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontWeight: '500', marginBottom: '2px' }}>{attr.name}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{attr.type}</div>
                {attr.lineageDetails && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    {attr.lineageDetails}
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

  return (
    <div style={{
      width: '320px',
      height: '100%',
      backgroundColor: '#f8fafc',
      borderLeft: '1px solid #e2e8f0',
      padding: '16px',
      overflowY: 'auto',
    }}>
      <div style={{
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color: '#1e293b',
      }}>
        {selectedNode.data.label}
      </div>
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        marginBottom: '16px',
        textTransform: 'uppercase',
        fontWeight: '500',
      }}>
        {selectedNode.type} Node
      </div>
      {renderNodeMetadata()}
    </div>
  );
};

export default MetadataPanel;
