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
