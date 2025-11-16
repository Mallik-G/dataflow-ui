import { useReactFlow } from 'reactflow';
import { useState } from 'react';
import { colors, borderRadius } from '../../theme/colors';

const Toolbar = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const buttonStyle = (buttonName: string) => ({
    padding: '10px 18px',
    backgroundColor: hoveredButton === buttonName ? colors.background.secondary : colors.background.tertiary,
    border: `1px solid ${colors.border.main}`,
    borderRadius: borderRadius.lg,
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: hoveredButton === buttonName ? colors.text.primary : colors.text.secondary,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: hoveredButton === buttonName ? colors.shadow.sm : 'none',
  });

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: colors.background.tertiary,
      padding: '8px',
      borderRadius: borderRadius.xl,
      boxShadow: colors.shadow.md,
      display: 'flex',
      gap: '4px',
      zIndex: 10,
      border: `1px solid ${colors.border.main}`,
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
        backgroundColor: colors.border.main,
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
        backgroundColor: colors.border.main,
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
