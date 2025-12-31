---
status: complete
priority: p2
issue_id: '214'
tags: [accessibility, a11y, animation, motion, landing-page]
dependencies: []
---

# TODO-214: Section Animations Don't Respect prefers-reduced-motion

## Priority: P2 (Important)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Description

CSS animations/transitions in landing page sections don't check `prefers-reduced-motion` media query. Users who prefer reduced motion (vestibular disorders, motion sensitivity) may experience discomfort.

## Affected Animations

- `FaqSection.tsx` - Accordion expand/collapse animation
- `GallerySection.tsx` - Lightbox transitions (if any)
- Hero scroll-to behavior with `behavior: 'smooth'`
- Any hover animations on buttons/cards

## Current Pattern

```typescript
// FaqSection.tsx - Always animates
<div
  className={`
    overflow-hidden transition-all duration-300 ease-in-out
    ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}
  `}
>
```

## Fix Required

### Option A: CSS Media Query

```css
/* client/src/styles/a11y.css or Tailwind config */
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Option B: Component-Level Check

```typescript
// hooks/useReducedMotion.ts
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

// FaqSection.tsx
function FaqAccordionItem({ item, isOpen, onToggle }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={`
        overflow-hidden
        ${reduceMotion ? '' : 'transition-all duration-300 ease-in-out'}
        ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}
      `}
    >
      {item.answer}
    </div>
  );
}
```

### Option C: Scroll Behavior Fix

```typescript
// HeroSection.tsx
const scrollToExperiences = () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('experiences')?.scrollIntoView({
    behavior: prefersReduced ? 'auto' : 'smooth',
  });
};
```

## Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      screens: {
        'motion-safe': { raw: '(prefers-reduced-motion: no-preference)' },
        'motion-reduce': { raw: '(prefers-reduced-motion: reduce)' },
      },
    },
  },
};

// Usage
<div className="motion-safe:transition-all motion-safe:duration-300">
```

## Acceptance Criteria

- [x] Accordion respects prefers-reduced-motion
- [x] Smooth scroll respects prefers-reduced-motion
- [x] All transitions/animations have reduced-motion alternative
- [x] Global CSS rule or per-component handling (choose one)
- [ ] Manual testing with system preference enabled

## Resolution

**Date:** 2025-12-03

**Approach:** Hybrid solution combining global CSS rule with component-level scroll behavior checks.

### Changes Made

1. **Global CSS Rule** (`client/src/index.css`)
   - Added comprehensive `@media (prefers-reduced-motion: reduce)` rule
   - Sets `animation-duration: 0.01ms !important` on all elements
   - Sets `animation-iteration-count: 1 !important`
   - Sets `transition-duration: 0.01ms !important`
   - Catches all animations including:
     - FaqSection accordion transitions
     - Hero button hover effects
     - GallerySection image zoom
     - All button scale transforms
     - Tailwind animate-bounce

2. **Component-Level Scroll Behavior**
   - Updated `HeroSection.tsx` scrollToExperiences()
   - Updated `FinalCtaSection.tsx` scrollToExperiences()
   - Both now check `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
   - Use `behavior: 'auto'` when reduced motion is preferred
   - Use `behavior: 'smooth'` otherwise

### Coverage

All landing page animations now respect user motion preferences:

- ✅ FAQ accordion expand/collapse (global CSS)
- ✅ Hero scroll-to-experiences (component check)
- ✅ Final CTA scroll-to-experiences (component check)
- ✅ All button hover animations (global CSS)
- ✅ Gallery image zoom on hover (global CSS)
- ✅ Arrow bounce animation (global CSS)

### Testing Notes

Build verified successfully. Manual testing with system preference should be performed:

**macOS:** System Preferences → Accessibility → Display → Reduce motion
**Windows:** Settings → Ease of Access → Display → Show animations
**Linux:** Varies by desktop environment

### Files Modified

- `/Users/mikeyoung/CODING/MAIS/client/src/index.css`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/HeroSection.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/FinalCtaSection.tsx`

## Resources

- MDN prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- WCAG 2.3.3 Animation from Interactions: https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions

## Tags

accessibility, a11y, animation, motion, landing-page
