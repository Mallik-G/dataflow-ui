import { useState } from 'react';
import { colors, borderRadius } from '../theme/colors';
import { PlatformSettings, SnowflakeConfig, DatabricksConfig, GitHubConfig } from '../types/settings';
import { SnowflakeAPI } from '../services/api/snowflakeApi';
import { DatabricksAPI } from '../services/api/databricksApi';
import { GitHubAPI } from '../services/api/githubApi';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'snowflake' | 'databricks' | 'github'>('snowflake');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Load settings from localStorage or use defaults
  const [snowflakeConfig, setSnowflakeConfig] = useState<SnowflakeConfig>({
    accountIdentifier: '',
    username: '',
    password: '',
    warehouse: '',
    database: '',
    schema: '',
    role: '',
  });

  const [databricksConfig, setDatabricksConfig] = useState<DatabricksConfig>({
    host: '',
    token: '',
    clusterId: '',
    catalog: '',
    schema: '',
  });

  const [githubConfig, setGitHubConfig] = useState<GitHubConfig>({
    owner: '',
    repo: '',
    token: '',
    branch: 'main',
    basePath: 'dataflows',
  });

  const handleSnowflakeChange = (field: keyof SnowflakeConfig, value: string) => {
    setSnowflakeConfig((prev) => ({ ...prev, [field]: value }));
    setConnectionStatus(null);
  };

  const handleDatabricksChange = (field: keyof DatabricksConfig, value: string) => {
    setDatabricksConfig((prev) => ({ ...prev, [field]: value }));
    setConnectionStatus(null);
  };

  const handleGitHubChange = (field: keyof GitHubConfig, value: string) => {
    setGitHubConfig((prev) => ({ ...prev, [field]: value }));
    setConnectionStatus(null);
  };

  const testSnowflakeConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const api = new SnowflakeAPI(snowflakeConfig);
      const result = await api.testConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({ success: false, message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setTestingConnection(false);
    }
  };

  const testDatabricksConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const api = new DatabricksAPI(databricksConfig);
      const result = await api.testConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({ success: false, message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setTestingConnection(false);
    }
  };

  const testGitHubConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const api = new GitHubAPI(githubConfig);
      const result = await api.testConnection();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({ success: false, message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setTestingConnection(false);
    }
  };

  const saveSettings = () => {
    const settings: PlatformSettings = {
      snowflake: snowflakeConfig,
      databricks: databricksConfig,
      github: githubConfig,
    };
    localStorage.setItem('platformSettings', JSON.stringify(settings));
    alert('✓ Settings saved successfully!');
  };

  const tabs = [
    { id: 'snowflake' as const, label: 'Snowflake', icon: '❄️' },
    { id: 'databricks' as const, label: 'Databricks', icon: '🧱' },
    { id: 'github' as const, label: 'GitHub', icon: '🐙' },
  ];

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    border: `1px solid ${colors.border.main}`,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    color: colors.text.primary,
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: '6px',
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
          ⚙️ Settings
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            color: colors.text.secondary,
          }}
        >
          Configure platform connections and application preferences
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 40px' }}>
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: `1px solid ${colors.border.main}`,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setConnectionStatus(null);
              }}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${colors.primary.main}` : '2px solid transparent',
                backgroundColor: 'transparent',
                color: activeTab === tab.id ? colors.primary.main : colors.text.secondary,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Snowflake Configuration */}
        {activeTab === 'snowflake' && (
          <div
            style={{
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.lg,
              padding: '32px',
              maxWidth: '800px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: '24px',
              }}
            >
              Snowflake Connection
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Account Identifier *</label>
                <input
                  type="text"
                  value={snowflakeConfig.accountIdentifier}
                  onChange={(e) => handleSnowflakeChange('accountIdentifier', e.target.value)}
                  placeholder="orgname-account_name"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Username *</label>
                <input
                  type="text"
                  value={snowflakeConfig.username}
                  onChange={(e) => handleSnowflakeChange('username', e.target.value)}
                  placeholder="your_username"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Password *</label>
                <input
                  type="password"
                  value={snowflakeConfig.password}
                  onChange={(e) => handleSnowflakeChange('password', e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Warehouse *</label>
                <input
                  type="text"
                  value={snowflakeConfig.warehouse}
                  onChange={(e) => handleSnowflakeChange('warehouse', e.target.value)}
                  placeholder="COMPUTE_WH"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Database *</label>
                <input
                  type="text"
                  value={snowflakeConfig.database}
                  onChange={(e) => handleSnowflakeChange('database', e.target.value)}
                  placeholder="MY_DATABASE"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Schema *</label>
                <input
                  type="text"
                  value={snowflakeConfig.schema}
                  onChange={(e) => handleSnowflakeChange('schema', e.target.value)}
                  placeholder="PUBLIC"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Role (Optional)</label>
                <input
                  type="text"
                  value={snowflakeConfig.role || ''}
                  onChange={(e) => handleSnowflakeChange('role', e.target.value)}
                  placeholder="ACCOUNTADMIN"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={testSnowflakeConnection}
                disabled={testingConnection}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.tertiary,
                  color: colors.text.primary,
                  cursor: testingConnection ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {testingConnection ? '⏳ Testing...' : '🔌 Test Connection'}
              </button>

              {connectionStatus && (
                <div
                  style={{
                    padding: '8px 16px',
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    backgroundColor: connectionStatus.success ? '#10b98120' : '#ef444420',
                    color: connectionStatus.success ? '#10b981' : '#ef4444',
                    border: `1px solid ${connectionStatus.success ? '#10b981' : '#ef4444'}`,
                  }}
                >
                  {connectionStatus.success ? '✓' : '✗'} {connectionStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Databricks Configuration */}
        {activeTab === 'databricks' && (
          <div
            style={{
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.lg,
              padding: '32px',
              maxWidth: '800px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: '24px',
              }}
            >
              Databricks Connection
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Workspace URL *</label>
                <input
                  type="text"
                  value={databricksConfig.host}
                  onChange={(e) => handleDatabricksChange('host', e.target.value)}
                  placeholder="https://your-workspace.cloud.databricks.com"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Access Token *</label>
                <input
                  type="password"
                  value={databricksConfig.token}
                  onChange={(e) => handleDatabricksChange('token', e.target.value)}
                  placeholder="dapi••••••••••••••••••••••••"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Cluster ID *</label>
                <input
                  type="text"
                  value={databricksConfig.clusterId}
                  onChange={(e) => handleDatabricksChange('clusterId', e.target.value)}
                  placeholder="0123-456789-abcdefg"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Catalog (Optional)</label>
                <input
                  type="text"
                  value={databricksConfig.catalog || ''}
                  onChange={(e) => handleDatabricksChange('catalog', e.target.value)}
                  placeholder="main"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Schema (Optional)</label>
                <input
                  type="text"
                  value={databricksConfig.schema || ''}
                  onChange={(e) => handleDatabricksChange('schema', e.target.value)}
                  placeholder="default"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={testDatabricksConnection}
                disabled={testingConnection}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.tertiary,
                  color: colors.text.primary,
                  cursor: testingConnection ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {testingConnection ? '⏳ Testing...' : '🔌 Test Connection'}
              </button>

              {connectionStatus && (
                <div
                  style={{
                    padding: '8px 16px',
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    backgroundColor: connectionStatus.success ? '#10b98120' : '#ef444420',
                    color: connectionStatus.success ? '#10b981' : '#ef4444',
                    border: `1px solid ${connectionStatus.success ? '#10b981' : '#ef4444'}`,
                  }}
                >
                  {connectionStatus.success ? '✓' : '✗'} {connectionStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GitHub Configuration */}
        {activeTab === 'github' && (
          <div
            style={{
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.lg,
              padding: '32px',
              maxWidth: '800px',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: '24px',
              }}
            >
              GitHub Repository
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Repository Owner *</label>
                <input
                  type="text"
                  value={githubConfig.owner}
                  onChange={(e) => handleGitHubChange('owner', e.target.value)}
                  placeholder="your-username"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Repository Name *</label>
                <input
                  type="text"
                  value={githubConfig.repo}
                  onChange={(e) => handleGitHubChange('repo', e.target.value)}
                  placeholder="dataflows"
                  style={inputStyle}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Personal Access Token *</label>
                <input
                  type="password"
                  value={githubConfig.token}
                  onChange={(e) => handleGitHubChange('token', e.target.value)}
                  placeholder="ghp_••••••••••••••••••••••••"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Branch *</label>
                <input
                  type="text"
                  value={githubConfig.branch}
                  onChange={(e) => handleGitHubChange('branch', e.target.value)}
                  placeholder="main"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Base Path (Optional)</label>
                <input
                  type="text"
                  value={githubConfig.basePath || ''}
                  onChange={(e) => handleGitHubChange('basePath', e.target.value)}
                  placeholder="dataflows"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={testGitHubConnection}
                disabled={testingConnection}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.tertiary,
                  color: colors.text.primary,
                  cursor: testingConnection ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {testingConnection ? '⏳ Testing...' : '🔌 Test Connection'}
              </button>

              {connectionStatus && (
                <div
                  style={{
                    padding: '8px 16px',
                    borderRadius: borderRadius.md,
                    fontSize: '13px',
                    backgroundColor: connectionStatus.success ? '#10b98120' : '#ef444420',
                    color: connectionStatus.success ? '#10b981' : '#ef4444',
                    border: `1px solid ${connectionStatus.success ? '#10b981' : '#ef4444'}`,
                  }}
                >
                  {connectionStatus.success ? '✓' : '✗'} {connectionStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div style={{ marginTop: '32px', maxWidth: '800px' }}>
          <button
            onClick={saveSettings}
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
            }}
          >
            💾 Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
