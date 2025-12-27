'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, Loader2, CheckCircle, XCircle, Bot, User, AlertTriangle } from 'lucide-react';
import { ChatbotUnavailable } from './ChatbotUnavailable';

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
      const healthResponse = await fetch(`${API_URL}/v1/agent/health`, {
        credentials: 'include',
      });

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
      const sessionResponse = await fetch(`${API_URL}/v1/agent/session`, {
        credentials: 'include',
      });

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
      const response = await fetch(`${API_URL}/v1/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
      const response = await fetch(`${API_URL}/v1/agent/proposals/${proposalId}/confirm`, {
        method: 'POST',
        credentials: 'include',
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
      const response = await fetch(`${API_URL}/v1/agent/proposals/${proposalId}/reject`, {
        method: 'POST',
        credentials: 'include',
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
          content: 'No problem, I won\'t make that change. What else can I help with?',
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

  // Loading state
  if (isCheckingHealth) {
    return (
      <div
        className={cn(
          'flex flex-col h-full bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden items-center justify-center',
          className
        )}
      >
        <Loader2 className="w-8 h-8 text-sage animate-spin" />
        <p className="text-text-muted mt-4">Loading your assistant...</p>
      </div>
    );
  }

  // Unavailable state
  if (isAvailable === false) {
    return (
      <div
        className={cn(
          'flex flex-col h-full bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden',
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
        'flex flex-col h-full bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100 bg-gradient-to-r from-sage/5 to-transparent">
        <div className="p-2 rounded-full bg-sage/10">
          <Bot className="w-5 h-5 text-sage" />
        </div>
        <div>
          <h3 className="font-semibold text-neutral-900">Business Growth Assistant</h3>
          {context && (
            <p className="text-sm text-neutral-500">
              Helping {context.businessName}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            onConfirmProposal={confirmProposal}
            onRejectProposal={rejectProposal}
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending Proposals Banner */}
      {pendingProposals.length > 0 && (
        <div className="px-6 py-3 bg-amber-50 border-t border-amber-100">
          <p className="text-sm text-amber-800">
            {pendingProposals.length} action{pendingProposals.length > 1 ? 's' : ''} awaiting
            your confirmation
          </p>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your business..."
            className={cn(
              'flex-1 resize-none rounded-xl border border-neutral-200 px-4 py-3',
              'focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage',
              'placeholder:text-neutral-400 text-neutral-900',
              'min-h-[48px] max-h-[120px]'
            )}
            rows={1}
            disabled={isLoading || !sessionId}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading || !sessionId}
            variant="sage"
            size="icon"
            className="h-12 w-12 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-400 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

/**
 * Individual message bubble component
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
          isUser ? 'bg-neutral-100' : 'bg-sage/10'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-neutral-600" />
        ) : (
          <Bot className="w-4 h-4 text-sage" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-sage text-white rounded-br-sm'
              : 'bg-neutral-100 text-neutral-900 rounded-bl-sm'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Tool Results */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolResults.map((result, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-2 text-xs px-3 py-1 rounded-full',
                  result.success
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
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
        <span className="text-xs text-neutral-400 mt-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

/**
 * Proposal confirmation card
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
    <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <p className="font-medium text-amber-900 mb-2">{proposal.operation}</p>

      {/* Preview of what will change */}
      <div className="text-sm text-amber-800 mb-3 space-y-1">
        {Object.entries(proposal.preview).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="font-medium">{key}:</span>
            <span>{String(value)}</span>
          </div>
        ))}
      </div>

      {/* Confirmation buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onConfirm}
          variant="default"
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Confirm
        </Button>
        <Button onClick={onReject} variant="outline" size="sm">
          <XCircle className="w-4 h-4 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default AgentChat;
