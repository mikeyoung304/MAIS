---
status: pending
priority: p1
issue_id: '5232'
tags: [code-review, security, project-hub, rate-limiting]
dependencies: []
created_at: 2026-01-21
pr: 31
---

# P1: Missing Rate Limiting on Tenant Admin Project Routes

> **Security Review:** Authenticated tenant routes lack rate limiting, enabling DoS attacks.

## Problem Statement

The tenant admin project routes (`createTenantAdminProjectRoutes`) do not apply any rate limiting. While protected by tenant authentication, a compromised or malicious tenant account could abuse endpoints to perform rapid bulk operations affecting system performance.

**File:** `server/src/routes/tenant-admin-projects.routes.ts`
**Lines:** 51-293 (entire router)

**Evidence:**

```typescript
export function createTenantAdminProjectRoutes(projectHubService: ProjectHubService): Router {
  const router = Router();
  // NO RATE LIMITER APPLIED!

  router.get('/bootstrap', async (req, res, next) => { ... });
  router.get('/', async (req, res, next) => { ... });
  router.post('/requests/approve', async (req, res, next) => { ... });
  // ...
}
```

**Risk:** A compromised tenant account or malicious insider could:

- Spam approve/deny requests at high volume
- Exhaust database connections
- Impact performance for other tenants

## Findings

| Reviewer           | Finding                                                  |
| ------------------ | -------------------------------------------------------- |
| Security Sentinel  | P1: Missing rate limiting on authenticated tenant routes |
| Performance Oracle | P2: Potential DoS vector through bulk operations         |

## Proposed Solutions

### Option A: Add Tenant-Specific Rate Limiter (Recommended)

```typescript
import rateLimit from 'express-rate-limit';

const tenantProjectRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Higher limit for authenticated tenant users
  message: { error: 'Too many requests. Please wait a moment.' },
  keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

export function createTenantAdminProjectRoutes(projectHubService: ProjectHubService): Router {
  const router = Router();
  router.use(tenantProjectRateLimiter);
  // ...
}
```

**Pros:** Per-tenant isolation, consistent with other tenant routes
**Cons:** None significant
**Effort:** Small (30 minutes)
**Risk:** Low

### Option B: Use Centralized Rate Limiter

Import and use rate limiter from `/server/src/middleware/rateLimiter.ts`.

**Pros:** Consistent configuration across routes
**Cons:** May need adjustment for tenant-specific keying
**Effort:** Small (15 minutes)
**Risk:** Low

## Recommended Action

**Option A** - Add tenant-specific rate limiter with higher limits than public routes (500 vs 100 requests per 15 min).

## Technical Details

**Affected Files:**

- `server/src/routes/tenant-admin-projects.routes.ts`

**Acceptance Criteria:**

- [ ] Rate limiter applied to all tenant admin project routes
- [ ] Key is tenant ID, not IP (for proper multi-tenant isolation)
- [ ] Rate limit is reasonable for legitimate use (500/15min)
- [ ] Error message is user-friendly
- [ ] Matches existing pattern in other tenant-admin routes

## Work Log

| Date       | Action                          | Learnings                                            |
| ---------- | ------------------------------- | ---------------------------------------------------- |
| 2026-01-21 | Created from PR #31 code review | All API routes need rate limiting regardless of auth |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
- Existing rate limiter: `server/src/middleware/rateLimiter.ts`
