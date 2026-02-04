/**
 * useComputedPhase - Reactive onboarding phase computation
 *
 * Computes the current onboarding phase from storefront state.
 * Used for the progress indicator that updates without waiting for API.
 *
 * This is SEPARATE from useOnboardingState which:
 * - Fetches phase from API (authoritative source)
 * - Handles skip functionality
 * - Provides summaries and resume messages
 *
 * This hook provides:
 * - Reactive phase based on local state
 * - Progress completion percentage
 * - Phase descriptions for UI
 *
 * @see docs/plans/2026-02-02-fix-build-mode-onboarding-flow-plan.md Phase 2.3
 */

'use client';

import { useMemo } from 'react';
import type { OnboardingPhase, PagesConfig } from '@macon/contracts';

/**
 * Phase metadata for UI display
 */
interface PhaseMetadata {
  label: string;
  description: string;
  order: number;
}

/**
 * Phase metadata map
 */
const PHASE_METADATA: Record<OnboardingPhase, PhaseMetadata> = {
  NOT_STARTED: { label: 'Welcome', description: 'Getting started', order: 0 },
  DISCOVERY: { label: 'Discovery', description: 'Tell us about your business', order: 1 },
  MARKET_RESEARCH: { label: 'Research', description: 'Understanding your market', order: 2 },
  SERVICES: { label: 'Services', description: 'Setting up your offerings', order: 3 },
  MARKETING: { label: 'Marketing', description: 'Crafting your message', order: 4 },
  COMPLETED: { label: 'Done', description: 'Ready to go live', order: 5 },
  SKIPPED: { label: 'Skipped', description: 'Setup skipped', order: 5 },
};

/**
 * Total number of content phases (excludes NOT_STARTED and terminal states)
 */
const TOTAL_PHASES = 4;

/**
 * Check if a section contains placeholder content
 */
function hasPlaceholders(section: unknown): boolean {
  if (!section || typeof section !== 'object') return false;

  const s = section as Record<string, unknown>;
  const textFields = ['headline', 'subheadline', 'content', 'description'];

  for (const field of textFields) {
    const value = s[field];
    if (typeof value === 'string') {
      // Check for common placeholder patterns
      if (
        value.includes('[Your ') ||
        value.includes('[Tell ') ||
        value.includes('[Add ') ||
        value.includes('[Insert ') ||
        value.includes('[Describe ') ||
        value.includes('[Share ') ||
        value.startsWith('Lorem ipsum') ||
        value === '' ||
        value === 'Coming soon'
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Count placeholders in a pages config
 */
function countPlaceholders(config: PagesConfig | null): number {
  if (!config) return 0;

  let count = 0;
  const pages = Object.values(config);

  for (const page of pages) {
    if (typeof page !== 'object' || !page) continue;
    const pageObj = page as { sections?: unknown[] };
    if (!pageObj.sections || !Array.isArray(pageObj.sections)) continue;

    for (const section of pageObj.sections) {
      if (hasPlaceholders(section)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Compute phase from storefront state
 *
 * This is a pure function - no side effects, easy to test.
 */
export function computePhase(
  apiPhase: OnboardingPhase,
  draftConfig: PagesConfig | null,
  liveConfig: PagesConfig | null
): OnboardingPhase {
  // Terminal states are authoritative from API
  if (apiPhase === 'COMPLETED' || apiPhase === 'SKIPPED') {
    return apiPhase;
  }

  // If we have a draft with fewer placeholders than live, we're making progress
  const draftPlaceholders = countPlaceholders(draftConfig);
  const livePlaceholders = countPlaceholders(liveConfig);

  // If draft has content and fewer placeholders, advance the phase
  if (draftConfig && draftPlaceholders < livePlaceholders) {
    // Upgrade phase based on placeholder reduction
    const reduction = livePlaceholders - draftPlaceholders;
    const phases: OnboardingPhase[] = [
      'NOT_STARTED',
      'DISCOVERY',
      'MARKET_RESEARCH',
      'SERVICES',
      'MARKETING',
    ];
    const currentIndex = phases.indexOf(apiPhase);
    const newIndex = Math.min(currentIndex + Math.ceil(reduction / 2), phases.length - 1);
    return phases[newIndex] || apiPhase;
  }

  return apiPhase;
}

/**
 * Hook interface
 */
interface UseComputedPhaseOptions {
  /** API phase from useOnboardingState */
  apiPhase: OnboardingPhase;
  /** Draft config from useDraftConfig */
  draftConfig?: PagesConfig | null;
  /** Live config from tenant data */
  liveConfig?: PagesConfig | null;
}

/**
 * Hook return type
 */
interface UseComputedPhaseReturn {
  /** Computed phase (may differ from API during local edits) */
  phase: OnboardingPhase;
  /** Phase metadata for UI display */
  metadata: PhaseMetadata;
  /** Progress as percentage (0-100) */
  progressPercent: number;
  /** Whether onboarding is in progress (not completed/skipped) */
  isOnboarding: boolean;
  /** Whether we've advanced past the API phase (local progress) */
  hasLocalProgress: boolean;
}

/**
 * useComputedPhase - Reactive onboarding phase computation
 *
 * @example
 * ```tsx
 * const { phase, progressPercent, isOnboarding } = useComputedPhase({
 *   apiPhase: currentPhase,
 *   draftConfig,
 *   liveConfig,
 * });
 * ```
 */
export function useComputedPhase({
  apiPhase,
  draftConfig = null,
  liveConfig = null,
}: UseComputedPhaseOptions): UseComputedPhaseReturn {
  const computed = useMemo(() => {
    const phase = computePhase(apiPhase, draftConfig, liveConfig);
    const metadata = PHASE_METADATA[phase];
    const isOnboarding = phase !== 'COMPLETED' && phase !== 'SKIPPED';
    const hasLocalProgress = phase !== apiPhase;

    // Calculate progress percentage
    // Phases: NOT_STARTED(0), DISCOVERY(1), MARKET_RESEARCH(2), SERVICES(3), MARKETING(4), COMPLETED(5)
    const progressPercent = Math.round((metadata.order / TOTAL_PHASES) * 100);

    return {
      phase,
      metadata,
      progressPercent: Math.min(progressPercent, 100),
      isOnboarding,
      hasLocalProgress,
    };
  }, [apiPhase, draftConfig, liveConfig]);

  return computed;
}

export default useComputedPhase;
