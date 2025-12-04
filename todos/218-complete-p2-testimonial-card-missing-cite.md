---
status: complete
priority: p2
issue_id: '218'
tags: [accessibility, semantic-html, seo, landing-page, testimonials]
dependencies: []
---

# TODO-218: Testimonial Cards Missing Semantic Markup

## Priority: P2 (Important)

## Status: Resolved

## Source: Code Review - Landing Page Implementation

## Description

Testimonial quotes use generic div elements instead of semantic HTML5 `<blockquote>`, `<cite>`, and `<figure>` elements. This reduces accessibility and SEO value.

## Current Pattern

```typescript
// TestimonialsSection.tsx
<div className="testimonial-card">
  <p className="quote">{testimonial.quote}</p>
  <div className="author">
    <img src={testimonial.avatarUrl} alt="" />
    <span>{testimonial.name}</span>
    <span>{testimonial.title}</span>
  </div>
</div>
```

## Semantic Fix

```typescript
// TestimonialsSection.tsx
function TestimonialCard({ testimonial }: { testimonial: TestimonialItem }) {
  return (
    <figure className="testimonial-card">
      <blockquote cite={testimonial.sourceUrl}>
        <p>{testimonial.quote}</p>
      </blockquote>
      <figcaption>
        {testimonial.avatarUrl && (
          <img
            src={sanitizeImageUrl(testimonial.avatarUrl)}
            alt={`${testimonial.name}'s photo`}
            className="w-12 h-12 rounded-full"
            loading="lazy"
          />
        )}
        <cite>
          <span className="font-semibold">{testimonial.name}</span>
          {testimonial.title && (
            <span className="text-neutral-600">, {testimonial.title}</span>
          )}
          {testimonial.company && (
            <span className="text-neutral-500"> at {testimonial.company}</span>
          )}
        </cite>
      </figcaption>
    </figure>
  );
}
```

## Schema Enhancement

```typescript
// landing-page.ts
export const TestimonialItemSchema = z.object({
  id: z.string().optional(),
  quote: z.string().min(1).max(1000),
  name: z.string().min(1).max(100),
  title: z.string().max(100).optional(),
  company: z.string().max(100).optional(), // NEW
  avatarUrl: SafeImageUrlSchema.optional(),
  sourceUrl: z.string().url().optional(), // NEW - for cite attribute
});
```

## Benefits

- Screen readers announce content as quotes
- Search engines understand testimonial content
- Better structured data for SEO
- `<cite>` properly attributes the quote source

## Acceptance Criteria

- [x] Testimonials use `<blockquote>` for quotes
- [x] Attribution uses `<cite>` element
- [x] Container uses `<figure>` + `<figcaption>`
- [x] No visual changes (styling preserved)

## Resolution

Updated `TestimonialCard` component in `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/TestimonialsSection.tsx` with proper semantic HTML:

1. Changed outer `<div>` to `<figure>` element
2. Wrapped quote text in `<blockquote>` with nested `<p>` tag
3. Changed author info wrapper from `<div>` to `<figcaption>`
4. Wrapped author name and role in `<cite>` element with `not-italic` class
5. Added `aria-hidden="true"` to decorative Quote icon

All Tailwind classes preserved for consistent styling. Client build passes successfully.

## Tags

accessibility, semantic-html, seo, landing-page, testimonials
