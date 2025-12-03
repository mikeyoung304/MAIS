---
status: complete
priority: p3
issue_id: "118"
tags: [code-review, accessibility, ui-redesign]
dependencies: []
---

# Screen Reader Context Missing for Sort Order, Slugs, Photo Counts

## Problem Statement

Visual information like sort order numbers, URL slugs, and photo counts lack screen reader context.

**Why it matters:** Screen reader users don't get full context for these values.

## Findings

### From accessibility specialist agent:

**Issues found:**
1. SegmentsList (lines 67-69) - Sort order number shown without label
2. SegmentsList (lines 88-90) - Slug path shown without context
3. PackageList (lines 98-103) - Photo count badge visual-only

## Proposed Solutions

### Solution 1: Add sr-only Context (Recommended)
**Pros:** Better screen reader experience
**Cons:** Minor code additions
**Effort:** Small (30 min)
**Risk:** None

```tsx
// Sort order
<span className="text-xs font-medium text-sage">
  <span className="sr-only">Sort order: </span>
  {segment.sortOrder}
</span>

// Slug
<span className="font-mono text-xs ...">
  <span className="sr-only">URL path: </span>
  /{segment.slug}
</span>

// Photo count
<span className="...">
  <ImageIcon className="w-3 h-3" aria-hidden="true" />
  <span className="sr-only">{pkg.photos.length} photos available</span>
  <span aria-hidden="true">{pkg.photos.length}</span>
</span>
```

## Acceptance Criteria

- [x] Sort order has "Sort order: " prefix for screen readers
- [x] Slugs have "URL path: " prefix for screen readers
- [x] Photo counts fully described for screen readers

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-30 | Created from code review | Accessibility enhancement |
| 2025-12-02 | Implemented screen reader context | Added sr-only labels for sort order, slugs, and photo counts |
