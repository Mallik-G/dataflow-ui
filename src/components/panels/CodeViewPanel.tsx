import { useState } from 'react';
import { colors, borderRadius } from '../../theme/colors';
import { useCanvasStore } from '../../stores/canvasStore';

interface CodeViewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CodeViewPanel = ({ isOpen, onClose }: CodeViewPanelProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'sql' | 'python' | 'yaml'>('sql');
  const selectedNode = useCanvasStore(state => state.selectedNode);

  // Sample generated code based on selected language
  const getCodeSample = () => {
    if (!selectedNode) {
      return `-- Select a node to view generated code`;
    }

    const nodeName = (selectedNode.data?.label || 'target_table').replace(/\s+/g, '_').toLowerCase();

    switch (selectedLanguage) {
      case 'sql':
        return `-- Generated SQL for: ${selectedNode.data?.label || 'Node'}
-- Type: ${selectedNode.type}

CREATE OR REPLACE TABLE analytics.${nodeName} AS
SELECT
  customer_id,
  customer_name,
  email,
  created_at,
  SUM(order_amount) as lifetime_value,
  COUNT(DISTINCT order_id) as total_orders,
  CASE
    WHEN SUM(order_amount) >= 10000 THEN 'VIP'
    WHEN SUM(order_amount) >= 5000 THEN 'Premium'
    ELSE 'Standard'
  END as customer_segment
FROM raw.customers c
LEFT JOIN raw.orders o ON o.customer_id = c.customer_id
WHERE c.status = 'active'
GROUP BY 1, 2, 3, 4;`;

      case 'python':
        return `# Generated Python (Databricks) for: ${selectedNode.data?.label || 'Node'}
# Type: ${selectedNode.type}

import dlt
from pyspark.sql import functions as F

@dlt.table(
    name="${nodeName}",
    comment="Customer analytics table with lifetime value"
)
def ${nodeName}():
    return (
        dlt.read("raw_customers")
        .join(
            dlt.read("raw_orders"),
            on="customer_id",
            how="left"
        )
        .filter(F.col("status") == "active")
        .groupBy("customer_id", "customer_name", "email", "created_at")
        .agg(
            F.sum("order_amount").alias("lifetime_value"),
            F.countDistinct("order_id").alias("total_orders")
        )
        .withColumn(
            "customer_segment",
            F.when(F.col("lifetime_value") >= 10000, "VIP")
            .when(F.col("lifetime_value") >= 5000, "Premium")
            .otherwise("Standard")
        )
    )`;

      case 'yaml':
        return `# Generated YAML for: ${selectedNode.data?.label || 'Node'}
# Type: ${selectedNode.type}

version: "1.0"
name: ${nodeName}
description: "Customer analytics table with lifetime value and segmentation"

sources:
  - name: raw_customers
    table: raw.customers
    filters:
      - status = 'active'

  - name: raw_orders
    table: raw.orders

transformations:
  - name: customer_lifetime_value
    type: aggregate
    group_by:
      - customer_id
      - customer_name
      - email
      - created_at
    aggregations:
      - column: order_amount
        function: SUM
        alias: lifetime_value
      - column: order_id
        function: COUNT_DISTINCT
        alias: total_orders

  - name: customer_segment
    type: case
    expression: |
      WHEN lifetime_value >= 10000 THEN 'VIP'
      WHEN lifetime_value >= 5000 THEN 'Premium'
      ELSE 'Standard'

target:
  schema: analytics
  table: ${nodeName}
  mode: overwrite`;

      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: colors.background.primary,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${colors.border.main}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.background.secondary,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: colors.text.primary }}>
            💻 Code View
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: colors.text.secondary }}>
            {selectedNode ? `Generated code for: ${selectedNode.data?.label || 'Node'}` : 'Select a node'}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: colors.text.secondary,
            padding: '4px 8px',
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Language Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 20px',
          borderBottom: `1px solid ${colors.border.main}`,
          backgroundColor: colors.background.secondary,
        }}
      >
        {(['sql', 'python', 'yaml'] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setSelectedLanguage(lang)}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: '500',
              border: 'none',
              borderRadius: borderRadius.sm,
              backgroundColor: selectedLanguage === lang ? colors.primary.main : 'transparent',
              color: selectedLanguage === lang ? '#ffffff' : colors.text.secondary,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Code Editor */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
          backgroundColor: '#1e1e1e',
        }}
      >
        <pre
          style={{
            margin: 0,
            fontSize: '13px',
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
            color: '#d4d4d4',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {getCodeSample()}
        </pre>
      </div>

      {/* Footer Actions */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: `1px solid ${colors.border.main}`,
          backgroundColor: colors.background.secondary,
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={() => {
            navigator.clipboard.writeText(getCodeSample());
          }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '500',
            border: `1px solid ${colors.border.main}`,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.background.primary,
            color: colors.text.primary,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📋 Copy
        </button>
        <button
          onClick={() => {
            // TODO: Implement download functionality
            const blob = new Blob([getCodeSample()], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(selectedNode?.data?.label || 'code').replace(/\s+/g, '_')}.${selectedLanguage}`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '500',
            border: 'none',
            borderRadius: borderRadius.sm,
            backgroundColor: colors.primary.main,
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          💾 Download
        </button>
      </div>
    </div>
  );
};

export default CodeViewPanel;
