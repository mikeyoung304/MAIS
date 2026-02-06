'use client';

/**
 * ReviewProgress - Progress indicator for guided section review
 *
 * Displayed below the AgentPanel header during `mode === 'reviewing'`.
 * Shows a sage-colored progress bar and "Reviewing: X of Y sections" text.
 * Subtle — doesn't compete with chat for attention.
 *
 * WCAG: Includes a screen reader announcer that speaks section changes.
 *
 * @see stores/refinement-store.ts
 */

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useRefinementStore, type RefinementState } from '@/stores/refinement-store';
import { cn } from '@/lib/utils';

export function ReviewProgress() {
  const announcerRef = useRef<HTMLDivElement>(null);

  // Use useShallow to prevent re-renders from new object references (Pitfall #87)
  const { completed, total, currentSectionType } = useRefinementStore(
    useShallow((state: RefinementState) => ({
      completed: state.completedSections.length,
      total: state.totalSections,
      currentSectionType: state.currentSectionType,
    }))
  );

  const percentage = total > 0 ? (completed / total) * 100 : 0;

  // WCAG 4.1.3: Announce section changes to screen readers
  useEffect(() => {
    if (announcerRef.current && currentSectionType) {
      const label = currentSectionType
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      announcerRef.current.textContent = `Now reviewing ${label} section. ${completed + 1} of ${total}.`;
    }
  }, [currentSectionType, completed, total]);

  return (
    <div className="px-4 py-2 border-b border-neutral-700 bg-surface-alt/80 shrink-0">
      {/* Screen reader announcer */}
      <div
        ref={announcerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Visual progress */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-text-muted">
          Reviewing: {completed} of {total} sections
        </span>
        {currentSectionType && (
          <span
            className={cn('text-xs px-2 py-0.5 rounded-full', 'bg-sage/10 text-sage font-medium')}
          >
            {currentSectionType
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-sage rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`Review progress: ${completed} of ${total} sections`}
        />
      </div>
    </div>
  );
}

export default ReviewProgress;
