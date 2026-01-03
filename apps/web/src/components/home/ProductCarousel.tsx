'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DemoStorefrontShowcase } from './DemoStorefrontShowcase';
import { BookingMockup, ClientHubMockup } from './mockups';

// ─────────────────────────────────────────────────────────────
// Slide data
// ─────────────────────────────────────────────────────────────
const slides = [
  {
    id: 'storefront',
    label: 'Your storefront',
    sublabel: 'Clients see your services',
  },
  {
    id: 'booking',
    label: 'They book you',
    sublabel: 'Pick date, pay—done',
  },
  {
    id: 'hub',
    label: 'Stay connected',
    sublabel: 'Everything in one place',
  },
];

// ─────────────────────────────────────────────────────────────
// ProductCarousel Component
// ─────────────────────────────────────────────────────────────
export function ProductCarousel() {
  const [current, setCurrent] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  // WCAG 2.2.2: Pause on hover/focus for auto-playing content
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // P2 Fix: Memoize goTo with early return for same-index
  const goTo = useCallback((index: number) => {
    const newIndex = Math.max(0, Math.min(slides.length - 1, index));
    setCurrent((prev) => {
      if (prev === newIndex) return prev; // No-op if same
      return newIndex;
    });
    setTranslateX(0);
  }, []);

  const prev = () => goTo(current - 1);
  const next = () => goTo(current + 1);

  // P1 Fix: Keyboard navigation scoped to carousel container
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(current - 1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(current + 1);
      }
    },
    [current, goTo]
  );

  // Auto-advance carousel every 5 seconds (pauses on hover/focus)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]); // slides.length is a constant, not needed in deps

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - startX;
    setTranslateX(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 50;
    if (translateX > threshold && current > 0) {
      goTo(current - 1);
    } else if (translateX < -threshold && current < slides.length - 1) {
      goTo(current + 1);
    } else {
      setTranslateX(0);
    }
  };

  // Mouse handlers for desktop drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    setTranslateX(diff);
  };

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 50;
    if (translateX > threshold && current > 0) {
      goTo(current - 1);
    } else if (translateX < -threshold && current < slides.length - 1) {
      goTo(current + 1);
    } else {
      setTranslateX(0);
    }
  }, [isDragging, translateX, current, goTo]);

  // P1 Fix: Global mouseup handler for drag cleanup outside component
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setTranslateX(0);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  return (
    <div
      ref={carouselRef}
      className="relative outline-none"
      role="region"
      aria-roledescription="carousel"
      aria-label="Product feature showcase"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        // Only unpause if focus leaves the carousel entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsPaused(false);
        }
      }}
    >
      {/* Labels for current slide - announced to screen readers */}
      <div
        className="text-center mb-6"
        role="group"
        aria-roledescription="slide"
        aria-label={`${current + 1} of ${slides.length}: ${slides[current].label}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="text-lg font-serif font-semibold text-text-primary">
          {slides[current].label}
        </p>
        <p className="text-sm text-text-muted">{slides[current].sublabel}</p>
      </div>

      {/* Carousel container */}
      <div className="relative overflow-hidden">
        {/* Navigation arrows - desktop */}
        <button
          onClick={prev}
          disabled={current === 0}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface-alt border border-neutral-800 items-center justify-center transition-all duration-300 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5 text-text-muted" aria-hidden="true" />
        </button>

        <button
          onClick={next}
          disabled={current === slides.length - 1}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface-alt border border-neutral-800 items-center justify-center transition-all duration-300 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5 text-text-muted" aria-hidden="true" />
        </button>

        {/* Slides wrapper */}
        <div
          ref={containerRef}
          className="px-4 md:px-14 cursor-grab active:cursor-grabbing select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(calc(-${current * 100}% + ${translateX}px))`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            }}
          >
            {slides.map((slide, index) => (
              <div key={slide.id} className="w-full flex-shrink-0 px-2">
                {/* Browser frame */}
                <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden max-w-lg mx-auto shadow-xl">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-neutral-700" />
                      <div className="w-3 h-3 rounded-full bg-neutral-700" />
                      <div className="w-3 h-3 rounded-full bg-neutral-700" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center">
                        yourname.gethandled.ai
                      </div>
                    </div>
                  </div>

                  {/* Mockup content */}
                  <div className="h-[400px] md:h-[480px]">
                    {index === 0 && <DemoStorefrontShowcase compact />}
                    {index === 1 && <BookingMockup />}
                    {index === 2 && <ClientHubMockup />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dot indicators - P1 Fix: Proper tabindex management for ARIA tabs */}
      <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="Slide navigation">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goTo(index)}
            role="tab"
            aria-selected={index === current}
            tabIndex={index === current ? 0 : -1}
            className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt ${
              index === current ? 'bg-sage w-6' : 'bg-neutral-700 hover:bg-neutral-600 w-2'
            }`}
            aria-label={`Go to slide ${index + 1}: ${slide.label}`}
          />
        ))}
      </div>

      {/* Swipe hint - mobile only, hidden from screen readers */}
      <p className="md:hidden text-center text-xs text-text-muted mt-4" aria-hidden="true">
        Swipe to explore →
      </p>
    </div>
  );
}
