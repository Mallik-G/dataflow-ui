# EditEntityMappingsPage - Quick Reference Card

## Component Props

```typescript
interface Props {
  entityName?: string; // "raw.customers"
  curatedEntities?: string[]; // ["curated.customers"]
  fileData?: FileData[]; // File metadata array
}
```

## Key State Variables

```typescript
const [rawAttributes, setRawAttributes] = useState<string[]>([]);
const [curatedAttributes, setCuratedAttributes] = useState<string[]>([]);
const [mappings, setMappings] = useState<Mapping[]>([]);
const [loading, setLoading] = useState<boolean>(true);
const [columnDescriptions, setColumnDescriptions] = useState<
  Record<string, string>
>({});
```

## Core Functions

```typescript
// Update a mapping
updateMapping(idx: number, field: string, value: string): Promise<void>

// Delete a mapping
deleteMapping(idx: number): Promise<void>

// Add new mapping
addMapping(): void

// Save new column
saveNewColumn(idx: number): Promise<void>

// Auto-save transformations
autoSaveMappings(mappings?: Mapping[], descriptions?: Record<string, string>): Promise<void>
```

## API Endpoints

```typescript
// Get schema
GET / api / raw - schemas / { entityName };

// Get metadata
GET / api / raw - schemas / { entityName } / column - metadata;

// Get saved transformations
GET / api / transformations / { entityName };

// Save transformations
POST / api / transformations / save;
```

## Control Columns

```typescript
const controlColumns = [
  "_ingest_timestamp", // When data was ingested
  "_source_system", // Source system ID
  "_record_status", // Validation status
  "_update_timestamp", // Last update time
  "_batch_id", // Processing batch
  "_created_by", // Record creator
  "_updated_by", // Last updater
];
```

## Common Patterns

### Basic Usage

```jsx
<EditEntityMappingsPage
  entityName="raw.customers"
  curatedEntities={["curated.customers"]}
  fileData={[{ key: "customers.csv", name: "customers.csv" }]}
/>
```

### Route Integration

```jsx
<Route
  path="/edit-entity-mappings/:entityName"
  element={<EditEntityMappingsPage />}
/>
```

### Navigation

```javascript
navigate(`/edit-entity-mappings/${encodeURIComponent(entityName)}`);
```

## Validation Rules

- ❌ Cannot use control column names for custom columns
- ❌ Cannot delete control columns
- ❌ Cannot modify control column descriptions
- ✅ Column names must be non-empty
- ✅ Entity names must be URL-encoded

## Error Handling

```javascript
// Schema loading errors
if (!schemaResponse.data.success) {
  alert("No schema found for this entity");
  setLoading(false);
  return;
}

// Validation errors
if (controlColumns.includes(value)) {
  alert("Cannot use a control column name");
  return;
}

// Auto-save errors (silent)
try {
  await autoSaveMappings();
} catch (error) {
  // Silent error handling
}
```

## Performance Tips

- Use `useMemo` for expensive computations
- Implement debounced auto-save
- Use functional state updates
- Handle cleanup in useEffect

## Testing

```javascript
// Mock API responses
jest.spyOn(axios, "get").mockResolvedValue({
  data: { success: true, schema: { schemaAttributes: ["id", "name"] } },
});

// Test component rendering
render(<EditEntityMappingsPage {...mockProps} />);

// Test user interactions
fireEvent.change(screen.getByDisplayValue("id"), {
  target: { value: "new_id" },
});
```

## Common Issues & Solutions

| Issue                    | Solution                                 |
| ------------------------ | ---------------------------------------- |
| Schema not loading       | Check entity name format, verify backend |
| Auto-save not working    | Check API status, verify auth            |
| Control columns editable | Refresh component, check state           |
| Memory leaks             | Use cleanup functions in useEffect       |
| Race conditions          | Use functional state updates             |

## File Structure

```
src/screens/EditEntityMappingsPage.jsx
├── Props & State (Lines 29-87)
├── Data Loading (Lines 89-188)
├── State Restoration (Lines 191-265)
├── Control Columns (Lines 268-294)
├── Core Functions (Lines 297-677)
└── UI Rendering (Lines 683-1117)
```

## Dependencies

```json
{
  "react": "^18.0.0",
  "react-bootstrap": "^2.0.0",
  "react-icons": "^4.0.0",
  "axios": "^1.0.0"
}
```

## Quick Debug Commands

```javascript
// Check component state
console.log("Mappings:", mappings);
console.log("Loading:", loading);
console.log("Raw Attributes:", rawAttributes);

// Test validation
console.log("Is Control Column:", isControlColumn("_ingest_timestamp"));

// Check API calls
// Use browser dev tools Network tab
```

---

**Need more details?** See the full documentation in the `docs/` folder.


