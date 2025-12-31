---
status: complete
priority: p2
issue_id: '408'
tags:
  - code-review
  - next-js
  - error-handling
  - locked-template-system
dependencies: []
---

# Missing error.tsx for Admin Pages Route

## Problem Statement

The tenant admin pages route at `/tenant/pages` does not have a dedicated error boundary. While the parent `/tenant/error.tsx` may exist, page-specific error handling provides better UX for API failures.

**Why This Matters:**

- Admin page makes API calls that can fail
- Generic error boundary may not provide context-specific recovery options
- Better debugging with page-specific error context

## Findings

**Location:** `apps/web/src/app/(protected)/tenant/pages/`

**Evidence:**

- Directory contains: `page.tsx` only
- Missing: `error.tsx`, `loading.tsx`

**Agent:** Architecture Strategist

## Proposed Solutions

### Solution 1: Add error.tsx and loading.tsx (Recommended)

```tsx
// error.tsx
'use client';
import { Button } from '@/components/ui/button';

export default function TenantPagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <h2>Unable to load page settings</h2>
      <p>{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

**Pros:**

- Specific error messaging
- Retry capability
- Consistent with other routes

**Cons:**

- Minor code addition

**Effort:** Small
**Risk:** None

## Technical Details

**Affected Files:**

- NEW: `apps/web/src/app/(protected)/tenant/pages/error.tsx`
- NEW: `apps/web/src/app/(protected)/tenant/pages/loading.tsx`

## Acceptance Criteria

- [ ] `error.tsx` created with retry button
- [ ] `loading.tsx` created with spinner
- [ ] Error boundary catches API failures gracefully
- [ ] TypeScript passes

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2025-12-25 | Created from code review | Missing error boundary in admin route |
