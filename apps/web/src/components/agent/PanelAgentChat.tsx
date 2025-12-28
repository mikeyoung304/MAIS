'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Bot,
  User,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Message in the chat history
 */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  proposals?: Proposal[];
  toolResults?: ToolResult[];
}

/**
 * Proposal requiring user confirmation
 */
interface Proposal {
  proposalId: string;
  operation: string;
  preview: Record<string, unknown>;
  trustTier: string;
  requiresApproval: boolean;
}

/**
 * Tool execution result
 */
interface ToolResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

interface PanelAgentChatProps {
  /** Custom welcome message for first-time users */
  welcomeMessage?: string;
  /** Callback when user sends their first message */
  onFirstMessage?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PanelAgentChat - Compact chat UI for side panel
 *
 * Adapted from AgentChat.tsx for panel form factor:
 * - Compact message styling
 * - Scroll container fits panel height
 * - Input fixed at bottom of panel
 */
export function PanelAgentChat({
  welcomeMessage = 'Salutations. Are you ready to get handled? Tell me a little about yourself.',
  onFirstMessage,
  className,
}: PanelAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasHealthCheckFailed, setHasHealthCheckFailed] = useState(false);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize chat session
  const initializeChat = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    setHasHealthCheckFailed(false);

    try {
      // Health check first
      const healthResponse = await fetch(`${API_URL}/v1/agent/health`, {
        credentials: 'include',
      });

      if (!healthResponse.ok) {
        console.warn('Health check failed, attempting session init...');
      } else {
        const health = await healthResponse.json();
        if (!health.available) {
          setHasHealthCheckFailed(true);
          setIsInitializing(false);
          return;
        }
      }

      // Initialize session
      const sessionResponse = await fetch(`${API_URL}/v1/agent/session`, {
        credentials: 'include',
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to initialize chat session');
      }

      const data = await sessionResponse.json();
      setSessionId(data.sessionId);

      // Add welcome message
      setMessages([
        {
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start chat');
      setHasHealthCheckFailed(true);
    } finally {
      setIsInitializing(false);
    }
  }, [welcomeMessage]);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  // Send a message to the agent
  const sendMessage = async () => {
    const message = inputValue.trim();
    if (!message || isLoading || !sessionId) return;

    // Track first message
    if (!hasSentFirstMessage) {
      setHasSentFirstMessage(true);
      onFirstMessage?.();
    }

    setInputValue('');
    setError(null);
    setIsLoading(true);

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`${API_URL}/v1/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        proposals: data.proposals,
        toolResults: data.toolResults,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle proposal confirmation
  const confirmProposal = async (proposalId: string) => {
    try {
      const response = await fetch(`${API_URL}/v1/agent/proposals/${proposalId}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to confirm proposal');
      }

      const result = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Done! ${result.status === 'EXECUTED' ? 'The change has been applied.' : 'Confirmed.'}`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm proposal');
    }
  };

  // Handle proposal rejection
  const rejectProposal = async (proposalId: string) => {
    try {
      const response = await fetch(`${API_URL}/v1/agent/proposals/${proposalId}/reject`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to reject proposal');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "No problem, I won't make that change. What else can I help with?",
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject proposal');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Loading state
  if (isInitializing) {
    return (
      <div className={cn('flex flex-col h-full items-center justify-center p-6', className)}>
        <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center mb-3">
          <Sparkles className="w-5 h-5 text-sage animate-pulse" />
        </div>
        <p className="text-sm text-text-muted">Loading assistant...</p>
      </div>
    );
  }

  // Unavailable state
  if (hasHealthCheckFailed) {
    return (
      <div
        className={cn(
          'flex flex-col h-full items-center justify-center p-6 text-center',
          className
        )}
      >
        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mb-3">
          <Bot className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text-primary mb-1">Assistant Unavailable</p>
        <p className="text-xs text-text-muted mb-3">Complete setup to unlock your AI assistant.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={initializeChat}
          className="rounded-full text-xs"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
        {messages.map((message, index) => (
          <CompactMessage
            key={index}
            message={message}
            onConfirmProposal={confirmProposal}
            onRejectProposal={rejectProposal}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2 items-start">
            <div className="w-6 h-6 rounded-lg bg-sage/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-sage" />
            </div>
            <div className="bg-neutral-50 rounded-xl rounded-bl-sm px-3 py-2">
              <div className="flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-sage/50 animate-pulse"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-sage/50 animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-sage/50 animate-pulse"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-neutral-100 bg-white">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className={cn(
              'flex-1 resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm',
              'focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/10',
              'placeholder:text-neutral-400 text-text-primary bg-white',
              'min-h-[40px] max-h-[80px]',
              'transition-all duration-200 hover:border-neutral-300'
            )}
            rows={1}
            disabled={isLoading || !sessionId}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading || !sessionId}
            variant="sage"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact message bubble for panel
 */
function CompactMessage({
  message,
  onConfirmProposal,
  onRejectProposal,
}: {
  message: ChatMessage;
  onConfirmProposal: (id: string) => void;
  onRejectProposal: (id: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 w-6 h-6 rounded-lg flex items-center justify-center',
          isUser ? 'bg-neutral-200' : 'bg-sage/10'
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-sage" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[85%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-xl px-3 py-2 text-sm',
            isUser
              ? 'bg-sage text-white rounded-br-sm'
              : 'bg-neutral-50 text-text-primary rounded-bl-sm'
          )}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>

        {/* Tool Results */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.toolResults.map((result, idx) => (
              <div
                key={idx}
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border',
                  result.success
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : 'bg-red-50 text-red-700 border-red-100'
                )}
              >
                {result.success ? (
                  <CheckCircle className="w-2.5 h-2.5" />
                ) : (
                  <XCircle className="w-2.5 h-2.5" />
                )}
                <span>{result.toolName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Proposals */}
        {message.proposals &&
          message.proposals
            .filter((p) => p.requiresApproval && p.trustTier === 'T3')
            .map((proposal) => (
              <CompactProposalCard
                key={proposal.proposalId}
                proposal={proposal}
                onConfirm={() => onConfirmProposal(proposal.proposalId)}
                onReject={() => onRejectProposal(proposal.proposalId)}
              />
            ))}
      </div>
    </div>
  );
}

/**
 * Compact proposal card for panel
 */
function CompactProposalCard({
  proposal,
  onConfirm,
  onReject,
}: {
  proposal: Proposal;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-2 p-3 rounded-xl bg-amber-50/80 border border-amber-200/60">
      <p className="text-xs font-medium text-amber-900 mb-1.5">{proposal.operation}</p>

      <div className="text-[10px] text-amber-800/90 mb-2 space-y-0.5">
        {Object.entries(proposal.preview)
          .slice(0, 2)
          .map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <span className="font-medium">{key}:</span>
              <span className="truncate">{String(value)}</span>
            </div>
          ))}
      </div>

      <div className="flex gap-1.5">
        <Button
          onClick={onConfirm}
          variant="sage"
          size="sm"
          className="rounded-lg px-2.5 py-1 h-auto text-xs"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Confirm
        </Button>
        <Button
          onClick={onReject}
          variant="outline"
          size="sm"
          className="rounded-lg px-2.5 py-1 h-auto text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default PanelAgentChat;
