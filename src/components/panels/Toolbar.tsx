import { useReactFlow } from 'reactflow';

const Toolbar = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#475569',
    transition: 'all 0.2s',
  };

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#fff',
      padding: '12px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      gap: '8px',
      zIndex: 10,
    }}>
      <button
        style={buttonStyle}
        onClick={() => zoomIn()}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#fff';
        }}
      >
        Zoom In
      </button>
      <button
        style={buttonStyle}
        onClick={() => zoomOut()}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#fff';
        }}
      >
        Zoom Out
      </button>
      <button
        style={buttonStyle}
        onClick={() => fitView({ padding: 0.2 })}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#fff';
        }}
      >
        Fit to Screen
      </button>
    </div>
  );
};

export default Toolbar;
