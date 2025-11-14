import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { colors, borderRadius } from '../../theme/colors';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: {
    nodeType?: string;
    nodeName?: string;
  };
}

const CopilotPanel = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Ready to help with data lineage analysis.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedNode = useCanvasStore(state => state.selectedNode);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      context: selectedNode ? {
        nodeType: selectedNode.type,
        nodeName: selectedNode.data.label,
      } : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate LLM response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateCopilotResponse(input, selectedNode),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 800);
  };

  const generateCopilotResponse = (query: string, node: any) => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('expand') || lowerQuery.includes('explore') || lowerQuery.includes('upstream') || lowerQuery.includes('downstream')) {
      return 'Click the ➕ icon on any node to explore its upstream and downstream dependencies. This will dynamically load connected nodes and show the complete data lineage path.';
    }

    if (lowerQuery.includes('selected') || lowerQuery.includes('node') || lowerQuery.includes('current')) {
      if (node) {
        const typeDesc = node.type === 'transform' ? 'transformation' :
                        node.type === 'gold' ? 'gold layer entity' :
                        node.type === 'silver' ? 'silver layer table' : 'source table';

        return `**${node.data.label}** is a ${typeDesc}.${
          node.type === 'transform' && node.data.expression
            ? `\n\nTransformation logic:\n\`\`\`\n${node.data.expression}\n\`\`\``
            : ''
        }${
          node.data.llmMetadata
            ? `\n\nConfidence: ${node.data.llmMetadata.confidence}%`
            : ''
        }`;
      }
      return 'Select a node on the canvas to get detailed information.';
    }

    if (lowerQuery.includes('confidence') || lowerQuery.includes('quality')) {
      return 'Confidence scores indicate the reliability of LLM-generated transformations:\n• 90-100%: High confidence\n• 70-89%: Medium confidence\n• <70%: Low confidence (review recommended)';
    }

    if (lowerQuery.includes('llm') || lowerQuery.includes('generated') || lowerQuery.includes('ai')) {
      return 'LLM-generated transformations are marked with 🤖 badges showing confidence percentages. You can review the SQL code, explanations, and warnings in the bottom panel when a transform node is selected.';
    }

    return 'I can help you:\n• Explore node lineage (click ➕ on nodes)\n• Understand transformations\n• Review LLM confidence scores\n• Analyze data quality\n\nTry: "Explain the selected node" or "How do I expand lineage?"';
  };

  if (!isOpen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '60px',
        height: '100vh',
        backgroundColor: colors.background.tertiary,
        borderLeft: `1px solid ${colors.border.main}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '12px',
        zIndex: 999,
      }}>
        <button
          onClick={() => setIsOpen(true)}
          title="AI Copilot Assistant"
          style={{
            width: '40px',
            height: '40px',
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
            border: `2px solid ${colors.primary.main}`,
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: colors.shadow.md,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = colors.shadow.lg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = colors.shadow.md;
          }}
        >
          ✨
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '420px',
      height: '100vh',
      backgroundColor: colors.background.tertiary,
      borderLeft: `1px solid ${colors.border.main}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 999,
      boxShadow: colors.shadow.xl,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${colors.border.main}`,
        backgroundColor: colors.background.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: borderRadius.md,
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>
            ✨
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text.primary }}>
              Data Copilot
            </div>
            <div style={{ fontSize: '11px', color: colors.text.muted }}>
              AI-powered lineage assistant
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: colors.text.muted,
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: borderRadius.sm,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.background.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            {message.role === 'assistant' || message.role === 'system' ? (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: borderRadius.sm,
                background: `linear-gradient(135deg, ${colors.primary.lighter} 0%, ${colors.primary.light} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                flexShrink: 0,
              }}>
                ✨
              </div>
            ) : (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: borderRadius.sm,
                backgroundColor: colors.border.dark,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                flexShrink: 0,
              }}>
                👤
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {message.context && (
                <div style={{
                  fontSize: '10px',
                  color: colors.text.muted,
                  marginBottom: '4px',
                  padding: '4px 8px',
                  backgroundColor: colors.background.secondary,
                  borderRadius: borderRadius.sm,
                  display: 'inline-block',
                }}>
                  Context: {message.context.nodeName} ({message.context.nodeType})
                </div>
              )}
              <div style={{
                fontSize: '13px',
                lineHeight: '1.6',
                color: colors.text.primary,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {message.content.split('```').map((part, i) =>
                  i % 2 === 0 ? (
                    <span key={i}>{part.split('**').map((text, j) =>
                      j % 2 === 0 ? text : <strong key={j}>{text}</strong>
                    )}</span>
                  ) : (
                    <pre key={i} style={{
                      backgroundColor: '#1e293b',
                      color: '#e2e8f0',
                      padding: '8px',
                      borderRadius: borderRadius.sm,
                      fontSize: '11px',
                      fontFamily: 'Monaco, Consolas, monospace',
                      overflow: 'auto',
                      margin: '8px 0',
                    }}>
                      {part}
                    </pre>
                  )
                )}
              </div>
              <div style={{
                fontSize: '10px',
                color: colors.text.muted,
                marginTop: '6px',
              }}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: borderRadius.sm,
              background: `linear-gradient(135deg, ${colors.primary.lighter} 0%, ${colors.primary.light} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}>
              ✨
            </div>
            <div style={{
              padding: '8px 12px',
              backgroundColor: colors.background.secondary,
              borderRadius: borderRadius.md,
              fontSize: '13px',
              color: colors.text.muted,
            }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px',
        borderTop: `1px solid ${colors.border.main}`,
        backgroundColor: colors.background.primary,
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '8px',
          backgroundColor: colors.background.tertiary,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.main}`,
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about lineage, transformations..."
            style={{
              flex: 1,
              padding: '6px 8px',
              border: 'none',
              fontSize: '13px',
              outline: 'none',
              backgroundColor: 'transparent',
              color: colors.text.primary,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            style={{
              padding: '6px 12px',
              borderRadius: borderRadius.md,
              border: 'none',
              backgroundColor: input.trim() && !isTyping ? colors.primary.main : colors.border.dark,
              color: '#ffffff',
              fontSize: '18px',
              cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ↑
          </button>
        </div>
        <div style={{
          marginTop: '8px',
          fontSize: '10px',
          color: colors.text.muted,
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setInput('Explain the selected node')}
            style={{
              padding: '4px 8px',
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.sm,
              fontSize: '10px',
              color: colors.text.secondary,
              cursor: 'pointer',
            }}
          >
            Explain selected
          </button>
          <button
            onClick={() => setInput('How do I expand lineage?')}
            style={{
              padding: '4px 8px',
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.main}`,
              borderRadius: borderRadius.sm,
              fontSize: '10px',
              color: colors.text.secondary,
              cursor: 'pointer',
            }}
          >
            Expand lineage
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopilotPanel;
