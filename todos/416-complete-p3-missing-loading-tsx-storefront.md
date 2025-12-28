---
status: complete
priority: p3
issue_id: '416'
tags:
  - code-review
  - next-js
  - ux
  - locked-template-system
dependencies: []
---

# Missing loading.tsx Files for Storefront Routes

## Problem Statement

Storefront page routes lack `loading.tsx` files for Suspense boundaries, resulting in no loading state during navigation.

**Why This Matters:**

- User sees blank screen during route transitions
- Perceived performance is worse
- Inconsistent with admin routes which may have loading states

## Findings

**Location:** `apps/web/src/app/t/[slug]/(site)/`

**Evidence:**

- `about/`, `services/`, `faq/`, `contact/` have error.tsx but no loading.tsx
- New `gallery/` and `testimonials/` routes also missing loading.tsx

**Agent:** Performance Oracle, Pattern Recognition Specialist

## Proposed Solutions

### Solution 1: Add loading.tsx to Each Route (Recommended)

Create skeleton loading states for each page type.

```tsx
// loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-10 w-1/3 bg-neutral-200 rounded" />
        <div className="mt-6 h-4 w-2/3 bg-neutral-200 rounded" />
      </div>
    </div>
  );
}
```

**Pros:**

- Better perceived performance
- Consistent UX

**Cons:**

- Additional files to maintain

**Effort:** Small
**Risk:** None

### Solution 2: Add loading.tsx at Layout Level

Single loading state for all child routes.

**Pros:**

- Less duplication

**Cons:**

- Generic loading, less contextual

**Effort:** Small
**Risk:** None

## Technical Details

**Affected Files:**

- NEW: Multiple `loading.tsx` files in storefront routes

## Acceptance Criteria

- [ ] Loading states added to storefront routes
- [ ] Skeleton matches page structure
- [ ] TypeScript passes

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2025-12-25 | Created from code review | Missing Suspense boundaries |
