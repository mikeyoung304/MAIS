---
status: closed
priority: p2
issue_id: '578'
tags: [code-review, architecture, nextjs, error-handling]
dependencies: []
closed_date: '2026-01-01'
closed_reason: 'Invalid finding - Parent routes have error boundaries that cover child routes'
---

# P2: Missing Error Boundaries in Dynamic Routes

## Problem Statement

Several Next.js dynamic routes are **missing `error.tsx`** files. Without error boundaries, unhandled errors crash the entire page tree instead of showing a graceful error state.

**Affected routes:**

- `/tenant/pages/[pageType]/` - Missing error.tsx
- `/tenant/landing-page/` - Missing error.tsx
- `/tenant/settings/` - Missing error.tsx

## Findings

**Identified by:** Architecture Strategist agent

**Impact:**

- Database/API errors crash entire admin section
- Users see generic Next.js error page
- No error telemetry at page level
- Poor user experience during outages

**Next.js App Router behavior:**

- Without `error.tsx`, errors bubble up to nearest error boundary
- If no boundary exists, shows generic error page
- Production errors may expose sensitive information

## Proposed Solutions

### Option A: Add error.tsx to All Dynamic Routes (Recommended)

**Pros:** Complete coverage, consistent UX
**Cons:** Some boilerplate
**Effort:** Small (1-2 hours)
**Risk:** Low

### Option B: Add Root-Level Error Boundary Only

**Pros:** Less files
**Cons:** Less granular error recovery
**Effort:** Small
**Risk:** Low

## Recommended Action

**Choose Option A** - Add error.tsx to each dynamic route

## Technical Details

**Template for error.tsx:**

```tsx
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
    logger.error('Page error:', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">We couldn't load this page. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

**Files to create:**

- `apps/web/src/app/(protected)/tenant/pages/[pageType]/error.tsx`
- `apps/web/src/app/(protected)/tenant/landing-page/error.tsx`
- `apps/web/src/app/(protected)/tenant/settings/error.tsx`

## Acceptance Criteria

- [ ] All dynamic routes have error.tsx files
- [ ] Error boundaries log to Sentry/logger
- [ ] Reset button allows retry
- [ ] Error messages are user-friendly (no stack traces)
- [ ] Add CI check to enforce error.tsx in dynamic routes

## Work Log

| Date       | Action  | Notes                                  |
| ---------- | ------- | -------------------------------------- |
| 2026-01-01 | Created | Found during comprehensive code review |

## Resources

- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- Existing error.tsx files in codebase for reference
