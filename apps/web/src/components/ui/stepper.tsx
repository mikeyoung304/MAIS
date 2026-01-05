'use client';

import { memo } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  label: string;
  status: 'complete' | 'current' | 'upcoming';
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

/**
 * Stepper Component
 *
 * Visual progress indicator for multi-step processes like checkout flows.
 * Shows numbered circles with connecting lines and checkmarks for completed steps.
 *
 * Features:
 * - Numbered step indicators
 * - Visual connection lines between steps
 * - Checkmarks for completed steps
 * - Highlight current step
 * - Accessible with proper ARIA labels
 * - Memoized to prevent unnecessary re-renders when parent state changes
 *
 * @example
 * ```tsx
 * const steps = [
 *   { label: "Select Package", status: "complete" },
 *   { label: "Choose Date", status: "current" },
 *   { label: "Payment", status: "upcoming" }
 * ];
 *
 * <Stepper steps={steps} currentStep={1} />
 * ```
 */
export const Stepper = memo(function Stepper({ steps, currentStep, className = '' }: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn('mb-8', className)}>
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isComplete = step.status === 'complete';
          const isCurrent = step.status === 'current';
          const isUpcoming = step.status === 'upcoming';
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.label}
              className="flex-1 flex items-center"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex items-center w-full">
                {/* Step Circle */}
                <div className="relative flex items-center justify-center">
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                      isComplete && 'bg-green-600 border-green-600',
                      isCurrent && 'bg-sage border-sage',
                      isUpcoming && 'bg-neutral-100 border-neutral-300'
                    )}
                  >
                    {isComplete ? (
                      <Check className="w-5 h-5 text-white" aria-hidden="true" />
                    ) : (
                      <span
                        className={cn(
                          'text-base font-semibold',
                          isCurrent ? 'text-white' : 'text-neutral-500'
                        )}
                      >
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Step Label */}
                  <span
                    className={cn(
                      'absolute top-12 left-1/2 -translate-x-1/2 text-sm font-medium whitespace-nowrap',
                      isComplete && 'text-green-700',
                      isCurrent && 'text-sage',
                      isUpcoming && 'text-neutral-500'
                    )}
                  >
                    {step.label}
                  </span>

                  {/* Screen reader status */}
                  <span className="sr-only">
                    {isComplete && 'Completed: '}
                    {isCurrent && 'Current step: '}
                    {isUpcoming && 'Upcoming: '}
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 transition-colors',
                      isComplete ? 'bg-green-600' : 'bg-neutral-300'
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Step counter for screen readers */}
      <div className="sr-only" role="status" aria-live="polite">
        Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.label}
      </div>
    </nav>
  );
});
