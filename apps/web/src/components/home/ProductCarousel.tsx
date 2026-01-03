'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DemoStorefrontShowcase } from './DemoStorefrontShowcase';

// ─────────────────────────────────────────────────────────────
// Booking Mockup (extracted from JourneyShowcase)
// ─────────────────────────────────────────────────────────────
function BookingMockup() {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dates = [
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
  ];

  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.12)_0%,transparent_70%)] px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
              <span className="text-sage font-semibold text-[10px]">SW</span>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">Booking with</p>
              <p className="text-xs font-medium text-text-primary">Sarah Williams</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-sage font-medium">Full Day Coverage</p>
            <p className="text-xs font-bold text-text-primary">$3,200</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-center gap-1">
          {[
            { num: '✓', label: 'Package', done: true, active: false },
            { num: '2', label: 'Date', done: false, active: true },
            { num: '3', label: 'Details', done: false, active: false },
            { num: '4', label: 'Pay', done: false, active: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={`w-6 h-px ${step.active || step.done ? 'bg-sage' : 'bg-neutral-700'}`}
                />
              )}
              <div className="flex items-center gap-1">
                <div
                  className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-medium ${
                    step.done
                      ? 'bg-sage text-white'
                      : step.active
                        ? 'bg-sage text-white'
                        : 'bg-neutral-800 border border-neutral-700 text-neutral-500'
                  }`}
                >
                  {step.done ? '✓' : step.num}
                </div>
                <span
                  className={`text-[9px] ${step.active ? 'text-text-primary font-medium' : step.done ? 'text-sage font-medium' : 'text-text-muted'}`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-3 bg-surface-alt">
        <div className="bg-surface rounded-xl p-3 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <button className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center">
              <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
            </button>
            <span className="text-sm font-serif font-semibold text-text-primary">March 2025</span>
            <button className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {days.map((day, i) => (
              <div key={i} className="text-[9px] text-text-muted text-center font-medium py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {dates.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((date, di) => (
                  <div
                    key={di}
                    className={`w-6 h-6 rounded-lg text-[10px] flex items-center justify-center ${
                      date === null
                        ? ''
                        : date === 15
                          ? 'bg-sage text-white font-semibold shadow-md shadow-sage/30'
                          : date < 10
                            ? 'text-neutral-600'
                            : 'bg-neutral-800 text-text-primary border border-neutral-700'
                    }`}
                  >
                    {date}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-[10px] text-text-muted mb-2 text-center">Available on March 15</p>
          <div className="flex gap-2 justify-center">
            <div className="px-3 py-1.5 bg-sage/15 border border-sage rounded-lg text-[10px] text-sage font-medium">
              All Day
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-surface border-t border-neutral-800">
        <button className="w-full py-2 bg-sage text-white text-[11px] font-semibold rounded-full flex items-center justify-center gap-1.5">
          Continue to Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        {/* Stripe trust badge */}
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[9px] text-text-muted">
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Secure payments via</span>
          <span className="font-semibold text-text-primary">Stripe</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Client Hub Mockup (post-booking experience)
// ─────────────────────────────────────────────────────────────
function ClientHubMockup() {
  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.15)_0%,transparent_70%)] px-4 py-2.5 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
              <span className="text-sage font-semibold text-xs">SW</span>
            </div>
            <div>
              <h3 className="font-serif text-xs font-semibold text-text-primary">
                Your Wedding Photos
              </h3>
              <p className="text-[9px] text-text-muted">Sarah Williams Photography</p>
            </div>
          </div>
          <div className="px-2 py-1 bg-sage/15 border border-sage/30 rounded-full">
            <span className="text-[9px] text-sage font-semibold flex items-center gap-1">
              ✓ Confirmed
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 px-3 py-2.5 bg-surface-alt overflow-auto border-r border-neutral-800">
          <div className="mb-3">
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              📅 What&apos;s Coming Up
            </h4>
            <div className="bg-surface rounded-xl p-2.5 border border-neutral-800">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-text-primary">Wedding Day</p>
                <span className="text-[9px] text-sage font-medium">In 2 weeks</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span>📅 Mar 15</span>
                <span>🕐 9:00 AM</span>
                <span>📦 Full Day</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              📋 Things to Do
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-amber-500/30">
                <div className="w-6 h-6 bg-amber-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-500 text-[10px]">📋</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate">
                    Shot list preferences
                  </p>
                  <p className="text-[8px] text-amber-500">3 min • Share your vision</p>
                </div>
                <ChevronRight className="w-3 h-3 text-amber-500" />
              </div>

              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-neutral-800 opacity-60">
                <div className="w-6 h-6 bg-emerald-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-500 text-[10px]">✓</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate line-through">
                    Deposit paid
                  </p>
                  <p className="text-[8px] text-text-muted">$1,600 • Mar 1</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-[45%] flex flex-col bg-surface">
          <div className="px-3 py-2 border-b border-neutral-800 bg-sage/5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
                  <span className="text-sage text-[10px]">💬</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-primary">Your Assistant</p>
                <p className="text-[8px] text-emerald-500 font-medium">Online</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-2.5 py-2 overflow-auto space-y-2">
            <div className="flex gap-1.5">
              <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sage text-[8px] font-semibold">AI</span>
              </div>
              <div className="bg-sage/10 rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[90%]">
                <p className="text-[9px] text-text-primary leading-relaxed">
                  Hi! I&apos;m here to help with your session. Need to reschedule? Just ask.
                </p>
              </div>
            </div>
          </div>

          <div className="px-2.5 py-2 border-t border-neutral-800">
            <div className="flex items-center gap-1.5 bg-neutral-800 rounded-full px-3 py-1.5 border border-neutral-700">
              <input
                type="text"
                placeholder="Ask anything..."
                className="flex-1 bg-transparent text-[10px] text-text-primary placeholder-text-muted focus:outline-none"
                readOnly
              />
              <button className="w-5 h-5 bg-sage rounded-full flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const goTo = useCallback((index: number) => {
    setCurrent(Math.max(0, Math.min(slides.length - 1, index)));
    setTranslateX(0);
  }, []);

  const prev = () => goTo(current - 1);
  const next = () => goTo(current + 1);

  // Auto-advance carousel every 5 seconds (pauses on hover/focus)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

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

  const handleMouseUp = () => {
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [current, goTo]);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Product feature showcase"
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
          <ChevronLeft className="w-5 h-5 text-text-muted" />
        </button>

        <button
          onClick={next}
          disabled={current === slides.length - 1}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface-alt border border-neutral-800 items-center justify-center transition-all duration-300 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5 text-text-muted" />
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

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="Slide navigation">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => goTo(index)}
            role="tab"
            aria-selected={index === current}
            className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt ${
              index === current ? 'bg-sage w-6' : 'bg-neutral-700 hover:bg-neutral-600 w-2'
            }`}
            aria-label={`Go to slide ${index + 1}: ${slide.label}`}
          />
        ))}
      </div>

      {/* Swipe hint - mobile only */}
      <p className="md:hidden text-center text-xs text-text-muted mt-4">Swipe to explore →</p>
    </div>
  );
}
