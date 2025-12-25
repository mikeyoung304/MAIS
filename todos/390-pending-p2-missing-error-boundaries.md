---
status: pending
priority: p2
issue_id: "390"
tags:
  - next.js
  - error-handling
  - code-review
dependencies: []
---

# Missing error.tsx Boundaries in 11 Pages

## Problem Statement

11 pages in the Next.js app are missing `error.tsx` error boundaries. When these pages throw errors, they propagate to parent layouts instead of showing a graceful error UI.

## Findings

**Pages missing error.tsx:**

### Protected Tenant Routes (6 pages)
1. `apps/web/src/app/(protected)/tenant/dashboard/`
2. `apps/web/src/app/(protected)/tenant/packages/`
3. `apps/web/src/app/(protected)/tenant/payments/`
4. `apps/web/src/app/(protected)/tenant/branding/`
5. `apps/web/src/app/(protected)/tenant/domains/`
6. `apps/web/src/app/(protected)/tenant/scheduling/`

### Auth Routes (3 pages)
7. `apps/web/src/app/login/`
8. `apps/web/src/app/signup/`
9. `apps/web/src/app/forgot-password/`

### Booking Success Routes (2 pages)
10. `apps/web/src/app/t/_domain/book/success/`
11. `apps/web/src/app/t/[slug]/book/success/`

**Template exists at:** `apps/web/src/app/(protected)/tenant/error.tsx`

## Proposed Solutions

### Option 1: Add error.tsx to each directory (Recommended)
- Copy template pattern to each missing directory
- Customize error messages per context

**Pros:** Granular error handling, context-aware messages
**Cons:** More files to maintain
**Effort:** Small (copy/customize template)
**Risk:** Low

### Option 2: Add single error.tsx at route group level
- Add to `(protected)/` and `t/` route groups only
- Generic error handling for all child routes

**Pros:** Fewer files
**Cons:** Less specific error messages
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1 - Add individual error.tsx files for better UX

## Technical Details

**Template pattern:**
```typescript
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Page error boundary caught error', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] All 11 directories have error.tsx
- [ ] Error boundaries log errors to logger
- [ ] Error boundaries have "Try again" button
- [ ] TypeScript compiles without errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from multi-agent scan | Found during error handling gaps analysis |

## Resources

- Next.js Error Handling docs
- Existing template: `apps/web/src/app/(protected)/tenant/error.tsx`
