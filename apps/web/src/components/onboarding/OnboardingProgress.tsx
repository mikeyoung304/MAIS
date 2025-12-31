'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { OnboardingPhase } from '@macon/contracts';

/**
 * Onboarding phases in order
 */
const PHASES = ['DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING'] as const;

/**
 * Human-readable phase labels
 */
const PHASE_LABELS: Record<string, string> = {
  NOT_STARTED: 'Getting Started',
  DISCOVERY: 'Discovery',
  MARKET_RESEARCH: 'Market Research',
  SERVICES: 'Services',
  MARKETING: 'Marketing',
  COMPLETED: 'Complete',
  SKIPPED: 'Skipped',
};

interface OnboardingProgressProps {
  /** Current onboarding phase */
  currentPhase: OnboardingPhase;
  /** Callback when user clicks "Skip setup" */
  onSkip: () => Promise<void>;
  /** Whether skip is in progress */
  isSkipping?: boolean;
  /** Error message if skip failed */
  skipError?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * OnboardingProgress - Phase completion indicator for tenant onboarding
 *
 * Shows progress dots for each onboarding phase with:
 * - Visual indicator of current/completed phases
 * - Current phase label
 * - Skip setup button with loading state
 * - ARIA labels for accessibility
 *
 * @example
 * ```tsx
 * <OnboardingProgress
 *   currentPhase="DISCOVERY"
 *   onSkip={async () => { await skipOnboarding() }}
 *   isSkipping={false}
 * />
 * ```
 */
export function OnboardingProgress({
  currentPhase,
  onSkip,
  isSkipping = false,
  skipError = null,
  className,
}: OnboardingProgressProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  // Find current phase index (handle unknown phases gracefully)
  const currentPhaseIndex = PHASES.indexOf(currentPhase as (typeof PHASES)[number]);
  const validPhaseIndex = currentPhaseIndex >= 0 ? currentPhaseIndex : 0;

  // Get phase label (fallback to phase name if unknown)
  const phaseName = PHASE_LABELS[currentPhase] || currentPhase;

  // Handle skip with error catching
  const handleSkip = async () => {
    setLocalError(null);
    try {
      await onSkip();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to skip. Please try again.';
      setLocalError(message);
    }
  };

  const displayError = skipError || localError;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 bg-sage/10 rounded-lg border border-sage/20',
        className
      )}
      data-testid="onboarding-progress"
      role="region"
      aria-label="Onboarding progress"
    >
      <div className="flex items-center gap-3">
        {/* Phase dots */}
        <div className="flex gap-1.5" role="group" aria-label="Onboarding phases">
          {PHASES.map((phase, i) => (
            <div
              key={phase}
              className={cn(
                'w-2 h-2 rounded-full transition-colors duration-300',
                i < validPhaseIndex
                  ? 'bg-sage' // Completed
                  : i === validPhaseIndex
                    ? 'bg-sage animate-pulse' // Current
                    : 'bg-neutral-600' // Upcoming
              )}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Phase label */}
        <span
          className="text-sm text-text-secondary font-medium"
          aria-live="polite"
          aria-atomic="true"
        >
          {phaseName} ({validPhaseIndex + 1}/{PHASES.length})
        </span>

        {/* Skip button */}
        <Button
          onClick={handleSkip}
          variant="ghost"
          size="sm"
          className="ml-auto text-xs text-text-muted hover:text-text-secondary px-2 py-1 h-auto"
          disabled={isSkipping}
          isLoading={isSkipping}
          loadingText="Skipping..."
          aria-label="Skip onboarding setup"
          data-testid="skip-onboarding-button"
        >
          Skip setup
        </Button>
      </div>

      {/* Error message */}
      {displayError && (
        <p className="text-xs text-red-400 mt-1" role="alert" aria-live="assertive">
          {displayError}
        </p>
      )}
    </div>
  );
}

export default OnboardingProgress;
