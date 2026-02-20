---
issue_id: 11043
status: pending
priority: p2
tags: [code-quality, google-calendar, duplication]
effort: Small
---

# P2: Calendar Route Inline Auth Guard Duplication

## Problem Statement

An inline auth guard is repeated 4 times in `tenant-admin-calendar.routes.ts` even though `requireAuth` middleware already exists and is used in `tenant-admin-shared.ts`. This violates DRY and creates a maintenance hazard — a future change to auth logic must be applied in all 4 places or a security regression is introduced silently.

## Findings

- File: `server/src/routes/tenant-admin-calendar.routes.ts`
- The inline guard pattern appears 4 times across the route handlers in that file.
- `requireAuth` middleware is already defined and exported from `server/src/routes/tenant-admin-shared.ts`.
- The duplication is purely incidental — the shared middleware was not applied when these routes were added.

## Proposed Solutions

Replace the 4 duplicate inline auth guards with a single `requireAuth` middleware applied at the router level (or at each route). The shared middleware already handles the auth check correctly; no behavioral change is needed, only consolidation.

```typescript
// Before: inline guard in each handler
if (!req.tenantAuth) return res.status(401).json({ error: 'Unauthorized' });

// After: middleware applied once at router level
router.use(requireAuth);
```

## Acceptance Criteria

- [ ] The 4 inline auth guard duplications in `tenant-admin-calendar.routes.ts` are removed.
- [ ] `requireAuth` middleware from `tenant-admin-shared.ts` is applied to cover all 4 routes.
- [ ] No behavioral change — auth still required on all previously guarded routes.
- [ ] Existing calendar route tests continue to pass.
- [ ] TypeScript typecheck passes.

## Work Log

_(empty)_
