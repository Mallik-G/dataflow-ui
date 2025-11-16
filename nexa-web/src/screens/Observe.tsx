import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, borderRadius } from '../theme/colors';

interface JobStats {
  total_jobs: number;
  failed_jobs: number;
  running_jobs: number;
  succeeded_jobs: number;
  overdue_jobs: number;
  jobs_needing_attention: number;
}

interface PipelineStats {
  total_pipelines: number;
  healthy_pipelines: number;
  unhealthy_pipelines: number;
  running_pipelines: number;
  failed_pipelines: number;
}

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'success' | 'warning' | 'error' | 'info';
  onClick?: () => void;
}

const KPICard = ({ title, value, subtitle, icon, trend, status = 'info', onClick }: KPICardProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#3b82f6';
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: colors.background.secondary,
        border: `1px solid ${colors.border.main}`,
        borderRadius: borderRadius.lg,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '32px' }}>{icon}</div>
        {trend && (
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : colors.text.secondary,
            }}
          >
            {getTrendIcon()}
          </div>
        )}
      </div>
      <div>
        <div
          style={{
            fontSize: '32px',
            fontWeight: '700',
            color: getStatusColor(),
            lineHeight: '1.2',
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: colors.text.primary,
            marginTop: '4px',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '12px',
              color: colors.text.secondary,
              marginTop: '4px',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

const Observe = () => {
  const navigate = useNavigate();
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch job stats
      const jobsResponse = await fetch('/api/v1/jobs?limit=1000');
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setJobStats(jobsData.stats);
      }

      // Fetch pipeline stats
      const pipelinesResponse = await fetch('/api/v1/pipelines?max_results=1000');
      if (pipelinesResponse.ok) {
        const pipelinesData = await pipelinesResponse.json();
        const pipelines = pipelinesData.statuses || [];

        const stats: PipelineStats = {
          total_pipelines: pipelines.length,
          healthy_pipelines: pipelines.filter((p: any) => p.health === 'HEALTHY').length,
          unhealthy_pipelines: pipelines.filter((p: any) => p.health === 'UNHEALTHY').length,
          running_pipelines: pipelines.filter((p: any) => p.state === 'RUNNING').length,
          failed_pipelines: pipelines.filter((p: any) => p.state === 'FAILED').length,
        };
        setPipelineStats(stats);
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError('Failed to fetch observability data');
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getHealthPercentage = () => {
    if (!jobStats) return 0;
    if (jobStats.total_jobs === 0) return 100;
    return Math.round(((jobStats.succeeded_jobs) / jobStats.total_jobs) * 100);
  };

  const getPipelineHealthPercentage = () => {
    if (!pipelineStats) return 0;
    if (pipelineStats.total_pipelines === 0) return 100;
    return Math.round((pipelineStats.healthy_pipelines / pipelineStats.total_pipelines) * 100);
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: colors.background.primary }}>
      {/* Header */}
      <div
        style={{
          padding: '32px 40px',
          borderBottom: `1px solid ${colors.border.main}`,
          backgroundColor: colors.background.primary,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
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
            👁️ Observe
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '15px',
              color: colors.text.secondary,
            }}
          >
            Monitor data pipelines, track metrics, and view execution health
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: colors.text.secondary }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.md,
              color: colors.text.primary,
              fontSize: '14px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 40px' }}>
        {error && (
          <div
            style={{
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: borderRadius.md,
              padding: '16px',
              marginBottom: '24px',
              color: '#c00',
            }}
          >
            {error}
          </div>
        )}

        {/* Overall Health */}
        <div style={{ marginBottom: '32px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '16px',
            }}
          >
            🎯 Overall Health
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <KPICard
              title="System Health"
              value={`${getHealthPercentage()}%`}
              subtitle="Job success rate"
              icon="💚"
              status={getHealthPercentage() >= 90 ? 'success' : getHealthPercentage() >= 70 ? 'warning' : 'error'}
            />
            <KPICard
              title="Pipeline Health"
              value={`${getPipelineHealthPercentage()}%`}
              subtitle="Healthy pipelines"
              icon="🔋"
              status={getPipelineHealthPercentage() >= 90 ? 'success' : getPipelineHealthPercentage() >= 70 ? 'warning' : 'error'}
            />
            <KPICard
              title="Attention Required"
              value={jobStats?.jobs_needing_attention || 0}
              subtitle="Jobs with issues"
              icon="⚠️"
              status={(jobStats?.jobs_needing_attention || 0) === 0 ? 'success' : 'warning'}
            />
          </div>
        </div>

        {/* Jobs Dashboard */}
        <div style={{ marginBottom: '32px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '16px',
            }}
          >
            📊 Jobs Dashboard
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <KPICard
              title="Total Jobs"
              value={jobStats?.total_jobs || 0}
              icon="📦"
              status="info"
              onClick={() => navigate('/jobs')}
            />
            <KPICard
              title="Running"
              value={jobStats?.running_jobs || 0}
              subtitle="Currently executing"
              icon="▶️"
              status="info"
              onClick={() => navigate('/jobs?status=running')}
            />
            <KPICard
              title="Succeeded"
              value={jobStats?.succeeded_jobs || 0}
              subtitle="Last run successful"
              icon="✅"
              status="success"
              onClick={() => navigate('/jobs?status=succeeded')}
            />
            <KPICard
              title="Failed"
              value={jobStats?.failed_jobs || 0}
              subtitle="Consecutive failures"
              icon="❌"
              status={(jobStats?.failed_jobs || 0) > 0 ? 'error' : 'success'}
              onClick={() => navigate('/jobs?status=failed')}
            />
            <KPICard
              title="Overdue"
              value={jobStats?.overdue_jobs || 0}
              subtitle="Past expected run time"
              icon="⏰"
              status={(jobStats?.overdue_jobs || 0) > 0 ? 'warning' : 'success'}
              onClick={() => navigate('/jobs?status=overdue')}
            />
          </div>
        </div>

        {/* Pipelines Dashboard */}
        <div style={{ marginBottom: '32px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '16px',
            }}
          >
            🚀 Pipelines Dashboard
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <KPICard
              title="Total Pipelines"
              value={pipelineStats?.total_pipelines || 0}
              icon="🔄"
              status="info"
              onClick={() => navigate('/pipelines')}
            />
            <KPICard
              title="Healthy"
              value={pipelineStats?.healthy_pipelines || 0}
              subtitle="Operating normally"
              icon="💚"
              status="success"
              onClick={() => navigate('/pipelines?health=HEALTHY')}
            />
            <KPICard
              title="Unhealthy"
              value={pipelineStats?.unhealthy_pipelines || 0}
              subtitle="Needs attention"
              icon="🔴"
              status={(pipelineStats?.unhealthy_pipelines || 0) > 0 ? 'error' : 'success'}
              onClick={() => navigate('/pipelines?health=UNHEALTHY')}
            />
            <KPICard
              title="Running"
              value={pipelineStats?.running_pipelines || 0}
              subtitle="Currently processing"
              icon="⚡"
              status="info"
              onClick={() => navigate('/pipelines?state=RUNNING')}
            />
            <KPICard
              title="Failed"
              value={pipelineStats?.failed_pipelines || 0}
              subtitle="Pipeline failures"
              icon="💥"
              status={(pipelineStats?.failed_pipelines || 0) > 0 ? 'error' : 'success'}
              onClick={() => navigate('/pipelines?state=FAILED')}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '16px',
            }}
          >
            ⚡ Quick Actions
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.href = '/jobs'}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.background.secondary,
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              📋 View All Jobs
            </button>
            <button
              onClick={() => window.location.href = '/data-flow'}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.background.secondary,
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              🔄 View All Pipelines
            </button>
            <button
              onClick={fetchStats}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.background.secondary,
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              📊 Refresh Metrics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Observe;
