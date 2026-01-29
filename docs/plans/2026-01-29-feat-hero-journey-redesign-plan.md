---
title: 'feat: Simplified Hero & Journey Carousel Redesign'
type: feat
date: 2026-01-29
brainstorm: docs/brainstorms/2026-01-29-hero-journey-redesign-brainstorm.md
reviewed: 2026-01-29 (design, typescript, copy, simplicity)
---

# ✨ Simplified Hero & Journey Carousel Redesign

## Overview

Replace the 4-vertical selector hero with a simplified full-width centered design, and convert the vertical journey scroll into a horizontal carousel with swipe/arrow navigation.

**Why:** The current vertical selector adds decision fatigue where visitors should feel clarity. A single compelling mockup communicates value faster. The journey carousel increases engagement over vertical scroll.

## Key Decisions (from Brainstorm)

| Decision                | Choice              | Rationale                                        |
| ----------------------- | ------------------- | ------------------------------------------------ |
| Hero layout             | Full-width centered | Maximum visual impact, cleaner than split-screen |
| Vertical selector       | Remove entirely     | Adds confusion, not value                        |
| Hero persona            | Keep Alex Chen      | Specific feels real, tutoring is relatable       |
| Journey format          | Horizontal carousel | More engaging than vertical scroll               |
| Carousel implementation | CSS scroll-snap     | Lightweight, native, no dependencies             |

---

## Review Fixes Applied

Issues identified by multi-agent review (design, typescript, copy, simplicity):

| Issue                                | Severity | Fix Applied                                |
| ------------------------------------ | -------- | ------------------------------------------ |
| Stale closure in keyboard navigation | P1       | Use functional state updates, stable deps  |
| Scroll/state race condition          | P1       | Add `isScrollingProgrammatically` ref gate |
| "rely on memory" punches down        | P1       | Changed to "Nothing slips"                 |
| "actually" is filler word            | P2       | Removed from Alex Chen subheadline         |
| Arrows obscure content on mobile     | P2       | Hide arrows on mobile (`hidden md:flex`)   |
| Missing `touch-pan-y` for mobile UX  | P2       | Added to scroll container                  |
| Scrollbar hide needs WebKit support  | P2       | Added global CSS utility                   |
| Dot animation abrupt                 | P3       | Increased duration to 300ms                |
| ClientHubMockup persona mismatch     | P2       | Create Alex Chen themed version            |

---

## Phase 1: Simplified Hero Component

### Task 1.1: Create New Hero.tsx

**File:** `apps/web/src/components/home/Hero.tsx` (new)

```tsx
// apps/web/src/components/home/Hero.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StorefrontPreview } from './StorefrontPreview';

export function Hero() {
  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-6 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sage/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-sage/3 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Headline - outcome-first, under 15 words */}
        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.08] tracking-tight">
          The operations layer that keeps bookings moving.
        </h1>

        {/* Subheadline - no punching down, uses approved words */}
        <p className="mt-6 text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
          Communication, booking, and follow-up in one calm system. Nothing slips.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            asChild
            variant="teal"
            className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Link href="/signup">Get Handled</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-8 py-6 text-lg text-text-muted hover:text-text-primary"
          >
            <Link href="#how-it-works">How it works</Link>
          </Button>
        </div>

        {/* Full-width Browser Mockup */}
        <div className="mt-16 max-w-4xl mx-auto">
          <StorefrontPreview />
        </div>
      </div>
    </section>
  );
}
```

### Task 1.2: Extract StorefrontPreview Component

**File:** `apps/web/src/components/home/StorefrontPreview.tsx` (new)

Extract from `HeroWithVerticals.tsx` lines 230-397, hardcoded to Alex Chen:

```tsx
// apps/web/src/components/home/StorefrontPreview.tsx
'use client';

import { Star, Users, GraduationCap } from 'lucide-react';

// Alex Chen tutor data (hardcoded for hero)
const ALEX_CHEN = {
  name: 'Alex Chen',
  business: 'Math & Science Tutoring',
  initials: 'AC',
  headline: 'Math finally makes sense.',
  // FIX: Removed filler word "actually" per copy review
  subheadline: 'Tutoring for students who want to understand—not just pass.',
  tiers: [
    {
      name: 'Single Session',
      description: 'Try it out',
      price: '$85',
      features: ['1-hour session', 'Homework help', 'Session notes'],
    },
    {
      name: 'Grade Boost',
      description: '4 sessions',
      price: '$320',
      perSession: '$80/ea',
      features: ['Custom study plan', 'Text support', 'Progress tracking', 'Parent updates'],
    },
    {
      name: 'Semester Success',
      description: '12 sessions',
      price: '$900',
      perSession: '$75/ea',
      savings: 'Best value',
      features: ['Everything in Grade Boost', 'Flexible scheduling', 'Exam prep', '24/7 chat'],
    },
  ],
  trust: [
    { icon: Star, value: '4.9', label: 'rating' },
    { icon: Users, value: '200+', label: 'students' },
    { icon: GraduationCap, value: '6 yrs', label: 'teaching' },
  ],
};

export function StorefrontPreview() {
  return (
    <div className="bg-surface-alt rounded-3xl border border-neutral-800 overflow-hidden shadow-2xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center">
            alexchen.gethandled.ai
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className="h-[420px] sm:h-[480px] overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* Extract rest from HeroWithVerticals lines 243-396 */}
        {/* Hero section + Packages grid + Trust footer */}
      </div>
    </div>
  );
}
```

### Task 1.3: Update page.tsx Import

**File:** `apps/web/src/app/page.tsx`

```diff
- import { HeroWithVerticals } from '@/components/home/HeroWithVerticals';
+ import { Hero } from '@/components/home/Hero';

// In JSX:
- <HeroWithVerticals />
+ <Hero />
```

### Task 1.4: Delete HeroWithVerticals

**Decision:** Delete `apps/web/src/components/home/HeroWithVerticals.tsx` (git history provides rollback)

---

## Phase 2: Journey Carousel

### Task 2.1: Convert JourneyShowcase to Horizontal Carousel

**File:** `apps/web/src/components/home/JourneyShowcase.tsx`

```tsx
// apps/web/src/components/home/JourneyShowcase.tsx
'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DemoStorefrontShowcase } from './DemoStorefrontShowcase';
import { BookingMockup } from './BookingMockup';
import { ClientHubMockupTutor } from './ClientHubMockupTutor';

// FIX: Updated copy per brand voice review
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

  // Navigate to specific slide
  const goToSlide = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    isScrollingProgrammatically.current = true;
    scrollRef.current.scrollTo({ left: index * clientWidth, behavior: 'smooth' });
    setActiveIndex(index); // Set immediately for responsive UI
    // Reset flag after scroll animation completes
    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 400);
  }, []);

  // FIX: Keyboard navigation with functional updates to avoid stale closures
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveIndex((prev) => {
          const next = Math.max(0, prev - 1);
          goToSlide(next);
          return next;
        });
      }
      if (e.key === 'ArrowRight') {
        setActiveIndex((prev) => {
          const next = Math.min(STAGES.length - 1, prev + 1);
          goToSlide(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToSlide]); // goToSlide is stable via useCallback

  return (
    <div className="relative">
      {/* FIX: Hide arrows on mobile (hidden md:flex), show only dots + swipe */}
      <button
        onClick={() => goToSlide(Math.max(0, activeIndex - 1))}
        disabled={activeIndex === 0}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-surface/80 backdrop-blur border border-neutral-800 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all items-center justify-center"
        aria-label="Previous slide"
        aria-disabled={activeIndex === 0}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={() => goToSlide(Math.min(STAGES.length - 1, activeIndex + 1))}
        disabled={activeIndex === STAGES.length - 1}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-surface/80 backdrop-blur border border-neutral-800 text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all items-center justify-center"
        aria-label="Next slide"
        aria-disabled={activeIndex === STAGES.length - 1}
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

            {/* Browser frame with mockup */}
            <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden max-w-lg mx-auto">
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
              <div className="aspect-[4/5]">
                {index === 0 && <DemoStorefrontShowcase compact />}
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
```

### Task 2.2: Extract BookingMockup to Standalone File

**File:** `apps/web/src/components/home/BookingMockup.tsx` (new)

Extract lines 29-160 from current `JourneyShowcase.tsx` into standalone export. Keep Alex Chen "Grade Boost" theming.

### Task 2.3: Create ClientHubMockupTutor Component

**File:** `apps/web/src/components/home/ClientHubMockupTutor.tsx` (new)

**FIX:** Create Alex Chen themed version (existing `ClientHubMockup.tsx` is Sarah Williams wedding photography). This ensures visual consistency across all 3 carousel slides.

```tsx
// apps/web/src/components/home/ClientHubMockupTutor.tsx
// Copy structure from ClientHubMockup.tsx but with Alex Chen tutoring data:
// - "Your Tutoring Sessions" header
// - "Alex Chen • Math & Science" subtitle
// - "First Session" instead of wedding milestones
// - "Learning goals questionnaire" task
```

### Task 2.4: Add Scrollbar Hide Utility

**File:** `apps/web/src/app/globals.css`

```css
/* Scrollbar hide utility - works across all browsers */
.scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
.scrollbar-hide::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
```

---

## Phase 3: Cleanup & Polish

### Task 3.1: Remove Unused Code

- [x] Delete `HeroWithVerticals.tsx` (git provides rollback)
- [x] Delete duplicate `ClientHubMockup` from `JourneyShowcase.tsx` (lines 163-302)
- [x] Remove unused `VERTICALS` type exports
- [x] Update DemoStorefrontShowcase to define Vertical type locally

### Task 3.2: Test Responsive Behavior

- [ ] Test hero at 375px (iPhone SE), 768px (iPad), 1024px+ (desktop)
- [ ] Test carousel swipe on mobile device/simulator
- [ ] Verify keyboard navigation (arrow keys) works for carousel
- [ ] Check arrow buttons disable at boundaries
- [ ] Verify arrows hidden on mobile, visible on md+

### Task 3.3: Accessibility Audit

- [x] Carousel has `aria-live="polite"` and `role="region"`
- [x] Dot indicators have `aria-current="step"` for active
- [x] Arrow buttons have `aria-label` and `aria-disabled`
- [ ] Test with screen reader

---

## Acceptance Criteria

### Hero

- [ ] Full-width centered layout with headline above mockup
- [ ] Single Alex Chen storefront preview (no vertical switching)
- [ ] Responsive text scaling works at all breakpoints
- [ ] "Get Handled" and "How it works" CTAs visible
- [ ] Ambient glow effects render correctly
- [ ] Copy passes brand voice (no punching down, no filler words)

### Journey Carousel

- [ ] 3 slides: Find → Book → Hub (all Alex Chen themed)
- [ ] Horizontal scroll with CSS snap
- [ ] Left/right arrow buttons work (desktop only)
- [ ] Swipe gesture works on mobile
- [ ] Dot indicators show current position
- [ ] Clicking dots navigates to slide
- [ ] Keyboard arrow keys navigate slides
- [ ] Arrows disable at first/last slide
- [ ] No race condition between scroll and state

### Code Quality

- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No duplicate component definitions
- [ ] Proper imports (no redefined components)
- [ ] No stale closure bugs in effects

---

## Files Changed Summary

| File                                                    | Action      | Lines |
| ------------------------------------------------------- | ----------- | ----- |
| `apps/web/src/components/home/Hero.tsx`                 | **CREATE**  | ~50   |
| `apps/web/src/components/home/StorefrontPreview.tsx`    | **CREATE**  | ~150  |
| `apps/web/src/components/home/BookingMockup.tsx`        | **CREATE**  | ~130  |
| `apps/web/src/components/home/ClientHubMockupTutor.tsx` | **CREATE**  | ~140  |
| `apps/web/src/components/home/JourneyShowcase.tsx`      | **REWRITE** | ~130  |
| `apps/web/src/app/page.tsx`                             | **MODIFY**  | ~5    |
| `apps/web/src/app/globals.css`                          | **MODIFY**  | ~8    |
| `apps/web/src/components/home/HeroWithVerticals.tsx`    | **DELETE**  | -576  |

**Net change:** ~613 lines added, ~576 deleted = **~37 lines added** (minimal growth for major UX improvement)

---

## References

- **Brainstorm:** `docs/brainstorms/2026-01-29-hero-journey-redesign-brainstorm.md`
- **Current Hero:** `apps/web/src/components/home/HeroWithVerticals.tsx`
- **Current Journey:** `apps/web/src/components/home/JourneyShowcase.tsx`
- **Design Tokens:** `apps/web/tailwind.config.js` (animations at lines 182-226)
- **Brand Voice:** `docs/design/VOICE_QUICK_REFERENCE.md`
