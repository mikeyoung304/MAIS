---
status: pending
priority: p2
issue_id: '639'
tags: [code-review, architecture, ux, nextjs]
dependencies: []
---

# Missing loading.tsx Files for Scheduling Routes

## Problem Statement

The scheduling routes under `/tenant/scheduling/*` do not have `loading.tsx` files, while other tenant routes (e.g., `/tenant/pages/`, `/tenant/build/`) do have them. This creates inconsistent user experience during navigation.

## Findings

**Source:** Architecture Strategist review of Legacy-to-Next.js Migration

**Location:** `apps/web/src/app/(protected)/tenant/scheduling/`

**Impact:**

- Flash of unstyled content during navigation
- Layout shift as loading states are handled inline in `'use client'` pages
- Inconsistent with established patterns

**Routes missing loading.tsx:**

- `/tenant/scheduling/` (overview)
- `/tenant/scheduling/appointment-types/`
- `/tenant/scheduling/availability/`
- `/tenant/scheduling/appointments/`
- `/tenant/scheduling/blackouts/`

## Proposed Solutions

### Option A: Add loading.tsx to each route (Recommended)

**Pros:** Consistent UX, follows established pattern
**Cons:** 5 new files
**Effort:** Low (copy pattern from `/tenant/pages/loading.tsx`)
**Risk:** None

Example pattern:

```tsx
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sage" />
    </div>
  );
}
```

### Option B: Add loading.tsx only to parent layout

**Pros:** Single file
**Cons:** May not provide granular loading states for each sub-route
**Effort:** Very Low
**Risk:** Low - may still see flashes on direct navigation

## Recommended Action

Option A - Add loading.tsx to each route for consistent UX.

## Technical Details

### Affected Files

- `apps/web/src/app/(protected)/tenant/scheduling/loading.tsx` (create)
- `apps/web/src/app/(protected)/tenant/scheduling/appointment-types/loading.tsx` (create)
- `apps/web/src/app/(protected)/tenant/scheduling/availability/loading.tsx` (create)
- `apps/web/src/app/(protected)/tenant/scheduling/appointments/loading.tsx` (create)
- `apps/web/src/app/(protected)/tenant/scheduling/blackouts/loading.tsx` (create)

## Acceptance Criteria

- [ ] All 5 scheduling routes have loading.tsx files
- [ ] Loading state uses sage spinner (consistent with other routes)
- [ ] No layout shift during navigation

## Work Log

| Date       | Action                   | Learnings                            |
| ---------- | ------------------------ | ------------------------------------ |
| 2026-01-05 | Created from code review | Follow existing loading.tsx patterns |

## Resources

- Pattern reference: `apps/web/src/app/(protected)/tenant/pages/loading.tsx`
- Next.js docs: https://nextjs.org/docs/app/building-your-application/routing/loading-ui
