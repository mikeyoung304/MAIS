'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserFrame } from './BrowserFrame';
import { ChatAssistant } from './ChatAssistant';
import { StageIndicator } from './StageIndicator';
import { StorefrontStage, CalendarStage, CheckoutStage, ConfirmationStage } from './stages';
import { Stage, STAGES, STAGE_DURATION } from './types';

// Minimum swipe distance to trigger stage change (prevents accidental triggers)
const SWIPE_THRESHOLD = 50;

/**
 * BookingFlowDemo - Animated demonstration of the full booking journey
 *
 * Auto-plays through 4 stages showing the complete customer experience:
 * browsing packages → selecting date/time → paying → Session Space.
 *
 * Designed to feel like a GIF — simple, continuous, no interaction required.
 * Subtle dots at the bottom allow optional manual navigation.
 * Supports touch swipe gestures on mobile for manual stage navigation.
 */
export function BookingFlowDemo() {
  const [activeStage, setActiveStage] = useState<Stage>('storefront');
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Auto-advance through stages (GIF-like continuous loop)
  useEffect(() => {
    const currentIndex = STAGES.indexOf(activeStage);
    const nextIndex = (currentIndex + 1) % STAGES.length;

    const timer = setTimeout(() => {
      setActiveStage(STAGES[nextIndex]);
    }, STAGE_DURATION[activeStage]);

    return () => clearTimeout(timer);
  }, [activeStage]);

  // Manual stage selection (optional, via dots or swipe)
  const handleStageSelect = useCallback((stage: Stage) => {
    setActiveStage(stage);
  }, []);

  // Navigate to next/previous stage
  const navigateStage = useCallback(
    (direction: 'next' | 'prev') => {
      const currentIndex = STAGES.indexOf(activeStage);
      if (direction === 'next') {
        const nextIndex = (currentIndex + 1) % STAGES.length;
        setActiveStage(STAGES[nextIndex]);
      } else {
        const prevIndex = (currentIndex - 1 + STAGES.length) % STAGES.length;
        setActiveStage(STAGES[prevIndex]);
      }
    },
    [activeStage]
  );

  // Touch handlers for swipe gesture support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;

      // Only process horizontal swipes (ignore vertical scrolling)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
        if (deltaX < 0) {
          // Swipe left → next stage
          navigateStage('next');
        } else {
          // Swipe right → previous stage
          navigateStage('prev');
        }
      }

      // Reset touch tracking
      touchStartX.current = null;
      touchStartY.current = null;
    },
    [navigateStage]
  );

  return (
    <div className="w-full max-w-[520px] lg:max-w-[620px] xl:max-w-none">
      <BrowserFrame>
        <div className="flex h-full" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* Main content - full width on mobile, 58% on larger screens */}
          <div className="w-full sm:w-[58%] sm:border-r border-neutral-800 relative bg-surface touch-pan-y">
            <StorefrontStage active={activeStage === 'storefront'} />
            <CalendarStage active={activeStage === 'calendar'} />
            <CheckoutStage active={activeStage === 'checkout'} />
            <ConfirmationStage active={activeStage === 'confirmation'} />
          </div>

          {/* Chat Assistant - hidden on mobile, 42% on larger screens */}
          <div className="hidden sm:block w-[42%]">
            <ChatAssistant stage={activeStage} />
          </div>
        </div>
      </BrowserFrame>

      {/* Subtle progress dots */}
      <StageIndicator activeStage={activeStage} onSelect={handleStageSelect} />
    </div>
  );
}

export default BookingFlowDemo;
