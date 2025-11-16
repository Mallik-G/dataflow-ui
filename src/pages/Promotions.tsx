import { useState } from 'react';
import { colors, borderRadius } from '../theme/colors';

type PromotionStatus = 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'deploying' | 'deployed' | 'failed';
type Environment = 'ephemeral' | 'dev' | 'staging' | 'prod';

interface Approval {
  id: string;
  approver_id: string;
  approver_email: string;
  decision: 'pending' | 'approved' | 'rejected';
  decision_at?: string;
  notes?: string;
}

interface Promotion {
  id: string;
  source_deployment_id: string;
  source_environment_id: Environment;
  target_environment_id: Environment;
  git_commit_sha: string;
  git_branch: string;
  requested_by: string;
  requested_at: string;
  status: PromotionStatus;
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  deployed_at?: string;
  error_message?: string;
  approvals?: Approval[];
}

const Promotions = () => {
  const [promotions] = useState<Promotion[]>([
    {
      id: 'promo-1',
      source_deployment_id: 'deploy-123',
      source_environment_id: 'dev',
      target_environment_id: 'staging',
      git_commit_sha: 'a1b2c3d',
      git_branch: 'feature/data-pipeline',
      requested_by: 'alice@company.com',
      requested_at: '2025-01-15T10:30:00Z',
      status: 'pending_approval',
      requires_approval: true,
      approvals: [
        {
          id: 'app-1',
          approver_id: 'tech-lead-bob',
          approver_email: 'bob@company.com',
          decision: 'pending',
        },
      ],
    },
    {
      id: 'promo-2',
      source_deployment_id: 'deploy-456',
      source_environment_id: 'staging',
      target_environment_id: 'prod',
      git_commit_sha: 'x7y8z9a',
      git_branch: 'release/v2.0',
      requested_by: 'alice@company.com',
      requested_at: '2025-01-15T09:00:00Z',
      status: 'approved',
      requires_approval: true,
      approved_by: 'manager-charlie',
      approved_at: '2025-01-15T09:45:00Z',
      approvals: [
        {
          id: 'app-2',
          approver_id: 'tech-lead-bob',
          approver_email: 'bob@company.com',
          decision: 'approved',
          decision_at: '2025-01-15T09:30:00Z',
          notes: 'All tests passed, looks good',
        },
        {
          id: 'app-3',
          approver_id: 'manager-charlie',
          approver_email: 'charlie@company.com',
          decision: 'approved',
          decision_at: '2025-01-15T09:45:00Z',
          notes: 'Business approved',
        },
      ],
    },
    {
      id: 'promo-3',
      source_deployment_id: 'deploy-789',
      source_environment_id: 'dev',
      target_environment_id: 'staging',
      git_commit_sha: 'f4g5h6i',
      git_branch: 'feature/new-tables',
      requested_by: 'bob@company.com',
      requested_at: '2025-01-14T14:00:00Z',
      status: 'deployed',
      requires_approval: true,
      approved_by: 'tech-lead-alice',
      approved_at: '2025-01-14T14:30:00Z',
      deployed_at: '2025-01-14T14:45:00Z',
    },
  ]);

  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [filterStatus, setFilterStatus] = useState<PromotionStatus | 'all'>('all');

  const getStatusColor = (status: PromotionStatus): string => {
    switch (status) {
      case 'deployed':
        return '#10b981';
      case 'approved':
        return '#3b82f6';
      case 'pending_approval':
        return '#f59e0b';
      case 'pending':
        return '#64748b';
      case 'deploying':
        return '#8b5cf6';
      case 'rejected':
        return '#ef4444';
      case 'failed':
        return '#ef4444';
      default:
        return colors.text.muted;
    }
  };

  const getStatusIcon = (status: PromotionStatus): string => {
    switch (status) {
      case 'deployed':
        return '✓';
      case 'approved':
        return '👍';
      case 'pending_approval':
        return '⏳';
      case 'pending':
        return '○';
      case 'deploying':
        return '🚀';
      case 'rejected':
        return '✕';
      case 'failed':
        return '⚠';
      default:
        return '?';
    }
  };

  const getEnvironmentColor = (env: Environment): string => {
    switch (env) {
      case 'ephemeral':
        return '#a855f7';
      case 'dev':
        return '#3b82f6';
      case 'staging':
        return '#f59e0b';
      case 'prod':
        return '#ef4444';
      default:
        return colors.text.muted;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredPromotions =
    filterStatus === 'all'
      ? promotions
      : promotions.filter((p) => p.status === filterStatus);

  const statusOptions: Array<{ value: PromotionStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pending_approval', label: 'Pending Approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'deploying', label: 'Deploying' },
    { value: 'deployed', label: 'Deployed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'failed', label: 'Failed' },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: colors.background.primary }}>
      {/* Header */}
      <div
        style={{
          padding: '32px 40px',
          borderBottom: `1px solid ${colors.border.main}`,
          backgroundColor: colors.background.primary,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: '700',
                color: colors.text.primary,
                marginBottom: '8px',
              }}
            >
              🔄 Deployment Promotions
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                color: colors.text.secondary,
              }}
            >
              Track and approve deployment promotions across environments
            </p>
          </div>
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', flexWrap: 'wrap' }}>
          {statusOptions.map((option) => {
            const isActive = filterStatus === option.value;

            return (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value)}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: `1px solid ${isActive ? colors.primary.main : colors.border.main}`,
                  borderRadius: borderRadius.full,
                  backgroundColor: isActive ? colors.primary.lighter : colors.background.secondary,
                  color: isActive ? colors.primary.main : colors.text.secondary,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Promotion Stats */}
      <div style={{ padding: '24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div
            style={{
              padding: '20px',
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>Pending Approval</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>
              {promotions.filter((p) => p.status === 'pending_approval').length}
            </div>
          </div>
          <div
            style={{
              padding: '20px',
              backgroundColor: '#dbeafe',
              border: '1px solid #3b82f6',
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '13px', color: '#1e40af', marginBottom: '8px' }}>Approved</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>
              {promotions.filter((p) => p.status === 'approved').length}
            </div>
          </div>
          <div
            style={{
              padding: '20px',
              backgroundColor: '#ede9fe',
              border: '1px solid #8b5cf6',
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '13px', color: '#5b21b6', marginBottom: '8px' }}>Deploying</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>
              {promotions.filter((p) => p.status === 'deploying').length}
            </div>
          </div>
          <div
            style={{
              padding: '20px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '13px', color: '#065f46', marginBottom: '8px' }}>Deployed</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>
              {promotions.filter((p) => p.status === 'deployed').length}
            </div>
          </div>
          <div
            style={{
              padding: '20px',
              backgroundColor: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '8px' }}>Failed/Rejected</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444' }}>
              {promotions.filter((p) => p.status === 'failed' || p.status === 'rejected').length}
            </div>
          </div>
        </div>

        {/* Promotions Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredPromotions.map((promotion) => (
            <div
              key={promotion.id}
              style={{
                padding: '24px',
                backgroundColor: colors.background.secondary,
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.lg,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.primary.main;
                e.currentTarget.style.boxShadow = colors.shadow.md;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border.main;
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => setSelectedPromotion(promotion)}
            >
              {/* Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                  {/* Environment Flow */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        padding: '8px 16px',
                        borderRadius: borderRadius.md,
                        backgroundColor: `${getEnvironmentColor(promotion.source_environment_id)}15`,
                        color: getEnvironmentColor(promotion.source_environment_id),
                        fontSize: '13px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}
                    >
                      {promotion.source_environment_id}
                    </div>
                    <span style={{ fontSize: '20px', color: colors.text.muted }}>→</span>
                    <div
                      style={{
                        padding: '8px 16px',
                        borderRadius: borderRadius.md,
                        backgroundColor: `${getEnvironmentColor(promotion.target_environment_id)}15`,
                        color: getEnvironmentColor(promotion.target_environment_id),
                        fontSize: '13px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}
                    >
                      {promotion.target_environment_id}
                    </div>
                  </div>

                  {/* Git Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', color: colors.text.muted }}>Branch:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text.primary, fontFamily: 'monospace' }}>
                      {promotion.git_branch}
                    </span>
                    <span style={{ fontSize: '14px', color: colors.text.muted }}>@</span>
                    <span
                      style={{
                        padding: '4px 8px',
                        backgroundColor: colors.background.tertiary,
                        borderRadius: borderRadius.sm,
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: colors.text.secondary,
                      }}
                    >
                      {promotion.git_commit_sha}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: borderRadius.full,
                    backgroundColor: `${getStatusColor(promotion.status)}15`,
                    fontSize: '13px',
                    fontWeight: '600',
                    color: getStatusColor(promotion.status),
                  }}
                >
                  <span>{getStatusIcon(promotion.status)}</span>
                  <span style={{ textTransform: 'capitalize' }}>{promotion.status.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Info Row */}
              <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: colors.text.secondary, marginBottom: '16px' }}>
                <div>
                  <span style={{ fontWeight: '600' }}>Requested by:</span> {promotion.requested_by}
                </div>
                <div>
                  <span style={{ fontWeight: '600' }}>Requested:</span> {formatTimestamp(promotion.requested_at)}
                </div>
                {promotion.approved_at && (
                  <div>
                    <span style={{ fontWeight: '600' }}>Approved:</span> {formatTimestamp(promotion.approved_at)}
                  </div>
                )}
                {promotion.deployed_at && (
                  <div>
                    <span style={{ fontWeight: '600' }}>Deployed:</span> {formatTimestamp(promotion.deployed_at)}
                  </div>
                )}
              </div>

              {/* Approvals Section */}
              {promotion.approvals && promotion.approvals.length > 0 && (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: colors.background.tertiary,
                    borderRadius: borderRadius.md,
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text.secondary, marginBottom: '12px', textTransform: 'uppercase' }}>
                    Approvals ({promotion.approvals.filter((a) => a.decision === 'approved').length}/{promotion.approvals.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {promotion.approvals.map((approval) => (
                      <div
                        key={approval.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          backgroundColor: colors.background.primary,
                          borderRadius: borderRadius.sm,
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', color: colors.text.primary }}>{approval.approver_email}</span>
                          {approval.notes && <span style={{ color: colors.text.muted }}>- {approval.notes}</span>}
                        </div>
                        <div
                          style={{
                            padding: '4px 10px',
                            borderRadius: borderRadius.full,
                            backgroundColor:
                              approval.decision === 'approved'
                                ? '#ecfdf5'
                                : approval.decision === 'rejected'
                                ? '#fee2e2'
                                : '#f3f4f6',
                            color:
                              approval.decision === 'approved'
                                ? '#10b981'
                                : approval.decision === 'rejected'
                                ? '#ef4444'
                                : '#64748b',
                            fontWeight: '600',
                          }}
                        >
                          {approval.decision === 'approved' ? '✓ Approved' : approval.decision === 'rejected' ? '✕ Rejected' : '⏳ Pending'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {promotion.status === 'pending_approval' && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button
                    style={{
                      padding: '10px 20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: borderRadius.md,
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Approve logic
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    style={{
                      padding: '10px 20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: `1px solid ${colors.border.main}`,
                      borderRadius: borderRadius.md,
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Reject logic
                    }}
                  >
                    ✕ Reject
                  </button>
                </div>
              )}

              {promotion.status === 'approved' && (
                <div style={{ marginTop: '16px' }}>
                  <button
                    style={{
                      padding: '10px 20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.primary.main,
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Execute deployment
                    }}
                  >
                    🚀 Execute Deployment
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredPromotions.length === 0 && (
          <div
            style={{
              padding: '60px',
              textAlign: 'center',
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.text.primary, marginBottom: '8px' }}>
              No promotions found
            </h3>
            <p style={{ fontSize: '14px', color: colors.text.secondary }}>
              {filterStatus === 'all'
                ? 'No promotions have been requested yet'
                : `No promotions with status: ${filterStatus}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Promotions;
