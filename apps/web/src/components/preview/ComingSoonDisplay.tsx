'use client';

/**
 * ComingSoonDisplay - Ambient backdrop during Discovery and Building phases
 *
 * Agent-forward layout: this is secondary to the chat panel.
 * Shows progress dots for discovered facts and an encouraging message.
 *
 * Data flow:
 * - Real-time: AgentPanel extracts slotMetrics from store_discovery_fact tool result
 *   → dispatches to agent-ui-store → this component re-renders (<200ms, no network)
 * - Hydration: On page refresh, useOnboardingState provides initial fact count
 *
 * Design tokens: #18181B bg, #FAFAFA text, sage filled dots, graphite unfilled
 *
 * @see stores/agent-ui-store.ts for comingSoon slice
 * @see plans/2026-02-06-feat-dashboard-onboarding-rebuild-plan.md (lines 368-427)
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentUIStore } from '@/stores/agent-ui-store';
import { DISCOVERY_FACT_LABELS } from '@macon/contracts';

// ============================================
// FACT KEY → HUMAN LABEL (from contracts)
// ============================================

/** Get human-readable label for a fact key */
function getFactLabel(key: string): string {
  return DISCOVERY_FACT_LABELS[key] ?? key;
}

// ============================================
// ENCOURAGING COPY (rotates based on progress)
// ============================================

const COPY_STAGES = [
  'Keep talking — every detail makes it better.',
  'Looking good — your site is taking shape.',
  'Almost there — a few more details.',
];

function getEncouragingCopy(filled: number, total: number): string {
  if (total === 0) return COPY_STAGES[0];
  const ratio = filled / total;
  if (ratio < 0.33) return COPY_STAGES[0];
  if (ratio < 0.66) return COPY_STAGES[1];
  return COPY_STAGES[2];
}

// ============================================
// SHIMMER ICON (CSS keyframes via inline style)
// ============================================

function ShimmerIcon() {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full bg-sage/10"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="text-3xl text-[#FAFAFA]/80" aria-hidden="true">
        &#10022;
      </span>
    </div>
  );
}

// ============================================
// PROGRESS DOTS
// ============================================

interface ProgressDotsProps {
  discoveredKeys: string[];
  total: number;
}

function ProgressDots({ discoveredKeys, total }: ProgressDotsProps) {
  // Show discovered facts as filled dots with labels, unfilled dots for remaining
  const filledCount = discoveredKeys.length;
  const unfilledCount = Math.max(0, total - filledCount);

  return (
    <div className="flex flex-col items-start gap-2 w-full max-w-xs">
      <AnimatePresence mode="popLayout">
        {discoveredKeys.map((key, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-sage shrink-0" />
            <span className="text-sm text-[#FAFAFA]/70">{getFactLabel(key)}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Unfilled placeholder dots */}
      {unfilledCount > 0 && (
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            {Array.from({ length: Math.min(unfilledCount, 5) }).map((_, i) => (
              <div key={`unfilled-${i}`} className="w-2.5 h-2.5 rounded-full bg-[#3F3F46]" />
            ))}
          </div>
          {unfilledCount > 5 && (
            <span className="text-xs text-[#FAFAFA]/40">+{unfilledCount - 5} more</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ComingSoonDisplayProps {
  /** Override message (e.g., "Putting finishing touches on..." during reveal preload) */
  buildingIndicator?: string;
}

export function ComingSoonDisplay({ buildingIndicator }: ComingSoonDisplayProps) {
  const discoveredFacts = useAgentUIStore((s) => s.comingSoon.discoveredKeys);
  const slotMetrics = useAgentUIStore((s) => s.comingSoon.slotMetrics);

  const encouragingCopy = useMemo(
    () => buildingIndicator ?? getEncouragingCopy(slotMetrics.filled, slotMetrics.total),
    [buildingIndicator, slotMetrics.filled, slotMetrics.total]
  );

  return (
    <div
      className="h-full flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, #27272A 0%, #18181B 70%)',
      }}
      data-testid="coming-soon-display"
    >
      <div className="flex flex-col items-center gap-8 text-center max-w-md px-8">
        <ShimmerIcon />

        <div>
          <h2 className="text-xl font-serif font-medium text-[#FAFAFA] mb-2">
            Your website is being crafted
          </h2>
          <motion.p
            key={encouragingCopy}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-[#FAFAFA]/60 text-sm"
          >
            {encouragingCopy}
          </motion.p>
        </div>

        {/* Progress dots — only show when we have slot metrics */}
        {slotMetrics.total > 0 && (
          <ProgressDots discoveredKeys={discoveredFacts} total={slotMetrics.total} />
        )}
      </div>
    </div>
  );
}

export default ComingSoonDisplay;
