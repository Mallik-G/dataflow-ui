# EditEntityMappingsPage Documentation Index

## Overview

This documentation suite provides comprehensive coverage of the `EditEntityMappingsPage` component, a critical part of the data transformation pipeline. The documentation is designed to help both new and experienced developers understand, maintain, and extend this component.

## Documentation Structure

### 1. [Main Component Documentation](./EditEntityMappingsPage.md)

**Purpose**: High-level overview and component architecture
**Contents**:

- Component overview and purpose
- Props interface and data types
- Key features and capabilities
- State management structure
- Component lifecycle
- UI components and visual indicators
- Error handling patterns
- Best practices
- Dependencies and related components

### 2. [Function Documentation](./EditEntityMappingsPage-Functions.md)

**Purpose**: Detailed function-by-function analysis
**Contents**:

- Core functions (mapping management)
- Utility functions (validation, helpers)
- Auto-save functionality
- Modal handlers
- Data loading functions
- State initialization
- Error handling patterns
- Performance considerations
- Testing guidelines

### 3. [API Documentation](./EditEntityMappingsPage-API.md)

**Purpose**: Backend integration and data flow
**Contents**:

- API endpoints and specifications
- Request/response formats
- Data types and interfaces
- Error handling and responses
- Data flow diagrams
- Performance considerations
- Security considerations
- Testing strategies

### 4. [Usage Examples and Patterns](./EditEntityMappingsPage-Usage-Examples.md)

**Purpose**: Practical implementation guidance
**Contents**:

- Basic usage examples
- Common patterns and best practices
- Advanced usage scenarios
- Integration examples
- Error handling patterns
- Performance optimization
- Testing patterns
- Common pitfalls and solutions

## Quick Start Guide

### For New Developers

1. **Start with**: [Main Component Documentation](./EditEntityMappingsPage.md)

   - Understand the component's purpose and architecture
   - Learn about props, state, and key features

2. **Then read**: [Function Documentation](./EditEntityMappingsPage-Functions.md)

   - Understand how each function works
   - Learn about the component's internal logic

3. **Next**: [API Documentation](./EditEntityMappingsPage-API.md)

   - Understand backend integration
   - Learn about data flow and persistence

4. **Finally**: [Usage Examples](./EditEntityMappingsPage-Usage-Examples.md)
   - See practical examples
   - Learn common patterns and best practices

### For Experienced Developers

1. **Quick Reference**: [API Documentation](./EditEntityMappingsPage-API.md)

   - Check endpoint specifications
   - Understand data formats

2. **Implementation**: [Usage Examples](./EditEntityMappingsPage-Usage-Examples.md)

   - Find integration patterns
   - Learn optimization techniques

3. **Debugging**: [Function Documentation](./EditEntityMappingsPage-Functions.md)
   - Understand function behavior
   - Debug specific issues

## Component Architecture Summary

```
EditEntityMappingsPage
├── Props Interface
│   ├── entityName: string
│   ├── curatedEntities: string[]
│   └── fileData: FileData[]
├── State Management
│   ├── Core Data (mappings, attributes)
│   ├── UI State (loading, modals)
│   └── Transformation State (rules, descriptions)
├── API Integration
│   ├── Schema Loading
│   ├── Metadata Fetching
│   ├── Transformation Persistence
│   └── Auto-save Functionality
└── User Interface
    ├── Mappings Table
    ├── Action Modals
    ├── Description Management
    └── Visual Indicators
```

## Key Concepts

### Data Flow

1. **Initialization**: Load schema and metadata
2. **State Restoration**: Restore saved transformations
3. **User Interaction**: Update mappings and descriptions
4. **Auto-save**: Persist changes to backend
5. **Validation**: Ensure data integrity

### Core Features

- **Column Mapping**: Raw to curated column mapping
- **Control Columns**: System-managed metadata columns
- **Column Descriptions**: AI-generated and user-editable descriptions
- **New Column Creation**: Dynamic column addition
- **Auto-save**: Automatic persistence of changes

### API Endpoints

- `GET /api/raw-schemas/{entityName}` - Schema information
- `GET /api/raw-schemas/{entityName}/column-metadata` - Column metadata
- `GET /api/transformations/{entityName}` - Saved transformations
- `POST /api/transformations/save` - Save transformations

## Common Use Cases

### 1. Basic Entity Mapping

```jsx
<EditEntityMappingsPage
  entityName="raw.customers"
  curatedEntities={["curated.customers"]}
  fileData={[{ key: "customers.csv", name: "customers.csv" }]}
/>
```

### 2. Route-based Navigation

```jsx
<Route
  path="/edit-entity-mappings/:entityName"
  element={<EditEntityMappingsPage />}
/>
```

### 3. Integration with Parent Component

```jsx
const handleEditMappings = (entityName) => {
  navigate(`/edit-entity-mappings/${encodeURIComponent(entityName)}`);
};
```

## Troubleshooting Guide

### Common Issues

1. **Schema not loading**

   - Check entity name format
   - Verify entity exists in backend
   - Check network connectivity

2. **Auto-save not working**

   - Check backend API status
   - Verify authentication
   - Check browser console for errors

3. **Control columns appearing editable**
   - Refresh component
   - Check state initialization
   - Verify control column logic

### Debug Steps

1. **Check Component State**

   ```javascript
   console.log("Raw Attributes:", rawAttributes);
   console.log("Mappings:", mappings);
   console.log("Loading:", loading);
   ```

2. **Verify API Calls**

   ```javascript
   // Check network tab in browser dev tools
   // Look for failed requests
   // Verify response formats
   ```

3. **Test Individual Functions**

   ```javascript
   // Test mapping updates
   updateMapping(0, "curated", "new_column_name");

   // Test validation
   isControlColumn("_ingest_timestamp"); // Should return true
   ```

## Performance Considerations

### Optimization Strategies

- **Debounced Auto-save**: Prevent excessive API calls
- **Memoized Computations**: Cache expensive calculations
- **Efficient State Updates**: Use functional updates
- **Error Boundaries**: Graceful error handling

### Monitoring

- **API Response Times**: Monitor backend performance
- **State Update Frequency**: Track re-renders
- **Memory Usage**: Watch for memory leaks
- **User Experience**: Monitor loading times

## Security Considerations

### Input Validation

- **Entity Names**: URL-encode special characters
- **Column Names**: Validate against reserved names
- **Descriptions**: Sanitize user input
- **API Calls**: Validate responses

### Access Control

- **Authentication**: All endpoints require auth
- **Authorization**: Entity access controlled by backend
- **Data Privacy**: Sensitive data handling
- **Audit Trail**: Track user actions

## Testing Strategy

### Unit Tests

- **Function Testing**: Test individual functions
- **State Management**: Test state updates
- **Validation Logic**: Test input validation
- **Error Handling**: Test error scenarios

### Integration Tests

- **API Integration**: Test backend communication
- **User Workflows**: Test complete user journeys
- **Data Persistence**: Test save/load functionality
- **Error Recovery**: Test error handling

### End-to-End Tests

- **User Scenarios**: Test real user workflows
- **Cross-browser**: Test browser compatibility
- **Performance**: Test under load
- **Accessibility**: Test accessibility compliance

## Maintenance Guidelines

### Code Updates

1. **Follow Patterns**: Use established patterns
2. **Update Tests**: Keep tests current
3. **Document Changes**: Update documentation
4. **Review Changes**: Code review process

### Performance Monitoring

1. **Track Metrics**: Monitor key performance indicators
2. **Profile Code**: Identify bottlenecks
3. **Optimize**: Implement performance improvements
4. **Test**: Verify improvements

### Security Updates

1. **Dependency Updates**: Keep dependencies current
2. **Security Patches**: Apply security patches
3. **Vulnerability Scanning**: Regular security scans
4. **Access Review**: Review access permissions

## Future Enhancements

### Planned Features

- **Bulk Operations**: Support for bulk column operations
- **Advanced Transformations**: More complex transformation rules
- **Data Preview**: Preview of transformed data
- **Version Control**: Track changes over time
- **Collaboration**: Multi-user editing capabilities

### Technical Improvements

- **Performance**: Optimize rendering and API calls
- **Accessibility**: Improve accessibility compliance
- **Mobile Support**: Better mobile experience
- **Offline Support**: Work offline capabilities
- **Real-time Updates**: Live collaboration features

## Contributing Guidelines

### Code Standards

- **ESLint**: Follow linting rules
- **TypeScript**: Use TypeScript for type safety
- **Testing**: Write comprehensive tests
- **Documentation**: Update documentation

### Pull Request Process

1. **Create Branch**: Use feature branch
2. **Write Tests**: Add/update tests
3. **Update Docs**: Update documentation
4. **Code Review**: Request review
5. **Merge**: Merge after approval

### Issue Reporting

1. **Bug Reports**: Include reproduction steps
2. **Feature Requests**: Describe use case
3. **Documentation**: Report unclear docs
4. **Performance**: Report performance issues

## Contact and Support

### Documentation Issues

- **Clarity**: Report unclear documentation
- **Accuracy**: Report incorrect information
- **Completeness**: Request additional information
- **Examples**: Request more examples

### Technical Support

- **Component Issues**: Report component bugs
- **API Issues**: Report API problems
- **Integration**: Help with integration
- **Performance**: Performance optimization help

---

**Last Updated**: January 2024
**Version**: 1.0
**Maintainer**: Development Team


