import { useState } from 'react';
import { colors, borderRadius } from '../../theme/colors';
import { FlowConfig } from './CreateFlowModal';
import {
  PlatformType,
  CodeGenerationOptions,
  GeneratedArtifact,
} from '../../types/codeGeneration';
import { SnowflakeGenerator } from '../../services/generators/SnowflakeGenerator';
import { DbtGenerator } from '../../services/generators/DbtGenerator';
import { DatabricksGenerator } from '../../services/generators/DatabricksGenerator';

interface GenerateArtifactsModalProps {
  flow: FlowConfig;
  onClose: () => void;
}

const GenerateArtifactsModal = ({ flow, onClose }: GenerateArtifactsModalProps) => {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>(flow.platform);
  const [includeTests, setIncludeTests] = useState(true);
  const [includeDocs, setIncludeDocs] = useState(true);
  const [useIncremental, setUseIncremental] = useState(false);
  const [materializationType, setMaterializationType] = useState<
    'table' | 'view' | 'incremental' | 'ephemeral'
  >('table');
  const [isGenerating, setIsGenerating] = useState(false);
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<GeneratedArtifact | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setArtifacts([]);
    setWarnings([]);

    try {
      const options: CodeGenerationOptions = {
        platform: selectedPlatform,
        includeTests,
        includeDocs,
        useIncrementalLoads: useIncremental,
        materializationType,
      };

      // Select generator based on platform
      let generator;
      switch (selectedPlatform) {
        case 'snowflake':
        case 'bigquery':
        case 'postgres':
          generator = new SnowflakeGenerator();
          break;
        case 'dbt':
          generator = new DbtGenerator();
          break;
        case 'databricks':
          generator = new DatabricksGenerator();
          break;
        default:
          throw new Error(`Unsupported platform: ${selectedPlatform}`);
      }

      const result = await generator.generate(flow, options);
      setArtifacts(result.artifacts);
      setWarnings(result.warnings);

      if (result.artifacts.length > 0) {
        setSelectedArtifact(result.artifacts[0]);
      }
    } catch (error) {
      console.error('Code generation failed:', error);
      setWarnings([`Generation failed: ${error}`]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (artifact: GeneratedArtifact) => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    artifacts.forEach((artifact) => {
      handleDownload(artifact);
    });
  };

  const getPlatformIcon = (platform: PlatformType): string => {
    const icons: Record<PlatformType, string> = {
      snowflake: '❄️',
      databricks: '🧱',
      bigquery: '🔍',
      postgres: '🐘',
      dbt: '🔧',
    };
    return icons[platform] || '📦';
  };

  const getLanguageIcon = (language: string): string => {
    const icons: Record<string, string> = {
      sql: '🔹',
      python: '🐍',
      yaml: '📄',
      json: '{ }',
    };
    return icons[language] || '📝';
  };

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
          maxWidth: '1200px',
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
              ⚡ Generate Artifacts
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: colors.text.secondary,
              }}
            >
              Convert flow to platform-specific code
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
          >
            ×
          </button>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div
            style={{
              padding: '12px 24px',
              backgroundColor: '#fef3c7',
              borderBottom: `1px solid #fbbf24`,
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#92400e',
                marginBottom: '4px',
              }}
            >
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
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Configuration Panel */}
          <div
            style={{
              width: '320px',
              padding: '24px',
              borderRight: `1px solid ${colors.border.main}`,
              backgroundColor: colors.background.secondary,
              overflowY: 'auto',
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
              Configuration
            </h3>

            {/* Platform Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.text.primary,
                  marginBottom: '8px',
                }}
              >
                Target Platform
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(['snowflake', 'databricks', 'bigquery', 'dbt', 'postgres'] as const).map(
                  (platform) => (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      style={{
                        padding: '10px 12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        border: `2px solid ${
                          selectedPlatform === platform ? colors.primary.main : colors.border.main
                        }`,
                        borderRadius: borderRadius.md,
                        backgroundColor:
                          selectedPlatform === platform
                            ? colors.primary.lighter
                            : colors.background.tertiary,
                        color:
                          selectedPlatform === platform
                            ? colors.primary.dark
                            : colors.text.secondary,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textTransform: 'capitalize',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span>{getPlatformIcon(platform)}</span>
                      <span>{platform}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Materialization Type */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.text.primary,
                  marginBottom: '8px',
                }}
              >
                Materialization
              </label>
              <select
                value={materializationType}
                onChange={(e) =>
                  setMaterializationType(
                    e.target.value as 'table' | 'view' | 'incremental' | 'ephemeral'
                  )
                }
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.tertiary,
                  color: colors.text.primary,
                  outline: 'none',
                }}
              >
                <option value="table">Table</option>
                <option value="view">View</option>
                <option value="incremental">Incremental</option>
                <option value="ephemeral">Ephemeral</option>
              </select>
            </div>

            {/* Options */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.text.primary,
                  marginBottom: '12px',
                }}
              >
                Options
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeTests}
                  onChange={(e) => setIncludeTests(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: colors.text.primary }}>
                  Include Tests
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeDocs}
                  onChange={(e) => setIncludeDocs(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: colors.text.primary }}>
                  Include Documentation
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={useIncremental}
                  onChange={(e) => setUseIncremental(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '13px', color: colors.text.primary }}>
                  Incremental Loads
                </span>
              </label>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: borderRadius.md,
                backgroundColor: isGenerating ? colors.background.secondary : colors.primary.main,
                color: '#ffffff',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: colors.shadow.sm,
              }}
            >
              {isGenerating ? '⏳ Generating...' : '⚡ Generate Code'}
            </button>
          </div>

          {/* Artifacts List */}
          <div
            style={{
              width: '280px',
              padding: '24px',
              borderRight: `1px solid ${colors.border.main}`,
              backgroundColor: colors.background.secondary,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: colors.text.secondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  margin: 0,
                }}
              >
                Artifacts ({artifacts.length})
              </h3>
              {artifacts.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    border: `1px solid ${colors.border.main}`,
                    borderRadius: borderRadius.sm,
                    backgroundColor: colors.background.tertiary,
                    color: colors.text.primary,
                    cursor: 'pointer',
                  }}
                >
                  ⬇ All
                </button>
              )}
            </div>

            {artifacts.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 16px',
                  color: colors.text.muted,
                  fontSize: '13px',
                }}
              >
                {isGenerating ? 'Generating artifacts...' : 'Click Generate to create code'}
              </div>
            ) : (
              artifacts.map((artifact, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedArtifact(artifact)}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor:
                      selectedArtifact === artifact
                        ? colors.primary.lighter
                        : colors.background.tertiary,
                    border: `1px solid ${
                      selectedArtifact === artifact ? colors.primary.main : colors.border.main
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
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>
                      {getLanguageIcon(artifact.language)}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: colors.text.primary,
                        fontFamily: 'monospace',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {artifact.filename}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: colors.text.secondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    {artifact.type}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Code Preview */}
          <div
            style={{
              flex: 1,
              padding: '24px',
              backgroundColor: colors.background.primary,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {selectedArtifact ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: colors.text.secondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      margin: 0,
                    }}
                  >
                    {selectedArtifact.filename}
                  </h3>
                  <button
                    onClick={() => handleDownload(selectedArtifact)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: `1px solid ${colors.border.main}`,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.background.secondary,
                      color: colors.text.primary,
                      cursor: 'pointer',
                    }}
                  >
                    ⬇ Download
                  </button>
                </div>
                <pre
                  style={{
                    flex: 1,
                    padding: '16px',
                    backgroundColor: colors.background.tertiary,
                    border: `1px solid ${colors.border.main}`,
                    borderRadius: borderRadius.md,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    color: colors.text.primary,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedArtifact.content}
                </pre>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.text.muted,
                  fontSize: '14px',
                }}
              >
                Select an artifact to preview
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${colors.border.main}`,
            backgroundColor: colors.background.tertiary,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
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
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateArtifactsModal;
