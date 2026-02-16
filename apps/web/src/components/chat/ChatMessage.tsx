'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Bot, User } from 'lucide-react';
import { ProposalCard } from './ProposalCard';

/**
 * Defense-in-depth: strip [SESSION CONTEXT] blocks that may slip through
 * from server-side filtering. Defined at module level to avoid re-creation per render.
 */
function stripSessionContext(content: string): string {
  const startTag = '[SESSION CONTEXT]';
  const endTag = '[END CONTEXT]';
  const startIdx = content.indexOf(startTag);
  if (startIdx === -1) return content;
  const endIdx = content.indexOf(endTag, startIdx);
  if (endIdx === -1) return content;
  return content.slice(endIdx + endTag.length).trim();
}

/**
 * Chat message type for the ChatMessage component
 * Simplified from the legacy useAgentChat - now supports Vertex AI messages
 */
export interface ChatMessageType {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Tool results (legacy - optional for backwards compatibility) */
  toolResults?: Array<{
    toolName: string;
    success: boolean;
  }>;
  /** Proposals requiring confirmation (legacy - optional) */
  proposals?: Array<{
    proposalId: string;
    operation: string;
    requiresApproval: boolean;
    trustTier: string;
    preview: Record<string, unknown>;
  }>;
}

/**
 * Variant configuration for ChatMessage styling
 */
export type ChatMessageVariant = 'default' | 'compact';

interface ChatMessageProps {
  /** The message to display */
  message: ChatMessageType;
  /** Visual variant - 'default' for full-size, 'compact' for panel usage */
  variant?: ChatMessageVariant;
  /** Handler for confirming a proposal */
  onConfirmProposal?: (proposalId: string) => void;
  /** Handler for rejecting a proposal */
  onRejectProposal?: (proposalId: string) => void;
  /** Whether to show timestamp (only applicable to default variant) */
  showTimestamp?: boolean;
}

/**
 * Variant-specific styling configurations
 */
const variantStyles = {
  default: {
    container: 'gap-3',
    avatar: 'w-8 h-8 rounded-full',
    avatarIcon: 'w-4 h-4',
    avatarUserBg: 'bg-neutral-200',
    avatarBotBg: 'bg-sage/10',
    maxWidth: 'max-w-[85%]',
    bubble: 'rounded-2xl px-4 py-3 shadow-sm',
    bubbleUser: 'bg-sage text-white rounded-br-sm',
    bubbleAssistant: 'bg-white text-text-primary border border-neutral-100 rounded-bl-sm',
    text: '',
    toolResultContainer: 'mt-2 space-y-1',
    toolResult: 'text-xs px-3 py-1.5 rounded-full border',
    toolResultSuccess: 'bg-green-50 text-green-700 border-green-100',
    toolResultError: 'bg-red-50 text-red-700 border-red-100',
    toolResultIcon: 'w-3 h-3',
  },
  compact: {
    container: 'gap-2',
    avatar: 'w-6 h-6 rounded-lg',
    avatarIcon: 'w-3.5 h-3.5',
    avatarUserBg: 'bg-neutral-700',
    avatarBotBg: 'bg-sage/10',
    maxWidth: 'max-w-[85%]',
    bubble: 'rounded-xl px-3 py-2',
    bubbleUser: 'bg-sage text-white rounded-br-sm',
    bubbleAssistant: 'bg-surface text-text-primary rounded-bl-sm',
    text: 'text-sm',
    toolResultContainer: 'mt-1.5 flex flex-wrap gap-1',
    toolResult: 'text-[10px] px-2 py-0.5 rounded-full border',
    toolResultSuccess: 'bg-green-950/50 text-green-400 border-green-800',
    toolResultError: 'bg-red-950/50 text-red-400 border-red-800',
    toolResultIcon: 'w-2.5 h-2.5',
  },
} as const;

/**
 * ChatMessage - Shared message bubble component for agent chat interfaces
 *
 * Supports two variants:
 * - 'default': Full-size styling for main chat views
 * - 'compact': Condensed styling for side panel usage
 *
 * @example
 * ```tsx
 * <ChatMessage
 *   message={message}
 *   variant="compact"
 *   onConfirmProposal={handleConfirm}
 *   onRejectProposal={handleReject}
 * />
 * ```
 */
export function ChatMessage({
  message,
  variant = 'default',
  onConfirmProposal,
  onRejectProposal,
  showTimestamp = true,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const styles = variantStyles[variant];
  // Strip context injection prefix from user messages (defense-in-depth)
  const displayContent = isUser ? stripSessionContext(message.content) : message.content;

  return (
    <div className={cn('flex', styles.container, isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 flex items-center justify-center',
          styles.avatar,
          isUser ? styles.avatarUserBg : styles.avatarBotBg
        )}
      >
        {isUser ? (
          <User className={cn(styles.avatarIcon, 'text-text-muted')} />
        ) : (
          <Bot className={cn(styles.avatarIcon, 'text-sage')} />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1', styles.maxWidth, isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            styles.bubble,
            styles.text,
            isUser ? styles.bubbleUser : styles.bubbleAssistant
          )}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{displayContent}</p>
        </div>

        {/* Tool Results */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className={styles.toolResultContainer}>
            {message.toolResults.map((result, idx) => (
              <div
                key={idx}
                className={cn(
                  'inline-flex items-center gap-1',
                  styles.toolResult,
                  result.success ? styles.toolResultSuccess : styles.toolResultError
                )}
              >
                {result.success ? (
                  <CheckCircle className={styles.toolResultIcon} />
                ) : (
                  <XCircle className={styles.toolResultIcon} />
                )}
                <span>{result.toolName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Proposals requiring confirmation */}
        {message.proposals &&
          onConfirmProposal &&
          onRejectProposal &&
          message.proposals
            .filter((p) => p.requiresApproval && p.trustTier === 'T3')
            .map((proposal) => (
              <ProposalCard
                key={proposal.proposalId}
                proposal={proposal}
                variant={variant}
                onConfirm={() => onConfirmProposal(proposal.proposalId)}
                onReject={() => onRejectProposal(proposal.proposalId)}
              />
            ))}

        {/* Timestamp - only shown in default variant */}
        {variant === 'default' && showTimestamp && (
          <span className="text-xs text-text-muted/60 mt-1.5 px-1">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
