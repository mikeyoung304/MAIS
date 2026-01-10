'use client';

import * as React from 'react';
import { useEffect, useMemo } from 'react';
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
import { parseQuickReplies } from '@/lib/parseQuickReplies';
import { parseHighlights } from '@/lib/parseHighlights';
import { QuickReplyChips } from './QuickReplyChips';
import {
  useAgentChat,
  type ChatMessage,
  type Proposal,
  type ToolResult,
} from '@/hooks/useAgentChat';

// Use Next.js API proxy to handle authentication
// The proxy at /api/agent/* adds the backend token from the session
const API_PROXY = '/api/agent';

/**
 * UI Action from agent tool responses
 * Matches the uiAction payloads from ui-tools.ts
 */
export interface AgentUIAction {
  type: 'SHOW_PREVIEW' | 'SHOW_DASHBOARD' | 'HIGHLIGHT_SECTION' | 'NAVIGATE';
  page?: string;
  sectionId?: string;
  path?: string;
}

interface PanelAgentChatProps {
  /** Custom welcome message for first-time users */
  welcomeMessage?: string;
  /** Callback when user sends their first message */
  onFirstMessage?: () => void;
  /** Callback when a message completes with successful tool results (config may have changed) */
  onToolComplete?: () => void;
  /** Callback when agent message contains section highlight instruction */
  onSectionHighlight?: (sectionId: string) => void;
  /** Callback when agent tool returns a UI action (preview, navigate, etc.) */
  onUIAction?: (action: AgentUIAction) => void;
  /** Initial message to populate in input field (from quick actions) */
  initialMessage?: string | null;
  /** Callback when initial message has been consumed */
  onMessageConsumed?: () => void;
  /** Callback when quick replies status changes (true = agent provided quick replies) */
  onQuickRepliesChange?: (hasQuickReplies: boolean) => void;
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
  onToolComplete,
  onSectionHighlight,
  onUIAction,
  initialMessage,
  onMessageConsumed,
  onQuickRepliesChange,
  className,
}: PanelAgentChatProps) {
  // Use shared hook with panel-specific callbacks
  const {
    messages,
    inputValue,
    isLoading,
    sessionId,
    error,
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
    apiUrl: API_PROXY,
    fallbackGreeting: welcomeMessage,
    onFirstMessage,
    onToolComplete: (toolResults) => {
      // Notify parent about tool completion
      onToolComplete?.();

      // Handle UI actions from tool results
      if (onUIAction) {
        for (const result of toolResults) {
          if (result.success && result.data) {
            const toolData = result.data as { uiAction?: AgentUIAction };
            if (toolData.uiAction) {
              onUIAction(toolData.uiAction);
            }
          }
        }
      }
    },
  });

  // Calculate whether the last assistant message has quick replies
  // Memoized to avoid recalculating on every render
  const hasAgentQuickReplies = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return false;
    const { quickReplies } = parseQuickReplies(lastMessage.content);
    return quickReplies.length > 0;
  }, [messages]);

  // Notify parent when quick replies status changes
  useEffect(() => {
    onQuickRepliesChange?.(hasAgentQuickReplies);
  }, [hasAgentQuickReplies, onQuickRepliesChange]);

  // Handle initial message from quick actions
  useEffect(() => {
    if (initialMessage && !isLoading && sessionId) {
      setInputValue(initialMessage);
      inputRef.current?.focus();
      onMessageConsumed?.();
    }
  }, [initialMessage, isLoading, sessionId, setInputValue, onMessageConsumed, inputRef]);

  // Loading state
  if (isCheckingHealth) {
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
  if (isAvailable === false) {
    return (
      <div
        className={cn(
          'flex flex-col h-full items-center justify-center p-6 text-center',
          className
        )}
      >
        <div className="w-10 h-10 rounded-xl bg-neutral-700 flex items-center justify-center mb-3">
          <Bot className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text-primary mb-1">Assistant Unavailable</p>
        <p className="text-xs text-text-muted mb-3">
          {unavailableReason || 'Unable to connect to your assistant.'}
        </p>
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
        {messages.map((message, index) => {
          // Check if this is the last assistant message
          const isLastAssistantMessage =
            message.role === 'assistant' && index === messages.length - 1;

          // Parse highlights and quick replies from assistant messages (chained)
          let displayContent = message.content;
          let quickReplies: string[] = [];
          let highlights: string[] = [];

          if (message.role === 'assistant') {
            // First, extract highlights
            const highlightResult = parseHighlights(message.content);
            highlights = highlightResult.highlights;

            // Then, parse quick replies from the cleaned content
            const quickReplyResult = parseQuickReplies(highlightResult.message);
            displayContent = quickReplyResult.message;
            quickReplies = quickReplyResult.quickReplies;
          }

          return (
            <div key={index}>
              {/* Trigger highlights when this message is rendered */}
              {isLastAssistantMessage && highlights.length > 0 && (
                <HighlightTrigger highlights={highlights} onSectionHighlight={onSectionHighlight} />
              )}
              <CompactMessage
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

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2 items-start">
            <div className="w-6 h-6 rounded-lg bg-sage/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-sage" />
            </div>
            <div className="bg-surface rounded-xl rounded-bl-sm px-3 py-2">
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
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-neutral-700 bg-surface-alt">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            data-growth-assistant-input
            data-testid="agent-chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className={cn(
              'flex-1 resize-none rounded-xl border border-neutral-700 px-3 py-2 text-sm',
              'focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/20',
              'placeholder:text-text-muted/60 text-text-primary bg-surface',
              'min-h-[40px] max-h-[80px]',
              'transition-all duration-200 hover:border-neutral-600'
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
          isUser ? 'bg-neutral-700' : 'bg-sage/10'
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
              : 'bg-surface text-text-primary rounded-bl-sm'
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
                    ? 'bg-green-950/50 text-green-400 border-green-800'
                    : 'bg-red-950/50 text-red-400 border-red-800'
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
    <div className="mt-2 p-3 rounded-xl bg-amber-950/50 border border-amber-800">
      <p className="text-xs font-medium text-amber-300 mb-1.5">{proposal.operation}</p>

      <div className="text-[10px] text-amber-400 mb-2 space-y-0.5">
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

/**
 * HighlightTrigger - Effect-only component to trigger section highlights
 *
 * Triggers the highlight callback when mounted, with staggered timing for multiple highlights.
 * Renders nothing - purely for side effects.
 *
 * Uses JSON.stringify to stabilize the array dependency and prevent re-triggering
 * on every parent re-render.
 */
function HighlightTrigger({
  highlights,
  onSectionHighlight,
}: {
  highlights: string[];
  onSectionHighlight?: (sectionId: string) => void;
}) {
  // Stringify highlights to create a stable dependency
  // This prevents the effect from re-running when parent re-renders
  // but the actual highlight IDs haven't changed
  const highlightsKey = JSON.stringify(highlights);

  useEffect(() => {
    if (!onSectionHighlight) return;

    // Parse highlights from the stable key
    const parsedHighlights: string[] = JSON.parse(highlightsKey);
    if (parsedHighlights.length === 0) return;

    // Trigger highlights with staggered timing (500ms between each)
    const timeouts = parsedHighlights.map((sectionId, index) =>
      setTimeout(() => {
        onSectionHighlight(sectionId);
      }, index * 500)
    );

    // Cleanup timeouts on unmount
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [highlightsKey, onSectionHighlight]);

  return null; // Renders nothing
}

export default PanelAgentChat;
