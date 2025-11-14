import { CustomNode, CustomEdge } from '../types';
import { MarkerType } from 'reactflow';

export const generateDataflowView = (flowId: string): { nodes: CustomNode[]; edges: CustomEdge[] } => {
  const nodes: CustomNode[] = [];
  const edges: CustomEdge[] = [];

  if (flowId === 'flow-1') {
    // Customer Gold Table Flow
    nodes.push({
      id: 'raw-customer',
      type: 'source',
      position: { x: 50, y: 50 },
      data: {
        label: 'customer_raw',
        schema: 'raw',
        columns: [
          { name: 'cust_id', type: 'int' },
          { name: 'first_name', type: 'string' },
          { name: 'last_name', type: 'string' },
          { name: 'dob', type: 'date' },
        ],
      },
    });

    nodes.push({
      id: 'transform-1',
      type: 'transform',
      position: { x: 400, y: 50 },
      data: {
        label: 'Name Concatenation',
        expression: "CONCAT(first_name, ' ', last_name) AS full_name",
        functions: ['CONCAT'],
        llmMetadata: {
          confidence: 95,
          explanation: 'Concatenating first and last names to create a full name field for customer display',
          reasoning: 'Standard practice to combine name fields for readability and reporting',
          generatedAt: new Date().toISOString(),
          version: 1,
        },
        executionState: {
          status: 'success',
          rowCountIn: 1234567,
          rowCountOut: 1234567,
          duration: 12,
          lastRun: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
          dataQualityScore: 99,
        },
      },
    });

    nodes.push({
      id: 'transform-2',
      type: 'transform',
      position: { x: 400, y: 200 },
      data: {
        label: 'Age Calculation',
        expression: "DATEDIFF(YEAR, dob, CURRENT_DATE()) AS age",
        functions: ['DATEDIFF', 'CURRENT_DATE'],
        llmMetadata: {
          confidence: 72,
          explanation: 'Calculating customer age from date of birth for analytics and segmentation',
          reasoning: 'Age is a key demographic metric for customer analysis',
          warnings: ['NULL values in dob column may cause issues', 'Consider handling future dates'],
          generatedAt: new Date().toISOString(),
          version: 1,
        },
        isUserModified: true,
        userEdits: [
          {
            editedBy: 'john.doe@company.com',
            editedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            originalCode: "DATEDIFF(YEAR, dob, NOW()) AS age",
            modifiedCode: "DATEDIFF(YEAR, dob, CURRENT_DATE()) AS age",
            reason: 'Changed NOW() to CURRENT_DATE() to avoid time component affecting age calculation',
          },
        ],
        executionState: {
          status: 'success',
          rowCountIn: 1234567,
          rowCountOut: 1198234,
          duration: 15,
          lastRun: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
          dataQualityScore: 97,
        },
      },
    });

    nodes.push({
      id: 'gold-customer',
      type: 'gold',
      position: { x: 750, y: 100 },
      data: {
        label: 'Customer',
        attributes: [
          { name: 'customer_id', type: 'string' },
          { name: 'full_name', type: 'string', lineageDetails: 'From first_name + last_name' },
          { name: 'age', type: 'integer', lineageDetails: 'Calculated from dob' },
        ],
        llmMetadata: {
          confidence: 88,
          explanation: 'Gold table containing curated customer master data for analytics',
          reasoning: 'Combines multiple transformations to create a single source of truth for customer data',
          generatedAt: new Date().toISOString(),
          version: 1,
        },
        executionState: {
          status: 'success',
          rowCountIn: 2432801,
          rowCountOut: 1198234,
          duration: 45,
          lastRun: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
          dataQualityScore: 98,
        },
        approvalState: {
          status: 'pending_review',
        },
      },
    });

    edges.push(
      {
        id: 'e1',
        source: 'raw-customer',
        target: 'transform-1',
        type: 'custom',
        data: { transformation: 'SELECT first_name, last_name' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'e2',
        source: 'raw-customer',
        target: 'transform-2',
        type: 'custom',
        data: { transformation: 'SELECT dob' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'e3',
        source: 'transform-1',
        target: 'gold-customer',
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'e4',
        source: 'transform-2',
        target: 'gold-customer',
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed },
      }
    );
  } else if (flowId === 'flow-2') {
    // Order Metrics Flow with JOIN
    nodes.push({
      id: 'raw-orders',
      type: 'source',
      position: { x: 50, y: 50 },
      data: {
        label: 'orders_raw',
        schema: 'raw',
        columns: [
          { name: 'order_id', type: 'int' },
          { name: 'customer_id', type: 'int' },
          { name: 'amount', type: 'decimal' },
        ],
      },
    });

    nodes.push({
      id: 'raw-customer',
      type: 'source',
      position: { x: 50, y: 250 },
      data: {
        label: 'customer_raw',
        schema: 'raw',
        columns: [
          { name: 'cust_id', type: 'int' },
          { name: 'first_name', type: 'string' },
        ],
      },
    });

    nodes.push({
      id: 'join-1',
      type: 'transform',
      position: { x: 400, y: 150 },
      data: {
        label: 'Join Orders & Customers',
        expression: 'INNER JOIN ON orders.customer_id = customers.cust_id',
        functions: ['JOIN'],
      },
    });

    nodes.push({
      id: 'aggregate-1',
      type: 'transform',
      position: { x: 700, y: 150 },
      data: {
        label: 'Aggregate Metrics',
        expression: 'SUM(amount) as total_spent, COUNT(*) as order_count',
        functions: ['SUM', 'COUNT', 'GROUP BY'],
      },
    });

    nodes.push({
      id: 'gold-metrics',
      type: 'gold',
      position: { x: 1000, y: 150 },
      data: {
        label: 'OrderMetrics',
        attributes: [
          { name: 'customer_id', type: 'string' },
          { name: 'customer_name', type: 'string' },
          { name: 'total_spent', type: 'decimal', lineageDetails: 'SUM(orders.amount)' },
          { name: 'order_count', type: 'integer', lineageDetails: 'COUNT(orders)' },
        ],
      },
    });

    edges.push(
      {
        id: 'ej1',
        source: 'raw-orders',
        target: 'join-1',
        type: 'custom',
        data: { transformation: 'orders table' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'ej2',
        source: 'raw-customer',
        target: 'join-1',
        type: 'custom',
        data: { transformation: 'customers table' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'ej3',
        source: 'join-1',
        target: 'aggregate-1',
        type: 'custom',
        data: { transformation: 'joined data' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'ej4',
        source: 'aggregate-1',
        target: 'gold-metrics',
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed },
      }
    );
  }

  return { nodes, edges };
};
