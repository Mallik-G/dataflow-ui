import { CustomNode, CustomEdge } from '../types';
import { MarkerType } from 'reactflow';

export const sampleNodes: CustomNode[] = [
  {
    id: 'source-1',
    type: 'source',
    position: { x: 50, y: 50 },
    data: {
      label: 'customer_raw',
      schema: 'raw_data',
      columns: [
        { name: 'cust_id', type: 'integer' },
        { name: 'first_name', type: 'string' },
        { name: 'last_name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'dob', type: 'date' },
        { name: 'created_at', type: 'timestamp' },
      ],
    },
  },
  {
    id: 'source-2',
    type: 'source',
    position: { x: 50, y: 350 },
    data: {
      label: 'orders_raw',
      schema: 'raw_data',
      columns: [
        { name: 'order_id', type: 'integer' },
        { name: 'customer_id', type: 'integer' },
        { name: 'order_date', type: 'timestamp' },
        { name: 'total_amount', type: 'decimal' },
      ],
    },
  },
  {
    id: 'silver-1',
    type: 'silver',
    position: { x: 400, y: 100 },
    data: {
      label: 'silver_customer',
      columns: [
        { name: 'cust_id', type: 'string' },
        { name: 'full_name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'dob', type: 'date' },
      ],
    },
  },
  {
    id: 'transform-1',
    type: 'transform',
    position: { x: 750, y: 150 },
    data: {
      label: 'Age Calculation',
      expression: "date_diff('year', dob, current_date)",
      functions: ['date_diff', 'current_date'],
    },
  },
  {
    id: 'gold-1',
    type: 'gold',
    position: { x: 1050, y: 100 },
    data: {
      label: 'Customer',
      attributes: [
        { name: 'customer_id', type: 'string' },
        { name: 'customer_name', type: 'string' },
        { name: 'customer_age', type: 'integer', lineageDetails: 'Derived from dob' },
        { name: 'contact_email', type: 'string' },
      ],
    },
  },
];

export const sampleEdges: CustomEdge[] = [
  {
    id: 'edge-1',
    source: 'source-1',
    target: 'silver-1',
    type: 'custom',
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  },
  {
    id: 'edge-2',
    source: 'silver-1',
    target: 'transform-1',
    type: 'custom',
    data: {
      transformation: 'dob',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  },
  {
    id: 'edge-3',
    source: 'transform-1',
    target: 'gold-1',
    type: 'custom',
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  },
  {
    id: 'edge-4',
    source: 'silver-1',
    target: 'gold-1',
    type: 'custom',
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  },
];
