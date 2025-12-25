---
status: complete
priority: p2
issue_id: '375'
tags: [code-review, error-handling, next.js]
dependencies: []
---

# P2: Missing error.tsx in _domain Routes

**Priority:** P2 (Important)
**Category:** Error Handling
**Source:** Code Review - Architecture Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The custom domain routes (`/t/_domain/*`) are missing `error.tsx` error boundaries that exist in the slug routes (`/t/[slug]/(site)/*`). Without error boundaries, errors in domain routes will bubble up to the root error handler or show raw error pages to users.

## Location

Missing files:
- `apps/web/src/app/t/_domain/error.tsx`
- `apps/web/src/app/t/_domain/about/error.tsx`
- `apps/web/src/app/t/_domain/services/error.tsx`
- `apps/web/src/app/t/_domain/faq/error.tsx`
- `apps/web/src/app/t/_domain/contact/error.tsx`

## Risk

- Poor user experience on error for custom domain users
- Inconsistent error handling between slug and domain access
- No error logging for domain route failures
- Potential exposure of stack traces in production

## Solution

Copy the error boundary pattern from slug routes to domain routes. If implementing todo-373 (shared components), error boundaries could also be shared.

Quick fix (copy existing error boundaries):
```bash
cp apps/web/src/app/t/[slug]/(site)/error.tsx apps/web/src/app/t/_domain/error.tsx
cp apps/web/src/app/t/[slug]/(site)/about/error.tsx apps/web/src/app/t/_domain/about/error.tsx
# ... etc for all routes
```

Better solution: Use a shared error boundary component that both route groups can import.

## Acceptance Criteria

- [ ] All domain routes have error.tsx files
- [ ] Error boundaries log errors with logger
- [ ] User sees friendly error message on domain routes
- [ ] Consistent error handling between slug and domain routes
- [ ] Consider shared error boundary component

## Related Files

- `apps/web/src/app/t/[slug]/(site)/error.tsx` (existing pattern)
- `apps/web/src/app/t/_domain/` (all subdirectories)
