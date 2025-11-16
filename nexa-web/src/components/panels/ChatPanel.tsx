import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { colors, borderRadius } from '../../theme/colors';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ChatPanel = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I can help you understand the data lineage, transformations, and pipelines on the canvas. Ask me anything about the flows, nodes, or data quality.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedNode = useCanvasStore(state => state.selectedNode);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Simulate LLM response (in production, this would call an API)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateMockResponse(input, selectedNode),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  const generateMockResponse = (query: string, node: any) => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('selected') || lowerQuery.includes('node')) {
      if (node) {
        return `The selected node "${node.data.label}" is a ${node.type} node. ${
          node.type === 'transform'
            ? `It applies the transformation: "${node.data.expression}"`
            : node.type === 'gold'
            ? 'It represents a gold layer entity with curated, business-ready data.'
            : node.type === 'silver'
            ? 'It represents cleaned and transformed data in the silver layer.'
            : 'It represents raw source data.'
        }`;
      }
      return 'Please select a node on the canvas to get information about it.';
    }

    if (lowerQuery.includes('quality') || lowerQuery.includes('confidence')) {
      return 'Data quality is tracked through multiple metrics including row counts, execution duration, and confidence scores. LLM-generated transformations show confidence percentages indicating the reliability of the generated code.';
    }

    if (lowerQuery.includes('transform') || lowerQuery.includes('llm')) {
      return 'LLM-generated transformations are marked with confidence indicators. You can review the SQL code, see explanations for why transformations were generated, and view any warnings. User modifications are clearly tracked with timestamps and reasons.';
    }

    if (lowerQuery.includes('approval') || lowerQuery.includes('review')) {
      return 'The approval workflow allows SMEs to review LLM-generated pipelines. You can approve, request changes, or reject transformations. Use the bottom panel to access the approval tab when a node is selected.';
    }

    return 'I can help you understand data lineage, LLM-generated transformations, data quality metrics, and the approval workflow. Try asking about a specific node, transformation logic, or data quality.';
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: colors.primary.main,
          color: '#ffffff',
          border: 'none',
          borderRadius: borderRadius.full,
          width: '56px',
          height: '56px',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: colors.shadow.lg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        💬
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '380px',
      height: '500px',
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.xl,
      boxShadow: colors.shadow.xl,
      border: `1px solid ${colors.border.main}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${colors.border.main}`,
        backgroundColor: colors.primary.main,
        borderRadius: `${borderRadius.xl} ${borderRadius.xl} 0 0`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🤖</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>
              Data Lineage Assistant
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)' }}>
              Powered by LLM
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#ffffff',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          −
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}
          >
            <div style={{
              padding: '10px 14px',
              borderRadius: borderRadius.lg,
              backgroundColor: message.role === 'user'
                ? colors.primary.main
                : colors.background.secondary,
              color: message.role === 'user' ? '#ffffff' : colors.text.primary,
              fontSize: '13px',
              lineHeight: '1.5',
            }}>
              {message.content}
            </div>
            <div style={{
              fontSize: '10px',
              color: colors.text.muted,
              marginTop: '4px',
              textAlign: message.role === 'user' ? 'right' : 'left',
            }}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px',
        borderTop: `1px solid ${colors.border.main}`,
        backgroundColor: colors.background.primary,
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about lineage, transformations..."
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.border.main}`,
              fontSize: '13px',
              outline: 'none',
              backgroundColor: colors.background.tertiary,
              color: colors.text.primary,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.primary.main;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border.main;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              padding: '10px 16px',
              borderRadius: borderRadius.md,
              border: 'none',
              backgroundColor: input.trim() ? colors.primary.main : colors.border.dark,
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
            }}
          >
            Send
          </button>
        </div>
        <div style={{
          marginTop: '8px',
          fontSize: '10px',
          color: colors.text.muted,
          textAlign: 'center',
        }}>
          Try: "Explain the selected node" or "What's the data quality?"
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
