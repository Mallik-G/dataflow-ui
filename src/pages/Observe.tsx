import { colors, borderRadius } from '../theme/colors';

const Observe = () => {
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
          👁️ Observe
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            color: colors.text.secondary,
          }}
        >
          Monitor data pipelines, track metrics, and view execution logs
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
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📊</div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '12px',
            }}
          >
            Observability Dashboard Coming Soon
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: colors.text.secondary,
              maxWidth: '500px',
              margin: '0 auto',
            }}
          >
            This page will display pipeline execution metrics, data quality scores, lineage
            visualization, and real-time monitoring capabilities.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Observe;
