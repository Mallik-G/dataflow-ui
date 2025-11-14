import { useState } from 'react';
import CatalogTab from './CatalogTab';
import DataflowsTab from './DataflowsTab';
import { colors } from '../../theme/colors';

type TabType = 'catalog' | 'dataflows';

const BrowserPanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('catalog');

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
