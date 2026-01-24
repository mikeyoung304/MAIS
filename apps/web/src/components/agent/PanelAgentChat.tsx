'use client';

import * as React from 'react';
import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, Loader2, Bot, AlertTriangle, Sparkles } from 'lucide-react';
import { parseQuickReplies } from '@/lib/parseQuickReplies';
import { parseHighlights } from '@/lib/parseHighlights';
import { QuickReplyChips } from './QuickReplyChips';
import { useAgentChat } from '@/hooks/useAgentChat';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { agentUIActions } from '@/stores/agent-ui-store';

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

/**
 * Type guard to validate uiAction data from tool results
 * Provides runtime validation to prevent errors from malformed data
 */
function hasUIAction(data: unknown): data is { uiAction: AgentUIAction } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  if (!('uiAction' in obj) || typeof obj.uiAction !== 'object' || obj.uiAction === null) {
    return false;
  }

  const action = obj.uiAction as Record<string, unknown>;
  const validTypes = ['SHOW_PREVIEW', 'SHOW_DASHBOARD', 'HIGHLIGHT_SECTION', 'NAVIGATE'];

  return typeof action.type === 'string' && validTypes.includes(action.type);
}

interface PanelAgentChatProps {
  /** Custom welcome message for first-time users */
  welcomeMessage?: string;
  /** Callback when user sends their first message */
  onFirstMessage?: () => void;
  /** Callback when a message completes with successful tool results (config may have changed) */
  onToolComplete?: (toolResults?: Array<{ success: boolean; data?: any }>) => void;
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
  /** Ref for the input textarea (for focus management from parent) */
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  /** ARIA role for messages container (default "log" for screen readers) */
  messagesRole?: 'log' | 'region';
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
  inputRef: externalInputRef,
  messagesRole = 'log',
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
    inputRef: internalInputRef,
    handleKeyDown,
  } = useAgentChat({
    apiUrl: API_PROXY,
    fallbackGreeting: welcomeMessage,
    onFirstMessage,
    onToolComplete: (toolResults) => {
      // Notify parent about tool completion (pass results for Phase 1.4 optimistic updates)
      onToolComplete?.(toolResults);

      // Handle UI actions from tool results
      if (onUIAction) {
        for (const result of toolResults) {
          if (result.success && hasUIAction(result.data)) {
            onUIAction(result.data.uiAction);
          }
        }
      }

      // Detect CONCURRENT_MODIFICATION errors (#620 - optimistic locking)
      // Show conflict dialog when another tab modified the draft
      for (const result of toolResults) {
        if (!result.success && result.error === 'CONCURRENT_MODIFICATION') {
          agentUIActions.setShowConflictDialog(true);
          break;
        }
      }
    },
  });

  // Use external ref if provided, otherwise use internal ref
  const inputRef = externalInputRef || internalInputRef;

  // Platform detection for keyboard handling
  const [isMobile, setIsMobile] = React.useState(false);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);

  // Detect platform on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobile = window.innerWidth < 768; // md breakpoint
    const android = /Android/i.test(navigator.userAgent);
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    setIsMobile(mobile);
    setIsAndroid(android);
    setIsIOS(ios);
  }, []);

  // Platform-specific keyboard handling for mobile
  useEffect(() => {
    if (!isMobile) return;

    if (isAndroid) {
      // Android: Viewport resizes naturally, add bottom padding to input
      if (inputRef.current) {
        inputRef.current.style.paddingBottom = '60px';
      }
    } else if (isIOS) {
      // iOS: Manual viewport monitoring with visualViewport API
      // Fix for #745: Track RAF ID for proper cleanup
      let rafId: number | null = null;

      const handleViewportChange = () => {
        if (!window.visualViewport) return;

        // Cancel any pending RAF to prevent race conditions
        if (rafId !== null) cancelAnimationFrame(rafId);

        const vh = window.visualViewport.height;
        const keyboardHeight = window.innerHeight - vh;

        if (keyboardHeight > 150) {
          // Keyboard open (threshold to distinguish from browser chrome)
          // Scroll input into view after layout settles
          rafId = requestAnimationFrame(() => {
            inputRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest', // NOT 'center' - causes over-scroll (issue #216)
            });
            rafId = null;
          });
        }
        // Note: No need to adjust drawer height - Vaul handles this automatically
      };

      window.visualViewport?.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        // Fix for #745: Cancel pending RAF on cleanup
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }
  }, [isMobile, isAndroid, isIOS, inputRef]);

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
      <div
        role={messagesRole}
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth"
      >
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
              <ChatMessage
                message={{ ...message, content: displayContent }}
                variant="compact"
                onConfirmProposal={confirmProposal}
                onRejectProposal={rejectProposal}
                showTimestamp={false}
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
        {/* Fix for #746: Screen reader description for input */}
        <span id="agent-input-description" className="sr-only">
          Chat with AI assistant. Press Enter to send, Shift+Enter for new line.
        </span>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            data-growth-assistant-input
            data-testid="agent-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            aria-label="Message input"
            aria-describedby="agent-input-description"
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
            aria-label="Send message"
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
