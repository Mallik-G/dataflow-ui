import { useState } from 'react';
import CatalogTab from './CatalogTab';
import DataflowsTab from './DataflowsTab';
import { colors, borderRadius } from '../../theme/colors';

type TabType = 'catalog' | 'dataflows';

const BrowserPanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('catalog');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tabStyle = (tab: TabType) => ({
    flex: 1,
    padding: '12px 16px',
    backgroundColor: activeTab === tab ? colors.background.tertiary : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? `2px solid ${colors.primary.main}` : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: activeTab === tab ? colors.text.primary : colors.text.secondary,
    transition: 'all 0.2s ease',
  });

  if (isCollapsed) {
    return (
      <div style={{
        width: '60px',
        height: '100%',
        backgroundColor: colors.background.tertiary,
        borderRight: `1px solid ${colors.border.main}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '12px',
      }}>
        <button
          onClick={() => {
            setIsCollapsed(false);
            setActiveTab('catalog');
          }}
          title="Catalog"
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: activeTab === 'catalog' ? colors.primary.lighter : 'transparent',
            border: activeTab === 'catalog' ? `2px solid ${colors.primary.main}` : '2px solid transparent',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.background.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = activeTab === 'catalog' ? colors.primary.lighter : 'transparent';
          }}
        >
          📊
        </button>
        <button
          onClick={() => {
            setIsCollapsed(false);
            setActiveTab('dataflows');
          }}
          title="Dataflows"
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: activeTab === 'dataflows' ? colors.primary.lighter : 'transparent',
            border: activeTab === 'dataflows' ? `2px solid ${colors.primary.main}` : '2px solid transparent',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.background.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = activeTab === 'dataflows' ? colors.primary.lighter : 'transparent';
          }}
        >
          🔄
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: '320px',
      height: '100%',
      backgroundColor: colors.background.tertiary,
      borderRight: `1px solid ${colors.border.main}`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Tab Headers */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${colors.border.main}`,
        backgroundColor: colors.background.primary,
        alignItems: 'center',
      }}>
        <button
          style={tabStyle('catalog')}
          onClick={() => setActiveTab('catalog')}
          onMouseEnter={(e) => {
            if (activeTab !== 'catalog') {
              e.currentTarget.style.backgroundColor = colors.background.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'catalog') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          📊 Catalog
        </button>
        <button
          style={tabStyle('dataflows')}
          onClick={() => setActiveTab('dataflows')}
          onMouseEnter={(e) => {
            if (activeTab !== 'dataflows') {
              e.currentTarget.style.backgroundColor = colors.background.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'dataflows') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          🔄 Dataflows
        </button>
        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse sidebar"
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: colors.text.muted,
            fontSize: '16px',
            marginLeft: 'auto',
            marginRight: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.text.muted;
          }}
        >
          ◀
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'catalog' && <CatalogTab />}
        {activeTab === 'dataflows' && <DataflowsTab />}
      </div>
    </div>
  );
};

export default BrowserPanel;
