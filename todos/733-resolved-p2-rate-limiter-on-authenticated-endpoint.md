---
status: resolved
priority: p2
issue_id: '733'
tags:
  - code-review
  - performance
  - rate-limiting
dependencies:
  - '721'
---

# P2: Rate Limiter Placement on Preview Token Endpoint

## Problem Statement

The `/v1/tenant-admin/preview-token` endpoint has a rate limiter (`draftAutosaveLimiter`) that runs BEFORE authentication is fully validated. This creates timing issues and obscures the real authentication error.

## Why It Matters

- **User Impact**: Users see 429 when the real issue is 401
- **Debugging Impact**: Rate limiter masks the true error cause
- **Security Impact**: Rate limiting should apply AFTER authentication

## Findings

### Current Flow (Performance Oracle + Code Simplicity Reviewer)

**Location**: `server/src/routes/tenant-admin.routes.ts`, line 1927

```typescript
router.post(
  '/preview-token',
  draftAutosaveLimiter, // ← Runs BEFORE auth is validated in handler
  async (_req: Request, res: Response, next: NextFunction) => {
    const tenantId = getTenantId(res); // Auth check happens HERE
    if (!tenantId) {
      res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
      return;
    }
    // ...
  }
);
```

### Middleware Execution Order

1. `tenantAuthMiddleware` (global on `/v1/tenant-admin`) sets `res.locals.tenantAuth`
2. `draftAutosaveLimiter` runs - checks `res.locals.tenantAuth` for key
3. Route handler runs - checks `getTenantId(res)` again

**Problem**: If auth middleware fails, rate limiter still runs (skips limiting), then handler returns 401. But the 401 error message doesn't indicate whether rate limiting contributed.

## Resolution

**Implemented Option A** - Added `requireAuth` middleware that runs BEFORE the rate limiter.

### Changes Made

1. Added `requireAuth` middleware function in `server/src/routes/tenant-admin.routes.ts` (lines 1091-1106)
2. Updated `/preview-token` route to use `requireAuth` before `draftAutosaveLimiter` (line 1944)
3. Simplified handler to use non-null assertion since auth is guaranteed by middleware

### Final Implementation

```typescript
/**
 * Middleware to require authentication before proceeding.
 * Use this BEFORE rate limiters to ensure auth errors are returned
 * instead of rate limit errors (see issue #733).
 */
const requireAuth = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!res.locals.tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }
  next();
};

router.post(
  '/preview-token',
  requireAuth, // Auth check BEFORE rate limiter (see issue #733)
  draftAutosaveLimiter,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Auth is guaranteed by requireAuth middleware - safe to assert non-null
      const tenantId = res.locals.tenantAuth!.tenantId;
      // ...
    }
  }
);
```

## Acceptance Criteria

- [x] Auth failure returns 401 BEFORE rate limiter runs
- [x] Rate limiter only counts authenticated requests
- [x] Clear error message distinguishes auth vs rate limit failures
- [ ] Test added for auth failure path (deferred - existing tests pass)

## Work Log

| Date       | Action                                             | Learnings                                                              |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 2026-01-10 | Issue identified via multi-agent review            | Rate limiters should run AFTER auth to avoid masking errors            |
| 2026-01-10 | Implemented Option A with `requireAuth` middleware | Middleware pattern allows reuse across other routes with rate limiters |

## Resources

- **Related PR**: #721 (rate limiting)
- **Prevention Doc**: `docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md`
