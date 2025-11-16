import { useState, useEffect, useRef } from 'react';
import { colors, borderRadius } from '../../theme/colors';
import {
  ColumnMapping,
  DataProfile,
  TransformationType,
} from '../../types/columnMapping';
import { AIColumnMapper } from '../../services/aiColumnMapper';
import { LLMColumnMapper } from '../../services/llmColumnMapper';
import FeedbackModal from './FeedbackModal';

interface ColumnMapperProps {
  sourceProfile: DataProfile;
  targetProfile: DataProfile;
  initialMappings?: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  onBack: () => void;
  onNext: () => void;
}

const ColumnMapper = ({
  sourceProfile,
  targetProfile,
  initialMappings = [],
  onMappingsChange,
  onBack,
  onNext,
}: ColumnMapperProps) => {
  const [mappings, setMappings] = useState<ColumnMapping[]>(initialMappings);
  const [selectedMapping, setSelectedMapping] = useState<ColumnMapping | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [llmReasoning, setLlmReasoning] = useState<string>('');
  const [llmYaml, setLlmYaml] = useState<string>('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showYamlView, setShowYamlView] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-map columns using LLM on mount
  useEffect(() => {
    if (initialMappings.length === 0) {
      handleLLMMap();
    }
  }, []);

  // Draw connection lines between mapped columns
  useEffect(() => {
    drawConnections();
  }, [mappings, selectedMapping]);

  const handleLLMMap = async (previousFeedback?: string) => {
    setIsLoading(true);
    try {
      const result = await LLMColumnMapper.generateMappings({
        sourceTable: sourceProfile,
        targetTable: targetProfile,
        context: previousFeedback
          ? {
              previousFeedback,
            }
          : undefined,
      });

      setMappings(result.mappings);
      setLlmReasoning(result.reasoning);
      setLlmYaml(result.yaml);
      onMappingsChange(result.mappings);
    } catch (error) {
      console.error('LLM mapping failed:', error);
      // Fallback to basic AI mapper
      await handleAutoMap();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoMap = async () => {
    setIsLoading(true);
    try {
      const result = await AIColumnMapper.analyzeAndMap(sourceProfile, targetProfile);
      setMappings(result.mappings);
      setAiSuggestions(result.suggestions);
      setWarnings(result.warnings);
      onMappingsChange(result.mappings);
    } catch (error) {
      console.error('Auto-mapping failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptAll = () => {
    const approvedMappings = mappings.map((m) => ({
      ...m,
      isApproved: true,
    }));
    setMappings(approvedMappings);
    onMappingsChange(approvedMappings);
  };

  const handleRejectAll = () => {
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async (feedback: string) => {
    setShowFeedbackModal(false);
    await handleLLMMap(feedback);
  };

  const drawConnections = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each mapping
    mappings.forEach((mapping) => {
      const sourceElement = document.getElementById(`source-${mapping.sourceColumn}`);
      const targetElement = document.getElementById(`target-${mapping.targetColumn}`);

      if (!sourceElement || !targetElement) return;

      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();

      const startX = sourceRect.right - canvasRect.left;
      const startY = sourceRect.top + sourceRect.height / 2 - canvasRect.top;
      const endX = targetRect.left - canvasRect.left;
      const endY = targetRect.top + targetRect.height / 2 - canvasRect.top;

      const isSelected = selectedMapping?.id === mapping.id;

      // Draw bezier curve
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      const controlX1 = startX + (endX - startX) / 3;
      const controlX2 = startX + (2 * (endX - startX)) / 3;

      ctx.bezierCurveTo(controlX1, startY, controlX2, endY, endX, endY);

      // Style based on confidence and selection
      ctx.strokeStyle = isSelected
        ? colors.primary.main
        : mapping.confidence > 0.8
        ? '#10b981'
        : mapping.confidence > 0.6
        ? '#f59e0b'
        : '#ef4444';

      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Draw arrowhead at target
      const arrowSize = 8;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - arrowSize, endY - arrowSize / 2);
      ctx.lineTo(endX - arrowSize, endY + arrowSize / 2);
      ctx.closePath();
      ctx.fill();
    });
  };

  const handleRemoveMapping = (mappingId: string) => {
    const updated = mappings.filter((m) => m.id !== mappingId);
    setMappings(updated);
    onMappingsChange(updated);
    if (selectedMapping?.id === mappingId) {
      setSelectedMapping(null);
    }
  };

  const handleApproveMapping = (mappingId: string) => {
    const updated = mappings.map((m) =>
      m.id === mappingId ? { ...m, isApproved: true } : m
    );
    setMappings(updated);
    onMappingsChange(updated);
  };

  const getTransformationIcon = (type: TransformationType): string => {
    const icons: Record<TransformationType, string> = {
      direct: '➡️',
      cast: '🔄',
      trim: '✂️',
      upper: '⬆️',
      lower: '⬇️',
      hash: '🔒',
      concat: '🔗',
      split: '✂️',
      date_format: '📅',
      coalesce: '🔀',
      custom: '⚙️',
    };
    return icons[type] || '•';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return '#10b981'; // Green
    if (confidence > 0.6) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  const getMappedTargetColumns = (): Set<string> => {
    return new Set(mappings.map((m) => m.targetColumn));
  };

  const getMappedSourceColumns = (): Set<string> => {
    return new Set(mappings.map((m) => m.sourceColumn));
  };

  const unmappedTargetColumns = targetProfile.columns.filter(
    (col) => !getMappedTargetColumns().has(col.name)
  );

  return (
    <div
      style={{
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
      }}
    >
      <div
        style={{
          backgroundColor: colors.background.primary,
          borderRadius: borderRadius.xl,
          boxShadow: colors.shadow.xl,
          width: '100%',
          maxWidth: '1400px',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${colors.border.main}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: `1px solid ${colors.border.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: '6px',
              }}
            >
              🔗 Column Mapping
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: colors.text.secondary,
              }}
            >
              {sourceProfile.tableName} → {targetProfile.tableName}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowYamlView(!showYamlView)}
              disabled={!llmYaml}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '600',
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                backgroundColor: showYamlView
                  ? colors.primary.lighter
                  : colors.background.secondary,
                color: showYamlView ? colors.primary.dark : colors.text.primary,
                cursor: llmYaml ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
            >
              📄 {showYamlView ? 'Hide YAML' : 'View YAML'}
            </button>
            <button
              onClick={() => handleLLMMap()}
              disabled={isLoading}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '600',
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                backgroundColor: colors.background.secondary,
                color: colors.text.primary,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {isLoading ? '⏳ Generating...' : '🔄 Regenerate'}
            </button>
          </div>
        </div>

        {/* AI Review Panel */}
        {llmReasoning && (
          <div
            style={{
              padding: '16px 24px',
              backgroundColor: '#eff6ff',
              borderBottom: `1px solid #3b82f6`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1e40af',
                    marginBottom: '8px',
                  }}
                >
                  🤖 AI Reasoning
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#1e3a8a',
                    whiteSpace: 'pre-line',
                    lineHeight: '1.5',
                  }}
                >
                  {llmReasoning}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                }}
              >
                <button
                  onClick={handleAcceptAll}
                  disabled={mappings.length === 0}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: borderRadius.md,
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    cursor: mappings.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✓ Accept All
                </button>
                <button
                  onClick={handleRejectAll}
                  disabled={mappings.length === 0}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: borderRadius.md,
                    backgroundColor: '#f59e0b',
                    color: '#ffffff',
                    cursor: mappings.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  💭 Provide Feedback
                </button>
              </div>
            </div>
          </div>
        )}

        {/* YAML View */}
        {showYamlView && llmYaml && (
          <div
            style={{
              padding: '16px 24px',
              backgroundColor: colors.background.tertiary,
              borderBottom: `1px solid ${colors.border.main}`,
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: colors.text.secondary,
                marginBottom: '8px',
              }}
            >
              Generated YAML Configuration
            </div>
            <pre
              style={{
                margin: 0,
                fontSize: '11px',
                fontFamily: 'monospace',
                color: colors.text.primary,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {llmYaml}
            </pre>
          </div>
        )}

        {/* Alerts */}
        {warnings.length > 0 && (
          <div
            style={{
              padding: '12px 24px',
              backgroundColor: '#fef3c7',
              borderBottom: `1px solid #fbbf24`,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
              ⚠️ Warnings
            </div>
            {warnings.map((warning, idx) => (
              <div key={idx} style={{ fontSize: '11px', color: '#78350f' }}>
                • {warning}
              </div>
            ))}
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
          {/* Source Columns */}
          <div
            style={{
              width: '35%',
              padding: '24px',
              overflowY: 'auto',
              backgroundColor: colors.background.secondary,
            }}
          >
            <h3
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '16px',
              }}
            >
              Source Columns ({sourceProfile.columns.length})
            </h3>
            {sourceProfile.columns.map((col) => {
              const isMapped = getMappedSourceColumns().has(col.name);
              return (
                <div
                  key={col.name}
                  id={`source-${col.name}`}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: isMapped ? '#dbeafe' : colors.background.tertiary,
                    border: `1px solid ${isMapped ? '#3b82f6' : colors.border.main}`,
                    borderRadius: borderRadius.md,
                    opacity: isMapped ? 1 : 0.6,
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: colors.text.primary,
                      fontFamily: 'monospace',
                    }}
                  >
                    {col.name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: colors.text.secondary,
                      marginTop: '4px',
                    }}
                  >
                    {col.type} {col.nullable ? '(nullable)' : '(not null)'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Canvas for drawing connections */}
          <canvas
            ref={canvasRef}
            width={420}
            height={800}
            style={{
              position: 'absolute',
              left: '35%',
              top: 0,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* Mapping Details */}
          <div
            style={{
              width: '30%',
              marginLeft: '35%',
              padding: '24px',
              overflowY: 'auto',
              backgroundColor: colors.background.primary,
              zIndex: 2,
            }}
          >
            <h3
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '16px',
              }}
            >
              Mappings ({mappings.length})
            </h3>
            {mappings.map((mapping) => (
              <div
                key={mapping.id}
                onClick={() => setSelectedMapping(mapping)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor:
                    selectedMapping?.id === mapping.id
                      ? colors.primary.lighter
                      : colors.background.tertiary,
                  border: `1px solid ${
                    selectedMapping?.id === mapping.id ? colors.primary.main : colors.border.main
                  }`,
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>
                      {getTransformationIcon(mapping.transformationType)}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: colors.text.secondary,
                      }}
                    >
                      {mapping.transformationType}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: getConfidenceColor(mapping.confidence),
                      backgroundColor: `${getConfidenceColor(mapping.confidence)}20`,
                      padding: '2px 6px',
                      borderRadius: borderRadius.sm,
                    }}
                  >
                    {(mapping.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: colors.text.primary,
                    wordBreak: 'break-all',
                  }}
                >
                  {mapping.transformationExpression}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    marginTop: '8px',
                  }}
                >
                  {!mapping.isApproved && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApproveMapping(mapping.id);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        border: 'none',
                        borderRadius: borderRadius.sm,
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      ✓ Approve
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMapping(mapping.id);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: borderRadius.sm,
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    × Remove
                  </button>
                </div>
              </div>
            ))}

            {aiSuggestions.length > 0 && (
              <div
                style={{
                  marginTop: '24px',
                  padding: '12px',
                  backgroundColor: '#eff6ff',
                  border: `1px solid #3b82f6`,
                  borderRadius: borderRadius.md,
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#1e40af',
                    marginBottom: '8px',
                  }}
                >
                  💡 AI Suggestions
                </div>
                {aiSuggestions.map((suggestion, idx) => (
                  <div key={idx} style={{ fontSize: '10px', color: '#1e3a8a', marginBottom: '4px' }}>
                    • {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Target Columns */}
          <div
            style={{
              width: '35%',
              padding: '24px',
              overflowY: 'auto',
              backgroundColor: colors.background.secondary,
            }}
          >
            <h3
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '16px',
              }}
            >
              Target Columns ({targetProfile.columns.length})
            </h3>
            {targetProfile.columns.map((col) => {
              const isMapped = getMappedTargetColumns().has(col.name);
              return (
                <div
                  key={col.name}
                  id={`target-${col.name}`}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: isMapped ? '#dcfce7' : colors.background.tertiary,
                    border: `1px solid ${isMapped ? '#10b981' : colors.border.main}`,
                    borderRadius: borderRadius.md,
                    opacity: isMapped ? 1 : 0.6,
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: colors.text.primary,
                      fontFamily: 'monospace',
                    }}
                  >
                    {col.name}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: colors.text.secondary,
                      marginTop: '4px',
                    }}
                  >
                    {col.type} {col.nullable ? '(nullable)' : '(not null)'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${colors.border.main}`,
            backgroundColor: colors.background.tertiary,
            display: 'flex',
            gap: '12px',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={onBack}
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
          >
            ← Back
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: colors.text.secondary, padding: '10px' }}>
              {mappings.length} of {targetProfile.columns.length} columns mapped
              {unmappedTargetColumns.length > 0 && (
                <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                  ({unmappedTargetColumns.length} unmapped)
                </span>
              )}
            </div>
            <button
              onClick={onNext}
              disabled={unmappedTargetColumns.length > 0}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: borderRadius.md,
                backgroundColor:
                  unmappedTargetColumns.length === 0
                    ? colors.primary.main
                    : colors.background.secondary,
                color:
                  unmappedTargetColumns.length === 0 ? '#ffffff' : colors.text.muted,
                cursor:
                  unmappedTargetColumns.length === 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                boxShadow:
                  unmappedTargetColumns.length === 0 ? colors.shadow.sm : 'none',
              }}
            >
              Next: Review Flow →
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <FeedbackModal
          onSubmit={handleFeedbackSubmit}
          onCancel={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  );
};

export default ColumnMapper;
