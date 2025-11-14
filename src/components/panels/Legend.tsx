const Legend = () => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#ffffff',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
      border: '1px solid #e2e8f0',
      zIndex: 10,
      minWidth: '200px',
    }}>
      <div style={{
        fontSize: '12px',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Node Types
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          }} />
          <span style={{ fontSize: '12px', color: '#475569' }}>Source Tables</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
          }} />
          <span style={{ fontSize: '12px', color: '#475569' }}>Silver Layer</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          }} />
          <span style={{ fontSize: '12px', color: '#475569' }}>Gold Entities</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
          }} />
          <span style={{ fontSize: '12px', color: '#475569' }}>Transformations</span>
        </div>
      </div>

      <div style={{
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid #e2e8f0',
      }}>
        <div style={{
          fontSize: '12px',
          fontWeight: '600',
          color: '#1e293b',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Edge Types
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '20px',
              height: '2px',
              backgroundColor: '#94a3b8',
            }} />
            <span style={{ fontSize: '11px', color: '#475569' }}>Mapping</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '20px',
              height: '2px',
              backgroundColor: '#8b5cf6',
              backgroundImage: 'repeating-linear-gradient(90deg, #8b5cf6, #8b5cf6 4px, transparent 4px, transparent 8px)',
            }} />
            <span style={{ fontSize: '11px', color: '#475569' }}>LLM Generated</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Legend;
