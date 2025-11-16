import { useState } from 'react';
import { colors, borderRadius } from '../theme/colors';

type ConnectionType =
  | 'databricks'
  | 'snowflake'
  | 's3'
  | 'gcs'
  | 'azure-blob'
  | 'kafka'
  | 'kinesis'
  | 'postgres'
  | 'mysql'
  | 'bigquery'
  | 'redshift';

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing';

interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  status: ConnectionStatus;
  description?: string;
  lastTested?: string;
  createdAt: string;
  config: Record<string, any>;
}

const Connections = () => {
  const [connections, setConnections] = useState<Connection[]>([
    {
      id: '1',
      name: 'Production Databricks',
      type: 'databricks',
      status: 'connected',
      description: 'Main production Databricks workspace',
      lastTested: '2025-01-15T10:30:00Z',
      createdAt: '2025-01-10T09:00:00Z',
      config: { host: 'dbc-xxxxx.cloud.databricks.com' },
    },
    {
      id: '2',
      name: 'Snowflake Data Warehouse',
      type: 'snowflake',
      status: 'connected',
      description: 'Central data warehouse',
      lastTested: '2025-01-15T11:00:00Z',
      createdAt: '2025-01-08T14:00:00Z',
      config: { account: 'xy12345', warehouse: 'COMPUTE_WH' },
    },
    {
      id: '3',
      name: 'Raw Data S3 Bucket',
      type: 's3',
      status: 'connected',
      description: 'Landing zone for raw data files',
      lastTested: '2025-01-15T09:45:00Z',
      createdAt: '2025-01-05T16:00:00Z',
      config: { bucket: 'raw-data-prod', region: 'us-east-1' },
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [filterType, setFilterType] = useState<ConnectionType | 'all'>('all');

  const connectionTypeConfig: Record<ConnectionType, { icon: string; label: string; color: string; category: string }> = {
    databricks: { icon: '🧱', label: 'Databricks', color: '#FF3621', category: 'Compute' },
    snowflake: { icon: '❄️', label: 'Snowflake', color: '#29B5E8', category: 'Warehouse' },
    bigquery: { icon: '🔍', label: 'BigQuery', color: '#4285F4', category: 'Warehouse' },
    redshift: { icon: '🔴', label: 'Redshift', color: '#8C4FFF', category: 'Warehouse' },
    postgres: { icon: '🐘', label: 'PostgreSQL', color: '#336791', category: 'Database' },
    mysql: { icon: '🐬', label: 'MySQL', color: '#4479A1', category: 'Database' },
    s3: { icon: '📦', label: 'Amazon S3', color: '#FF9900', category: 'Storage' },
    gcs: { icon: '☁️', label: 'Google Cloud Storage', color: '#4285F4', category: 'Storage' },
    'azure-blob': { icon: '🔷', label: 'Azure Blob', color: '#0078D4', category: 'Storage' },
    kafka: { icon: '🌊', label: 'Apache Kafka', color: '#231F20', category: 'Streaming' },
    kinesis: { icon: '🌀', label: 'AWS Kinesis', color: '#FF9900', category: 'Streaming' },
  };

  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return '#10b981';
      case 'disconnected':
        return '#64748b';
      case 'error':
        return '#ef4444';
      case 'testing':
        return '#f59e0b';
      default:
        return colors.text.muted;
    }
  };

  const getStatusIcon = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return '✓';
      case 'disconnected':
        return '○';
      case 'error':
        return '✕';
      case 'testing':
        return '⟳';
      default:
        return '?';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filteredConnections = filterType === 'all'
    ? connections
    : connections.filter(c => c.type === filterType);

  const categories = ['All', 'Compute', 'Warehouse', 'Database', 'Storage', 'Streaming'];

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
              🔌 Connections
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                color: colors.text.secondary,
              }}
            >
              Manage connections to databases, warehouses, storage, and streaming platforms
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
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
            + Add Connection
          </button>
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', flexWrap: 'wrap' }}>
          {categories.map((category) => {
            const isActive = category === 'All' ? filterType === 'all' :
              Object.values(connectionTypeConfig).some(c => c.category === category && filterType === Object.keys(connectionTypeConfig).find(k => connectionTypeConfig[k as ConnectionType].category === category));

            return (
              <button
                key={category}
                onClick={() => {
                  if (category === 'All') {
                    setFilterType('all');
                  } else {
                    const firstType = Object.keys(connectionTypeConfig).find(
                      k => connectionTypeConfig[k as ConnectionType].category === category
                    ) as ConnectionType;
                    setFilterType(firstType || 'all');
                  }
                }}
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
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Connection Stats */}
      <div style={{ padding: '24px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div
            style={{
              padding: '20px',
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '13px', color: colors.text.secondary, marginBottom: '8px' }}>Total Connections</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: colors.text.primary }}>{connections.length}</div>
          </div>
          <div
            style={{
              padding: '20px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '13px', color: '#065f46', marginBottom: '8px' }}>Connected</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>
              {connections.filter(c => c.status === 'connected').length}
            </div>
          </div>
          <div
            style={{
              padding: '20px',
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>Disconnected</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>
              {connections.filter(c => c.status === 'disconnected').length}
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
            <div style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '8px' }}>Errors</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444' }}>
              {connections.filter(c => c.status === 'error').length}
            </div>
          </div>
        </div>

        {/* Connection Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
          {filteredConnections.map((connection) => {
            const typeConfig = connectionTypeConfig[connection.type];

            return (
              <div
                key={connection.id}
                style={{
                  padding: '20px',
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
                onClick={() => setSelectedConnection(connection)}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: borderRadius.md,
                        backgroundColor: `${typeConfig.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                      }}
                    >
                      {typeConfig.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: '600',
                          color: colors.text.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {connection.name}
                      </h3>
                      <div style={{ fontSize: '12px', color: colors.text.secondary, marginTop: '4px' }}>
                        {typeConfig.label}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: borderRadius.full,
                      backgroundColor: `${getStatusColor(connection.status)}15`,
                      fontSize: '12px',
                      fontWeight: '600',
                      color: getStatusColor(connection.status),
                    }}
                  >
                    <span>{getStatusIcon(connection.status)}</span>
                    <span style={{ textTransform: 'capitalize' }}>{connection.status}</span>
                  </div>
                </div>

                {/* Description */}
                {connection.description && (
                  <p
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '13px',
                      color: colors.text.secondary,
                      lineHeight: '1.5',
                    }}
                  >
                    {connection.description}
                  </p>
                )}

                {/* Config Preview */}
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: colors.background.tertiary,
                    borderRadius: borderRadius.sm,
                    marginBottom: '16px',
                  }}
                >
                  {Object.entries(connection.config).slice(0, 2).map(([key, value]) => (
                    <div key={key} style={{ fontSize: '12px', color: colors.text.secondary, marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600' }}>{key}:</span>{' '}
                      <span style={{ fontFamily: 'monospace', color: colors.text.primary }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: colors.text.muted }}>
                    {connection.lastTested && `Tested ${formatTimestamp(connection.lastTested)}`}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        border: `1px solid ${colors.border.main}`,
                        borderRadius: borderRadius.sm,
                        backgroundColor: colors.background.primary,
                        color: colors.text.primary,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Test connection
                      }}
                    >
                      Test
                    </button>
                    <button
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        border: `1px solid ${colors.border.main}`,
                        borderRadius: borderRadius.sm,
                        backgroundColor: colors.background.primary,
                        color: colors.text.primary,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Edit connection
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredConnections.length === 0 && (
          <div
            style={{
              padding: '60px',
              textAlign: 'center',
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.lg,
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔌</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.text.primary, marginBottom: '8px' }}>
              No connections found
            </h3>
            <p style={{ fontSize: '14px', color: colors.text.secondary, marginBottom: '20px' }}>
              {filterType === 'all' ? 'Get started by adding your first connection' : 'No connections of this type'}
            </p>
            <button
              onClick={() => setShowAddModal(true)}
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
              + Add Connection
            </button>
          </div>
        )}
      </div>

      {/* Add Connection Modal - Placeholder */}
      {showAddModal && (
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
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              backgroundColor: colors.background.primary,
              borderRadius: borderRadius.xl,
              boxShadow: colors.shadow.xl,
              width: '90%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '24px',
                borderBottom: `1px solid ${colors.border.main}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: colors.text.primary }}>
                Add New Connection
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.text.muted,
                  fontSize: '24px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {/* Connection Type Selector */}
            <div style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.text.secondary, marginBottom: '16px', textTransform: 'uppercase' }}>
                Select Connection Type
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {Object.entries(connectionTypeConfig).map(([type, config]) => (
                  <button
                    key={type}
                    style={{
                      padding: '16px',
                      border: `1px solid ${colors.border.main}`,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.background.secondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.primary.main;
                      e.currentTarget.style.backgroundColor = colors.primary.lighter;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border.main;
                      e.currentTarget.style.backgroundColor = colors.background.secondary;
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{config.icon}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text.primary }}>
                        {config.label}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.text.muted }}>{config.category}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Connections;
