---
status: complete
priority: p3
issue_id: "414"
tags:
  - code-review
  - code-quality
  - duplication
  - locked-template-system
dependencies: []
---

# StarRating Component Duplicated

## Problem Statement

The `StarRating` helper component is defined identically in two files, violating DRY principle.

**Why This Matters:**
- Changes must be made in two places
- Easy to create inconsistencies
- Indicates broader duplication pattern

## Findings

**Locations:**
- `apps/web/src/components/tenant/TenantLandingPage.tsx` (lines 19-29)
- `apps/web/src/components/tenant/sections/TestimonialsSection.tsx` (lines 11-21)

**Evidence (identical in both):**
```typescript
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1 text-macon-orange">
      {[...Array(5)].map((_, i) => (
        <span key={i} className={i < rating ? 'opacity-100' : 'opacity-30'}>
          &#9733;
        </span>
      ))}
    </div>
  );
}
```

**Agent:** Code Simplicity Reviewer, Performance Oracle

## Proposed Solutions

### Solution 1: Extract to Shared Component (Recommended)

Create `apps/web/src/components/ui/StarRating.tsx`.

```typescript
// components/ui/StarRating.tsx
export function StarRating({ rating }: { rating: number }) {
  // ...implementation
}
```

**Pros:**
- Single source of truth
- Reusable across codebase

**Cons:**
- Minor refactor

**Effort:** Small
**Risk:** None

## Technical Details

**Affected Files:**
- NEW: `apps/web/src/components/ui/StarRating.tsx`
- `apps/web/src/components/tenant/TenantLandingPage.tsx`
- `apps/web/src/components/tenant/sections/TestimonialsSection.tsx`

## Acceptance Criteria

- [ ] StarRating extracted to shared component
- [ ] Both usages import from shared location
- [ ] Visual output unchanged
- [ ] TypeScript passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from code review | Component duplication found |
