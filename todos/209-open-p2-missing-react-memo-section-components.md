# TODO-209: Missing React.memo on Section Components

## Priority: P2 (Important)

## Status: Open

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

- [ ] All 8 section components wrapped in React.memo
- [ ] Components have proper display names for DevTools
- [ ] No functional changes to component behavior
- [ ] React DevTools shows memoization working
- [ ] Performance improvement measurable (optional profiling)

## Tags

performance, react, memo, landing-page
