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
      tooltip: 'AI Assistant',
      width: 400
    },
    {
      id: 'context' as PanelType,
      icon: '📋',
      label: 'Context',
      tooltip: 'Context Window',
      width: 360
    },
    {
      id: 'codeview' as PanelType,
      icon: '💻',
      label: 'Code',
      tooltip: 'Code View',
      width: 600
    }
  ];

  // Calculate total width: icon bar (56px) + panel width if active
  const activeButton = sidebarButtons.find(b => b.id === activePanel);
  const sidebarWidth = activePanel ? 56 + activeButton!.width : 56;

  return (
    <div
      style={{
        width: `${sidebarWidth}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        transition: 'width 0.3s ease-out',
        flexShrink: 0,
      }}
    >
      {/* Panel Content - Renders First (on the left side of the sidebar) */}
      {activePanel === 'nexa-ai' && (
        <div style={{ width: '400px', height: '100%', borderLeft: `1px solid ${colors.border.main}` }}>
          <CopilotPanel isOpen={true} onClose={() => setActivePanel(null)} />
        </div>
      )}

      {activePanel === 'context' && (
        <div style={{ width: '360px', height: '100%', borderLeft: `1px solid ${colors.border.main}` }}>
          <MetadataPanel isOpen={true} onClose={() => setActivePanel(null)} />
        </div>
      )}

      {activePanel === 'codeview' && (
        <div style={{ width: '600px', height: '100%', borderLeft: `1px solid ${colors.border.main}` }}>
          <CodeViewPanel isOpen={true} onClose={() => setActivePanel(null)} />
        </div>
      )}

      {/* Icon Bar - Always Visible (on the right edge) */}
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
          flexShrink: 0,
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
    </div>
  );
};

export default RightSidebar;
