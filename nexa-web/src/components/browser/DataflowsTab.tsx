import { dataFlows } from '../../data/catalogData';
import { useCanvasStore } from '../../stores/canvasStore';
import { colors, borderRadius } from '../../theme/colors';

const DataflowsTab = () => {
  const { setViewMode, setSelectedDataFlow } = useCanvasStore();

  const handleFlowClick = (flowId: string) => {
    setViewMode('dataflow');
    setSelectedDataFlow(flowId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: colors.status.successLight, text: '#166534', border: colors.status.success };
      case 'inactive': return { bg: colors.background.secondary, text: colors.text.secondary, border: colors.border.dark };
      case 'error': return { bg: colors.status.errorLight, text: '#991b1b', border: colors.status.error };
      default: return { bg: colors.background.secondary, text: colors.text.secondary, border: colors.border.dark };
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: '600',
        color: colors.text.secondary,
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
                backgroundColor: colors.background.primary,
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.lg,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.background.secondary;
                e.currentTarget.style.borderColor = colors.border.dark;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.background.primary;
                e.currentTarget.style.borderColor = colors.border.main;
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
                  color: colors.text.primary,
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
                  borderRadius: borderRadius.sm,
                  textTransform: 'uppercase',
                }}>
                  {flow.status}
                </div>
              </div>

              <div style={{
                fontSize: '11px',
                color: colors.text.secondary,
                marginBottom: '6px',
              }}>
                → {flow.targetTable}
              </div>

              <div style={{
                fontSize: '11px',
                color: colors.text.muted,
                fontStyle: 'italic',
              }}>
                {flow.description}
              </div>

              {flow.lastRun && (
                <div style={{
                  fontSize: '10px',
                  color: colors.text.muted,
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: `1px solid ${colors.border.main}`,
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
