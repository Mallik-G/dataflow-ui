import { useState } from 'react';
import CatalogTab from './CatalogTab';
import DataflowsTab from './DataflowsTab';

type TabType = 'catalog' | 'dataflows';

const BrowserPanel = () => {
  const [activeTab, setActiveTab] = useState<TabType>('catalog');

  const tabStyle = (tab: TabType) => ({
    flex: 1,
    padding: '12px 16px',
    backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    color: activeTab === tab ? '#1e293b' : '#64748b',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={{
      width: '320px',
      height: '100%',
      backgroundColor: '#ffffff',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Tab Headers */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#fafbfc',
      }}>
        <button
          style={tabStyle('catalog')}
          onClick={() => setActiveTab('catalog')}
          onMouseEnter={(e) => {
            if (activeTab !== 'catalog') {
              e.currentTarget.style.backgroundColor = '#f8fafc';
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
              e.currentTarget.style.backgroundColor = '#f8fafc';
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
