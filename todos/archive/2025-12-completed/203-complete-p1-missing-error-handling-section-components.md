---
status: complete
priority: p1
issue_id: '203'
tags: [error-handling, frontend, landing-page, resilience]
dependencies: []
---

# TODO-203: Missing Error Handling for Malformed Landing Page Configs

## Priority: P1 (Critical)

## Status: Open

## Source: Code Review - Landing Page Implementation

## Description

Landing page section components assume config data is always valid. If malformed data is stored in the database (manual SQL, migration issues, API bugs), components will crash with unhandled exceptions, breaking the entire storefront.

## Affected Files

- `client/src/features/storefront/landing/sections/HeroSection.tsx`
- `client/src/features/storefront/landing/sections/SocialProofBar.tsx`
- `client/src/features/storefront/landing/sections/AboutSection.tsx`
- `client/src/features/storefront/landing/sections/TestimonialsSection.tsx`
- `client/src/features/storefront/landing/sections/AccommodationSection.tsx`
- `client/src/features/storefront/landing/sections/GallerySection.tsx`
- `client/src/features/storefront/landing/sections/FaqSection.tsx`
- `client/src/features/storefront/landing/sections/FinalCtaSection.tsx`

## Example Vulnerability

```typescript
// Current - crashes if config.stats is undefined or not an array
{config.stats.map((stat, index) => (
  <div key={index}>...</div>
))}

// Current - crashes if testimonials array is undefined
{config.testimonials.map((testimonial) => (
  <TestimonialCard key={testimonial.id} testimonial={testimonial} />
))}
```

## Fix Required

1. Add runtime validation at component level:

```typescript
// Option A: Zod parsing with fallback
import { HeroSectionConfigSchema } from '@macon/contracts';

export function HeroSection({ config }: HeroSectionProps) {
  const parsed = HeroSectionConfigSchema.safeParse(config);
  if (!parsed.success) {
    console.error('Invalid hero config:', parsed.error);
    return null; // Or fallback UI
  }
  const validConfig = parsed.data;
  // ... render with validConfig
}
```

2. Or use defensive coding with optional chaining:

```typescript
// Option B: Defensive rendering
export function SocialProofBar({ config }: SocialProofBarProps) {
  const stats = config?.stats ?? [];
  if (stats.length === 0) return null;

  return (
    <section>
      {stats.map((stat, index) => (
        <div key={stat?.label ?? index}>
          {stat?.value ?? 'N/A'}
        </div>
      ))}
    </section>
  );
}
```

3. Add error boundary per section in LandingPage.tsx:

```typescript
// LandingPage.tsx
{sections?.hero && landingPage?.hero && (
  <SectionErrorBoundary sectionName="Hero">
    <HeroSection config={landingPage.hero} />
  </SectionErrorBoundary>
)}
```

## Acceptance Criteria

- [ ] Each section component handles missing/malformed config gracefully
- [ ] No unhandled exceptions from invalid config data
- [ ] Error boundary wraps each section independently
- [ ] Invalid sections fail silently or show minimal fallback
- [ ] Console logs validation errors for debugging
- [ ] Unit tests cover malformed config scenarios

## Tags

error-handling, frontend, landing-page, resilience
