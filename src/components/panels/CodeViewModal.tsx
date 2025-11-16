import { useState, useEffect } from 'react';
import { colors, borderRadius } from '../../theme/colors';
import { useCanvasStore } from '../../stores/canvasStore';
import { serializeToYAML, deserializeFromYAML } from '../../utils/yamlSerializer';

interface CodeViewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CodeViewModal = ({ isOpen, onClose }: CodeViewModalProps) => {
  const { nodes, edges, setNodes, setEdges } = useCanvasStore();
  const [yamlCode, setYamlCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync canvas state to YAML when modal opens or canvas changes
  useEffect(() => {
    if (isOpen) {
      try {
        const yaml = serializeToYAML(nodes, edges);
        setYamlCode(yaml);
        setError(null);
        setHasUnsavedChanges(false);
      } catch (err) {
        setError('Failed to serialize canvas to YAML');
      }
    }
  }, [isOpen, nodes, edges]);

  const handleYamlChange = (newYaml: string) => {
    setYamlCode(newYaml);
    setHasUnsavedChanges(true);
    setError(null);
  };

  const handleApplyChanges = () => {
    try {
      const { nodes: newNodes, edges: newEdges } = deserializeFromYAML(yamlCode);
      setNodes(newNodes);
      setEdges(newEdges);
      setError(null);
      setHasUnsavedChanges(false);

      // Save to localStorage
      localStorage.setItem('lineage-yaml', yamlCode);

      // Show success message
      alert('✅ YAML applied successfully! Canvas updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse YAML');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([yamlCode], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineage-${new Date().toISOString().split('T')[0]}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setYamlCode(content);
          setHasUnsavedChanges(true);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.xl,
        boxShadow: colors.shadow.xl,
        width: '90%',
        maxWidth: '1200px',
        height: '85vh',
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
              fontSize: '20px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '6px',
            }}>
              YAML Configuration
            </h2>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: colors.text.secondary,
            }}>
              Edit the YAML below to update the canvas. Changes are bi-directional.
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

        {/* Toolbar */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${colors.border.main}`,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          backgroundColor: colors.background.tertiary,
        }}>
          <button
            onClick={handleApplyChanges}
            disabled={!hasUnsavedChanges}
            style={{
              padding: '10px 20px',
              backgroundColor: hasUnsavedChanges ? colors.primary.main : colors.background.secondary,
              color: hasUnsavedChanges ? '#ffffff' : colors.text.muted,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: '14px',
              fontWeight: '600',
              cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
              boxShadow: hasUnsavedChanges ? colors.shadow.sm : 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (hasUnsavedChanges) {
                e.currentTarget.style.backgroundColor = colors.primary.dark;
                e.currentTarget.style.boxShadow = colors.shadow.md;
              }
            }}
            onMouseLeave={(e) => {
              if (hasUnsavedChanges) {
                e.currentTarget.style.backgroundColor = colors.primary.main;
                e.currentTarget.style.boxShadow = colors.shadow.sm;
              }
            }}
          >
            ✓ Apply Changes
          </button>
          <button
            onClick={handleDownload}
            style={{
              padding: '10px 20px',
              backgroundColor: colors.background.secondary,
              color: colors.text.primary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.md,
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.hover;
              e.currentTarget.style.borderColor = colors.border.dark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.secondary;
              e.currentTarget.style.borderColor = colors.border.main;
            }}
          >
            ⬇ Download YAML
          </button>
          <button
            onClick={handleUpload}
            style={{
              padding: '10px 20px',
              backgroundColor: colors.background.secondary,
              color: colors.text.primary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.md,
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.hover;
              e.currentTarget.style.borderColor = colors.border.dark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.background.secondary;
              e.currentTarget.style.borderColor = colors.border.main;
            }}
          >
            ⬆ Upload YAML
          </button>
          {hasUnsavedChanges && (
            <span style={{
              marginLeft: 'auto',
              fontSize: '12px',
              color: colors.status.warning,
              fontWeight: '600',
            }}>
              ● Unsaved changes
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            margin: '16px 24px 0',
            padding: '12px 16px',
            backgroundColor: '#fee',
            border: `1px solid ${colors.status.error}`,
            borderRadius: borderRadius.md,
            color: colors.status.error,
            fontSize: '13px',
            fontWeight: '500',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Editor */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflow: 'auto',
          backgroundColor: '#1e293b',
        }}>
          <textarea
            value={yamlCode}
            onChange={(e) => handleYamlChange(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#e2e8f0',
              fontSize: '13px',
              fontFamily: 'Monaco, Consolas, monospace',
              lineHeight: '1.8',
              resize: 'none',
              outline: 'none',
              padding: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CodeViewModal;
