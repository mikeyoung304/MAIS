import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  label: string;
  description?: string;
}

export interface ProgressStepsProps {
  steps: Step[];
  currentStep: number; // 0-indexed
  className?: string;
}

export function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;

          return (
            <div key={index} className="flex-1 flex items-center">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'relative flex items-center justify-center rounded-full transition-all duration-300',
                    isCompleted && 'w-10 h-10 bg-success-500 text-white',
                    isCurrent && 'w-12 h-12 bg-macon-orange text-white animate-pulse',
                    isFuture && 'w-10 h-10 bg-neutral-200 text-neutral-400'
                  )}
                >
                  {isCompleted && <Check className="h-5 w-5 animate-in zoom-in-50 duration-200" />}
                  {isCurrent && <span className="text-lg font-bold">{index + 1}</span>}
                  {isFuture && <span className="text-base font-medium">{index + 1}</span>}

                  {/* Pulse ring for current step */}
                  {isCurrent && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-macon-orange opacity-75 animate-ping"></span>
                  )}
                </div>

                {/* Step label */}
                <div className="mt-3 text-center">
                  <p
                    className={cn(
                      'text-sm font-semibold transition-colors',
                      isCompleted && 'text-success-600',
                      isCurrent && 'text-macon-orange',
                      isFuture && 'text-neutral-400'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p
                      className={cn(
                        'text-xs mt-1 transition-colors',
                        isCompleted && 'text-success-500',
                        isCurrent && 'text-neutral-600',
                        isFuture && 'text-neutral-300'
                      )}
                    >
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connecting line (not for last step) */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-4 relative">
                  {/* Background line */}
                  <div className="absolute inset-0 bg-neutral-200 rounded-full" />

                  {/* Progress line with gradient */}
                  <div
                    className={cn(
                      'absolute inset-0 rounded-full transition-all duration-500',
                      isCompleted && 'bg-gradient-to-r from-success-500 to-success-400 w-full',
                      isCurrent && 'bg-gradient-to-r from-macon-orange to-transparent w-1/2',
                      isFuture && 'w-0'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compact version for mobile
export function ProgressStepsCompact({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Progress bar */}
      <div className="relative h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-macon-orange to-macon-teal transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Current step indicator */}
      <div className="mt-4 flex justify-between items-center">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{steps[currentStep]?.label}</p>
          {steps[currentStep]?.description && (
            <p className="text-xs text-neutral-500 mt-1">{steps[currentStep].description}</p>
          )}
        </div>
        <div className="text-xs font-medium text-neutral-500">
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>
    </div>
  );
}
