# Canvas Architecture

Modern, TypeScript-based canvas infrastructure for nexa-web data flow visualization.

## Directory Structure

```
canvas/
├── core/
│   ├── types.ts              # Shared TypeScript type definitions
│   └── canvasConfig.ts       # Configuration constants
├── bronze/
│   └── [future Bronze canvas modules]
├── gold/
│   ├── components/           # Gold canvas React components
│   ├── hooks/
│   │   ├── useHierarchyManager.ts    # Smart expansion/collapse logic
│   │   └── useFieldMappings.ts       # Auto-mapping generation
│   └── utils/
│       └── nodePositioning.ts        # Layout calculation utilities
└── shared/
    ├── CustomEdge.tsx        # Reusable edge component
    └── canvasUtils.ts        # Common utility functions
```

## Key Concepts

### 1. Hierarchy Management (Gold Canvas)

The `useHierarchyManager` hook implements the smart expansion/collapse system:

- **Consumption entities**: Always visible, can be expanded to show related curated entities
- **Curated entities**: Only visible when a connected consumption entity is expanded
- **Auto-collapse**: When a consumption entity collapses, its curated entities collapse too (unless used by another expanded consumption entity)

**Usage:**
```typescript
import { useHierarchyManager } from './canvas/gold/hooks/useHierarchyManager';

const {
  expandedConsumptionEntities,
  toggleConsumptionEntity,
  getVisibleNodes
} = useHierarchyManager(edges);

// Toggle expansion
const handleClick = (entityId: string) => {
  toggleConsumptionEntity(entityId);
};

// Get visible nodes for rendering
const visibleNodes = getVisibleNodes(allNodes, edges);
```

### 2. Field Mappings

The `useFieldMappings` hook provides automatic field mapping generation:

```typescript
import { useFieldMappings } from './canvas/gold/hooks/useFieldMappings';

const { generateMappings, findMapping } = useFieldMappings();

// Generate all mappings
const mappings = generateMappings(sourceColumns, targetColumns);

// Find single best match
const match = findMapping('customer_id', targetColumns);
// Returns: { column: 'id', confidence: 0.85 }
```

### 3. Column Matching Algorithm

The canvas uses a sophisticated column matching algorithm:

1. **Exact match** (confidence: 1.0): `customer_id` === `customer_id`
2. **Case-insensitive match** (confidence: 0.95): `Customer_ID` === `customer_id`
3. **Normalized match** (confidence: 0.9): `src_customer_id` === `tgt_customer_id`
   - Removes common prefixes: `src_`, `tgt_`, `stg_`, `raw_`, `curated_`
   - Removes common suffixes: `_id`, `_key`, `_name`, `_date`
4. **Similarity match** (confidence: varies): Uses Levenshtein distance
   - `custmer_id` → `customer_id` (confidence: 0.91)

Only matches with confidence ≥ 0.7 are returned.

### 4. Node Positioning

The `nodePositioning` utilities handle layout calculations:

```typescript
import { calculateGoldLayout } from './canvas/gold/utils/nodePositioning';

const { consumption, curated } = calculateGoldLayout(
  consumptionNodes,
  curatedNodes,
  expandedCuratedIds,
  edges,
  config
);
```

**Layout Strategy:**
- Consumption nodes: Right column (x = columnWidth * 2)
- Curated nodes: Left column (x = 0)
- Vertical spacing: Calculated to center all nodes
- Smart ordering: Nodes grouped by connections

## Configuration

All configuration is centralized in `core/canvasConfig.ts`:

```typescript
import { GOLD_LAYOUT_CONFIG, NODE_STYLES, EDGE_STYLES } from './canvas/core/canvasConfig';

// Layout settings
const config = GOLD_LAYOUT_CONFIG;
// { nodeWidth: 300, nodeHeight: 450, horizontalSpacing: 350, ... }

// Node styling by type
const style = NODE_STYLES.curated;
// { background: '#ffffff', border: '2px solid #4CAF50', ... }

// Edge styling by relationship type
const edgeStyle = EDGE_STYLES.fieldMapping;
// { stroke: '#4CAF50', strokeWidth: 2, strokeDasharray: '5,5' }
```

## Type Safety

All types are defined in `core/types.ts`:

```typescript
import type {
  CanvasNode,
  CanvasEdge,
  CuratedNodeData,
  ConsumptionNodeData,
  MappingRule,
  LayoutConfig
} from './canvas/core/types';

// Node with type-safe data
const node: CanvasNode = {
  id: 'node-1',
  type: 'custom',
  position: { x: 0, y: 0 },
  data: {
    isCuratedFile: true,
    label: 'customers',
    attributes: [
      { name: 'id', type: 'integer', isPrimaryKey: true },
      { name: 'name', type: 'string' }
    ]
  } as CuratedNodeData
};
```

## Utility Functions

Common utilities in `shared/canvasUtils.ts`:

```typescript
import {
  calculateSimilarity,
  findBestMatch,
  layoutNodesInColumn,
  filterNodesByType,
  getConnectedEdges,
  isValidNodeName,
  inferDataType
} from './canvas/shared/canvasUtils';

// String similarity (0 to 1)
const similarity = calculateSimilarity('customer', 'custmer'); // 0.875

// Find best matching column
const match = findBestMatch('customer_id', targetColumns);

// Layout nodes in a vertical column
const positioned = layoutNodesInColumn(nodes, columnX, config);

// Filter nodes by type
const curatedNodes = filterNodesByType(nodes, 'curated');

// Get edges connected to a node
const edges = getConnectedEdges('node-1', allEdges);

// Validate node name
const isValid = isValidNodeName('customer_360'); // true

// Infer data type from name
const dataType = inferDataType('created_at'); // 'timestamp'
```

## Migration Path

### Current State (January 2025)
- ✅ Core types and configuration defined
- ✅ Hierarchy manager extracted
- ✅ Field mappings extracted
- ✅ Utilities created in TypeScript
- ✅ React Flow upgraded to v11
- 🔄 Existing canvas pages still using old code

### Next Steps
1. **Gradual adoption**: Import and use new modules in existing pages
2. **Component extraction**: Extract individual components to TypeScript
3. **Full migration**: Replace old canvas implementations with modular versions
4. **Performance optimization**: Add virtualization and memoization

### Using New Modules in Existing Code

```javascript
// In CanvasPageGold.jsx (existing file)
import { useHierarchyManager } from '../canvas/gold/hooks/useHierarchyManager';
import { useFieldMappings } from '../canvas/gold/hooks/useFieldMappings';
import { calculateGoldLayout } from '../canvas/gold/utils/nodePositioning';
import { GOLD_LAYOUT_CONFIG } from '../canvas/core/canvasConfig';

// Replace old state management
const {
  expandedConsumptionEntities,
  toggleConsumptionEntity,
  getVisibleNodes
} = useHierarchyManager(edges);

// Replace old mapping logic
const { generateMappings } = useFieldMappings();
const autoMappings = generateMappings(sourceColumns, targetColumns);

// Replace old positioning logic
const { consumption, curated } = calculateGoldLayout(
  consumptionNodes,
  curatedNodes,
  expandedCuratedEntities,
  edges,
  GOLD_LAYOUT_CONFIG
);
```

## Performance Considerations

- **Memoization**: Use `useMemo` for expensive calculations
- **Debouncing**: Layout recalculations are debounced (300ms)
- **Virtualization**: Planned for >200 nodes
- **Edge optimization**: Only render visible edges

## Testing

```typescript
// Unit tests for utilities
import { calculateSimilarity, findBestMatch } from './canvas/shared/canvasUtils';

test('exact match should return confidence 1.0', () => {
  const result = findBestMatch('id', ['id', 'name', 'email']);
  expect(result?.confidence).toBe(1.0);
});

// Integration tests for hooks
import { renderHook, act } from '@testing-library/react-hooks';
import { useHierarchyManager } from './canvas/gold/hooks/useHierarchyManager';

test('toggling consumption entity should expand related curated entities', () => {
  const { result } = renderHook(() => useHierarchyManager(mockEdges));

  act(() => {
    result.current.toggleConsumptionEntity('consumption-1');
  });

  expect(result.current.expandedConsumptionEntities.has('consumption-1')).toBe(true);
});
```

## Contributing

When adding new canvas features:

1. **Define types first** in `core/types.ts`
2. **Add configuration** to `core/canvasConfig.ts`
3. **Create utilities** in `shared/canvasUtils.ts` or specific canvas folders
4. **Build components** using types and utilities
5. **Write tests** for new functionality
6. **Update this README** with usage examples

## See Also

- [ARCHITECTURE.md](/ARCHITECTURE.md) - Overall architecture plan
- [React Flow Documentation](https://reactflow.dev/) - React Flow v11 docs
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript reference
