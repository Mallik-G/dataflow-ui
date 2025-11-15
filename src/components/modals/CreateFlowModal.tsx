import { useState } from 'react';
import { colors, borderRadius } from '../../theme/colors';
import { CatalogObject } from '../../types/catalog';

interface CreateFlowModalProps {
  sourceTable: CatalogObject;
  onClose: () => void;
  onCreateFlow: (config: FlowConfig) => void;
}

export interface FlowConfig {
  id: string;
  name: string;
  source: {
    schema: string;
    table: string;
    fullPath: string;
  };
  target: {
    schema: string;
    table: string;
    fullPath: string;
  };
  description: string;
  platform: 'snowflake' | 'databricks' | 'bigquery' | 'postgres';
}

const CreateFlowModal = ({ sourceTable, onClose, onCreateFlow }: CreateFlowModalProps) => {
  // Extract schema from fully qualified name (e.g., "ecommerce_db.raw.customer_raw" -> "raw")
  const extractSchemaFromFQN = (fqn: string): string => {
    const parts = fqn.split('.');
    return parts.length > 1 ? parts[parts.length - 2] : 'unknown';
  };

  const sourceSchema = extractSchemaFromFQN(sourceTable.fullyQualifiedName);

  // Generate smart suggestions for target table
  const suggestTargetTable = () => {
    const sourceName = sourceTable.name;

    // Smart naming conventions
    if (sourceName.startsWith('raw_')) {
      return sourceName.replace('raw_', 'stg_');
    }
    if (sourceName.endsWith('_raw')) {
      return sourceName.replace('_raw', '_staging');
    }
    return `stg_${sourceName}`;
  };

  const suggestTargetSchema = () => {
    if (sourceSchema === 'raw') return 'staging';
    if (sourceSchema === 'staging') return 'analytics';
    return 'processed';
  };

  const [flowName, setFlowName] = useState(`${sourceTable.name}_transformation`);
  const [targetSchema, setTargetSchema] = useState(suggestTargetSchema());
  const [targetTable, setTargetTable] = useState(suggestTargetTable());
  const [description, setDescription] = useState(`Transform ${sourceTable.name} from ${sourceSchema} to ${suggestTargetSchema()}`);
  const [platform, setPlatform] = useState<'snowflake' | 'databricks' | 'bigquery' | 'postgres'>('snowflake');

  const handleNext = () => {
    const config: FlowConfig = {
      id: `flow-${Date.now()}`,
      name: flowName,
      source: {
        schema: sourceSchema,
        table: sourceTable.name,
        fullPath: `${sourceSchema}.${sourceTable.name}`,
      },
      target: {
        schema: targetSchema,
        table: targetTable,
        fullPath: `${targetSchema}.${targetTable}`,
      },
      description,
      platform,
    };

    onCreateFlow(config);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.xl,
        boxShadow: colors.shadow.xl,
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${colors.border.main}`,
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: `1px solid ${colors.border.main}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '6px',
            }}>
              ✨ Create New Flow
            </h2>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: colors.text.secondary,
            }}>
              Configure transformation from {sourceSchema}.{sourceTable.name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: colors.text.muted,
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: borderRadius.sm,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.hover;
              e.currentTarget.style.color = colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = colors.text.muted;
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* Flow Name */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '8px',
            }}>
              Flow Name
            </label>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                backgroundColor: colors.background.tertiary,
                color: colors.text.primary,
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary.main;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border.main;
              }}
            />
          </div>

          {/* Source Table (Read-only) */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '8px',
            }}>
              Source Table
            </label>
            <div style={{
              padding: '10px 12px',
              fontSize: '14px',
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.background.secondary,
              color: colors.text.secondary,
              fontFamily: 'monospace',
            }}>
              {sourceSchema}.{sourceTable.name}
            </div>
          </div>

          {/* Target Schema & Table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: '8px',
              }}>
                Target Schema
              </label>
              <input
                type="text"
                value={targetSchema}
                onChange={(e) => setTargetSchema(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.tertiary,
                  color: colors.text.primary,
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.primary.main;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border.main;
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: '8px',
              }}>
                Target Table
              </label>
              <input
                type="text"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.tertiary,
                  color: colors.text.primary,
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.primary.main;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.border.main;
                }}
              />
            </div>
          </div>

          {/* Platform Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '8px',
            }}>
              Target Platform
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['snowflake', 'databricks', 'bigquery', 'postgres'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    border: `2px solid ${platform === p ? colors.primary.main : colors.border.main}`,
                    borderRadius: borderRadius.md,
                    backgroundColor: platform === p ? colors.primary.lighter : colors.background.secondary,
                    color: platform === p ? colors.primary.dark : colors.text.secondary,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'capitalize',
                  }}
                  onMouseEnter={(e) => {
                    if (platform !== p) {
                      e.currentTarget.style.backgroundColor = colors.background.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (platform !== p) {
                      e.currentTarget.style.backgroundColor = colors.background.secondary;
                    }
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '8px',
            }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                backgroundColor: colors.background.tertiary,
                color: colors.text.primary,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary.main;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border.main;
              }}
            />
          </div>

          {/* Preview */}
          <div style={{
            padding: '16px',
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.border.main}`,
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: colors.text.secondary,
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Flow Preview
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontFamily: 'monospace',
              fontSize: '13px',
            }}>
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                borderRadius: borderRadius.sm,
                fontWeight: '600',
              }}>
                {sourceSchema}.{sourceTable.name}
              </div>
              <span style={{ color: colors.text.muted }}>→</span>
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                borderRadius: borderRadius.sm,
                fontWeight: '600',
              }}>
                {targetSchema}.{targetTable}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${colors.border.main}`,
          backgroundColor: colors.background.tertiary,
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.background.secondary,
              color: colors.text.primary,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.secondary;
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleNext}
            disabled={!flowName || !targetSchema || !targetTable}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderRadius: borderRadius.md,
              backgroundColor: flowName && targetSchema && targetTable ? colors.primary.main : colors.background.secondary,
              color: flowName && targetSchema && targetTable ? '#ffffff' : colors.text.muted,
              cursor: flowName && targetSchema && targetTable ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              boxShadow: flowName && targetSchema && targetTable ? colors.shadow.sm : 'none',
            }}
            onMouseEnter={(e) => {
              if (flowName && targetSchema && targetTable) {
                e.currentTarget.style.backgroundColor = colors.primary.dark;
                e.currentTarget.style.boxShadow = colors.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (flowName && targetSchema && targetTable) {
                e.currentTarget.style.backgroundColor = colors.primary.main;
                e.currentTarget.style.boxShadow = colors.shadow.sm;
              }
            }}
          >
            Next: Map Columns →
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFlowModal;
