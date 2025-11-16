import { CustomNode, CustomEdge } from '../types';
import { CatalogObject } from '../types/catalog';
import { MarkerType } from 'reactflow';

export const generateLineageView = (
  catalogObject: CatalogObject,
  _upstreamLevels: number,
  downstreamLevels: number
): { nodes: CustomNode[]; edges: CustomEdge[] } => {
  const nodes: CustomNode[] = [];
  const edges: CustomEdge[] = [];

  // For demo, generate based on table name
  const tableName = catalogObject.name;

  if (tableName === 'silver_customer') {
    // Silver customer lineage
    nodes.push({
      id: 'customer_raw',
      type: 'source',
      position: { x: 50, y: 100 },
      data: {
        label: 'customer_raw',
        schema: 'raw',
        columns: [
          { name: 'cust_id', type: 'integer' },
          { name: 'first_name', type: 'string' },
          { name: 'last_name', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'dob', type: 'date' },
        ],
      },
    });

    nodes.push({
      id: 'silver_customer',
      type: 'silver',
      position: { x: 450, y: 100 },
      data: {
        label: 'silver_customer',
        columns: [
          { name: 'cust_id', type: 'string' },
          { name: 'full_name', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'dob', type: 'date' },
        ],
      },
    });

    if (downstreamLevels >= 1) {
      nodes.push({
        id: 'Customer',
        type: 'gold',
        position: { x: 850, y: 100 },
        data: {
          label: 'Customer',
          attributes: [
            { name: 'customer_id', type: 'string' },
            { name: 'customer_name', type: 'string' },
            { name: 'customer_age', type: 'integer', lineageDetails: 'Derived from dob' },
            { name: 'contact_email', type: 'string' },
          ],
        },
      });

      edges.push({
        id: 'edge-silver-gold',
        source: 'silver_customer',
        target: 'Customer',
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }

    edges.push({
      id: 'edge-raw-silver',
      source: 'customer_raw',
      target: 'silver_customer',
      type: 'custom',
      markerEnd: { type: MarkerType.ArrowClosed },
    });
  } else if (tableName === 'Customer') {
    // Gold Customer lineage
    nodes.push({
      id: 'customer_raw',
      type: 'source',
      position: { x: 50, y: 100 },
      data: {
        label: 'customer_raw',
        schema: 'raw',
        columns: [
          { name: 'cust_id', type: 'integer' },
          { name: 'first_name', type: 'string' },
          { name: 'last_name', type: 'string' },
        ],
      },
    });

    nodes.push({
      id: 'silver_customer',
      type: 'silver',
      position: { x: 450, y: 100 },
      data: {
        label: 'silver_customer',
        columns: [
          { name: 'cust_id', type: 'string' },
          { name: 'full_name', type: 'string' },
          { name: 'dob', type: 'date' },
        ],
      },
    });

    nodes.push({
      id: 'transform-age',
      type: 'transform',
      position: { x: 650, y: 250 },
      data: {
        label: 'Age Calculation',
        expression: "date_diff('year', dob, current_date)",
        functions: ['date_diff', 'current_date'],
      },
    });

    nodes.push({
      id: 'Customer',
      type: 'gold',
      position: { x: 950, y: 150 },
      data: {
        label: 'Customer',
        attributes: [
          { name: 'customer_id', type: 'string' },
          { name: 'customer_name', type: 'string' },
          { name: 'customer_age', type: 'integer', lineageDetails: 'Derived from dob' },
        ],
      },
    });

    edges.push(
      {
        id: 'edge-1',
        source: 'customer_raw',
        target: 'silver_customer',
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'edge-2',
        source: 'silver_customer',
        target: 'transform-age',
        type: 'custom',
        data: { transformation: 'dob' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'edge-3',
        source: 'transform-age',
        target: 'Customer',
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'edge-4',
        source: 'silver_customer',
        target: 'Customer',
        type: 'custom',
        markerEnd: { type: MarkerType.ArrowClosed },
      }
    );
  } else {
    // Default simple lineage
    nodes.push({
      id: catalogObject.id,
      type: 'silver',
      position: { x: 400, y: 200 },
      data: {
        label: tableName,
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'string' },
        ],
      },
    });
  }

  return { nodes, edges };
};
