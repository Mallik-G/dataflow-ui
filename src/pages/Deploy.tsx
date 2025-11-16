import { useState } from 'react';
import { colors, borderRadius } from '../theme/colors';
import { useNavigate } from 'react-router-dom';

type Environment = 'ephemeral' | 'dev' | 'staging' | 'prod';
type DeploymentStatus = 'running' | 'completed' | 'failed' | 'queued';

interface Deployment {
  id: string;
  environment_id: Environment;
  git_branch: string;
  git_commit_sha: string;
  status: DeploymentStatus;
  deployed_by: string;
  deployed_at: string;
  completed_at?: string;
  can_promote_to?: Environment[];
}

const Deploy = () => {
  const navigate = useNavigate();
  const [deployments] = useState<Deployment[]>([
    {
      id: 'deploy-123',
      environment_id: 'dev',
      git_branch: 'feature/data-pipeline',
      git_commit_sha: 'a1b2c3d',
      status: 'completed',
      deployed_by: 'alice@company.com',
      deployed_at: '2025-01-15T10:00:00Z',
      completed_at: '2025-01-15T10:15:00Z',
      can_promote_to: ['staging'],
    },
    {
      id: 'deploy-456',
      environment_id: 'staging',
      git_branch: 'release/v2.0',
      git_commit_sha: 'x7y8z9a',
      status: 'completed',
      deployed_by: 'alice@company.com',
      deployed_at: '2025-01-15T09:00:00Z',
      completed_at: '2025-01-15T09:20:00Z',
      can_promote_to: ['prod'],
    },
    {
      id: 'deploy-789',
      environment_id: 'dev',
      git_branch: 'feature/new-tables',
      git_commit_sha: 'f4g5h6i',
      status: 'running',
      deployed_by: 'bob@company.com',
      deployed_at: '2025-01-15T11:00:00Z',
      can_promote_to: [],
    },
  ]);

  const [selectedEnv, setSelectedEnv] = useState<Environment | 'all'>('all');
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);

  const environments: Array<{ id: Environment; label: string; color: string }> = [
    { id: 'ephemeral', label: 'Ephemeral', color: '#a855f7' },
    { id: 'dev', label: 'Development', color: '#3b82f6' },
    { id: 'staging', label: 'Staging', color: '#f59e0b' },
    { id: 'prod', label: 'Production', color: '#ef4444' },
  ];

  const getStatusColor = (status: DeploymentStatus): string => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'running':
        return '#3b82f6';
      case 'failed':
        return '#ef4444';
      case 'queued':
        return '#64748b';
      default:
        return colors.text.muted;
    }
  };

  const getStatusIcon = (status: DeploymentStatus): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'running':
        return '⟳';
      case 'failed':
        return '✕';
      case 'queued':
        return '⏳';
      default:
        return '?';
    }
  };

  const getEnvironmentColor = (env: Environment): string => {
    return environments.find((e) => e.id === env)?.color || colors.text.muted;
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

  const filteredDeployments =
    selectedEnv === 'all'
      ? deployments
      : deployments.filter((d) => d.environment_id === selectedEnv);

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: colors.background.primary }}>
      {/* Header */}
      <div
        style={{
          padding: '32px 40px',
          borderBottom: `1px solid ${colors.border.main}`,
          backgroundColor: colors.background.primary,
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
              🚀 Deploy
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                color: colors.text.secondary,
              }}
            >
              Deploy data pipelines to Databricks and manage environment promotions
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => navigate('/promotions')}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                backgroundColor: colors.background.secondary,
                color: colors.text.primary,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              🔄 View Promotions
            </button>
            <button
              onClick={() => {
                // Trigger new deployment
              }}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: borderRadius.md,
                backgroundColor: colors.primary.main,
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: colors.shadow.sm,
              }}
            >
              + New Deployment
            </button>
          </div>
        </div>

        {/* Environment Filters */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedEnv('all')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              border: `1px solid ${selectedEnv === 'all' ? colors.primary.main : colors.border.main}`,
              borderRadius: borderRadius.full,
              backgroundColor: selectedEnv === 'all' ? colors.primary.lighter : colors.background.secondary,
              color: selectedEnv === 'all' ? colors.primary.main : colors.text.secondary,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            All Environments
          </button>
          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => setSelectedEnv(env.id)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                border: `1px solid ${selectedEnv === env.id ? env.color : colors.border.main}`,
                borderRadius: borderRadius.full,
                backgroundColor: selectedEnv === env.id ? `${env.color}15` : colors.background.secondary,
                color: selectedEnv === env.id ? env.color : colors.text.secondary,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {env.label}
            </button>
          ))}
        </div>
      </div>

      {/* Environment Overview */}
      <div style={{ padding: '24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {environments.map((env) => {
            const envDeployments = deployments.filter((d) => d.environment_id === env.id);
            const latestDeployment = envDeployments[0];

            return (
              <div
                key={env.id}
                style={{
                  padding: '20px',
                  backgroundColor: colors.background.secondary,
                  border: `2px solid ${env.color}`,
                  borderRadius: borderRadius.lg,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: env.color,
                    }}
                  />
                  <div style={{ fontSize: '14px', fontWeight: '600', color: env.color, textTransform: 'uppercase' }}>
                    {env.label}
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text.primary, marginBottom: '8px' }}>
                  {envDeployments.length}
                </div>
                <div style={{ fontSize: '11px', color: colors.text.muted }}>
                  {latestDeployment
                    ? `Last: ${formatTimestamp(latestDeployment.deployed_at)}`
                    : 'No deployments'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Deployments List */}
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text.primary, marginBottom: '16px' }}>
          Recent Deployments
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredDeployments.map((deployment) => (
            <div
              key={deployment.id}
              style={{
                padding: '20px',
                backgroundColor: colors.background.secondary,
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.lg,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.primary.main;
                e.currentTarget.style.boxShadow = colors.shadow.sm;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border.main;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  {/* Environment Badge */}
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: borderRadius.md,
                      backgroundColor: `${getEnvironmentColor(deployment.environment_id)}15`,
                      color: getEnvironmentColor(deployment.environment_id),
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      marginBottom: '12px',
                    }}
                  >
                    {deployment.environment_id}
                  </div>

                  {/* Git Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text.primary, fontFamily: 'monospace' }}>
                      {deployment.git_branch}
                    </span>
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
                      {deployment.git_commit_sha}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div style={{ fontSize: '13px', color: colors.text.secondary }}>
                    Deployed by <span style={{ fontWeight: '600' }}>{deployment.deployed_by}</span> at{' '}
                    {formatTimestamp(deployment.deployed_at)}
                    {deployment.completed_at && ` • Completed at ${formatTimestamp(deployment.completed_at)}`}
                  </div>
                </div>

                {/* Status and Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Status Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: borderRadius.full,
                      backgroundColor: `${getStatusColor(deployment.status)}15`,
                      fontSize: '13px',
                      fontWeight: '600',
                      color: getStatusColor(deployment.status),
                    }}
                  >
                    <span>{getStatusIcon(deployment.status)}</span>
                    <span style={{ textTransform: 'capitalize' }}>{deployment.status}</span>
                  </div>

                  {/* Promote Button */}
                  {deployment.status === 'completed' && deployment.can_promote_to && deployment.can_promote_to.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedDeployment(deployment);
                        setShowPromoteModal(true);
                      }}
                      style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: '600',
                        border: 'none',
                        borderRadius: borderRadius.md,
                        backgroundColor: colors.primary.main,
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>🔄</span>
                      <span>Promote</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredDeployments.length === 0 && (
          <div
            style={{
              padding: '60px',
              textAlign: 'center',
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.text.primary, marginBottom: '8px' }}>
              No deployments found
            </h3>
            <p style={{ fontSize: '14px', color: colors.text.secondary, marginBottom: '20px' }}>
              {selectedEnv === 'all'
                ? 'Start by creating your first deployment'
                : `No deployments in ${environments.find((e) => e.id === selectedEnv)?.label}`}
            </p>
            <button
              onClick={() => {
                // Create deployment
              }}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: borderRadius.md,
                backgroundColor: colors.primary.main,
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              + Create Deployment
            </button>
          </div>
        )}
      </div>

      {/* Promote Modal */}
      {showPromoteModal && selectedDeployment && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowPromoteModal(false)}
        >
          <div
            style={{
              backgroundColor: colors.background.primary,
              borderRadius: borderRadius.xl,
              boxShadow: colors.shadow.xl,
              width: '90%',
              maxWidth: '600px',
              padding: '32px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: colors.text.primary }}>
              Promote Deployment
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: colors.text.secondary }}>
              Promote this deployment to the next environment
            </p>

            {/* Current Deployment Info */}
            <div
              style={{
                padding: '16px',
                backgroundColor: colors.background.secondary,
                borderRadius: borderRadius.md,
                marginBottom: '24px',
              }}
            >
              <div style={{ fontSize: '12px', color: colors.text.muted, marginBottom: '8px' }}>FROM</div>
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: `${getEnvironmentColor(selectedDeployment.environment_id)}15`,
                  color: getEnvironmentColor(selectedDeployment.environment_id),
                  fontSize: '14px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  borderRadius: borderRadius.sm,
                  display: 'inline-block',
                  marginBottom: '12px',
                }}
              >
                {selectedDeployment.environment_id}
              </div>
              <div style={{ fontSize: '13px', color: colors.text.primary, fontFamily: 'monospace' }}>
                {selectedDeployment.git_branch} @ {selectedDeployment.git_commit_sha}
              </div>
            </div>

            {/* Target Environment Selection */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: colors.text.muted, marginBottom: '12px' }}>TO</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedDeployment.can_promote_to?.map((targetEnv) => (
                  <button
                    key={targetEnv}
                    onClick={() => {
                      // Create promotion request
                      console.log(`Promoting to ${targetEnv}`);
                      setShowPromoteModal(false);
                      navigate('/promotions');
                    }}
                    style={{
                      padding: '16px',
                      border: `2px solid ${getEnvironmentColor(targetEnv)}`,
                      borderRadius: borderRadius.md,
                      backgroundColor: `${getEnvironmentColor(targetEnv)}10`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${getEnvironmentColor(targetEnv)}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = `${getEnvironmentColor(targetEnv)}10`;
                    }}
                  >
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: getEnvironmentColor(targetEnv),
                        textTransform: 'uppercase',
                      }}
                    >
                      {targetEnv}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.text.secondary, marginTop: '4px' }}>
                      {targetEnv === 'staging' && 'Requires 1 approval'}
                      {targetEnv === 'prod' && 'Requires 2 approvals'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowPromoteModal(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.secondary,
                  color: colors.text.primary,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deploy;
