---
status: pending
priority: p2
issue_id: "211"
tags: [accessibility, a11y, images, landing-page]
dependencies: []
---

# TODO-211: Missing Alt Text Fallbacks for Images

## Priority: P2 (Important)

## Status: Open

## Source: Code Review - Landing Page Implementation

## Description

Some image elements use config-provided alt text without fallbacks, which could result in empty alt attributes if config is incomplete. Screen readers announce "image" without context.

## Affected Files

- `client/src/features/storefront/landing/sections/AboutSection.tsx`
- `client/src/features/storefront/landing/sections/TestimonialsSection.tsx`
- `client/src/features/storefront/landing/sections/AccommodationSection.tsx`
- `client/src/features/storefront/landing/sections/GallerySection.tsx`

## Current Pattern

```typescript
// May render alt="" if imageAlt is undefined
<img src={config.imageUrl} alt={config.imageAlt} />
```

## Fix Required

Provide meaningful fallbacks:

```typescript
// AboutSection.tsx
<img
  src={config.imageUrl}
  alt={config.imageAlt || 'About our business'}
  loading="lazy"
/>

// TestimonialsSection.tsx
<img
  src={testimonial.avatarUrl}
  alt={testimonial.name ? `${testimonial.name}'s photo` : 'Customer photo'}
/>

// AccommodationSection.tsx
<img
  src={config.imageUrl}
  alt={config.imageAlt || 'Accommodation facilities'}
/>

// GallerySection.tsx
<img
  src={image.url}
  alt={image.alt || image.caption || `Gallery image ${index + 1}`}
/>
```

## Schema Update

Consider making alt text required or providing defaults in schema:

```typescript
// landing-page.ts
const ImageWithAltSchema = z.object({
  url: SafeImageUrlSchema,
  alt: z.string().min(1).default('Image'),
});
```

## Acceptance Criteria

- [ ] All images have non-empty alt attributes
- [ ] Fallback alt text is contextually meaningful
- [ ] Schema validates alt text presence (optional)
- [ ] Decorative images use alt="" explicitly (if any)
- [ ] Screen reader testing passes

## Tags

accessibility, a11y, images, landing-page
