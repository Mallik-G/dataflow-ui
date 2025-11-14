import { useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { TransformNodeData } from '../../types';
import { colors, borderRadius } from '../../theme/colors';

type TabType = 'sql' | 'metrics' | 'approval' | 'explanation';

const BottomPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('sql');
  const selectedNode = useCanvasStore(state => state.selectedNode);

  if (!selectedNode) return null;

  const nodeData = selectedNode.data;
  const isTransform = selectedNode.type === 'transform';
  const transformData = isTransform ? (nodeData as TransformNodeData) : null;

  const tabStyle = (tab: TabType) => ({
    padding: '8px 16px',
    backgroundColor: activeTab === tab ? colors.background.tertiary : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? `2px solid ${colors.primary.main}` : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    color: activeTab === tab ? colors.text.primary : colors.text.secondary,
    transition: 'all 0.2s ease',
  });

  const generateSQL = () => {
    if (!transformData) return '';

    const userEditComments = transformData.userEdits?.map(edit =>
      `-- ⚠️ USER MODIFIED (${edit.editedBy} on ${new Date(edit.editedAt).toLocaleDateString()})
-- Reason: ${edit.reason || 'No reason provided'}
${edit.modifiedCode}
-- END USER MODIFICATION\n`
    ).join('\n') || '';

    return `-- LLM Generated Transformation
-- Confidence: ${transformData.llmMetadata?.confidence || 0}%
-- Generated: ${transformData.llmMetadata?.generatedAt || 'Unknown'}
${transformData.isUserModified ? '\n' + userEditComments : ''}
SELECT
  ${transformData.expression}
FROM source_table;`;
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: '320px',
      right: '360px',
      backgroundColor: colors.background.tertiary,
      borderTop: `1px solid ${colors.border.main}`,
      zIndex: 20,
      boxShadow: colors.shadow.lg,
    }}>
      {/* Collapse/Expand Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '8px 16px',
          backgroundColor: colors.background.primary,
          borderBottom: `1px solid ${colors.border.main}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{isExpanded ? '▼' : '▲'}</span>
          <span style={{ fontWeight: '600', fontSize: '13px', color: colors.text.primary }}>
            {selectedNode.data.label}
          </span>
          {transformData?.isUserModified && (
            <span style={{
              fontSize: '10px',
              padding: '2px 8px',
              backgroundColor: colors.status.warningLight,
              color: '#92400e',
              borderRadius: borderRadius.sm,
              fontWeight: '600',
            }}>
              ✏️ USER MODIFIED
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: colors.text.secondary }}>
          {isExpanded ? 'Click to collapse' : 'Click to expand details'}
        </div>
      </div>

      {/* Panel Content */}
      {isExpanded && (
        <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: `1px solid ${colors.border.main}`,
            backgroundColor: colors.background.primary,
          }}>
            <button style={tabStyle('sql')} onClick={() => setActiveTab('sql')}>
              📝 SQL Code
            </button>
            <button style={tabStyle('explanation')} onClick={() => setActiveTab('explanation')}>
              💡 LLM Explanation
            </button>
            <button style={tabStyle('metrics')} onClick={() => setActiveTab('metrics')}>
              📊 Metrics
            </button>
            <button style={tabStyle('approval')} onClick={() => setActiveTab('approval')}>
              ✅ Approval
            </button>
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {activeTab === 'sql' && isTransform && (
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text.primary }}>
                    Generated SQL
                  </div>
                  <button
                    style={{
                      padding: '6px 12px',
                      backgroundColor: colors.background.secondary,
                      border: `1px solid ${colors.border.dark}`,
                      borderRadius: borderRadius.md,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigator.clipboard.writeText(generateSQL())}
                  >
                    📋 Copy
                  </button>
                </div>
                <pre style={{
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  padding: '16px',
                  borderRadius: borderRadius.lg,
                  fontSize: '12px',
                  fontFamily: 'Monaco, Consolas, monospace',
                  overflow: 'auto',
                  lineHeight: '1.6',
                }}>
                  {generateSQL()}
                </pre>

                {transformData && transformData.userEdits && transformData.userEdits.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#92400e',
                      marginBottom: '8px',
                    }}>
                      ⚠️ User Modifications ({transformData.userEdits.length})
                    </div>
                    {transformData.userEdits.map((edit, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        backgroundColor: colors.status.warningLight,
                        border: `1px solid ${colors.status.warning}`,
                        borderRadius: borderRadius.md,
                        marginBottom: '8px',
                      }}>
                        <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>
                          Edited by {edit.editedBy} on {new Date(edit.editedAt).toLocaleString()}
                        </div>
                        {edit.reason && (
                          <div style={{ fontSize: '12px', color: '#713f12', fontStyle: 'italic' }}>
                            Reason: {edit.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'explanation' && (
              <div>
                <div style={{
                  padding: '16px',
                  backgroundColor: colors.status.infoLight,
                  border: `1px solid ${colors.status.info}`,
                  borderRadius: borderRadius.lg,
                  marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af', marginBottom: '8px' }}>
                    💡 Why this transformation?
                  </div>
                  <div style={{ fontSize: '13px', color: colors.text.primary, lineHeight: '1.6' }}>
                    {transformData?.llmMetadata?.explanation || nodeData.llmMetadata?.explanation ||
                     'This transformation was generated to process data according to business requirements.'}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text.secondary, marginBottom: '8px' }}>
                    Confidence Level
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      flex: 1,
                      height: '8px',
                      backgroundColor: colors.border.main,
                      borderRadius: borderRadius.sm,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${transformData?.llmMetadata?.confidence || nodeData.llmMetadata?.confidence || 0}%`,
                        height: '100%',
                        backgroundColor: (transformData?.llmMetadata?.confidence || nodeData.llmMetadata?.confidence || 0) > 80 ? colors.status.success :
                                       (transformData?.llmMetadata?.confidence || nodeData.llmMetadata?.confidence || 0) > 60 ? colors.status.warning : colors.status.error,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text.primary, minWidth: '45px' }}>
                      {transformData?.llmMetadata?.confidence || nodeData.llmMetadata?.confidence || 0}%
                    </div>
                  </div>
                </div>

                {transformData?.llmMetadata?.warnings && transformData.llmMetadata.warnings.length > 0 && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: colors.status.warningLight,
                    border: `1px solid ${colors.status.warning}`,
                    borderRadius: borderRadius.lg,
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                      ⚠️ Warnings
                    </div>
                    {transformData.llmMetadata.warnings.map((warning, idx) => (
                      <div key={idx} style={{ fontSize: '12px', color: '#713f12', marginBottom: '4px' }}>
                        • {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'metrics' && (
              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px',
                }}>
                  <MetricCard
                    label="Input Rows"
                    value={nodeData.executionState?.rowCountIn?.toLocaleString() || 'N/A'}
                    icon="📥"
                  />
                  <MetricCard
                    label="Output Rows"
                    value={nodeData.executionState?.rowCountOut?.toLocaleString() || 'N/A'}
                    icon="📤"
                  />
                  <MetricCard
                    label="Duration"
                    value={nodeData.executionState?.duration ? `${nodeData.executionState.duration}s` : 'N/A'}
                    icon="⏱️"
                  />
                  <MetricCard
                    label="Data Quality"
                    value={nodeData.executionState?.dataQualityScore ? `${nodeData.executionState.dataQualityScore}%` : 'N/A'}
                    icon="✓"
                  />
                </div>

                {nodeData.executionState?.lastRun && (
                  <div style={{ marginTop: '16px', fontSize: '12px', color: colors.text.secondary }}>
                    Last run: {new Date(nodeData.executionState.lastRun).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'approval' && (
              <ApprovalTab nodeData={nodeData} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
  <div style={{
    padding: '16px',
    backgroundColor: colors.background.secondary,
    border: `1px solid ${colors.border.main}`,
    borderRadius: borderRadius.lg,
  }}>
    <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
    <div style={{ fontSize: '11px', color: colors.text.secondary, marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '20px', fontWeight: '600', color: colors.text.primary }}>{value}</div>
  </div>
);

const ApprovalTab = ({ nodeData }: { nodeData: any }) => {
  const approvalState = nodeData.approvalState;

  return (
    <div>
      <div style={{
        padding: '16px',
        backgroundColor: approvalState?.status === 'approved' ? colors.status.successLight :
                       approvalState?.status === 'rejected' ? colors.status.errorLight :
                       approvalState?.status === 'changes_requested' ? colors.status.warningLight : colors.background.secondary,
        border: `1px solid ${approvalState?.status === 'approved' ? colors.status.success :
                              approvalState?.status === 'rejected' ? colors.status.error :
                              approvalState?.status === 'changes_requested' ? colors.status.warning : colors.border.dark}`,
        borderRadius: borderRadius.lg,
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text.primary, marginBottom: '8px' }}>
          Review Status: {approvalState?.status?.replace(/_/g, ' ').toUpperCase() || 'PENDING REVIEW'}
        </div>
        {approvalState?.reviewer && (
          <div style={{ fontSize: '12px', color: colors.text.secondary }}>
            Reviewed by {approvalState.reviewer} on {new Date(approvalState.reviewedAt!).toLocaleString()}
          </div>
        )}
      </div>

      {(!approvalState || approvalState.status === 'pending_review') && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: colors.text.primary, marginBottom: '12px' }}>
            Review Checklist
          </div>
          <div style={{ marginBottom: '16px' }}>
            {['Business logic correct', 'Join conditions validated', 'Data quality rules appropriate', 'Performance acceptable'].map((item, idx) => (
              <div key={idx} style={{
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <input type="checkbox" />
                <span style={{ fontSize: '13px', color: colors.text.primary }}>{item}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{
              flex: 1,
              padding: '12px',
              backgroundColor: colors.status.success,
              color: '#ffffff',
              border: 'none',
              borderRadius: borderRadius.lg,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>
              ✓ Approve Pipeline
            </button>
            <button style={{
              flex: 1,
              padding: '12px',
              backgroundColor: colors.status.warning,
              color: '#ffffff',
              border: 'none',
              borderRadius: borderRadius.lg,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>
              🔄 Request Changes
            </button>
            <button style={{
              flex: 1,
              padding: '12px',
              backgroundColor: colors.status.error,
              color: '#ffffff',
              border: 'none',
              borderRadius: borderRadius.lg,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}>
              ✗ Reject
            </button>
          </div>
        </div>
      )}

      {approvalState?.feedback && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.border.main}`,
          borderRadius: borderRadius.lg,
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text.secondary, marginBottom: '4px' }}>
            Feedback:
          </div>
          <div style={{ fontSize: '13px', color: colors.text.primary }}>
            {approvalState.feedback}
          </div>
        </div>
      )}
    </div>
  );
};

export default BottomPanel;
