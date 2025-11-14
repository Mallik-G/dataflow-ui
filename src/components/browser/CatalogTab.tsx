import { useState } from 'react';
import { catalogData } from '../../data/catalogData';
import { CatalogObject } from '../../types/catalog';
import { useCanvasStore } from '../../stores/canvasStore';

const CatalogTab = () => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['db-1', 'schema-raw', 'schema-silver', 'schema-gold']));
  const { setViewMode, setSelectedCatalogObject } = useCanvasStore();

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleObjectClick = (obj: CatalogObject) => {
    if (obj.type === 'table' || obj.type === 'view') {
      setViewMode('lineage');
      setSelectedCatalogObject(obj);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'database': return '🗄️';
      case 'schema': return '📁';
      case 'table': return '📄';
      case 'view': return '👁️';
      default: return '•';
    }
  };

  const renderCatalogTree = (objects: CatalogObject[], level = 0) => {
    return objects.map((obj) => {
      const isExpanded = expandedNodes.has(obj.id);
      const hasChildren = obj.children && obj.children.length > 0;
      const isClickable = obj.type === 'table' || obj.type === 'view';

      return (
        <div key={obj.id}>
          <div
            style={{
              paddingLeft: `${level * 16 + 12}px`,
              paddingRight: '12px',
              paddingTop: '8px',
              paddingBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: hasChildren || isClickable ? 'pointer' : 'default',
              backgroundColor: 'transparent',
              transition: 'all 0.15s ease',
            }}
            onClick={() => {
              if (hasChildren) {
                toggleNode(obj.id);
              }
              handleObjectClick(obj);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {hasChildren && (
              <span style={{ fontSize: '10px', width: '12px' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {!hasChildren && <span style={{ width: '12px' }} />}
            <span style={{ fontSize: '14px' }}>{getIcon(obj.type)}</span>
            <span style={{
              fontSize: '13px',
              fontWeight: obj.type === 'table' || obj.type === 'view' ? '500' : '400',
              color: '#334155',
              flex: 1,
            }}>
              {obj.name}
            </span>
            {(obj.type === 'table' || obj.type === 'view') && (
              <span style={{
                fontSize: '10px',
                color: '#94a3b8',
                backgroundColor: '#f1f5f9',
                padding: '2px 6px',
                borderRadius: '4px',
              }}>
                {obj.type}
              </span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div>
              {renderCatalogTree(obj.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{
        padding: '12px 16px',
        fontSize: '11px',
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderBottom: '1px solid #f1f5f9',
      }}>
        Data Catalog
      </div>
      {renderCatalogTree(catalogData)}
    </div>
  );
};

export default CatalogTab;
