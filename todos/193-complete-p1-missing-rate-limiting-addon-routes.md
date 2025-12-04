---
status: complete
priority: p1
issue_id: "193"
tags: [code-review, security, rate-limiting]
dependencies: []
---

# Missing Rate Limiting on Add-On CRUD Endpoints

## Problem Statement

All 5 add-on routes lack rate limiting, exposing the application to abuse. The existing patterns show that photo upload routes use `uploadLimiterIP` and `uploadLimiterTenant`, and draft autosave uses `draftAutosaveLimiter`.

### Why It Matters
- **Resource Exhaustion:** Attacker creates 10,000+ add-ons rapidly, filling database
- **DoS via Database Queries:** Rapid GET requests overwhelm database connection pool
- **Cache Poisoning Amplification:** Repeated updates force cache invalidation storms
- **Business Logic Abuse:** Create/delete loop to bypass pricing logic or corrupt analytics

## Findings

**Source:** Security Review

**Evidence:**
- Line 32 imports rate limiters but they're not applied to add-on routes
- Other tenant-admin routes apply rate limiting (pattern established)
- No rate limiter middleware visible in lines 1021-1189

**Location:** `server/src/routes/tenant-admin.routes.ts:1021-1189`

## Proposed Solutions

### Option A: Add New Rate Limiters (Recommended)
**Pros:** Precise control, follows existing patterns
**Cons:** Requires new rate limiter definitions
**Effort:** Small (15 minutes)
**Risk:** Low

1. Create rate limiters in `server/src/middleware/rateLimiter.ts`:

```typescript
export const addonReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 reads per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many add-on requests, please try again later',
});

export const addonWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 writes per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many add-on modification requests, please try again later',
});
```

2. Apply to routes:
```typescript
router.get('/addons', addonReadLimiter, async (...) => { ... });
router.get('/addons/:id', addonReadLimiter, async (...) => { ... });
router.post('/addons', addonWriteLimiter, async (...) => { ... });
router.put('/addons/:id', addonWriteLimiter, async (...) => { ... });
router.delete('/addons/:id', addonWriteLimiter, async (...) => { ... });
```

### Option B: Reuse Existing Limiters
**Pros:** No new code
**Cons:** May not be appropriate limits for add-on operations
**Effort:** Small (5 minutes)
**Risk:** Medium - limits may be too restrictive or too loose

Use `draftAutosaveLimiter` for write operations and create minimal read limiter.

## Recommended Action

Option A - Create specific rate limiters for add-on operations.

## Technical Details

**Affected Files:**
- `server/src/middleware/rateLimiter.ts`
- `server/src/routes/tenant-admin.routes.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] Rate limiters defined for add-on read/write operations
- [ ] All 5 add-on routes have rate limiting applied
- [ ] Rate limit exceeded returns 429 status
- [ ] Existing tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-03 | Created from code review | Always add rate limiting to new CRUD routes |

## Resources

- Existing Pattern: `uploadLimiterIP`, `uploadLimiterTenant` in same file
- OWASP Rate Limiting: https://owasp.org/API-Security/
