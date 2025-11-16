# Nexa-Web Architecture Plan

## Canvas Consolidation Strategy

### Current State (January 2025)

We have two canvas implementations:
1. **dataflow-ui** - Modern TypeScript implementation with React Flow v11
2. **nexa-web** - Production JavaScript implementation with react-flow-renderer (older version)

### Decision: Unified Canvas in nexa-web

**Primary Implementation:** nexa-web (with modernization)
**Status:** dataflow-ui features integrated, canvas consolidation in progress

## Architecture Evolution Roadmap

### Phase 1: Modernization ✅ IN PROGRESS

#### 1.1 React Flow Upgrade
- **From:** `react-flow-renderer` (deprecated)
- **To:** `reactflow@11.x` (latest stable)
- **Impact:** Better performance, modern APIs, active maintenance
- **Risk:** Low - API is mostly compatible with migration path

**Breaking Changes to Address:**
```javascript
// Old (react-flow-renderer)
import ReactFlow from 'react-flow-renderer';

// New (reactflow@11)
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';
```

#### 1.2 TypeScript Gradual Migration
- **Strategy:** New files in TypeScript, convert existing files incrementally
- **Order:** Utilities → Components → Canvas files
- **Target:** 100% TypeScript coverage by Q2 2025

**TypeScript Adoption Plan:**
1. ✅ Utilities (presenceUtils.ts, hooks)
2. 🔄 Shared components (nodes, edges)
3. 🔄 Bronze Canvas (simpler, good starting point)
4. 🔄 Gold Canvas (complex, save for last)

#### 1.3 Gold Canvas Modularization
**Problem:** Single 4000+ line file is hard to maintain
**Solution:** Break into focused, testable modules

**New Structure:**
```
nexa-web/src/
├── canvas/
│   ├── core/
│   │   ├── types.ts              # Shared TypeScript types
│   │   ├── useCanvasState.ts     # Zustand store for canvas state
│   │   └── canvasConfig.ts       # Shared configuration
│   │
│   ├── bronze/
│   │   ├── BronzeCanvas.tsx      # Main Bronze canvas (migrated)
│   │   ├── BronzeNodes.tsx       # Node components
│   │   └── useBronzeData.ts      # Data fetching hook
│   │
│   ├── gold/
│   │   ├── GoldCanvas.tsx        # Refactored main canvas
│   │   ├── components/
│   │   │   ├── GoldCanvasHeader.tsx
│   │   │   ├── ConsumptionEntityNode.tsx
│   │   │   ├── CuratedEntityNode.tsx
│   │   │   └── RelationshipControls.tsx
│   │   ├── hooks/
│   │   │   ├── useGoldData.ts
│   │   │   ├── useHierarchyManager.ts   # Smart expansion logic
│   │   │   └── useFieldMappings.ts
│   │   └── utils/
│   │       ├── hierarchyEngine.ts       # Core hierarchy logic
│   │       ├── mappingEngine.ts         # Auto-mapping algorithms
│   │       └── nodePositioning.ts       # Layout calculations
│   │
│   └── shared/
│       ├── CustomEdge.tsx        # Reusable edge component
│       ├── NodeWrapper.tsx       # Common node wrapper
│       └── canvasUtils.ts        # Shared utilities
│
└── screens/
    ├── CanvasPage.jsx            # Bronze entry point (keep for now)
    └── CanvasPageGold.jsx        # Gold entry point (keep for now)
```

### Phase 2: Shared Infrastructure (Q1 2025)

#### 2.1 Unified State Management
Create shared Zustand store for canvas operations:

```typescript
// canvas/core/useCanvasStore.ts
interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNode: string | null;
  addNode: (node: Node) => void;
  updateNode: (id: string, data: any) => void;
  // ... etc
}
```

#### 2.2 Common Node Components
Reusable, styled node components for all canvas types:

```typescript
// canvas/shared/NodeWrapper.tsx
interface NodeWrapperProps {
  type: 'raw' | 'curated' | 'consumption';
  title: string;
  columns: Column[];
  icon?: string;
  onEdit?: () => void;
}
```

#### 2.3 Smart Layout Engine
Extract and generalize the Gold Canvas hierarchy logic:

```typescript
// canvas/gold/utils/hierarchyEngine.ts
export class HierarchyEngine {
  expandEntity(entityId: string): void;
  collapseEntity(entityId: string): void;
  getVisibleNodes(): Node[];
  calculateLayout(): Layout;
}
```

### Phase 3: Feature Parity & Enhancement (Q2 2025)

#### 3.1 Bronze Canvas Enhancements
- Add similar smart expansion to Bronze (if needed)
- Improve auto-mapping algorithm
- Better visual feedback for transformations

#### 3.2 Gold Canvas Optimization
- Performance optimization for large graphs (100+ nodes)
- Virtual rendering for off-screen nodes
- Improved edge routing algorithms

#### 3.3 Cross-Canvas Features
- ✅ Collaborative presence (already implemented)
- Version history and rollback
- Export to various formats (PNG, SVG, JSON)
- Canvas templates and patterns

### Phase 4: dataflow-ui Retirement (Q2 2025)

**Status Check Before Retirement:**
- ✅ Deploy screen integrated
- ✅ Promotions screen integrated
- ✅ Observe screen integrated
- ✅ Connections screen integrated
- ✅ Pipelines screen integrated
- ✅ All TypeScript utilities ported
- ✅ React Flow v11 upgraded
- 🔄 Canvas modernization complete

**Retirement Steps:**
1. Final audit of dataflow-ui for any missed features
2. Archive repository with clear README pointing to nexa-web
3. Update all documentation references
4. Remove from CI/CD pipelines

## Technical Decisions

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowJs": true,
    "checkJs": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### React Flow v11 Features to Leverage
1. **Background Patterns** - Better grid visualization
2. **Mini Map** - Improved navigation for large graphs
3. **Connection Lines** - Better edge creation UX
4. **Node Resizer** - Allow dynamic node sizing
5. **Sub Flows** - Group related nodes

### State Management Strategy
- **Zustand** for canvas state (lightweight, no boilerplate)
- **React Query** for server state (API calls, caching)
- **React Context** for auth and user preferences
- Local state for UI-only concerns

## Migration Checklist

### React Flow v11 Upgrade
- [ ] Update package.json dependencies
- [ ] Update imports from react-flow-renderer → reactflow
- [ ] Add reactflow CSS import
- [ ] Update nodeTypes and edgeTypes syntax
- [ ] Test Bronze Canvas
- [ ] Test Gold Canvas
- [ ] Test entity mapping flows

### TypeScript Conversion
- [ ] Add TypeScript config
- [ ] Install type definitions
- [ ] Convert utility files
- [ ] Convert shared components
- [ ] Convert Bronze Canvas
- [ ] Convert Gold Canvas
- [ ] Fix all type errors
- [ ] Remove any usage

### Gold Canvas Modularization
- [ ] Create new directory structure
- [ ] Extract GoldCanvasHeader component
- [ ] Extract ConsumptionEntityNode component
- [ ] Extract CuratedEntityNode component
- [ ] Extract hierarchy manager hook
- [ ] Extract mapping engine
- [ ] Extract positioning utilities
- [ ] Update main GoldCanvas file
- [ ] Test all functionality
- [ ] Remove old code

## Performance Targets

### Current Performance
- Gold Canvas with 50 nodes: ~200ms render time
- Large graphs (100+ nodes): Can be sluggish

### Target Performance
- Gold Canvas with 50 nodes: <100ms render time
- Gold Canvas with 200 nodes: <300ms render time
- Initial load: <2 seconds
- Interaction response: <16ms (60fps)

### Optimization Strategies
1. Memoization of expensive calculations
2. Virtual rendering for off-screen nodes
3. Debounced layout recalculations
4. Web Workers for heavy computations
5. Code splitting and lazy loading

## Testing Strategy

### Unit Tests
- Utility functions (mappingEngine, hierarchyEngine)
- Hooks (usePresence, useHierarchyManager)
- Pure components

### Integration Tests
- Canvas node interactions
- Edge creation and deletion
- State updates and persistence

### E2E Tests
- Complete bronze flow (upload → curate → generate code)
- Complete gold flow (curate → consumption → 360 view)
- Multi-user collaboration scenarios

## Documentation Requirements

### Developer Documentation
- [ ] Canvas component API reference
- [ ] Custom hooks documentation
- [ ] State management patterns
- [ ] Adding new node types guide
- [ ] Testing guidelines

### User Documentation
- [ ] Bronze Canvas user guide
- [ ] Gold Canvas user guide
- [ ] Collaborative editing guide
- [ ] Troubleshooting common issues

## Success Metrics

### Code Quality
- TypeScript coverage: 100%
- Test coverage: >80%
- No ESLint errors
- Bundle size: <500KB (canvas modules)

### Performance
- Lighthouse score: >90
- Time to Interactive: <3s
- Largest Contentful Paint: <2.5s

### Maintainability
- Average file size: <300 lines
- Cyclomatic complexity: <10
- Code duplication: <5%

## Timeline

**Q1 2025 (Current Quarter)**
- Week 1-2: ✅ Collaborative presence feature
- Week 3-4: 🔄 React Flow v11 upgrade
- Week 5-6: 🔄 TypeScript gradual migration
- Week 7-8: 🔄 Gold Canvas modularization

**Q2 2025**
- Shared infrastructure buildout
- Performance optimization
- dataflow-ui retirement
- Comprehensive testing

## Risks & Mitigation

### Risk 1: Breaking Changes During Upgrade
**Mitigation:**
- Comprehensive testing before merge
- Feature flags for gradual rollout
- Keep old code until new code is proven

### Risk 2: Lost Functionality During Refactor
**Mitigation:**
- Detailed feature audit before starting
- Side-by-side comparison testing
- User acceptance testing

### Risk 3: TypeScript Learning Curve
**Mitigation:**
- Gradual adoption (not big bang)
- Team training sessions
- Allow any usage temporarily during transition

## Conclusion

This architecture plan provides a clear path to modernize the nexa-web canvas implementation while maintaining stability and feature parity. The gradual, phased approach minimizes risk while delivering continuous improvements.

**Next Steps:**
1. Execute React Flow v11 upgrade
2. Begin TypeScript conversion with utilities
3. Start Gold Canvas modularization
4. Monitor performance and iterate
