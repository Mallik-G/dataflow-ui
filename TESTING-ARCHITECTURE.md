# Testing Architecture

**Production-Grade Testing Framework for Nexa Platform**

## Overview

This document defines the comprehensive testing strategy for all data flows, SQL generation, canvas operations, and deployment processes. Every change triggers automated validation against Databricks SQL Warehouse with realistic synthetic data.

---

## Testing Layers

### 1. **Unit Tests** - Component Level
**Location**: `/nexa-web/tests/unit/`
**Scope**: Individual functions, utilities, hooks
**Tools**: Jest, React Testing Library
**Coverage Target**: >90%

### 2. **Integration Tests** - Flow Level
**Location**: `/nexa-web/tests/integration/`
**Scope**: Complete data flows (Bronze → Curated → Gold)
**Tools**: Jest, @testing-library/react-hooks, Supertest
**Coverage Target**: >80%

### 3. **E2E Tests** - User Journey
**Location**: `/nexa-web/tests/e2e/`
**Scope**: Full user workflows with UI interactions
**Tools**: Playwright, Faker.js
**Coverage Target**: Critical paths 100%

### 4. **SQL Validation** - Databricks Warehouse
**Location**: `/nexa-web/tests/sql/`
**Scope**: Generated SQL correctness and performance
**Tools**: Databricks SDK, Custom validators
**Coverage Target**: All generated SQL 100%

---

## Test Data Strategy

### Synthetic Data Generation with Faker.js

**Principles:**
- **Realistic**: Data matches real-world patterns and distributions
- **Deterministic**: Seeded for reproducibility
- **Scalable**: Generate 10 to 10M records on demand
- **Schema-aware**: Respects column types and constraints

**Data Generators by Layer:**

#### Bronze Layer (Raw Data)
```typescript
// Location: /tests/fixtures/bronze/
- customers.faker.ts      // Customer demographic data
- orders.faker.ts         // Transaction data
- products.faker.ts       // Product catalog
- events.faker.ts         // Clickstream/event data
- iot_sensors.faker.ts    // IoT telemetry
```

**Example Structure:**
```typescript
// customers.faker.ts
import { faker } from '@faker-js/faker';

export interface RawCustomer {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  created_at: string;
  source_system: string;
}

export function generateRawCustomers(count: number, seed?: number): RawCustomer[] {
  if (seed) faker.seed(seed);

  return Array.from({ length: count }, (_, i) => ({
    customer_id: faker.string.uuid(),
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zip_code: faker.location.zipCode(),
    created_at: faker.date.past({ years: 2 }).toISOString(),
    source_system: faker.helpers.arrayElement(['CRM', 'Website', 'Mobile App']),
  }));
}

// Generate with quality issues for validation testing
export function generateRawCustomersWithIssues(count: number): RawCustomer[] {
  const customers = generateRawCustomers(count);

  // Inject realistic data quality issues (10% defect rate)
  return customers.map((customer, i) => {
    if (i % 10 === 0) {
      // Null email (missing data)
      return { ...customer, email: null as any };
    }
    if (i % 10 === 1) {
      // Invalid phone format
      return { ...customer, phone: '123' };
    }
    if (i % 10 === 2) {
      // Duplicate customer_id
      return { ...customer, customer_id: customers[0].customer_id };
    }
    return customer;
  });
}
```

#### Curated Layer (Transformed Data)
```typescript
// Location: /tests/fixtures/curated/
- customer_360.faker.ts   // Deduplicated, enriched customers
- order_facts.faker.ts    // Aggregated order metrics
- product_dim.faker.ts    // Product dimension table
```

#### Gold Layer (Consumption Data)
```typescript
// Location: /tests/fixtures/gold/
- customer_insights.faker.ts  // ML-ready customer features
- sales_analytics.faker.ts    // Business intelligence views
- real_time_metrics.faker.ts  // Streaming aggregations
```

---

## Flow-Based Test Cases

### Test Case Structure

Each flow has a standardized test suite:

```typescript
// Location: /tests/flows/
describe('Flow: Bronze -> Curated (Customers)', () => {
  // 1. Setup - Generate test data
  // 2. Execute - Run transformations
  // 3. Validate - Check results
  // 4. SQL Verify - Validate against Databricks
  // 5. Cleanup - Remove test data
});
```

---

## 1. Bronze Flow Tests

**Location**: `/tests/flows/bronze/`

### BronzeCustomerFlow.test.ts

```typescript
import { generateRawCustomers, generateRawCustomersWithIssues } from '../../fixtures/bronze/customers.faker';
import { validateBronzeSchema } from '../../validators/schema.validator';
import { executeSQLOnDatabricks } from '../../utils/databricks.client';

describe('Bronze Flow: Raw Customer Ingestion', () => {
  let testData: RawCustomer[];
  let testTableName: string;

  beforeEach(() => {
    // Generate deterministic test data
    testData = generateRawCustomers(1000, 12345);
    testTableName = `raw.customers_test_${Date.now()}`;
  });

  afterEach(async () => {
    // Cleanup test table
    await executeSQLOnDatabricks(`DROP TABLE IF EXISTS ${testTableName}`);
  });

  test('should ingest raw CSV files into Bronze table', async () => {
    // 1. Upload CSV to S3 mock
    const csvContent = convertToCSV(testData);
    await uploadToMockS3('bronze/customers.csv', csvContent);

    // 2. Trigger ingestion
    const result = await triggerBronzeIngestion('customers');

    // 3. Validate record count
    expect(result.recordsIngested).toBe(1000);

    // 4. Validate schema
    const schema = await getDatabricksTableSchema(testTableName);
    expect(validateBronzeSchema(schema, 'customers')).toBe(true);

    // 5. Validate data quality
    const qualityReport = await runDataQualityChecks(testTableName);
    expect(qualityReport.nullPercentage).toBeLessThan(5);
    expect(qualityReport.duplicateCount).toBe(0);
  });

  test('should handle data quality issues gracefully', async () => {
    // Generate data with known issues
    const badData = generateRawCustomersWithIssues(1000);
    const csvContent = convertToCSV(badData);
    await uploadToMockS3('bronze/customers_bad.csv', csvContent);

    // Trigger ingestion
    const result = await triggerBronzeIngestion('customers_bad');

    // Should quarantine bad records
    expect(result.quarantinedRecords).toBe(100); // 10% defect rate
    expect(result.successRecords).toBe(900);

    // Validate quarantine table exists
    const quarantineExists = await tableExists(`${testTableName}_quarantine`);
    expect(quarantineExists).toBe(true);
  });

  test('should validate SQL syntax before execution', async () => {
    const sql = generateBronzeIngestionSQL('customers', testTableName);

    // Validate SQL syntax without executing
    const validation = await validateSQLSyntax(sql);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should handle schema evolution', async () => {
    // Initial load
    await triggerBronzeIngestion('customers', testData);

    // Add new column to source data
    const evolvedData = testData.map(c => ({
      ...c,
      loyalty_tier: faker.helpers.arrayElement(['Bronze', 'Silver', 'Gold']),
    }));

    // Trigger second load
    const result = await triggerBronzeIngestion('customers', evolvedData);

    // Should auto-add new column
    const schema = await getDatabricksTableSchema(testTableName);
    expect(schema.columns.find(c => c.name === 'loyalty_tier')).toBeDefined();
  });
});
```

---

## 2. Curated Flow Tests

**Location**: `/tests/flows/curated/`

### CuratedCustomer360Flow.test.ts

```typescript
describe('Curated Flow: Customer 360 Transformation', () => {
  let rawCustomers: RawCustomer[];
  let rawOrders: RawOrder[];
  let rawEvents: RawEvent[];

  beforeEach(() => {
    // Generate linked test data
    rawCustomers = generateRawCustomers(1000, 12345);
    rawOrders = generateRawOrders(5000, rawCustomers, 12345);
    rawEvents = generateRawEvents(50000, rawCustomers, 12345);
  });

  test('should deduplicate customers based on email', async () => {
    // Create duplicates with same email
    const duplicates = [
      { ...rawCustomers[0], customer_id: 'dup1' },
      { ...rawCustomers[0], customer_id: 'dup2' },
      rawCustomers[0],
    ];

    await loadBronzeData('customers', duplicates);

    // Run deduplication transformation
    const result = await runCuratedTransformation('customer_dedup');

    // Should keep only one record
    const count = await queryDatabricks(
      `SELECT COUNT(*) as cnt FROM curated.customers WHERE email = '${rawCustomers[0].email}'`
    );
    expect(count[0].cnt).toBe(1);
  });

  test('should enrich customers with aggregated metrics', async () => {
    await loadBronzeData('customers', rawCustomers);
    await loadBronzeData('orders', rawOrders);

    // Run enrichment
    await runCuratedTransformation('customer_360');

    // Validate enrichment fields
    const enriched = await queryDatabricks(
      `SELECT * FROM curated.customer_360 LIMIT 1`
    );

    expect(enriched[0]).toHaveProperty('total_orders');
    expect(enriched[0]).toHaveProperty('total_spend');
    expect(enriched[0]).toHaveProperty('avg_order_value');
    expect(enriched[0]).toHaveProperty('last_order_date');
    expect(enriched[0]).toHaveProperty('customer_lifetime_value');
  });

  test('should apply SCD Type 2 for historical tracking', async () => {
    // Initial load
    await loadCuratedData('customers', rawCustomers);

    // Update customer address
    const updatedCustomer = {
      ...rawCustomers[0],
      address: '123 New Street',
    };

    // Trigger SCD Type 2 update
    await runCuratedTransformation('customer_scd2', [updatedCustomer]);

    // Should have 2 records: old (expired) and new (current)
    const history = await queryDatabricks(
      `SELECT * FROM curated.customers WHERE customer_id = '${rawCustomers[0].customer_id}' ORDER BY effective_date`
    );

    expect(history).toHaveLength(2);
    expect(history[0].is_current).toBe(false);
    expect(history[0].expiration_date).not.toBeNull();
    expect(history[1].is_current).toBe(true);
    expect(history[1].address).toBe('123 New Street');
  });

  test('should validate generated SQL produces expected results', async () => {
    // Get SQL from mapping configuration
    const mapping = getEntityMapping('raw.customers', 'curated.customer_360');
    const sql = generateTransformationSQL(mapping);

    // Validate SQL syntax
    const syntaxCheck = await validateSQLSyntax(sql);
    expect(syntaxCheck.isValid).toBe(true);

    // Execute and validate results
    const result = await executeSQLOnDatabricks(sql);
    expect(result.recordCount).toBeGreaterThan(0);

    // Validate schema matches expectations
    const schema = result.schema;
    expect(schema.columns.map(c => c.name)).toContain('customer_id');
    expect(schema.columns.map(c => c.name)).toContain('total_orders');
  });
});
```

---

## 3. Gold Flow Tests

**Location**: `/tests/flows/gold/`

### GoldConsumptionFlow.test.ts

```typescript
describe('Gold Flow: Consumption Layer Generation', () => {
  test('should create 360° view from multiple curated entities', async () => {
    // Load curated data
    await loadCuratedData('customers', generateCuratedCustomers(1000));
    await loadCuratedData('orders', generateCuratedOrders(5000));
    await loadCuratedData('products', generateCuratedProducts(100));
    await loadCuratedData('events', generateCuratedEvents(50000));

    // Generate 360° view
    const result = await generate360View('customer_360', [
      'curated.customers',
      'curated.orders',
      'curated.products',
      'curated.events',
    ]);

    // Validate all entities are joined
    const viewData = await queryDatabricks(
      `SELECT * FROM gold.customer_360_view LIMIT 10`
    );

    expect(viewData[0]).toHaveProperty('customer_id');
    expect(viewData[0]).toHaveProperty('total_orders');
    expect(viewData[0]).toHaveProperty('favorite_product');
    expect(viewData[0]).toHaveProperty('last_event_timestamp');
  });

  test('should apply business rules and calculations', async () => {
    await loadCuratedData('orders', generateCuratedOrders(1000));

    // Apply business rule: VIP if CLV > $10,000
    await runGoldTransformation('customer_segmentation');

    const vipCustomers = await queryDatabricks(
      `SELECT COUNT(*) as cnt FROM gold.customer_segments WHERE segment = 'VIP'`
    );

    expect(vipCustomers[0].cnt).toBeGreaterThan(0);
  });

  test('should validate consumption layer performance', async () => {
    // Load large dataset
    await loadCuratedData('orders', generateCuratedOrders(1000000));

    // Measure query performance
    const startTime = Date.now();
    await queryDatabricks(
      `SELECT customer_id, SUM(order_total) as total FROM gold.customer_analytics GROUP BY customer_id`
    );
    const duration = Date.now() - startTime;

    // Should complete in under 5 seconds
    expect(duration).toBeLessThan(5000);
  });
});
```

---

## 4. SQL Validation Against Databricks

**Location**: `/tests/sql/`

### DatabricksSQLValidator.ts

```typescript
import { DBSQLClient } from '@databricks/sql';

export class DatabricksSQLValidator {
  private client: DBSQLClient;

  constructor() {
    this.client = new DBSQLClient({
      host: process.env.DATABRICKS_HOST,
      path: process.env.DATABRICKS_HTTP_PATH,
      token: process.env.DATABRICKS_TOKEN,
    });
  }

  /**
   * Validate SQL syntax without executing
   */
  async validateSyntax(sql: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      // Use EXPLAIN to validate syntax
      const explainSQL = `EXPLAIN ${sql}`;
      await this.executeQuery(explainSQL);
      return { isValid: true, errors: [] };
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Validate SQL produces expected schema
   */
  async validateSchema(
    sql: string,
    expectedColumns: { name: string; type: string }[]
  ): Promise<{ matches: boolean; differences: string[] }> {
    const result = await this.executeQuery(`${sql} LIMIT 0`);
    const actualColumns = result.schema.columns;

    const differences: string[] = [];

    // Check all expected columns exist
    for (const expected of expectedColumns) {
      const actual = actualColumns.find(c => c.name === expected.name);
      if (!actual) {
        differences.push(`Missing column: ${expected.name}`);
      } else if (actual.type !== expected.type) {
        differences.push(
          `Type mismatch for ${expected.name}: expected ${expected.type}, got ${actual.type}`
        );
      }
    }

    // Check for unexpected columns
    for (const actual of actualColumns) {
      const expected = expectedColumns.find(c => c.name === actual.name);
      if (!expected) {
        differences.push(`Unexpected column: ${actual.name}`);
      }
    }

    return {
      matches: differences.length === 0,
      differences,
    };
  }

  /**
   * Validate SQL performance
   */
  async validatePerformance(
    sql: string,
    maxDurationMs: number
  ): Promise<{ passedPerformanceCheck: boolean; actualDurationMs: number }> {
    const startTime = Date.now();
    await this.executeQuery(sql);
    const actualDurationMs = Date.now() - startTime;

    return {
      passedPerformanceCheck: actualDurationMs <= maxDurationMs,
      actualDurationMs,
    };
  }

  /**
   * Validate data quality in results
   */
  async validateDataQuality(
    tableName: string
  ): Promise<{
    totalRecords: number;
    nullPercentage: number;
    duplicateCount: number;
    passed: boolean;
  }> {
    // Get total records
    const countResult = await this.executeQuery(
      `SELECT COUNT(*) as cnt FROM ${tableName}`
    );
    const totalRecords = countResult.rows[0].cnt;

    // Check for nulls in key columns
    const columns = await this.getTableColumns(tableName);
    const keyColumns = columns.filter(c => c.isPrimaryKey);

    let totalNulls = 0;
    for (const col of keyColumns) {
      const nullResult = await this.executeQuery(
        `SELECT COUNT(*) as cnt FROM ${tableName} WHERE ${col.name} IS NULL`
      );
      totalNulls += nullResult.rows[0].cnt;
    }

    const nullPercentage = (totalNulls / (totalRecords * keyColumns.length)) * 100;

    // Check for duplicates on primary key
    let duplicateCount = 0;
    if (keyColumns.length > 0) {
      const pkCols = keyColumns.map(c => c.name).join(', ');
      const dupResult = await this.executeQuery(
        `SELECT COUNT(*) as cnt FROM (
          SELECT ${pkCols}, COUNT(*) as dup_count
          FROM ${tableName}
          GROUP BY ${pkCols}
          HAVING COUNT(*) > 1
        )`
      );
      duplicateCount = dupResult.rows[0]?.cnt || 0;
    }

    return {
      totalRecords,
      nullPercentage,
      duplicateCount,
      passed: nullPercentage < 5 && duplicateCount === 0,
    };
  }

  private async executeQuery(sql: string): Promise<any> {
    const session = await this.client.openSession();
    const operation = await session.executeStatement(sql);
    const result = await operation.fetchAll();
    await operation.close();
    await session.close();
    return result;
  }

  async close() {
    await this.client.close();
  }
}
```

---

## 5. Canvas Operation Tests

**Location**: `/tests/canvas/`

### CanvasHierarchyManager.test.ts

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useHierarchyManager } from '../../../nexa-web/src/canvas/gold/hooks/useHierarchyManager';
import { generateMockEdges, generateMockNodes } from '../../fixtures/canvas/nodes.faker';

describe('Canvas: Hierarchy Manager', () => {
  test('should expand consumption entity and related curated entities', () => {
    const mockEdges = generateMockEdges(10);
    const { result } = renderHook(() => useHierarchyManager(mockEdges));

    act(() => {
      result.current.toggleConsumptionEntity('consumption-1');
    });

    expect(result.current.expandedConsumptionEntities.has('consumption-1')).toBe(true);

    // Related curated entities should also be expanded
    const relatedCurated = mockEdges
      .filter(e => e.target === 'consumption-1')
      .map(e => e.source);

    relatedCurated.forEach(id => {
      expect(result.current.expandedCuratedEntities.has(id)).toBe(true);
    });
  });

  test('should collapse orphaned curated entities', () => {
    const mockEdges = generateMockEdges(10);
    const { result } = renderHook(() => useHierarchyManager(mockEdges));

    // Expand two consumption entities
    act(() => {
      result.current.toggleConsumptionEntity('consumption-1');
      result.current.toggleConsumptionEntity('consumption-2');
    });

    // Collapse one
    act(() => {
      result.current.toggleConsumptionEntity('consumption-1');
    });

    // Curated entities only mapped to consumption-1 should be collapsed
    // Curated entities mapped to both should remain expanded
    const curatedOnlyMappedTo1 = mockEdges
      .filter(e => e.target === 'consumption-1')
      .map(e => e.source)
      .filter(id => !mockEdges.some(e => e.source === id && e.target === 'consumption-2'));

    curatedOnlyMappedTo1.forEach(id => {
      expect(result.current.expandedCuratedEntities.has(id)).toBe(false);
    });
  });
});
```

---

## 6. Deployment Flow Tests

**Location**: `/tests/flows/deployment/`

### DABDeploymentFlow.test.ts

```typescript
describe('Deployment Flow: Databricks Asset Bundles', () => {
  test('should validate bundle before deployment', async () => {
    const bundle = generateTestBundle();

    const validation = await validateDABBundle(bundle);

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should deploy to dev environment successfully', async () => {
    const bundle = generateTestBundle();

    const result = await deployBundle('dev', bundle);

    expect(result.status).toBe('completed');
    expect(result.errors).toHaveLength(0);
  });

  test('should rollback on deployment failure', async () => {
    const invalidBundle = generateInvalidBundle();

    const result = await deployBundle('dev', invalidBundle);

    expect(result.status).toBe('failed');
    expect(result.rolledBack).toBe(true);
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

**Location**: `/.github/workflows/test-flows.yml`

```yaml
name: Test All Data Flows

on:
  push:
    branches: [ main, develop, claude/** ]
  pull_request:
    branches: [ main, develop ]

env:
  DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
  DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}
  DATABRICKS_HTTP_PATH: ${{ secrets.DATABRICKS_HTTP_PATH }}

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: nexa-web/package-lock.json

      - name: Install dependencies
        working-directory: ./nexa-web
        run: npm ci

      - name: Run unit tests
        working-directory: ./nexa-web
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./nexa-web/coverage/coverage-final.json
          flags: unittests

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./nexa-web
        run: npm ci

      - name: Run integration tests
        working-directory: ./nexa-web
        run: npm run test:integration
        env:
          DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
          DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}

  sql-validation:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./nexa-web
        run: npm ci

      - name: Validate SQL against Databricks
        working-directory: ./nexa-web
        run: npm run test:sql
        env:
          DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
          DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [integration-tests, sql-validation]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: ./nexa-web
        run: npm ci

      - name: Install Playwright
        working-directory: ./nexa-web
        run: npx playwright install --with-deps

      - name: Run E2E tests
        working-directory: ./nexa-web
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: nexa-web/playwright-report/

  deployment-validation:
    runs-on: ubuntu-latest
    needs: [integration-tests, sql-validation]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Validate DAB bundle
        run: databricks bundle validate -t dev
        env:
          DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
          DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}

      - name: Test deployment to dev
        run: databricks bundle deploy -t dev
        env:
          DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
          DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}
```

---

## Test Execution Strategy

### On Every Commit
```bash
npm run test:unit           # Unit tests (fast, <30s)
npm run test:lint           # ESLint + TypeScript checks
```

### On Pull Request
```bash
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests (medium, <5min)
npm run test:sql            # SQL validation against Databricks
```

### Before Deployment
```bash
npm run test:all            # All tests
npm run test:e2e            # E2E tests (slow, <15min)
databricks bundle validate  # DAB validation
```

### Nightly
```bash
npm run test:performance    # Performance regression tests
npm run test:load          # Load testing with 1M+ records
npm run test:security      # Security vulnerability scans
```

---

## Test Data Management

### Data Lifecycle

1. **Generate** - Create synthetic data with Faker
2. **Load** - Upload to test tables in Databricks
3. **Transform** - Run data flow transformations
4. **Validate** - Check results against expectations
5. **Cleanup** - Drop test tables

### Test Table Naming Convention

```
[layer].[entity]_test_[timestamp]_[test_run_id]

Examples:
- raw.customers_test_1705689600_abc123
- curated.customer_360_test_1705689600_abc123
- gold.customer_analytics_test_1705689600_abc123
```

### Cleanup Strategy

- **Immediate**: Drop tables after each test (default)
- **Retained**: Keep tables for 24h for debugging (on failure)
- **Archived**: Move to `test_archive` schema for analysis

---

## Monitoring & Reporting

### Test Dashboard

**Location**: `http://test-dashboard.nexa.internal`

**Metrics:**
- Test pass rate (target: >95%)
- Test execution time trend
- SQL validation success rate
- Coverage percentage
- Flaky test detection

### Alerts

- **Critical**: All tests failing (Slack + PagerDuty)
- **Warning**: Test pass rate < 90% (Slack)
- **Info**: New test added (Slack #testing channel)

---

## Best Practices

### 1. Deterministic Tests
- Always seed Faker for reproducibility
- Use fixed timestamps, not `Date.now()`
- Avoid flaky tests with proper async handling

### 2. Isolation
- Each test creates its own tables
- No shared state between tests
- Clean up in `afterEach` hooks

### 3. Realistic Data
- Match real-world data distributions
- Include edge cases (nulls, duplicates, outliers)
- Test with various data volumes (10, 1K, 1M records)

### 4. Fast Feedback
- Unit tests run in <30s
- Integration tests run in <5min
- Use test.skip() for slow tests during development

### 5. Clear Assertions
- One logical assertion per test
- Descriptive test names
- Include expected vs actual in failure messages

---

## Next Steps

1. ✅ Install dependencies: `npm install --save-dev @faker-js/faker @databricks/sql playwright`
2. Create test fixtures for each data entity
3. Implement DatabricksSQLValidator
4. Write flow-based test suites
5. Configure GitHub Actions workflow
6. Set up test dashboard and monitoring

**Test Coverage Goal**: >90% by end of Q1 2025
