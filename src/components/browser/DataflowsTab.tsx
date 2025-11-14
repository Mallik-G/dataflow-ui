import { dataFlows } from '../../data/catalogData';
import { useCanvasStore } from '../../stores/canvasStore';

const DataflowsTab = () => {
  const { setViewMode, setSelectedDataFlow } = useCanvasStore();

  const handleFlowClick = (flowId: string) => {
    setViewMode('dataflow');
    setSelectedDataFlow(flowId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      case 'inactive': return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
      case 'error': return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      default: return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '12px',
      }}>
        Data Flows ({dataFlows.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {dataFlows.map((flow) => {
          const statusColors = getStatusColor(flow.status);
          return (
            <div
              key={flow.id}
              onClick={() => handleFlowClick(flow.id)}
              style={{
                padding: '12px',
                backgroundColor: '#fafbfc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fafbfc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#1e293b',
                }}>
                  {flow.name}
                </div>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  color: statusColors.text,
                  backgroundColor: statusColors.bg,
                  border: `1px solid ${statusColors.border}`,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}>
                  {flow.status}
                </div>
              </div>

              <div style={{
                fontSize: '11px',
                color: '#64748b',
                marginBottom: '6px',
              }}>
                → {flow.targetTable}
              </div>

              <div style={{
                fontSize: '11px',
                color: '#94a3b8',
                fontStyle: 'italic',
              }}>
                {flow.description}
              </div>

              {flow.lastRun && (
                <div style={{
                  fontSize: '10px',
                  color: '#94a3b8',
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid #e2e8f0',
                }}>
                  Last run: {flow.lastRun}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DataflowsTab;
