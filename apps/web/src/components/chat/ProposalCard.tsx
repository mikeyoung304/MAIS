'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Proposal } from '@/hooks/useAgentChat';
import type { ChatMessageVariant } from './ChatMessage';

interface ProposalCardProps {
  /** The proposal to display */
  proposal: Proposal;
  /** Visual variant - matches parent ChatMessage variant */
  variant?: ChatMessageVariant;
  /** Handler for confirming the proposal */
  onConfirm: () => void;
  /** Handler for rejecting the proposal */
  onReject: () => void;
}

/**
 * Variant-specific styling configurations
 */
const variantStyles = {
  default: {
    container: 'mt-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 shadow-sm',
    title: 'font-medium text-amber-900 mb-2',
    preview: 'text-sm text-amber-800/90 mb-4 space-y-1',
    previewItem: 'flex gap-2',
    buttonContainer: 'flex gap-2',
    confirmButton: 'rounded-full px-4',
    cancelButton: 'rounded-full px-4',
    icon: 'w-4 h-4 mr-1.5',
    // Show all preview items
    previewLimit: undefined,
    showTruncate: false,
  },
  compact: {
    container: 'mt-2 p-3 rounded-xl bg-amber-950/50 border border-amber-800',
    title: 'text-xs font-medium text-amber-300 mb-1.5',
    preview: 'text-[10px] text-amber-400 mb-2 space-y-0.5',
    previewItem: 'flex gap-1.5',
    buttonContainer: 'flex gap-1.5',
    confirmButton: 'rounded-lg px-2.5 py-1 h-auto text-xs',
    cancelButton: 'rounded-lg px-2.5 py-1 h-auto text-xs',
    icon: 'w-3 h-3 mr-1',
    // Limit preview items in compact mode
    previewLimit: 2,
    showTruncate: true,
  },
} as const;

/**
 * ProposalCard - Confirmation UI for T3 trust tier proposals
 *
 * Displays proposal details and confirm/cancel buttons.
 * Supports two variants matching ChatMessage:
 * - 'default': Full-size with all preview fields
 * - 'compact': Condensed with limited preview fields
 *
 * @example
 * ```tsx
 * <ProposalCard
 *   proposal={proposal}
 *   variant="compact"
 *   onConfirm={() => confirmProposal(proposal.proposalId)}
 *   onReject={() => rejectProposal(proposal.proposalId)}
 * />
 * ```
 */
export function ProposalCard({
  proposal,
  variant = 'default',
  onConfirm,
  onReject,
}: ProposalCardProps) {
  const styles = variantStyles[variant];
  const previewEntries = Object.entries(proposal.preview);
  const displayEntries = styles.previewLimit
    ? previewEntries.slice(0, styles.previewLimit)
    : previewEntries;

  return (
    <div className={styles.container}>
      <p className={styles.title}>{proposal.operation}</p>

      {/* Preview of what will change */}
      <div className={styles.preview}>
        {displayEntries.map(([key, value]) => (
          <div key={key} className={styles.previewItem}>
            <span className="font-medium">{key}:</span>
            <span className={cn(styles.showTruncate && 'truncate')}>{String(value)}</span>
          </div>
        ))}
      </div>

      {/* Confirmation buttons */}
      <div className={styles.buttonContainer}>
        <Button onClick={onConfirm} variant="sage" size="sm" className={styles.confirmButton}>
          <CheckCircle className={styles.icon} />
          Confirm
        </Button>
        <Button onClick={onReject} variant="outline" size="sm" className={styles.cancelButton}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
