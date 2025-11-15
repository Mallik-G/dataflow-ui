import { useNavigate } from 'react-router-dom';
import { colors, borderRadius } from '../theme/colors';

const Dashboard = () => {
  const navigate = useNavigate();

  const stats = [
    { label: 'Active Flows', value: '12', icon: '🔄', color: '#3b82f6' },
    { label: 'Data Sources', value: '8', icon: '🗄️', color: '#10b981' },
    { label: 'Deployments', value: '24', icon: '🚀', color: '#f59e0b' },
    { label: 'Data Quality', value: '98%', icon: '✓', color: '#8b5cf6' },
  ];

  const recentFlows = [
    {
      id: 1,
      name: 'Customer 360 Transformation',
      source: 'raw.customers',
      target: 'analytics.customer_360',
      status: 'completed',
      lastRun: '2 hours ago',
    },
    {
      id: 2,
      name: 'Order Aggregation',
      source: 'raw.orders',
      target: 'staging.order_metrics',
      status: 'running',
      lastRun: '10 minutes ago',
    },
    {
      id: 3,
      name: 'Product Catalog Sync',
      source: 'raw.products',
      target: 'gold.product_master',
      status: 'failed',
      lastRun: '1 day ago',
    },
  ];

  const quickActions = [
    {
      icon: '✨',
      label: 'Create New Flow',
      description: 'Start building a new data transformation',
      action: () => navigate('/canvas'),
      color: colors.primary.main,
    },
    {
      icon: '⚡',
      label: 'Generate Artifacts',
      description: 'Convert flows to platform-specific code',
      action: () => navigate('/canvas'),
      color: '#10b981',
    },
    {
      icon: '📊',
      label: 'View Lineage',
      description: 'Explore data lineage relationships',
      action: () => navigate('/canvas'),
      color: '#f59e0b',
    },
    {
      icon: '⚙️',
      label: 'Configure Platforms',
      description: 'Set up Snowflake, Databricks, or GitHub',
      action: () => navigate('/settings'),
      color: '#8b5cf6',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'running':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return colors.text.muted;
    }
  };

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
        <h1
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: '700',
            color: colors.text.primary,
            marginBottom: '8px',
          }}
        >
          Welcome to DataFlow UI
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            color: colors.text.secondary,
          }}
        >
          Build, deploy, and monitor data transformations with AI-powered automation
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ padding: '32px 40px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '24px',
                backgroundColor: colors.background.secondary,
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.lg,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = colors.shadow.md;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: colors.text.primary,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    width: '48px',
                    height: '48px',
                    borderRadius: borderRadius.md,
                    backgroundColor: `${stat.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {stat.icon}
                </div>
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: colors.text.secondary,
                  fontWeight: '500',
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={{ marginBottom: '32px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '16px',
            }}
          >
            Quick Actions
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}
          >
            {quickActions.map((action) => (
              <div
                key={action.label}
                onClick={action.action}
                style={{
                  padding: '20px',
                  backgroundColor: colors.background.secondary,
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.lg,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = colors.shadow.md;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border.main;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  style={{
                    fontSize: '32px',
                    marginBottom: '12px',
                  }}
                >
                  {action.icon}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.text.primary,
                    marginBottom: '6px',
                  }}
                >
                  {action.label}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: colors.text.secondary,
                  }}
                >
                  {action.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Flows */}
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '16px',
            }}
          >
            Recent Flows
          </h2>
          <div
            style={{
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.lg,
              overflow: 'hidden',
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
                padding: '16px 20px',
                backgroundColor: colors.background.tertiary,
                borderBottom: `1px solid ${colors.border.main}`,
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text.secondary }}>
                FLOW NAME
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text.secondary }}>
                SOURCE
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text.secondary }}>
                TARGET
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text.secondary }}>
                STATUS
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: colors.text.secondary }}>
                LAST RUN
              </div>
            </div>

            {/* Table Rows */}
            {recentFlows.map((flow, idx) => (
              <div
                key={flow.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
                  padding: '16px 20px',
                  borderBottom:
                    idx < recentFlows.length - 1 ? `1px solid ${colors.border.light}` : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.background.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text.primary }}>
                  {flow.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: colors.text.secondary,
                  }}
                >
                  {flow.source}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: colors.text.secondary,
                  }}
                >
                  {flow.target}
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      borderRadius: borderRadius.sm,
                      backgroundColor: `${getStatusColor(flow.status)}20`,
                      color: getStatusColor(flow.status),
                      textTransform: 'capitalize',
                    }}
                  >
                    {flow.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: colors.text.secondary }}>
                  {flow.lastRun}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
