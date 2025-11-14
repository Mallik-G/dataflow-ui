import { useReactFlow } from 'reactflow';
import { useState } from 'react';

const Toolbar = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const buttonStyle = (buttonName: string) => ({
    padding: '10px 18px',
    backgroundColor: hoveredButton === buttonName ? '#f1f5f9' : '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: hoveredButton === buttonName ? '#1e293b' : '#475569',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: hoveredButton === buttonName ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none',
  });

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#ffffff',
      padding: '8px',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
      display: 'flex',
      gap: '4px',
      zIndex: 10,
      border: '1px solid #e2e8f0',
    }}>
      <button
        style={buttonStyle('zoomIn')}
        onClick={() => zoomIn()}
        onMouseEnter={() => setHoveredButton('zoomIn')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        <span style={{ fontSize: '16px' }}>+</span>
        <span>Zoom In</span>
      </button>
      <div style={{
        width: '1px',
        height: '24px',
        backgroundColor: '#e2e8f0',
        margin: '6px 4px',
      }} />
      <button
        style={buttonStyle('zoomOut')}
        onClick={() => zoomOut()}
        onMouseEnter={() => setHoveredButton('zoomOut')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        <span style={{ fontSize: '16px' }}>−</span>
        <span>Zoom Out</span>
      </button>
      <div style={{
        width: '1px',
        height: '24px',
        backgroundColor: '#e2e8f0',
        margin: '6px 4px',
      }} />
      <button
        style={buttonStyle('fit')}
        onClick={() => fitView({ padding: 0.2, duration: 400 })}
        onMouseEnter={() => setHoveredButton('fit')}
        onMouseLeave={() => setHoveredButton(null)}
      >
        <span style={{ fontSize: '16px' }}>⤢</span>
        <span>Fit to Screen</span>
      </button>
    </div>
  );
};

export default Toolbar;
