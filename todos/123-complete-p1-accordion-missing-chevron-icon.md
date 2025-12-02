---
status: complete
priority: p1
issue_id: "123"
tags: [code-review, accessibility, ux, pr-12]
dependencies: []
---

# No Visual Indicator of Accordion Open/Closed State

## Problem Statement

The accordion sections have no icon or visual cue indicating whether they are expanded or collapsed. The native disclosure triangle was removed but no replacement was added.

**Why it matters:**
- Users cannot visually determine if section is expanded or collapsed
- Violates WCAG 2.1 Success Criterion 1.3.1 (Info and Relationships)
- Confusing UX, especially with multiple segments
- Standard UX pattern expects chevron/arrow indicator

## Findings

**Source:** Frontend Architecture Expert agent review of PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx`
**Lines:** 205-208

**Current Code:**
```typescript
<summary className="... list-none [&::-webkit-details-marker]:hidden">
  <span className="text-text-primary">
    {segment.name} <span className="font-normal text-text-muted">({segment.packages.length})</span>
  </span>
</summary>
```

**Problem:** `[&::-webkit-details-marker]:hidden` removes default triangle, but no replacement icon added.

## Proposed Solutions

### Solution 1: Add Rotating Chevron (Recommended)
```typescript
import { ChevronRight } from "lucide-react";

<summary className="... group">
  <span className="flex items-center gap-2">
    <ChevronRight className="w-5 h-5 text-sage transition-transform group-open:rotate-90" />
    <span className="text-text-primary">
      {segment.name} <span className="font-normal text-text-muted">({segment.packages.length})</span>
    </span>
  </span>
  {/* ... buttons ... */}
</summary>
```

Note: `group-open` is a Tailwind variant that targets `<details open>`.

**Pros:** Clear visual indicator, standard UX pattern, accessible
**Cons:** Adds icon import (lucide-react already used)
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

Implement Solution 1 immediately. This is a WCAG compliance issue.

## Technical Details

**Affected Files:**
- `client/src/features/tenant-admin/TenantPackagesManager.tsx` (lines 205-208)

**Note:** May need to add `group` class to `<details>` element for `group-open` to work.

## Acceptance Criteria

- [ ] Chevron icon visible next to segment name
- [ ] Chevron rotates 90° when accordion opens
- [ ] Smooth rotation animation (transition-transform)
- [ ] Uses sage color from design system
- [ ] Works in all browsers

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12
- Tailwind group-open: https://tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-parent-state
