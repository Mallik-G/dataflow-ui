import { useState } from 'react';
import { colors, borderRadius } from '../../theme/colors';

interface FeedbackModalProps {
  onSubmit: (feedback: string) => void;
  onCancel: () => void;
}

const FeedbackModal = ({ onSubmit, onCancel }: FeedbackModalProps) => {
  const [feedback, setFeedback] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());

  const commonIssues = [
    { id: 'wrong-mapping', label: 'Incorrect column mapping' },
    { id: 'wrong-transformation', label: 'Wrong transformation type' },
    { id: 'missing-mapping', label: 'Missing important mappings' },
    { id: 'data-quality', label: 'Data quality concerns' },
    { id: 'business-logic', label: 'Business logic not applied' },
    { id: 'naming-convention', label: 'Naming convention issues' },
  ];

  const handleIssueToggle = (issueId: string) => {
    const newSelected = new Set(selectedIssues);
    if (newSelected.has(issueId)) {
      newSelected.delete(issueId);
    } else {
      newSelected.add(issueId);
    }
    setSelectedIssues(newSelected);
  };

  const handleSubmit = () => {
    let fullFeedback = '';

    if (selectedIssues.size > 0) {
      const issues = Array.from(selectedIssues)
        .map((id) => commonIssues.find((i) => i.id === id)?.label)
        .join(', ');
      fullFeedback += `Issues: ${issues}\n\n`;
    }

    fullFeedback += feedback;

    onSubmit(fullFeedback);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11000,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: colors.background.primary,
          borderRadius: borderRadius.xl,
          boxShadow: colors.shadow.xl,
          width: '100%',
          maxWidth: '600px',
          border: `1px solid ${colors.border.main}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: `1px solid ${colors.border.main}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: colors.text.primary,
              marginBottom: '6px',
            }}
          >
            💭 Provide Feedback
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: colors.text.secondary,
            }}
          >
            Help the AI improve the column mappings
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Common Issues */}
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
              Common Issues (select all that apply)
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              {commonIssues.map((issue) => (
                <label
                  key={issue.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    backgroundColor: selectedIssues.has(issue.id)
                      ? colors.primary.lighter
                      : colors.background.tertiary,
                    border: `1px solid ${
                      selectedIssues.has(issue.id)
                        ? colors.primary.main
                        : colors.border.main
                    }`,
                    borderRadius: borderRadius.md,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIssues.has(issue.id)) {
                      e.currentTarget.style.backgroundColor = colors.background.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedIssues.has(issue.id)) {
                      e.currentTarget.style.backgroundColor = colors.background.tertiary;
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIssues.has(issue.id)}
                    onChange={() => handleIssueToggle(issue.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span
                    style={{
                      fontSize: '12px',
                      color: colors.text.primary,
                    }}
                  >
                    {issue.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Detailed Feedback */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                color: colors.text.primary,
                marginBottom: '8px',
              }}
            >
              Detailed Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe what's wrong and what you'd like to see instead...&#10;&#10;Example:&#10;- The full_name should use CONCAT_WS(' ', first_name, last_name) to handle nulls&#10;- Map address to billing_address instead of skipping it&#10;- Use HASH(email) for PII protection"
              rows={8}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
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
            <div
              style={{
                fontSize: '11px',
                color: colors.text.muted,
                marginTop: '6px',
              }}
            >
              Be specific about which mappings need changes and why
            </div>
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
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedIssues.size === 0 && !feedback.trim()}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderRadius: borderRadius.md,
              backgroundColor:
                selectedIssues.size > 0 || feedback.trim()
                  ? colors.primary.main
                  : colors.background.secondary,
              color:
                selectedIssues.size > 0 || feedback.trim()
                  ? '#ffffff'
                  : colors.text.muted,
              cursor:
                selectedIssues.size > 0 || feedback.trim()
                  ? 'pointer'
                  : 'not-allowed',
              transition: 'all 0.2s ease',
            }}
          >
            🔄 Regenerate with Feedback
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
