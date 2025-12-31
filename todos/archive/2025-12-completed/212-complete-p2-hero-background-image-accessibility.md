---
status: complete
priority: p2
issue_id: '212'
tags: [accessibility, a11y, images, landing-page, hero, resolved]
dependencies: []
---

# TODO-212: Hero Background Image Missing Accessible Description

## Priority: P2 (Important)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Description

The hero section uses a CSS background-image which is invisible to screen readers. If the image conveys meaningful content, it needs an accessible description via ARIA.

## Current Implementation

```typescript
// HeroSection.tsx
<section
  className="..."
  style={{
    backgroundImage: config.backgroundImageUrl
      ? `url(${config.backgroundImageUrl})`
      : undefined
  }}
>
  <h1>{config.headline}</h1>
  ...
</section>
```

## Problem

Background images are purely decorative to assistive technology. If the image provides context (e.g., showing the business location, service in action), that context is lost.

## Fix Options

### Option A: Treat as Decorative (if applicable)

If the background is purely aesthetic:

```typescript
// No changes needed - background images are ignored by screen readers
// This is acceptable if the headline/subheadline convey all meaning
```

### Option B: Add ARIA Description

If the image conveys meaning:

```typescript
<section
  role="img"
  aria-label={config.backgroundImageAlt || 'Hero background image'}
  style={{ backgroundImage: `url(${config.backgroundImageUrl})` }}
>
  {/* Content becomes accessible name for the image region */}
</section>
```

### Option C: Use Actual Image Element

For maximum accessibility:

```typescript
<section className="relative">
  {config.backgroundImageUrl && (
    <img
      src={config.backgroundImageUrl}
      alt={config.backgroundImageAlt || ''}
      className="absolute inset-0 w-full h-full object-cover -z-10"
      fetchPriority="high"
    />
  )}
  <div className="relative z-10">
    <h1>{config.headline}</h1>
  </div>
</section>
```

## Schema Update

Add backgroundImageAlt to hero config:

```typescript
// landing-page.ts
export const HeroSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(500).optional(),
  ctaText: z.string().min(1).max(50),
  backgroundImageUrl: SafeImageUrlSchema.optional(),
  backgroundImageAlt: z.string().max(200).optional(), // NEW
});
```

## Acceptance Criteria

- [x] Decision made: decorative vs meaningful image
- [x] Documentation added explaining background is decorative
- [x] Instructions provided for future semantic background images
- [x] Build verification confirms TypeScript compilation

## Resolution Summary

**Decision:** Treat hero background image as decorative.

**Rationale:** The headline and subheadline convey all meaningful content. The background image is purely aesthetic and provides visual atmosphere, not semantic information.

**Implementation:** Added comprehensive accessibility comment to `HeroSection.tsx` explaining:

1. Background image is decorative (correct screen reader behavior)
2. Headline/subheadline provide semantic content
3. Future path if background needs to be semantic (role="img" + aria-label)
4. Reference to TODO-212 resolution

**Files Modified:**

- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/HeroSection.tsx`

**Verification:** Client build successful (vite build passed).

## Tags

accessibility, a11y, images, landing-page, hero, resolved
