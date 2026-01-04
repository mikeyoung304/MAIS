'use client';

import { cn } from '@/lib/utils';
import { Stage, STAGES, STAGE_LABELS } from './types';

interface StageIndicatorProps {
  activeStage: Stage;
  onSelect?: (stage: Stage) => void;
}

/**
 * StageIndicator - Subtle progress dots (like a GIF progress bar)
 *
 * Simple visual showing current position. Clickable for optional navigation.
 */
export function StageIndicator({ activeStage, onSelect }: StageIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mt-3">
      {STAGES.map((stage) => {
        const isActive = activeStage === stage;

        return (
          <button
            key={stage}
            onClick={() => onSelect?.(stage)}
            className="p-1 cursor-pointer"
            aria-label={`Go to ${STAGE_LABELS[stage]} stage`}
            aria-current={isActive ? 'step' : undefined}
          >
            <div
              className={cn(
                'rounded-full transition-all duration-300',
                isActive ? 'w-2 h-2 bg-sage' : 'w-1.5 h-1.5 bg-neutral-600 hover:bg-neutral-500'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
