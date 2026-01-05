'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Stage, STAGES, STAGE_LABELS } from './types';

interface StageIndicatorProps {
  activeStage: Stage;
  onSelect?: (stage: Stage) => void;
}

/**
 * StageIndicator - Subtle progress dots with navigation arrows
 *
 * Simple visual showing current position. Dots and arrows allow manual navigation.
 * Arrows are small and unobtrusive, respecting the GIF-like auto-play experience.
 */
export function StageIndicator({ activeStage, onSelect }: StageIndicatorProps) {
  const currentIndex = STAGES.indexOf(activeStage);

  const goToPrevious = () => {
    const prevIndex = (currentIndex - 1 + STAGES.length) % STAGES.length;
    onSelect?.(STAGES[prevIndex]);
  };

  const goToNext = () => {
    const nextIndex = (currentIndex + 1) % STAGES.length;
    onSelect?.(STAGES[nextIndex]);
  };

  return (
    <div className="flex items-center justify-center gap-3 mt-3">
      {/* Left arrow */}
      <button
        onClick={goToPrevious}
        className="p-1 cursor-pointer group"
        aria-label="Previous stage"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-400 transition-colors duration-200" />
      </button>

      {/* Dots */}
      <div className="flex items-center gap-2">
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

      {/* Right arrow */}
      <button onClick={goToNext} className="p-1 cursor-pointer group" aria-label="Next stage">
        <ChevronRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-400 transition-colors duration-200" />
      </button>
    </div>
  );
}
