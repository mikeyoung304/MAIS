'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, Loader2, Bot, AlertTriangle, Sparkles, Zap } from 'lucide-react';
import {
  useTenantAgentChat,
  type TenantAgentToolCall,
  type DashboardAction,
} from '@/hooks/useTenantAgentChat';
import { registerAgentSender } from '@/lib/tenant-agent-dispatch';
import { ChatMessage } from '@/components/chat/ChatMessage';

/**
 * UI Action from tenant-agent tool calls
 * Maps agent actions to UI updates (preview, navigation, highlighting)
 */
export interface TenantAgentUIAction {
  type: 'SHOW_PREVIEW' | 'SHOW_DASHBOARD' | 'HIGHLIGHT_SECTION' | 'REFRESH_PREVIEW';
  sectionId?: string;
}

interface TenantAgentChatProps {
  /** Callback when user sends their first message */
  onFirstMessage?: () => void;
  /** Callback when tool calls complete (for preview updates) */
  onToolComplete?: (toolCalls: TenantAgentToolCall[]) => void;
  /** Callback for UI actions derived from tool calls */
  onUIAction?: (action: TenantAgentUIAction) => void;
  /** Callback when dashboard actions are received from agent (navigation, scroll, preview) */
  onDashboardActions?: (actions: DashboardAction[]) => void;
  /** Ref for the input textarea (for focus management from parent) */
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  /** ARIA role for messages container */
  messagesRole?: 'log' | 'region';
  /** Additional CSS classes */
  className?: string;
}

/**
 * TenantAgentChat - Chat interface for Tenant Agent (Cloud Run)
 *
 * This component connects to the unified tenant-agent that handles:
 * - Storefront editing: layout changes, section updates, branding
 * - Marketing content: headlines, copy, taglines
 * - Project management: client communication, task tracking
 *
 * IMPORTANT: The agent speaks first based on session state (forbiddenSlots).
 * There is no hardcoded welcome message - the agent's system prompt determines the opener.
 *
 * Features:
 * - Agent-first greeting based on session context
 * - Real-time tool call visualization
 * - Activity indicators for tool execution
 * - Integration with preview panel via callbacks
 * - Dashboard action processing (navigation, scroll, guided refinement)
 *
 * See SERVICE_REGISTRY.md for current agent architecture.
 * See docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md for context injection.
 */
export function TenantAgentChat({
  onFirstMessage,
  onToolComplete,
  onUIAction,
  onDashboardActions,
  inputRef: externalInputRef,
  messagesRole = 'log',
  className,
}: TenantAgentChatProps) {
  const {
    messages,
    inputValue,
    isLoading,
    sessionId,
    error,
    lastToolCalls,
    isInitializing,
    isAvailable,
    sendMessage,
    sendProgrammaticMessage,
    setInputValue,
    initializeSession,
    cancelRequest,
    loadingStartRef,
    messagesEndRef,
    inputRef: internalInputRef,
    handleKeyDown,
  } = useTenantAgentChat({
    onFirstMessage,
    onDashboardActions,
    onToolComplete: (toolCalls) => {
      onToolComplete?.(toolCalls);

      // Derive UI actions from tool calls
      if (onUIAction) {
        for (const call of toolCalls) {
          // Marketing agent calls → show preview
          if (call.name.includes('marketing') || call.name.includes('headline')) {
            onUIAction({ type: 'SHOW_PREVIEW' });
          }
          // Storefront agent calls → refresh preview
          if (call.name.includes('storefront') || call.name.includes('section')) {
            onUIAction({ type: 'REFRESH_PREVIEW' });
          }
        }
      }
    },
  });

  const inputRef = externalInputRef || internalInputRef;

  // Show recovery button after 60s of continuous loading
  const [showRecovery, setShowRecovery] = React.useState(false);
  React.useEffect(() => {
    if (!isLoading) {
      setShowRecovery(false);
      return;
    }
    const timer = setTimeout(() => {
      if (loadingStartRef.current && Date.now() - loadingStartRef.current >= 60_000) {
        setShowRecovery(true);
      }
    }, 60_000);
    return () => clearTimeout(timer);
  }, [isLoading, loadingStartRef]);

  // Register message sender for external components (SectionWidget)
  React.useEffect(() => {
    if (isAvailable && sendProgrammaticMessage) {
      return registerAgentSender(sendProgrammaticMessage);
    }
  }, [isAvailable, sendProgrammaticMessage]);

  // Loading state
  if (isInitializing) {
    return (
      <div className={cn('flex flex-col h-full items-center justify-center p-6', className)}>
        <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center mb-3">
          <Sparkles className="w-5 h-5 text-sage animate-pulse" />
        </div>
        <p className="text-sm text-text-muted">Connecting to assistant...</p>
      </div>
    );
  }

  // Unavailable state
  if (!isAvailable) {
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
          {error || 'Unable to connect to your assistant.'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={initializeSession}
          className="rounded-full text-xs"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Active agent indicator */}
      {isLoading && lastToolCalls.length > 0 && (
        <div className="px-4 py-2 border-b border-neutral-700 bg-sage/5">
          <div className="flex items-center gap-2 text-xs text-sage">
            <Zap className="w-3 h-3 animate-pulse" />
            <span>
              Working with{' '}
              {lastToolCalls[0].name.includes('marketing')
                ? 'Marketing'
                : lastToolCalls[0].name.includes('storefront')
                  ? 'Storefront'
                  : lastToolCalls[0].name.includes('research')
                    ? 'Research'
                    : 'Specialist'}{' '}
              Agent...
            </span>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        role={messagesRole}
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth"
      >
        {messages.map((message, index) => {
          return (
            <div key={index}>
              <ChatMessage
                message={{
                  role: message.role,
                  content: message.content,
                  timestamp: message.timestamp,
                }}
                variant="compact"
                showTimestamp={false}
              />

              {/* Show tool calls for assistant messages */}
              {message.role === 'assistant' &&
                message.toolCalls &&
                message.toolCalls.length > 0 && (
                  <div className="ml-8 mt-2 space-y-1">
                    {message.toolCalls.map((call, callIndex) => (
                      <ToolCallBadge key={callIndex} toolCall={call} />
                    ))}
                  </div>
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

        {/* Recovery button — shown after 60s of loading */}
        {showRecovery && isLoading && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-950/50 border border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="text-xs text-amber-400">Taking longer than expected.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={cancelRequest}
              className="ml-auto rounded-full text-xs h-6 px-2"
            >
              Cancel
            </Button>
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
        <span id="tenant-agent-input-description" className="sr-only">
          Chat with AI assistant. Press Enter to send, Shift+Enter for new line.
        </span>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            data-tenant-agent-input
            data-testid="tenant-agent-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            aria-label="Message input"
            aria-describedby="tenant-agent-input-description"
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
 * ToolCallBadge - Visual indicator for tenant-agent tool execution
 * Shows which category of tool is being executed (marketing, storefront, research)
 */
function ToolCallBadge({ toolCall }: { toolCall: TenantAgentToolCall }) {
  // Determine agent type from tool name
  const getAgentInfo = (name: string) => {
    if (name.includes('marketing') || name.includes('headline') || name.includes('copy')) {
      return { label: 'Marketing', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    }
    if (name.includes('storefront') || name.includes('section') || name.includes('layout')) {
      return { label: 'Storefront', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    }
    if (name.includes('research') || name.includes('competitor') || name.includes('market')) {
      return { label: 'Research', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    }
    return { label: 'Tool', color: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' };
  };

  const { label, color } = getAgentInfo(toolCall.name);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border',
        color
      )}
    >
      <Zap className="w-3 h-3" />
      <span>{label}</span>
      {toolCall.result !== undefined && <span className="opacity-60">✓</span>}
    </div>
  );
}

export default TenantAgentChat;
