'use client';

/**
 * OnboardingStepper — Shared step indicator for onboarding pages
 *
 * Renders step dots with labels and connector lines.
 * Steps before the active step are shown as completed (sage),
 * the active step has a ring highlight, and later steps are muted.
 *
 * Two variants:
 * - "compact" (default): smaller dots, text-[10px], used in intake + build headers
 * - "centered": larger dots, text-xs, used on the payment page
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepConfig {
  label: string;
}

interface OnboardingStepperProps {
  /** Array of step labels in order */
  steps: StepConfig[];
  /** Zero-based index of the currently active step */
  activeStep: number;
  /** Visual variant */
  variant?: 'compact' | 'centered';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingStepper({
  steps,
  activeStep,
  variant = 'compact',
}: OnboardingStepperProps) {
  const isCompact = variant === 'compact';

  const dotSize = isCompact ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const textSize = isCompact ? 'text-[10px]' : 'text-xs';
  const connectorWidth = isCompact ? 'w-4' : 'w-8';
  const containerClass = isCompact
    ? 'flex items-center gap-2'
    : 'flex items-center justify-center gap-2';

  return (
    <div className={containerClass}>
      {steps.map((step, index) => {
        const isCompleted = index < activeStep;
        const isActive = index === activeStep;
        const isPending = index > activeStep;

        // Dot styles
        const dotClasses = [
          dotSize,
          'rounded-full',
          isCompleted || isActive ? 'bg-sage' : 'bg-neutral-600',
          isActive ? 'ring-2 ring-sage/30' : '',
        ]
          .filter(Boolean)
          .join(' ');

        // Label styles
        const labelClasses = [
          textSize,
          isActive ? 'text-text-primary font-medium' : '',
          isCompleted ? (isCompact ? 'text-text-muted' : 'text-sage font-medium') : '',
          isPending ? 'text-text-muted' : '',
        ]
          .filter(Boolean)
          .join(' ');

        // Connector before this step (not before the first)
        const connectorColor = index <= activeStep ? 'bg-neutral-600' : 'bg-neutral-700';

        return (
          <div key={step.label} className="contents">
            {index > 0 && <div className={`${connectorWidth} h-px ${connectorColor}`} />}
            <div className="flex items-center gap-1.5">
              <div className={dotClasses} />
              <span className={labelClasses}>{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
