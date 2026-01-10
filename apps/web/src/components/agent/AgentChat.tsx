'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, Loader2, Bot, AlertTriangle } from 'lucide-react';
import { ChatbotUnavailable } from './ChatbotUnavailable';
import { parseQuickReplies } from '@/lib/parseQuickReplies';
import { QuickReplyChips } from './QuickReplyChips';
import { useAgentChat } from '@/hooks/useAgentChat';
import { ChatMessage } from '@/components/chat/ChatMessage';

// Use Next.js API proxy for agent endpoints
// The proxy (/api/agent/*) handles authentication and forwards to Express backend
// SECURITY: Backend token is never exposed to client-side code
const API_URL = '/api/agent';

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
  const {
    messages,
    inputValue,
    isLoading,
    sessionId,
    context,
    error,
    pendingProposals,
    isCheckingHealth,
    isAvailable,
    unavailableReason,
    sendMessage,
    confirmProposal,
    rejectProposal,
    initializeChat,
    setInputValue,
    messagesEndRef,
    inputRef,
    handleKeyDown,
  } = useAgentChat({
    apiUrl: API_URL,
    initialGreeting,
    onSessionStart,
    onProposalConfirmed,
  });

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
              <ChatMessage
                message={{ ...message, content: displayContent }}
                variant="default"
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

export default AgentChat;
