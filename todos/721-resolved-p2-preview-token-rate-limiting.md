---
status: pending
priority: p2
issue_id: '721'
tags:
  - code-review
  - security
  - preview-system
dependencies: []
---

# P2: Missing Rate Limiting on Preview Token Generation Endpoint

## Problem Statement

The `POST /v1/tenant-admin/preview-token` endpoint lacks dedicated rate limiting. While admin routes have general rate limiting, preview token generation is a JWT-signing operation that could be abused for CPU exhaustion or token collection.

## Findings

**Location:** `server/src/routes/tenant-admin.routes.ts` (lines 1925-1956)

**Current Code:**

```typescript
router.post('/preview-token', async (_req: Request, res: Response, next: NextFunction) => {
  // No rate limiter applied
```

**Risk:**

- An authenticated attacker could flood the endpoint to generate thousands of tokens
- Could consume server CPU for JWT signing operations
- Fill logs with token generation entries

**Comparison:** Other similar endpoints use dedicated rate limiters:

- `draftAutosaveLimiter` for draft endpoints
- `addonReadLimiter` / `addonWriteLimiter` for add-on endpoints
- `uploadLimiterTenant` for upload endpoints

## Proposed Solutions

### Option A: Add Dedicated Rate Limiter (Recommended)

**Effort:** Small (15 min)
**Risk:** Low

Create a `previewTokenLimiter` similar to existing limiters:

```typescript
// In middleware/rateLimiter.ts
export const previewTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 tokens per minute per tenant
  message: { error: 'Too many preview token requests' },
  keyGenerator: (req) => req.tenantAuth?.tenantId || req.ip,
});

// In tenant-admin.routes.ts
router.post('/preview-token', previewTokenLimiter, async (_req, res, next) => {
```

### Option B: Reuse Existing Limiter

**Effort:** Tiny (5 min)
**Risk:** Low

Use `draftAutosaveLimiter` which has reasonable limits:

```typescript
router.post('/preview-token', draftAutosaveLimiter, async (_req, res, next) => {
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/routes/tenant-admin.routes.ts`
- `server/src/middleware/rateLimiter.ts`

**Components:**

- Preview token endpoint
- Rate limiting middleware

## Acceptance Criteria

- [ ] Rate limiter added to `/preview-token` endpoint
- [ ] Limit is tenant-scoped (not just IP-based)
- [ ] Returns appropriate 429 status on rate limit exceeded
- [ ] Existing tests still pass

## Work Log

| Date       | Action                   | Learnings                                          |
| ---------- | ------------------------ | -------------------------------------------------- |
| 2026-01-10 | Created from code review | Security-sentinel identified missing rate limiting |

## Resources

- Security review agent findings
- Similar patterns in same file (upload, addon endpoints)
