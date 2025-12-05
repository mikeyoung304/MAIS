---
status: complete
priority: p2
issue_id: '255'
tags: [code-review, landing-page, performance, ux]
dependencies: []
source: 'plan-review-2025-12-04'
---

# TODO-255: Add Aspect Ratio Handling to Prevent Layout Shift

## Priority: P2 (Important - Performance/UX)

## Status: Pending

## Source: Plan Review - Performance Oracle

## Problem Statement

The plan claims "No layout shift during editing" (line 693) but doesn't define image dimension handling. Gallery section allows 20 images, each loaded on-demand. Without `aspect-ratio` CSS or skeleton placeholders, images will cause Cumulative Layout Shift (CLS) as they load.

**Why It Matters:**

- Poor CLS score (>0.25) fails Core Web Vitals
- User editing text while images load causes scroll jumpiness
- Lighthouse score penalty (plan claims >90 accessibility target, line 704)
- Bad UX during gallery editing

## Findings

### Current Schema Has No Dimensions

```typescript
// landing-page.ts
export const GalleryImageSchema = z.object({
  url: SafeImageUrlSchema,
  alt: z.string().max(200).optional(),
  // NO width/height fields
});
```

### Without Dimensions

```tsx
// Images load without reserved space
<img src={image.url} alt={image.alt} />
// Browser doesn't know dimensions until loaded
// Content shifts when image finally renders
```

## Proposed Solutions

### Option A: Store Image Dimensions in Schema (Recommended)
- **Effort:** 2-3 hours
- **Risk:** Low
- Add `width` and `height` fields to image schemas
- Extract dimensions during upload
- Use `aspect-ratio` CSS for reserved space
- **Pros:** Zero CLS, proper solution
- **Cons:** Schema change, needs dimension extraction

### Option B: Fixed Aspect Ratio Containers
- **Effort:** 1 hour
- **Risk:** Medium
- Use fixed aspect ratios (16:9 for hero, 1:1 for gallery)
- No schema changes
- **Pros:** Quick fix
- **Cons:** Images may be cropped awkwardly

### Option C: Skeleton Loading Only
- **Effort:** 30 minutes
- **Risk:** Medium
- Show gray skeleton until image loads
- Keep current layout shift but mask it visually
- **Pros:** Simplest
- **Cons:** Still has shift, just hidden

## Recommended Action

**For MVP:** Execute Option B (fixed aspect ratios):

```tsx
// Define aspect ratios per section
const SECTION_ASPECT_RATIOS = {
  hero: '16/9',
  about: '4/3',
  gallery: '1/1',
  accommodation: '16/9',
};

// Use in EditableImage
<div
  className="relative bg-muted rounded-lg overflow-hidden"
  style={{ aspectRatio: SECTION_ASPECT_RATIOS[section] }}
>
  <img
    src={image.url}
    alt={image.alt}
    className="absolute inset-0 w-full h-full object-cover"
    loading="lazy"
  />
</div>
```

**Post-MVP:** Consider Option A for better quality:

```typescript
// Updated schema
export const GalleryImageSchema = z.object({
  url: SafeImageUrlSchema,
  alt: z.string().max(200).optional(),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
});

// Extract dimensions during upload
const dimensions = await getImageDimensions(file);
await uploadImage({ url, width: dimensions.width, height: dimensions.height });

// Use actual dimensions
<div style={{ aspectRatio: `${image.width}/${image.height}` }}>
  <img src={image.url} />
</div>
```

## Acceptance Criteria

- [ ] Hero background image has reserved space (16:9)
- [ ] About section image has reserved space (4:3)
- [ ] Gallery images have reserved space (1:1 grid)
- [ ] No layout shift when images load in editor
- [ ] Lighthouse CLS score < 0.1

## Work Log

| Date       | Action  | Notes                                             |
|------------|---------|--------------------------------------------------|
| 2025-12-04 | Created | Performance review identified layout shift risk  |

## Tags

code-review, landing-page, performance, ux
