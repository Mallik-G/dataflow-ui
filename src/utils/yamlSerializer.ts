import { CustomNode, CustomEdge } from '../types';

export interface CanvasConfig {
  version: string;
  metadata: {
    name: string;
    description: string;
    created: string;
    platform: string;
  };
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    position: { x: number; y: number };
    data: any;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    data?: any;
  }>;
}

export const serializeToYAML = (nodes: CustomNode[], edges: CustomEdge[]): string => {
  const config: CanvasConfig = {
    version: '1.0',
    metadata: {
      name: 'Data Lineage Pipeline',
      description: 'Auto-generated lineage configuration',
      created: new Date().toISOString(),
      platform: 'multi-cloud',
    },
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type,
      label: node.data.label,
      position: node.position,
      data: node.data,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
    })),
  };

  // Convert to YAML-like format (simple indentation-based)
  return objectToYAML(config, 0);
};

export const deserializeFromYAML = (yamlString: string): { nodes: CustomNode[]; edges: CustomEdge[] } => {
  try {
    // Parse YAML-like string to object
    const config = parseYAML(yamlString) as CanvasConfig;

    const nodes: CustomNode[] = config.nodes.map(node => ({
      id: node.id,
      type: node.type as any,
      position: node.position,
      data: node.data,
    }));

    const edges: CustomEdge[] = config.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type as any,
      data: edge.data,
      markerEnd: { type: 'arrowclosed' as any },
    }));

    return { nodes, edges };
  } catch (error) {
    console.error('Failed to parse YAML:', error);
    throw new Error('Invalid YAML format');
  }
};

// Simple YAML serializer (for basic objects)
function objectToYAML(obj: any, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        yaml += `${spaces}- `;
        const itemYaml = objectToYAML(item, indent + 1);
        yaml += itemYaml.substring(spaces.length + 2) + '\n';
      } else {
        yaml += `${spaces}- ${formatValue(item)}\n`;
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += objectToYAML(value, indent + 1);
      } else if (typeof value === 'object' && value !== null) {
        yaml += `${spaces}${key}:\n`;
        yaml += objectToYAML(value, indent + 1);
      } else {
        yaml += `${spaces}${key}: ${formatValue(value)}\n`;
      }
    });
  }

  return yaml;
}

function formatValue(value: any): string {
  if (typeof value === 'string') {
    // Escape strings that contain special characters
    if (value.includes(':') || value.includes('\n') || value.includes('#')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (value === null || value === undefined) {
    return 'null';
  }
  return String(value);
}

// Simple YAML parser (for basic structures)
function parseYAML(yamlString: string): any {
  const lines = yamlString.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
  const result: any = {};
  const stack: Array<{ obj: any; indent: number }> = [{ obj: result, indent: -1 }];
  let currentArray: any[] | null = null;

  lines.forEach(line => {
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Handle array items
    if (trimmed.startsWith('- ')) {
      const value = trimmed.substring(2).trim();

      // Pop stack until we find the right parent
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;
      const lastKey = Object.keys(parent).pop();

      if (lastKey && Array.isArray(parent[lastKey])) {
        currentArray = parent[lastKey];

        // Check if it's an object
        if (value.includes(':')) {
          const obj: any = {};
          const [k, v] = value.split(':').map(s => s.trim());
          obj[k] = parseValue(v);
          currentArray.push(obj);
          stack.push({ obj: obj, indent });
        } else {
          currentArray.push(parseValue(value));
        }
      }
      return;
    }

    // Handle key-value pairs
    if (trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.substring(0, colonIndex).trim();
      const valueStr = trimmed.substring(colonIndex + 1).trim();

      // Pop stack to find the right parent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;

      if (valueStr === '') {
        // It's a nested object or array
        if (Array.isArray(parent)) {
          const obj: any = {};
          parent[parent.length - 1] = { ...parent[parent.length - 1], [key]: obj };
          stack.push({ obj, indent });
        } else {
          parent[key] = {};
          stack.push({ obj: parent[key], indent });
        }
      } else {
        // It's a value
        const value = parseValue(valueStr);
        if (Array.isArray(parent)) {
          Object.assign(parent[parent.length - 1], { [key]: value });
        } else {
          parent[key] = value;
        }
      }
    }
  });

  return result;
}

function parseValue(str: string): any {
  const trimmed = str.trim();

  // Remove quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.substring(1, trimmed.length - 1);
  }

  // Parse numbers
  if (!isNaN(Number(trimmed)) && trimmed !== '') {
    return Number(trimmed);
  }

  // Parse booleans
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  // Check if it's an array marker
  if (trimmed === '' || trimmed === '[]') {
    return [];
  }

  return trimmed;
}
