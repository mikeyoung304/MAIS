'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, Loader2, CheckCircle, XCircle, Bot, User, AlertTriangle } from 'lucide-react';
import { ChatbotUnavailable } from './ChatbotUnavailable';
import { parseQuickReplies } from '@/lib/parseQuickReplies';
import { QuickReplyChips } from './QuickReplyChips';

// Use Next.js API proxy for agent endpoints
// The proxy (/api/agent/*) handles authentication and forwards to Express backend
// SECURITY: Backend token is never exposed to client-side code
const API_URL = '/api';

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

/**
 * Session context from backend
 */
interface SessionContext {
  businessName: string;
  businessSlug: string;
  quickStats: {
    stripeConnected: boolean;
    packageCount: number;
    upcomingBookings: number;
    totalBookings: number;
    revenueThisMonth: number;
  };
}

/**
 * Health check response from backend
 */
interface HealthCheckResponse {
  available: boolean;
  reason: string | null;
  onboardingState: 'needs_stripe' | 'needs_packages' | 'needs_bookings' | 'ready';
  capabilities: string[];
}

interface AgentChatProps {
  /** Initial greeting to display (optional, will fetch from API if not provided) */
  initialGreeting?: string;
  /** Callback when chat session starts */
  onSessionStart?: (sessionId: string) => void;
  /** Callback when a proposal is confirmed */
  onProposalConfirmed?: (proposalId: string, result: unknown) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AgentChat - AI Business Growth Assistant chat interface
 *
 * Features:
 * - Real-time chat with Claude-powered agent
 * - Proposal confirmation/rejection UI
 * - Tool execution feedback
 * - Session persistence
 */
export function AgentChat({
  initialGreeting,
  onSessionStart,
  onProposalConfirmed,
  className,
}: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProposals, setPendingProposals] = useState<Proposal[]>([]);

  // Health check state
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Health check and session initialization
  const initializeChat = useCallback(async () => {
    setIsCheckingHealth(true);
    setError(null);

    try {
      // Step 1: Pre-flight health check
      // Calls /api/agent/health → proxied to /v1/agent/health with auth
      const healthResponse = await fetch(`${API_URL}/agent/health`);

      if (!healthResponse.ok) {
        // Network error - try to proceed anyway
        console.warn('Health check failed, attempting session init...');
      } else {
        const health: HealthCheckResponse = await healthResponse.json();

        if (!health.available) {
          setIsAvailable(false);
          setUnavailableReason(health.reason);
          setIsCheckingHealth(false);
          return;
        }
        // onboardingState is available in health.onboardingState for future use
        // (e.g., showing progress indicators)
      }

      // Step 2: Initialize session
      const sessionResponse = await fetch(`${API_URL}/agent/session`);

      if (!sessionResponse.ok) {
        throw new Error('Failed to initialize chat session');
      }

      const data = await sessionResponse.json();
      setSessionId(data.sessionId);
      setContext(data.context);
      setIsAvailable(true);
      onSessionStart?.(data.sessionId);

      // Add greeting message
      const greeting = initialGreeting || data.greeting;
      setMessages([
        {
          role: 'assistant',
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setIsAvailable(false);
      setUnavailableReason('context_unavailable');
      setError(err instanceof Error ? err.message : 'Failed to start chat');
    } finally {
      setIsCheckingHealth(false);
    }
  }, [initialGreeting, onSessionStart]);

  // Initialize on mount
  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  // Send a message to the agent
  const sendMessage = async () => {
    const message = inputValue.trim();
    if (!message || isLoading || !sessionId) return;

    setInputValue('');
    setError(null);
    setIsLoading(true);

    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`${API_URL}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        proposals: data.proposals,
        toolResults: data.toolResults,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Track pending proposals that need confirmation
      if (data.proposals?.length) {
        const needsConfirmation = data.proposals.filter(
          (p: Proposal) => p.requiresApproval && p.trustTier === 'T3'
        );
        if (needsConfirmation.length) {
          setPendingProposals((prev) => [...prev, ...needsConfirmation]);
        }
      }
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
      const response = await fetch(`${API_URL}/agent/proposals/${proposalId}/confirm`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to confirm proposal');
      }

      const result = await response.json();

      // Remove from pending
      setPendingProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));

      // Add confirmation message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Done! ${result.status === 'EXECUTED' ? 'The change has been applied.' : 'Confirmed.'}`,
          timestamp: new Date(),
        },
      ]);

      onProposalConfirmed?.(proposalId, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm proposal');
    }
  };

  // Handle proposal rejection
  const rejectProposal = async (proposalId: string) => {
    try {
      const response = await fetch(`${API_URL}/agent/proposals/${proposalId}/reject`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reject proposal');
      }

      // Remove from pending
      setPendingProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));

      // Add rejection message
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

  // Handle textarea enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Loading state - matches HANDLED card pattern
  if (isCheckingHealth) {
    return (
      <div
        className={cn(
          'flex flex-col h-full bg-surface rounded-3xl shadow-lg border border-neutral-100 overflow-hidden items-center justify-center',
          className
        )}
      >
        <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-4">
          <Bot className="w-6 h-6 text-sage" />
        </div>
        {/* Typing indicator dots */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full bg-sage/60 animate-pulse"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-sage/60 animate-pulse"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-sage/60 animate-pulse"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <p className="text-text-muted mt-4 text-sm">Loading your assistant...</p>
      </div>
    );
  }

  // Unavailable state
  if (isAvailable === false) {
    return (
      <div
        className={cn(
          'flex flex-col h-full bg-surface rounded-3xl shadow-lg border border-neutral-100 overflow-hidden',
          className
        )}
      >
        <ChatbotUnavailable reason={unavailableReason} onRetry={initializeChat} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-surface rounded-3xl shadow-lg border border-neutral-100 overflow-hidden',
        className
      )}
    >
      {/* Header - subtle gradient, matches brand */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100/80 bg-white/60">
        <div className="w-10 h-10 rounded-2xl bg-sage/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-sage" />
        </div>
        <div>
          <h3 className="font-serif font-semibold text-text-primary">AI Assistant</h3>
          {context && <p className="text-sm text-text-muted">{context.businessName}</p>}
        </div>
      </div>

      {/* Messages - warm cream background with smooth scrolling */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scroll-smooth">
        {messages.map((message, index) => {
          // Check if this is the last assistant message
          const isLastAssistantMessage =
            message.role === 'assistant' && index === messages.length - 1;

          // Parse quick replies from assistant messages
          const { message: displayContent, quickReplies } =
            message.role === 'assistant'
              ? parseQuickReplies(message.content)
              : { message: message.content, quickReplies: [] };

          return (
            <div key={index}>
              <MessageBubble
                message={{ ...message, content: displayContent }}
                onConfirmProposal={confirmProposal}
                onRejectProposal={rejectProposal}
              />
              {/* Quick replies - only on last assistant message */}
              {isLastAssistantMessage && quickReplies.length > 0 && (
                <QuickReplyChips
                  replies={quickReplies}
                  onSelect={(reply) => {
                    setInputValue(reply);
                    inputRef.current?.focus();
                  }}
                  disabled={isLoading}
                />
              )}
            </div>
          );
        })}

        {/* Typing indicator while loading */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-sage/10 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-sage" />
            </div>
            <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full bg-sage/50 animate-pulse"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-sage/50 animate-pulse"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 rounded-full bg-sage/50 animate-pulse"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending Proposals Banner */}
      {pendingProposals.length > 0 && (
        <div className="px-6 py-3 bg-amber-50/80 border-t border-amber-100">
          <p className="text-sm text-amber-800">
            {pendingProposals.length} action{pendingProposals.length > 1 ? 's' : ''} awaiting your
            confirmation
          </p>
        </div>
      )}

      {/* Input - matches HANDLED form pattern */}
      <div className="px-6 py-4 border-t border-neutral-100/80 bg-white/60">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your business..."
            className={cn(
              'flex-1 resize-none rounded-full border-2 border-neutral-200 px-5 py-3',
              'focus:outline-none focus:border-sage focus:ring-4 focus:ring-sage/10',
              'placeholder:text-neutral-400 text-text-primary bg-white',
              'min-h-[48px] max-h-[120px]',
              'transition-all duration-200 hover:border-neutral-300'
            )}
            rows={1}
            disabled={isLoading || !sessionId}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading || !sessionId}
            variant="sage"
            className="h-12 w-12 shrink-0 rounded-full shadow-md hover:shadow-lg transition-all duration-300"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-text-muted text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

/**
 * Individual message bubble component
 * Styled to match HANDLED brand: warm, professional, minimal
 */
function MessageBubble({
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
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-neutral-200' : 'bg-sage/10'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-text-muted" />
        ) : (
          <Bot className="w-4 h-4 text-sage" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[85%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isUser
              ? 'bg-sage text-white rounded-br-sm'
              : 'bg-white text-text-primary border border-neutral-100 rounded-bl-sm'
          )}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>

        {/* Tool Results */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolResults.map((result, idx) => (
              <div
                key={idx}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border',
                  result.success
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : 'bg-red-50 text-red-700 border-red-100'
                )}
              >
                {result.success ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>{result.toolName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Proposals requiring confirmation */}
        {message.proposals &&
          message.proposals
            .filter((p) => p.requiresApproval && p.trustTier === 'T3')
            .map((proposal) => (
              <ProposalCard
                key={proposal.proposalId}
                proposal={proposal}
                onConfirm={() => onConfirmProposal(proposal.proposalId)}
                onReject={() => onRejectProposal(proposal.proposalId)}
              />
            ))}

        {/* Timestamp */}
        <span className="text-xs text-text-muted/60 mt-1.5 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

/**
 * Proposal confirmation card
 * Styled to match HANDLED brand with warm amber tones
 */
function ProposalCard({
  proposal,
  onConfirm,
  onReject,
}: {
  proposal: Proposal;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 shadow-sm">
      <p className="font-medium text-amber-900 mb-2">{proposal.operation}</p>

      {/* Preview of what will change */}
      <div className="text-sm text-amber-800/90 mb-4 space-y-1">
        {Object.entries(proposal.preview).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="font-medium">{key}:</span>
            <span>{String(value)}</span>
          </div>
        ))}
      </div>

      {/* Confirmation buttons - follow HANDLED button patterns */}
      <div className="flex gap-2">
        <Button onClick={onConfirm} variant="sage" size="sm" className="rounded-full px-4">
          <CheckCircle className="w-4 h-4 mr-1.5" />
          Confirm
        </Button>
        <Button onClick={onReject} variant="outline" size="sm" className="rounded-full px-4">
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default AgentChat;
