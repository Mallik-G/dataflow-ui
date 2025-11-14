import { CatalogObject, DataFlow } from '../types/catalog';

export const catalogData: CatalogObject[] = [
  {
    id: 'db-1',
    name: 'ecommerce_db',
    type: 'database',
    fullyQualifiedName: 'ecommerce_db',
    children: [
      {
        id: 'schema-raw',
        name: 'raw',
        type: 'schema',
        fullyQualifiedName: 'ecommerce_db.raw',
        children: [
          {
            id: 'table-raw-customers',
            name: 'customer_raw',
            type: 'table',
            fullyQualifiedName: 'ecommerce_db.raw.customer_raw',
          },
          {
            id: 'table-raw-orders',
            name: 'orders_raw',
            type: 'table',
            fullyQualifiedName: 'ecommerce_db.raw.orders_raw',
          },
          {
            id: 'table-raw-products',
            name: 'products_raw',
            type: 'table',
            fullyQualifiedName: 'ecommerce_db.raw.products_raw',
          },
        ],
      },
      {
        id: 'schema-silver',
        name: 'silver',
        type: 'schema',
        fullyQualifiedName: 'ecommerce_db.silver',
        children: [
          {
            id: 'table-silver-customer',
            name: 'silver_customer',
            type: 'table',
            fullyQualifiedName: 'ecommerce_db.silver.silver_customer',
          },
          {
            id: 'table-silver-orders',
            name: 'silver_orders',
            type: 'table',
            fullyQualifiedName: 'ecommerce_db.silver.silver_orders',
          },
        ],
      },
      {
        id: 'schema-gold',
        name: 'gold',
        type: 'schema',
        fullyQualifiedName: 'ecommerce_db.gold',
        children: [
          {
            id: 'table-gold-customer',
            name: 'Customer',
            type: 'table',
            fullyQualifiedName: 'ecommerce_db.gold.Customer',
          },
          {
            id: 'table-gold-order-metrics',
            name: 'OrderMetrics',
            type: 'table',
            fullyQualifiedName: 'ecommerce_db.gold.OrderMetrics',
          },
        ],
      },
    ],
  },
];

export const dataFlows: DataFlow[] = [
  {
    id: 'flow-1',
    name: 'Customer Gold Table Flow',
    targetTable: 'ecommerce_db.gold.Customer',
    description: 'Builds the Customer gold table from raw and silver sources',
    lastRun: '2024-01-15 10:30:00',
    status: 'active',
  },
  {
    id: 'flow-2',
    name: 'Order Metrics Flow',
    targetTable: 'ecommerce_db.gold.OrderMetrics',
    description: 'Aggregates order data with customer joins',
    lastRun: '2024-01-15 10:25:00',
    status: 'active',
  },
  {
    id: 'flow-3',
    name: 'Product Analytics Flow',
    targetTable: 'ecommerce_db.gold.ProductAnalytics',
    description: 'Product performance metrics',
    status: 'inactive',
  },
];
