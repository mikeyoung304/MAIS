'use client';

import { useState, useEffect, useCallback } from 'react';
import { BrowserFrame } from './BrowserFrame';
import { ChatAssistant } from './ChatAssistant';
import { StageIndicator } from './StageIndicator';
import { StorefrontStage, CalendarStage, CheckoutStage, ConfirmationStage } from './stages';
import { Stage, STAGES, STAGE_DURATION } from './types';

/**
 * BookingFlowDemo - Animated demonstration of the full booking journey
 *
 * Auto-plays through 4 stages showing the complete customer experience:
 * browsing packages → selecting date/time → paying → Session Space.
 *
 * Designed to feel like a GIF — simple, continuous, no interaction required.
 * Subtle dots at the bottom allow optional manual navigation.
 */
export function BookingFlowDemo() {
  const [activeStage, setActiveStage] = useState<Stage>('storefront');

  // Auto-advance through stages (GIF-like continuous loop)
  useEffect(() => {
    const currentIndex = STAGES.indexOf(activeStage);
    const nextIndex = (currentIndex + 1) % STAGES.length;

    const timer = setTimeout(() => {
      setActiveStage(STAGES[nextIndex]);
    }, STAGE_DURATION[activeStage]);

    return () => clearTimeout(timer);
  }, [activeStage]);

  // Manual stage selection (optional, via dots)
  const handleStageSelect = useCallback((stage: Stage) => {
    setActiveStage(stage);
  }, []);

  return (
    <div className="w-full max-w-[520px] lg:max-w-[620px] xl:max-w-none">
      <BrowserFrame>
        <div className="flex h-full">
          {/* Left panel - Main content (58%) */}
          <div className="w-[58%] border-r border-neutral-800 relative bg-surface">
            <StorefrontStage active={activeStage === 'storefront'} />
            <CalendarStage active={activeStage === 'calendar'} />
            <CheckoutStage active={activeStage === 'checkout'} />
            <ConfirmationStage active={activeStage === 'confirmation'} />
          </div>

          {/* Right panel - Chat Assistant (42%) */}
          <div className="w-[42%]">
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
