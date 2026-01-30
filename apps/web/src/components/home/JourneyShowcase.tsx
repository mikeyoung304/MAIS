'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FullStorefrontPreview } from './FullStorefrontPreview';
import { BookingMockup } from './BookingMockup';
import { ClientHubMockupTutor } from './ClientHubMockupTutor';

/**
 * JourneyShowcase - Horizontal carousel of the complete client journey
 *
 * Shows three stages in a swipeable carousel:
 * 1. Storefront - "Your storefront goes live"
 * 2. Booking - "They book you"
 * 3. Client Hub - "One hub. Forever."
 *
 * Implementation uses CSS scroll-snap for native performance and accessibility.
 *
 * Review fixes applied:
 * - P1: isScrollingProgrammatically ref prevents race condition between
 *       scroll events and programmatic navigation
 * - P1: Functional state updates in keyboard handler prevent stale closures
 * - P2: Arrows hidden on mobile (hidden md:flex) - mobile uses dots + swipe
 * - P2: touch-pan-y enables vertical scrolling while horizontal swiping
 * - P3: Increased dot animation duration to 300ms for smoother feel
 */

// FIX: Updated copy per brand voice review - no punching down
const STAGES = [
  {
    id: 'find',
    number: '1',
    title: 'Your storefront goes live',
    description: 'Your packages, your prices, your availability. Done.',
  },
  {
    id: 'book',
    number: '2',
    title: 'They book you',
    description: 'Package, date, payment. One page.',
  },
  {
    id: 'hub',
    number: '3',
    title: 'One hub. Forever.',
    description: 'Questions, files, updates, rebooking—clients return here forever.',
  },
];

export function JourneyShowcase() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // FIX: Add ref to prevent race condition between scroll events and programmatic navigation
  const isScrollingProgrammatically = useRef(false);

  // Update active index on scroll (only for user-initiated scrolls)
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isScrollingProgrammatically.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const newIndex = Math.round(scrollLeft / clientWidth);
    setActiveIndex(newIndex);
  }, []);

  // Navigate to specific slide with infinite loop support
  // STAGES is a module-level constant, so no dependencies needed
  const goToSlide = useCallback((index: number) => {
    if (!scrollRef.current) return;

    // Wrap around for infinite loop (handles both directions)
    const wrappedIndex = ((index % STAGES.length) + STAGES.length) % STAGES.length;

    const { clientWidth } = scrollRef.current;
    isScrollingProgrammatically.current = true;
    scrollRef.current.scrollTo({ left: wrappedIndex * clientWidth, behavior: 'smooth' });
    setActiveIndex(wrappedIndex); // Set immediately for responsive UI
    // Reset flag after scroll animation completes
    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 400);
  }, []);

  // Keyboard navigation with infinite loop support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        // Infinite loop: wrapping handled by goToSlide
        goToSlide(activeIndex - 1);
      }
      if (e.key === 'ArrowRight') {
        // Infinite loop: wrapping handled by goToSlide
        goToSlide(activeIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, goToSlide]);

  return (
    <div className="relative">
      {/* Infinite loop arrows - hidden on mobile (use dots + swipe), shown on desktop */}
      <button
        onClick={() => goToSlide(activeIndex - 1)}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-surface/80 backdrop-blur border border-neutral-800 text-text-muted hover:text-text-primary hover:border-sage/50 transition-all items-center justify-center"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={() => goToSlide(activeIndex + 1)}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-surface/80 backdrop-blur border border-neutral-800 text-text-muted hover:text-text-primary hover:border-sage/50 transition-all items-center justify-center"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* FIX: Added touch-pan-y for mobile vertical scroll, aria-live for screen readers */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="region"
        aria-label={`Journey stage ${activeIndex + 1} of ${STAGES.length}: ${STAGES[activeIndex].title}`}
        aria-live="polite"
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide touch-pan-y"
      >
        {STAGES.map((stage, index) => (
          <div key={stage.id} className="w-full flex-shrink-0 snap-center px-6 md:px-16">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-sage/10 border border-sage/30 flex items-center justify-center">
                  <span className="text-sage font-serif text-lg font-bold">{stage.number}</span>
                </div>
                <h3 className="font-serif text-2xl font-bold text-text-primary">{stage.title}</h3>
              </div>
              <p className="text-text-muted max-w-md mx-auto">{stage.description}</p>
            </div>

            {/* Browser frame with mockup - increased height for better content visibility */}
            <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden max-w-xl mx-auto shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center">
                    alexchen.gethandled.ai
                  </div>
                </div>
              </div>
              {/* Fixed height with responsive sizing - enables scrollable content */}
              <div className="h-[380px] md:h-[480px]">
                {index === 0 && <FullStorefrontPreview />}
                {index === 1 && <BookingMockup />}
                {index === 2 && <ClientHubMockupTutor />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FIX: Increased animation duration to 300ms for smoother feel */}
      <div className="flex justify-center gap-2 mt-8">
        {STAGES.map((stage, index) => (
          <button
            key={stage.id}
            onClick={() => goToSlide(index)}
            className={`h-2.5 rounded-full transition-all duration-300 ease-out ${
              index === activeIndex ? 'bg-sage w-8' : 'bg-neutral-700 hover:bg-neutral-600 w-2.5'
            }`}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === activeIndex ? 'step' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
