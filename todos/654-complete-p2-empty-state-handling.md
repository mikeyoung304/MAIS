---
status: pending
priority: p2
issue_id: 654
tags: [code-review, ux, edge-cases]
dependencies: []
---

# Missing Empty State Handling

## Problem Statement

If `segmentsWithPackages` is empty (no segments have packages), the component renders an empty grid with no user feedback. New tenants or tenants without active packages see a confusing blank section.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

**Current behavior:**

- Line 303: If `segmentsWithPackages.length === 1`, renders single segment
- If length is 0, falls through to multi-segment view
- Multi-segment view renders empty grid (no visible feedback)

**Source:** code-simplicity-reviewer agent

## Proposed Solutions

### Option 1: Add Empty State Check (Recommended)

Add early return with friendly message:

```typescript
// Add after segmentsWithPackages definition (around line 262)
if (segmentsWithPackages.length === 0) {
  return (
    <section id="packages" className="py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="font-serif text-3xl font-bold text-text-muted sm:text-4xl">
          Services coming soon
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-text-muted">
          We're preparing something special for you. Check back soon!
        </p>
      </div>
    </section>
  );
}
```

**Pros:**

- Clear user feedback
- Maintains brand voice
- Simple implementation

**Cons:**

- Additional render path to maintain

**Effort:** Small (10 min)
**Risk:** Low

### Option 2: Hide Section Entirely

Return null when no packages:

```typescript
if (segmentsWithPackages.length === 0) {
  return null;
}
```

**Pros:**

- Simplest solution
- No empty UI

**Cons:**

- #packages anchor won't work
- Hero CTA "View Packages" leads nowhere

**Effort:** Small (2 min)
**Risk:** Medium (broken anchor links)

## Recommended Action

Option 1 - Add empty state with friendly message

## Technical Details

**Affected files:**

- `apps/web/src/components/tenant/SegmentPackagesSection.tsx`

## Acceptance Criteria

- [ ] Empty state shows when no segments have packages
- [ ] Message matches brand voice
- [ ] #packages anchor still works
- [ ] Visual design consistent with section styling

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2026-01-08 | Created from code review | Always handle empty states explicitly |

## Resources

- BRAND_VOICE_GUIDE.md for copy style
- Code review: Segment-first browsing implementation
