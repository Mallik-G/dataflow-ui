import { colors, borderRadius } from '../theme/colors';

const Deploy = () => {
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
          🚀 Deploy
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            color: colors.text.secondary,
          }}
        >
          Deploy data pipelines to Snowflake, Databricks, and other platforms
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 40px' }}>
        <div
          style={{
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.border.main}`,
            borderRadius: borderRadius.lg,
            padding: '60px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🛠️</div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '12px',
            }}
          >
            Deployment Pipeline Coming Soon
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: colors.text.secondary,
              maxWidth: '500px',
              margin: '0 auto',
            }}
          >
            This page will allow you to deploy generated artifacts to your configured platforms,
            manage environments, and track deployment history.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Deploy;
