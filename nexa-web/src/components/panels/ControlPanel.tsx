import { useState } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';

const ControlPanel = () => {
  const [showColumns, setShowColumns] = useState(true);
  const {
    upstreamLevels,
    downstreamLevels,
    setUpstreamLevels,
    setDownstreamLevels,
  } = useCanvasStore();

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      backgroundColor: '#ffffff',
      padding: '16px',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
      border: '1px solid #e2e8f0',
      zIndex: 10,
      minWidth: '240px',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '12px',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '16px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Lineage Controls
      </div>

      {/* Show Columns Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}>
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
            Show Columns
          </span>
          <div
            onClick={() => setShowColumns(!showColumns)}
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              backgroundColor: showColumns ? '#3b82f6' : '#cbd5e1',
              position: 'relative',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              position: 'absolute',
              top: '3px',
              left: showColumns ? '23px' : '3px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }} />
          </div>
        </label>
      </div>

      {/* Upstream Levels */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '11px',
          color: '#64748b',
          marginBottom: '8px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Upstream Levels: {upstreamLevels}
        </div>
        <input
          type="range"
          min="1"
          max="3"
          value={upstreamLevels}
          onChange={(e) => setUpstreamLevels(Number(e.target.value))}
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            outline: 'none',
            WebkitAppearance: 'none',
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((upstreamLevels - 1) / 2) * 100}%, #e2e8f0 ${((upstreamLevels - 1) / 2) * 100}%, #e2e8f0 100%)`,
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>1</span>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>2</span>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>3</span>
        </div>
      </div>

      {/* Downstream Levels */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '11px',
          color: '#64748b',
          marginBottom: '8px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Downstream Levels: {downstreamLevels}
        </div>
        <input
          type="range"
          min="1"
          max="3"
          value={downstreamLevels}
          onChange={(e) => setDownstreamLevels(Number(e.target.value))}
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            outline: 'none',
            WebkitAppearance: 'none',
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((downstreamLevels - 1) / 2) * 100}%, #e2e8f0 ${((downstreamLevels - 1) / 2) * 100}%, #e2e8f0 100%)`,
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>1</span>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>2</span>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>3</span>
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={() => alert('Export functionality coming soon!')}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '600',
          color: '#475569',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
          e.currentTarget.style.borderColor = '#cbd5e1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f8fafc';
          e.currentTarget.style.borderColor = '#e2e8f0';
        }}
      >
        Export Lineage
      </button>
    </div>
  );
};

export default ControlPanel;
