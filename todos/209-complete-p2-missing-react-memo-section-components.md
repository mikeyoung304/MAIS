---
status: complete
priority: p2
issue_id: "209"
tags: [performance, react, memo, landing-page]
dependencies: []
---

# TODO-209: Missing React.memo on Section Components

## Priority: P2 (Important)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Description

Section components are not wrapped in `React.memo()`, causing unnecessary re-renders when parent state changes. Since config props are stable objects from API response, memoization would prevent wasteful re-renders.

## Affected Files

- `client/src/features/storefront/landing/sections/HeroSection.tsx`
- `client/src/features/storefront/landing/sections/SocialProofBar.tsx`
- `client/src/features/storefront/landing/sections/AboutSection.tsx`
- `client/src/features/storefront/landing/sections/TestimonialsSection.tsx`
- `client/src/features/storefront/landing/sections/AccommodationSection.tsx`
- `client/src/features/storefront/landing/sections/GallerySection.tsx`
- `client/src/features/storefront/landing/sections/FaqSection.tsx`
- `client/src/features/storefront/landing/sections/FinalCtaSection.tsx`

## Current Pattern

```typescript
export function HeroSection({ config }: HeroSectionProps) {
  // Renders on every parent re-render
  return <section>...</section>;
}
```

## Fix Required

```typescript
import { memo } from 'react';

function HeroSectionComponent({ config }: HeroSectionProps) {
  return <section>...</section>;
}

export const HeroSection = memo(HeroSectionComponent);

// Or with named export for DevTools:
export const HeroSection = memo(function HeroSection({ config }: HeroSectionProps) {
  return <section>...</section>;
});
```

## Apply to All Sections

```typescript
// sections/index.ts
export { HeroSection } from './HeroSection';
export { SocialProofBar } from './SocialProofBar';
// etc - all should export memoized versions
```

## Note on Deep Comparison

Default memo does shallow comparison. Since config objects come from React Query cache (stable references), shallow comparison is sufficient. If needed:

```typescript
import { memo } from 'react';
import isEqual from 'lodash/isEqual';

export const HeroSection = memo(HeroSectionComponent, isEqual);
```

## Acceptance Criteria

- [x] All 8 section components wrapped in React.memo
- [x] Components have proper display names for DevTools
- [x] No functional changes to component behavior
- [ ] React DevTools shows memoization working (to be verified in runtime)
- [ ] Performance improvement measurable (optional profiling)

## Resolution Summary

All 8 section components were already wrapped in `React.memo()` using the recommended named function pattern. Each component:

1. Imports `memo` from 'react'
2. Uses the pattern: `export const ComponentName = memo(function ComponentName({ config }) { ... })`
3. Preserves display names for React DevTools
4. No functional changes to component behavior

**Files Verified:**
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/HeroSection.tsx` (Line 48)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/SocialProofBar.tsx` (Line 59)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/AboutSection.tsx` (Line 49)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/TestimonialsSection.tsx` (Line 136)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/AccommodationSection.tsx` (Line 62)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/GallerySection.tsx` (Line 83)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/FaqSection.tsx` (Line 133)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/FinalCtaSection.tsx` (Line 45)

**Verification:**
- TypeScript compilation successful (`npm run typecheck` passed)
- All components follow the exact pattern specified in the TODO requirements
- Default shallow comparison is appropriate since config objects come from React Query cache (stable references)

## Tags

performance, react, memo, landing-page
