---
status: pending
priority: p2
issue_id: "234"
tags: [performance, code-review, landing-page, images]
dependencies: []
source: "code-review-landing-page-visual-editor"
---

# TODO-234: Define EditableImage Component with Optimization

## Priority: P2 (Important - Should Fix)

## Status: Pending

## Source: Performance Review - Landing Page Visual Editor Plan

## Problem Statement

The plan references `EditableImage` component (line 429) but doesn't define it. Without image optimization, 5MB background images could freeze the editor during upload and preview.

**Why It Matters:**
- Hero background + Gallery could load 10-15MB unoptimized
- Editor frozen during large image uploads
- Mobile users severely impacted

## Findings

**Evidence:**
- Plan mentions `EditableImage` but no implementation details
- PhotoDropZone accepts 5MB files
- No mention of image compression or WebP conversion
- No lazy loading for gallery images

## Proposed Solutions

### Option A: Simple Input + Existing Upload (Recommended for MVP)
Use native file input with existing photo upload infrastructure.

**Pros:** Simple, fast to implement
**Cons:** No client-side optimization
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file).then(url => onUpdate({ backgroundImageUrl: url }));
  }}
/>
```

### Option B: Full ImageUploadOptimizer
Create utility with compression, WebP conversion, thumbnails.

**Pros:** Best performance
**Cons:** More complex
**Effort:** Large (4-6 hours)
**Risk:** Medium

## Recommended Action

**Option A** for MVP, **Option B** as post-launch enhancement.

## Acceptance Criteria

- [ ] EditableImage component defined and functional
- [ ] `loading="lazy"` on all preview images
- [ ] Gallery images lazy-load via Intersection Observer
- [ ] Upload shows loading indicator

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Performance review of landing page visual editor plan |

## Tags

performance, code-review, landing-page, images
