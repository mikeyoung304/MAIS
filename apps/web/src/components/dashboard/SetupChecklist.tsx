'use client';

/**
 * SetupChecklist — Onboarding progress checklist for the dashboard
 *
 * Shows when onboardingStatus === 'SETUP'. Displays 8 checklist items
 * with weighted progress percentage, actionable click targets, and dismiss.
 *
 * Data is derived server-side from actual tenant state (no redundant storage).
 *
 * @see docs/plans/2026-02-20-feat-onboarding-redesign-plan.md (Phase 6)
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  X,
  MessageSquare,
  ExternalLink,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetupAction {
  type: 'agent_prompt' | 'navigate' | 'modal';
  prompt?: string;
  path?: string;
  modal?: string;
}

interface SetupItem {
  id: string;
  label: string;
  completed: boolean;
  dismissed: boolean;
  action: SetupAction;
  weight: number;
}

interface SetupProgress {
  percentage: number;
  items: SetupItem[];
}

interface SetupChecklistProps {
  /** Callback when an agent_prompt action is triggered */
  onAgentPrompt?: (prompt: string) => void;
  /** Callback when a modal action is triggered */
  onModalOpen?: (modal: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupChecklist({ onAgentPrompt, onModalOpen }: SetupChecklistProps) {
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Fetch progress
  // -------------------------------------------------------------------------

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/tenant-admin/onboarding/setup-progress');
      if (!res.ok) {
        throw new Error('Failed to load setup progress');
      }
      const data = (await res.json()) as SetupProgress;
      setProgress(data);
      setError(null);
    } catch (err) {
      logger.error(
        'SetupChecklist: failed to fetch progress',
        err instanceof Error ? err : { error: String(err) }
      );
      setError('Could not load your setup progress.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // -------------------------------------------------------------------------
  // Dismiss handler
  // -------------------------------------------------------------------------

  const handleDismiss = useCallback(async (itemId: string) => {
    setDismissingId(itemId);
    try {
      const res = await fetch('/api/tenant-admin/onboarding/dismiss-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });

      if (res.ok) {
        // Optimistic update: mark as dismissed locally
        setProgress((prev) => {
          if (!prev) return prev;
          const updated = prev.items.map((item) =>
            item.id === itemId ? { ...item, dismissed: true } : item
          );
          // Recalculate percentage excluding dismissed
          const active = updated.filter((i) => !i.dismissed);
          const totalWeight = active.reduce((sum, i) => sum + i.weight, 0);
          const completedWeight = active
            .filter((i) => i.completed)
            .reduce((sum, i) => sum + i.weight, 0);
          const percentage =
            totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
          return { percentage, items: updated };
        });
      }
    } catch (err) {
      logger.error(
        'SetupChecklist: dismiss failed',
        err instanceof Error ? err : { error: String(err) }
      );
    } finally {
      setDismissingId(null);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Action handler
  // -------------------------------------------------------------------------

  const handleAction = useCallback(
    (action: SetupAction) => {
      if (action.type === 'agent_prompt' && action.prompt) {
        onAgentPrompt?.(action.prompt);
      } else if (action.type === 'modal' && action.modal) {
        onModalOpen?.(action.modal);
      }
      // 'navigate' type is handled by Link component
    },
    [onAgentPrompt, onModalOpen]
  );

  // -------------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-neutral-800 bg-surface-alt p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-48 animate-pulse rounded bg-neutral-700" />
          <div className="h-6 w-12 animate-pulse rounded bg-neutral-700" />
        </div>
        <div className="h-2 w-full animate-pulse rounded-full bg-neutral-700 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="w-5 h-5 animate-pulse rounded-full bg-neutral-700" />
              <div className="h-4 flex-1 animate-pulse rounded bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !progress) {
    return null; // Silently hide on error — dashboard still functional
  }

  // Filter visible items (not dismissed)
  const visibleItems = progress.items.filter((item) => !item.dismissed);

  if (visibleItems.length === 0) {
    return null; // All items dismissed or completed
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="rounded-3xl border border-sage/20 bg-surface-alt shadow-lg overflow-hidden">
      {/* Header + progress */}
      <button
        onClick={() => setIsCollapsed((c) => !c)}
        className="w-full flex items-center justify-between p-6 pb-4 hover:bg-surface-alt/80 transition-colors text-left"
        aria-expanded={!isCollapsed}
        aria-controls="setup-checklist-items"
      >
        <div className="flex-1">
          <h2 className="font-serif text-lg font-bold text-text-primary">
            Your website is {progress.percentage}% complete
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            {visibleItems.filter((i) => i.completed).length} of {visibleItems.length} steps done
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Circular progress indicator */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                className="text-neutral-700"
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <circle
                className="text-sage transition-all duration-700 ease-out"
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${(progress.percentage / 100) * 94.25} 94.25`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-text-primary">
              {progress.percentage}%
            </span>
          </div>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-6 pb-2">
        <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-sage transition-all duration-700 ease-out"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Items list */}
      {!isCollapsed && (
        <div id="setup-checklist-items" className="px-4 pb-4 pt-2">
          <ul className="space-y-1" role="list" aria-label="Setup checklist">
            {visibleItems.map((item) => (
              <ChecklistItem
                key={item.id}
                item={item}
                onAction={handleAction}
                onDismiss={handleDismiss}
                isDismissing={dismissingId === item.id}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChecklistItem
// ---------------------------------------------------------------------------

function ChecklistItem({
  item,
  onAction,
  onDismiss,
  isDismissing,
}: {
  item: SetupItem;
  onAction: (action: SetupAction) => void;
  onDismiss: (id: string) => void;
  isDismissing: boolean;
}) {
  const actionIcon = getActionIcon(item.action.type);

  const content = (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        item.completed ? 'opacity-60' : 'hover:bg-sage/5 cursor-pointer'
      }`}
    >
      {/* Status icon */}
      {item.completed ? (
        <CheckCircle2 className="w-5 h-5 text-sage flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-neutral-600 flex-shrink-0" />
      )}

      {/* Label */}
      <span
        className={`flex-1 text-sm ${
          item.completed ? 'text-text-muted line-through' : 'text-text-primary'
        }`}
      >
        {item.label}
      </span>

      {/* Action icon */}
      {!item.completed && (
        <span className="text-text-muted group-hover:text-sage transition-colors">
          {actionIcon}
        </span>
      )}

      {/* Dismiss button */}
      {!item.completed && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss(item.id);
          }}
          disabled={isDismissing}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-neutral-700/50 transition-all text-text-muted hover:text-text-primary disabled:opacity-30"
          aria-label={`Dismiss "${item.label}"`}
          title="Dismiss this item"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  // Navigate actions use Link, others use button
  if (!item.completed && item.action.type === 'navigate' && item.action.path) {
    return (
      <li role="listitem">
        <Link href={item.action.path}>{content}</Link>
      </li>
    );
  }

  if (!item.completed && (item.action.type === 'agent_prompt' || item.action.type === 'modal')) {
    return (
      <li role="listitem">
        <button className="w-full text-left" onClick={() => onAction(item.action)}>
          {content}
        </button>
      </li>
    );
  }

  // Completed items are non-interactive
  return <li role="listitem">{content}</li>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActionIcon(type: string) {
  switch (type) {
    case 'agent_prompt':
      return <MessageSquare className="w-4 h-4" />;
    case 'navigate':
      return <ExternalLink className="w-4 h-4" />;
    case 'modal':
      return <Upload className="w-4 h-4" />;
    default:
      return null;
  }
}
