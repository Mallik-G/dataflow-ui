import { useState } from 'react';
import { catalogData } from '../../data/catalogData';
import { CatalogObject } from '../../types/catalog';
import { useCanvasStore } from '../../stores/canvasStore';
import { colors, borderRadius } from '../../theme/colors';
import ContextMenu, { ContextMenuItem } from '../common/ContextMenu';
import CreateFlowModal, { FlowConfig } from '../modals/CreateFlowModal';

interface ContextMenuState {
  x: number;
  y: number;
  object: CatalogObject;
}

const CatalogTab = () => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['db-1', 'schema-raw', 'schema-silver', 'schema-gold']));
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isCreateFlowModalOpen, setIsCreateFlowModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<CatalogObject | null>(null);
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

  const handleCreateFlow = (config: FlowConfig) => {
    console.log('Creating flow:', config);
    // This will be connected to canvas store in next task
    alert(`✨ Flow created!\n\nSource: ${config.source.fullPath}\nTarget: ${config.target.fullPath}\nPlatform: ${config.platform}`);
    setIsCreateFlowModalOpen(false);
    setSelectedTable(null);
  };

  const handleContextMenu = (e: React.MouseEvent, obj: CatalogObject) => {
    e.preventDefault();
    e.stopPropagation();

    if (obj.type === 'table' || obj.type === 'view') {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        object: obj,
      });
    }
  };

  const getContextMenuItems = (obj: CatalogObject): ContextMenuItem[] => {
    // Check if flow exists (for now, always allow creation)
    const hasExistingFlow = false;

    return [
      {
        id: 'view-lineage',
        label: 'View Lineage',
        icon: '📊',
        onClick: () => {
          setViewMode('lineage');
          setSelectedCatalogObject(obj);
        },
      },
      {
        id: 'create-flow',
        label: hasExistingFlow ? 'Edit Flow' : 'Create New Flow',
        icon: '✨',
        onClick: () => {
          setSelectedTable(obj);
          setIsCreateFlowModalOpen(true);
        },
      },
      {
        id: 'add-to-flow',
        label: 'Add to Current Flow',
        icon: '🔗',
        onClick: () => {
          alert(`Add ${obj.name} to current flow`);
        },
        disabled: true, // Enable when there's an active flow
        divider: true,
      },
      {
        id: 'copy-path',
        label: 'Copy Table Path',
        icon: '📋',
        onClick: () => {
          navigator.clipboard.writeText(obj.fullyQualifiedName);
          alert(`Copied: ${obj.fullyQualifiedName}`);
        },
      },
      {
        id: 'profile',
        label: 'Profile Data',
        icon: '🔍',
        onClick: () => {
          alert(`Profile data for ${obj.name}`);
        },
        disabled: true, // Will implement in Phase 2
      },
      {
        id: 'docs',
        label: 'View Documentation',
        icon: '📖',
        onClick: () => {
          alert(`View docs for ${obj.name}`);
        },
        disabled: true,
      },
    ];
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
            onContextMenu={(e) => handleContextMenu(e, obj)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.hover;
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
              color: colors.text.primary,
              flex: 1,
            }}>
              {obj.name}
            </span>
            {(obj.type === 'table' || obj.type === 'view') && (
              <span style={{
                fontSize: '10px',
                color: colors.text.secondary,
                backgroundColor: colors.background.secondary,
                padding: '2px 6px',
                borderRadius: borderRadius.sm,
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
    <>
      <div style={{ padding: '8px 0' }}>
        <div style={{
          padding: '12px 16px',
          fontSize: '11px',
          fontWeight: '600',
          color: colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: `1px solid ${colors.border.light}`,
        }}>
          Data Catalog
        </div>
        {renderCatalogTree(catalogData)}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.object)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Create Flow Modal */}
      {isCreateFlowModalOpen && selectedTable && (
        <CreateFlowModal
          sourceTable={selectedTable}
          onClose={() => {
            setIsCreateFlowModalOpen(false);
            setSelectedTable(null);
          }}
          onCreateFlow={handleCreateFlow}
        />
      )}
    </>
  );
};

export default CatalogTab;
