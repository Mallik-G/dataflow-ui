import { useState } from 'react';
import { colors, borderRadius } from '../../theme/colors';
import CopilotPanel from '../panels/CopilotPanel';
import MetadataPanel from '../panels/MetadataPanel';
import CodeViewPanel from '../panels/CodeViewPanel';

type PanelType = 'nexa-ai' | 'context' | 'codeview' | null;

const RightSidebar = () => {
  const [activePanel, setActivePanel] = useState<PanelType>(null);

  const togglePanel = (panel: PanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  const sidebarButtons = [
    {
      id: 'nexa-ai' as PanelType,
      icon: '🤖',
      label: 'Nexa AI',
      tooltip: 'AI Assistant'
    },
    {
      id: 'context' as PanelType,
      icon: '📋',
      label: 'Context',
      tooltip: 'Context Window'
    },
    {
      id: 'codeview' as PanelType,
      icon: '💻',
      label: 'Code',
      tooltip: 'Code View'
    }
  ];

  return (
    <>
      {/* Icon Bar - Always Visible */}
      <div
        style={{
          width: '56px',
          height: '100%',
          backgroundColor: colors.background.secondary,
          borderLeft: `1px solid ${colors.border.main}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          gap: '8px',
          zIndex: 1000,
        }}
      >
        {sidebarButtons.map((button) => (
          <button
            key={button.id}
            onClick={() => togglePanel(button.id)}
            title={button.tooltip}
            style={{
              width: '40px',
              height: '40px',
              border: 'none',
              borderRadius: borderRadius.md,
              backgroundColor: activePanel === button.id ? colors.primary.lighter : 'transparent',
              color: activePanel === button.id ? colors.primary.main : colors.text.secondary,
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              outline: activePanel === button.id ? `2px solid ${colors.primary.main}` : 'none',
            }}
            onMouseEnter={(e) => {
              if (activePanel !== button.id) {
                e.currentTarget.style.backgroundColor = colors.background.tertiary;
              }
            }}
            onMouseLeave={(e) => {
              if (activePanel !== button.id) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {button.icon}
          </button>
        ))}
      </div>

      {/* Sliding Panels */}
      {activePanel === 'nexa-ai' && (
        <div
          style={{
            position: 'absolute',
            right: '56px',
            top: 0,
            bottom: 0,
            width: '400px',
            backgroundColor: colors.background.primary,
            borderLeft: `1px solid ${colors.border.main}`,
            zIndex: 999,
            animation: 'slideInFromRight 0.3s ease-out',
          }}
        >
          <CopilotPanel isOpen={true} onClose={() => setActivePanel(null)} />
        </div>
      )}

      {activePanel === 'context' && (
        <div
          style={{
            position: 'absolute',
            right: '56px',
            top: 0,
            bottom: 0,
            width: '360px',
            backgroundColor: colors.background.primary,
            borderLeft: `1px solid ${colors.border.main}`,
            zIndex: 999,
            animation: 'slideInFromRight 0.3s ease-out',
          }}
        >
          <MetadataPanel isOpen={true} onClose={() => setActivePanel(null)} />
        </div>
      )}

      {activePanel === 'codeview' && (
        <div
          style={{
            position: 'absolute',
            right: '56px',
            top: 0,
            bottom: 0,
            width: '600px',
            backgroundColor: colors.background.primary,
            borderLeft: `1px solid ${colors.border.main}`,
            zIndex: 999,
            animation: 'slideInFromRight 0.3s ease-out',
          }}
        >
          <CodeViewPanel isOpen={true} onClose={() => setActivePanel(null)} />
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default RightSidebar;
