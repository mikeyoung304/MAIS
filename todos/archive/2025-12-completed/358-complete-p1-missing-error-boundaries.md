---
status: complete
priority: p1
issue_id: '358'
tags: [code-review, architecture, nextjs]
dependencies: []
---

# Missing Error Boundaries for App Router

## Problem Statement

No `error.tsx` files exist in the Next.js app directory. Pages with SSR failures or runtime errors will display blank screens instead of user-friendly errors.

**Why it matters:** Production crash risk - any runtime error crashes the entire page instead of showing graceful error message.

## Findings

**Location:** `apps/web/src/app/**` (all dynamic routes)

**Evidence:**

```bash
# No error.tsx files found
grep -r "error.tsx" apps/web/src/app/  # Returns nothing
```

**Missing in:**

- `/t/[slug]/error.tsx` - Tenant pages
- `/t/[slug]/book/[packageSlug]/error.tsx` - Booking pages
- `/(protected)/tenant/error.tsx` - Admin pages

**Impact:** P1 - Users see blank screen on any runtime error

## Proposed Solutions

### Option 1: Add Error Boundaries to All Dynamic Routes (Recommended)

- **Description:** Create error.tsx for each dynamic route
- **Pros:** Graceful error handling, retry capability
- **Cons:** Multiple files to create
- **Effort:** Small (1 hour)
- **Risk:** Low

### Option 2: Root-Level Error Boundary Only

- **Description:** Add single error.tsx at app level
- **Pros:** Quick implementation
- **Cons:** Less granular error handling
- **Effort:** Small (15 min)
- **Risk:** Medium - less specific errors

## Recommended Action

**FIX NOW** - Create error.tsx files for dynamic routes. Use Option 1 (error boundaries for all dynamic routes). Start with root-level error.tsx, then add to /t/[slug]/ and /(protected)/tenant/.

## Technical Details

**Files to Create:**

- `apps/web/src/app/t/[slug]/error.tsx`
- `apps/web/src/app/t/[slug]/book/[packageSlug]/error.tsx`
- `apps/web/src/app/(protected)/tenant/error.tsx`
- `apps/web/src/app/error.tsx` (fallback)

**Template:**

```typescript
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2>Something went wrong</h2>
        <button onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Error boundaries exist for all dynamic routes
- [ ] Errors display user-friendly message
- [ ] Retry button attempts to recover
- [ ] Error is logged to monitoring

## Work Log

| Date       | Action                     | Learnings                             |
| ---------- | -------------------------- | ------------------------------------- |
| 2025-12-25 | Created during code review | Missing error handling in Next.js app |

## Resources

- Next.js Error Handling: https://nextjs.org/docs/app/building-your-application/routing/error-handling
