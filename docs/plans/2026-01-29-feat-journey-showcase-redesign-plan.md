---
title: Journey Showcase Redesign - Full Storefront Preview & Infinite Scroll
type: feat
date: 2026-01-29
---

# Journey Showcase Redesign

Redesign the "client journey" carousel section to show full scrollable storefronts with infinite looping and optimized vertical space usage.

## Overview

The current Journey Showcase shows a cramped preview of Alex Chen's storefront. Users requested:

1. **Full website scrolling** - The first slide should show Alex Chen's complete website (hero → about → packages → etc.), scrollable within the browser frame
2. **Infinite/endless carousel** - After the last slide, loop back to the first
3. **Better vertical space** - Reduce wasted whitespace, maximize content display area
4. **Centered hero** - The browser mockup should be centered as the focal point
5. **Responsive spacing** - Different treatment for mobile vs desktop

## Problem Statement

Looking at the screenshot:

- The browser window shows only a compressed storefront preview (~4:5 aspect ratio)
- Alex Chen's "site" is just hero + packages, not his full website with about section, testimonials, etc.
- The carousel stops at slide 3 - no infinite loop
- Significant vertical padding (`py-32 md:py-40`) may be excessive for this visual showcase section
- Navigation arrows are far from the content

## Proposed Solution

### 1. Full Scrollable Website in Browser Frame

Replace `DemoStorefrontShowcase` with a new `FullStorefrontPreview` component that:

- Shows Alex Chen's complete website: Hero → About (with photo) → Packages → Testimonials → FAQ → CTA
- Is scrollable within the browser frame (user can scroll down inside the mock browser)
- Uses the same structure as real tenant storefronts (`TenantLandingPage` layout)

**Key insight:** Create a miniature but complete version of a real tenant site, not just the compressed hero + packages card view.

### 2. Infinite Carousel Loop

Modify `JourneyShowcase.tsx` to:

- Add infinite loop behavior: when reaching slide 3, next arrow goes to slide 1
- Update scroll position calculation to support wrap-around
- Consider CSS approach with duplicate slides at edges OR
- Use modular arithmetic in `goToSlide()` function

### 3. Vertical Space Optimization

**Current structure (lines 265-282 in page.tsx):**

```tsx
<section className="py-32 md:py-40 px-6 bg-surface-alt">
  <div className="max-w-4xl mx-auto">
    <div className="text-center mb-16">...</div>
    <JourneyShowcase />
  </div>
</section>
```

**Proposed changes:**

- Reduce section padding: `py-20 md:py-28` (more breathing room for the showcase itself)
- Reduce header margin: `mb-10` instead of `mb-16`
- Allow browser frame to be taller: increase aspect ratio from 4:5 to something that shows more content

### 4. Browser Frame Height & Display

**Current:** `aspect-[4/5]` forces a specific ratio that cuts off content
**Proposed:** Use a fixed height that fits viewport minus header:

- Mobile: `h-[400px]` with overflow-y scroll
- Desktop: `h-[500px] lg:h-[560px]`

The browser frame should show:

- Just the hero initially (above the fold)
- User can scroll down to see about, packages, etc.

### 5. Alex Chen Content Expansion

Create realistic content for Alex Chen's full website:

```typescript
const ALEX_CHEN_FULL_SITE = {
  hero: {
    headline: 'Math finally makes sense.',
    subheadline: 'Tutoring for students who want to understand—not just pass.',
    // ... trust indicators
  },
  about: {
    headline: 'Meet Your Tutor',
    content: 'Hi, I\'m Alex! I\'ve been helping students conquer math and science for 6 years. My approach: don\'t memorize—understand. When concepts click, grades follow.',
    image: '/demo/alex-chen-portrait.jpg', // Need to add this asset
  },
  packages: [...], // existing tiers
  testimonials: [
    { quote: 'My son went from a C- to a B+ in one semester.', author: 'Sarah M., Parent' },
    { quote: 'Finally a tutor who explains WHY, not just HOW.', author: 'Jake T., Student' }
  ],
  faq: [
    { q: 'What grades do you tutor?', a: 'Middle school through college prep.' },
    { q: 'Online or in-person?', a: 'Both! Most students prefer video calls.' }
  ]
};
```

### 6. Responsive Spacing Strategy

| Element              | Mobile                  | Desktop                |
| -------------------- | ----------------------- | ---------------------- |
| Section padding      | `py-16`                 | `md:py-24`             |
| Header margin        | `mb-8`                  | `md:mb-12`             |
| Browser frame height | `h-[380px]`             | `md:h-[480px]`         |
| Arrow position       | Hidden (use dots/swipe) | Closer to browser edge |

## Technical Approach

### Files to Modify

1. **`apps/web/src/components/home/JourneyShowcase.tsx`**
   - Add infinite loop logic
   - Adjust browser frame sizing
   - Move arrows closer to content

2. **`apps/web/src/components/home/FullStorefrontPreview.tsx`** (NEW)
   - Create full scrollable Alex Chen website
   - Include all sections: hero, about, packages, testimonials, faq, cta
   - Self-contained with hardcoded Alex Chen data

3. **`apps/web/src/app/page.tsx`**
   - Reduce section padding for Journey section
   - Adjust max-width if needed

4. **`apps/web/public/demo/`** (NEW)
   - Add Alex Chen portrait image for about section

### Implementation Phases

#### Phase 1: Full Storefront Preview Component

Create `FullStorefrontPreview.tsx`:

```tsx
export function FullStorefrontPreview() {
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-surface">
      {/* Mini Hero */}
      <section className="py-6 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Alex Chen hero content */}
      </section>

      {/* Mini About */}
      <section className="py-6 px-4 bg-surface-alt">{/* About with portrait */}</section>

      {/* Mini Packages */}
      <section className="py-6 px-4 bg-surface">{/* 3-tier grid */}</section>

      {/* Mini Testimonials */}
      <section className="py-4 px-4 bg-surface-alt">{/* Testimonial cards */}</section>

      {/* Mini CTA */}
      <section className="py-4 px-4 bg-sage">{/* Final CTA */}</section>
    </div>
  );
}
```

#### Phase 2: Infinite Carousel Loop

Update `goToSlide()` in JourneyShowcase.tsx:

```tsx
const goToSlide = useCallback((index: number) => {
  if (!scrollRef.current) return;

  // Wrap around for infinite loop
  const wrappedIndex = ((index % STAGES.length) + STAGES.length) % STAGES.length;

  const { clientWidth } = scrollRef.current;
  isScrollingProgrammatically.current = true;
  scrollRef.current.scrollTo({ left: wrappedIndex * clientWidth, behavior: 'smooth' });
  setActiveIndex(wrappedIndex);

  setTimeout(() => {
    isScrollingProgrammatically.current = false;
  }, 400);
}, []);
```

Update arrow buttons to always be enabled:

```tsx
<button
  onClick={() => goToSlide(activeIndex - 1)}
  // Remove: disabled={activeIndex === 0}
  className="..."
>
```

#### Phase 3: Vertical Space Optimization

In `page.tsx`, update Journey section:

```tsx
<section className="py-20 md:py-28 px-6 bg-surface-alt">
  <div className="max-w-4xl mx-auto">
    <div className="text-center mb-8 md:mb-12">{/* Keep header content */}</div>
    <JourneyShowcase />
  </div>
</section>
```

In `JourneyShowcase.tsx`, update browser frame:

```tsx
<div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden max-w-xl mx-auto">
  {/* Browser chrome */}
  <div className="h-[380px] md:h-[480px]">
    {index === 0 && <FullStorefrontPreview />}
    {/* ... */}
  </div>
</div>
```

#### Phase 4: Post-Booking Page Review

The `ClientHubMockupTutor` component should also be reviewed for vertical space:

- Current: Two-column layout with left (schedule/tasks) and right (chat)
- Consider: More compact header, tighter spacing on task items
- The 45% width for chat panel may be adjusted

## Acceptance Criteria

### Functional Requirements

- [x] Slide 1 shows a full scrollable Alex Chen website (hero, about, packages, testimonials visible when scrolling)
- [x] Carousel loops infinitely (slide 3 → slide 1 on "next", slide 1 → slide 3 on "prev")
- [x] Both arrow buttons always enabled (no disabled state at edges)
- [x] Browser frame fits nicely in viewport without excessive whitespace
- [x] About section includes a placeholder portrait image for Alex Chen

### Non-Functional Requirements

- [x] Mobile: Browser frame ~380px height, arrows hidden, swipe + dots work
- [x] Desktop: Browser frame ~480px height, arrows visible and close to content
- [x] Smooth scroll-snap behavior preserved
- [x] No layout shift when switching slides
- [x] Keyboard navigation (arrow keys) works with infinite loop

### Quality Gates

- [ ] Visual regression: No unexpected changes to other sections
- [ ] Lighthouse performance: No significant score drop
- [ ] WCAG: `aria-live` announces current slide correctly with loop

## Dependencies & Prerequisites

- Need to source or create an Alex Chen portrait image (can use placeholder initially)
- No external dependencies required (all CSS scroll-snap based)

## Risk Analysis

| Risk                         | Likelihood | Impact | Mitigation                            |
| ---------------------------- | ---------- | ------ | ------------------------------------- |
| Infinite loop feels jarring  | Medium     | Low    | Use smooth scroll animation, ~400ms   |
| Scrollable content confusing | Low        | Medium | Add subtle scroll indicator on mobile |
| Portrait image licensing     | Low        | Low    | Use AI-generated or stock placeholder |

## Future Considerations

1. **Auto-advance carousel** - Could add timer-based auto-play (disabled on interaction)
2. **Multiple tenant examples** - Rotate through different verticals (photographer, chef, coach)
3. **Interactive demo** - Allow clicking packages to simulate booking flow

## References

### Internal References

- `apps/web/src/components/home/JourneyShowcase.tsx` - Current carousel implementation
- `apps/web/src/components/home/DemoStorefrontShowcase.tsx` - Current storefront preview
- `apps/web/src/components/home/StorefrontPreview.tsx` - Alternative storefront component
- `apps/web/src/components/tenant/TenantLandingPage.tsx` - Real tenant page structure
- `packages/contracts/src/landing-page.ts:718-842` - Default tenant page config

### Design References

- `docs/design/VOICE_QUICK_REFERENCE.md` - Brand voice for Alex Chen copy
- `docs/design/BRAND_VOICE_GUIDE.md` - Spacing guidelines (`py-32 md:py-40` standard)

### Related Components

- `ClientHubMockupTutor` - Stage 3 mockup (also needs vertical space review)
- `BookingMockup` - Stage 2 mockup (currently well-proportioned)
