---
status: complete
priority: p2
issue_id: '217'
tags: [ux, loading, skeleton, landing-page, performance]
dependencies: []
---

# TODO-217: Missing Loading/Skeleton States for Sections

## Priority: P2 (Important)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Description

If landing page config takes time to load (slow network, large payload), users see nothing or incomplete content. Each section should have a skeleton loading state.

## Current Flow

```typescript
// TenantStorefrontLayout - Tenant loading
if (isLoading) {
  return <Loading label="Loading storefront" />;
}

// LandingPage - No intermediate states
// Either shows full content or nothing
```

## Issue

- Tenant fetch is fast due to caching
- But on first visit or cache miss, there's no graceful loading
- Sections pop in all at once, causing layout shift

## Fix Required

### Option A: Skeleton Components

```typescript
// sections/HeroSkeleton.tsx
export function HeroSkeleton() {
  return (
    <section className="relative h-[80vh] bg-neutral-200 animate-pulse">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="h-12 w-96 bg-neutral-300 rounded mb-4" />
        <div className="h-6 w-64 bg-neutral-300 rounded mb-8" />
        <div className="h-12 w-32 bg-neutral-300 rounded-lg" />
      </div>
    </section>
  );
}

// sections/TestimonialsSkeleton.tsx
export function TestimonialsSkeleton() {
  return (
    <section className="py-16 bg-neutral-50">
      <div className="container mx-auto">
        <div className="h-10 w-64 bg-neutral-200 rounded mx-auto mb-12 animate-pulse" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
              <div className="h-4 w-full bg-neutral-200 rounded mb-2" />
              <div className="h-4 w-3/4 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Option B: Suspense Boundaries

```typescript
// LandingPage.tsx
import { Suspense, lazy } from 'react';

const HeroSection = lazy(() => import('./sections/HeroSection'));
const TestimonialsSection = lazy(() => import('./sections/TestimonialsSection'));

function LandingPageContent({ tenant }: LandingPageProps) {
  return (
    <div className="landing-page">
      {sections?.hero && (
        <Suspense fallback={<HeroSkeleton />}>
          <HeroSection config={landingPage.hero} />
        </Suspense>
      )}
    </div>
  );
}
```

### Option C: Progressive Loading

Load critical sections first (hero), lazy load below-fold:

```typescript
function LandingPageContent({ tenant }: LandingPageProps) {
  // Hero loads immediately
  // Other sections load progressively
  return (
    <div>
      {sections?.hero && <HeroSection config={landingPage.hero} />}

      {/* Below-fold sections lazy loaded */}
      <LazyLoadSection
        enabled={sections?.testimonials}
        skeleton={<TestimonialsSkeleton />}
      >
        <TestimonialsSection config={landingPage.testimonials} />
      </LazyLoadSection>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Each section has a skeleton component
- [ ] Skeletons match approximate layout of real content
- [ ] Smooth transition from skeleton to content
- [ ] No layout shift (CLS) during loading
- [ ] Hero section prioritized for fast paint

## Tags

ux, loading, skeleton, landing-page, performance

## Resolution

Implemented Option A with a comprehensive `LandingPageSkeleton` component that provides a complete skeleton loading state for the entire landing page.

### Changes Made

1. **Created `client/src/features/storefront/landing/LandingPageSkeleton.tsx`**
   - Comprehensive skeleton component covering all landing page sections
   - Hero skeleton with overlays and gradient matching real layout
   - Section skeletons for About, Testimonials, Gallery, FAQ, and Final CTA
   - Uses `animate-pulse` for loading animation
   - Responsive design with proper max-width constraints
   - Total size: ~4KB

2. **Updated `client/src/features/storefront/landing/index.ts`**
   - Exported `LandingPageSkeleton` for easy imports

3. **Updated `client/src/app/TenantStorefrontLayout.tsx`**
   - Replaced generic `<Loading label="Loading storefront" />` with `<LandingPageSkeleton />`
   - Provides better UX during initial tenant data fetch
   - Skeleton appears while tenant query is loading

### Design Decisions

- **Single skeleton vs per-section**: Chose single skeleton because tenant data loads as one query
- **Matches layout structure**: Skeleton mirrors the real component hierarchy (hero, sections, CTA)
- **No layout shift**: Skeleton heights match approximate real content heights
- **Accessible**: Uses semantic HTML and proper contrast ratios
- **Performance**: Minimal CSS, reuses neutral color palette from Tailwind

### Benefits

- Better perceived performance during first visit or cache miss
- No jarring flash from empty state to content
- Matches design system (neutral colors, rounded corners)
- Reusable skeleton can be extended if needed for progressive loading

### Future Enhancements

- Could add per-section suspense boundaries for progressive loading
- Could add intersection observer for lazy loading below-fold sections
- Could customize skeleton based on enabled sections from tenant config

### Files Modified

- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/LandingPageSkeleton.tsx` (created)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/index.ts` (updated export)
- `/Users/mikeyoung/CODING/MAIS/client/src/app/TenantStorefrontLayout.tsx` (updated loading state)
