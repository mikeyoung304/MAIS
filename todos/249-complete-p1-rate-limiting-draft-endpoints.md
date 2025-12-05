---
status: complete
priority: p1
issue_id: '249'
tags: [code-review, landing-page, security, rate-limiting]
dependencies: []
source: 'plan-review-2025-12-04'
---

# TODO-249: Missing Rate Limiting on Draft Endpoints (DoS Vulnerability)

## Priority: P1 (Critical - Security)

## Status: Pending

## Source: Plan Review - Security Sentinel

## Problem Statement

The landing page draft endpoints (`PUT /draft`, `POST /publish`, `DELETE /draft`) have **no rate limiting**. Auto-save endpoints are particularly vulnerable to DoS attacks via rapid-fire requests.

**Why It Matters:**

- Client-side debounce (1-2s) is NOT a security control
- A malicious actor could spam draft saves to exhaust database resources
- Similar issue was identified in TODO-133 for visual editor draft endpoints
- Could impact other tenants on shared infrastructure

## Findings

### Vulnerable Endpoints

```typescript
// server/src/routes/tenant-admin-landing-page.routes.ts
PUT  /v1/tenant-admin/landing-page/draft     // No rate limiting
POST /v1/tenant-admin/landing-page/publish   // No rate limiting
DELETE /v1/tenant-admin/landing-page/draft   // No rate limiting
```

### Attack Scenario

1. Attacker obtains valid tenant JWT (or compromises tenant account)
2. Sends 1000 requests/second to `PUT /draft` endpoint
3. Each request triggers:
   - JSON parsing (~5ms)
   - Database transaction (~20ms)
   - JSON serialization (~5ms)
4. Database connection pool exhausted in seconds
5. All tenants affected (shared database)

### Existing Rate Limiting Patterns

The codebase already uses rate limiters:
```typescript
// server/src/middleware/rate-limiter.ts
export const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
export const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
```

## Proposed Solutions

### Option A: Apply uploadLimiter Pattern (Recommended)
- **Effort:** 30 minutes
- **Risk:** Low
- Create `draftLimiter` with reasonable limits
- Apply to all draft endpoints
- **Pros:** Proven pattern, simple implementation
- **Cons:** None

### Option B: Per-Tenant Rate Limiting
- **Effort:** 2 hours
- **Risk:** Low
- Create tenant-aware rate limiter using `res.locals.tenantAuth.tenantId`
- More granular control
- **Pros:** Affected tenant can't impact others
- **Cons:** More complex, requires Redis for distributed state

## Recommended Action

**Execute Option A:** Add rate limiting to draft endpoints:

```typescript
// server/src/middleware/rate-limiter.ts
export const draftLimiterIP = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second max)
  message: { error: 'Too many save requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to routes
router.put('/draft', draftLimiterIP, async (req, res) => { ... });
router.post('/publish', draftLimiterIP, async (req, res) => { ... });
router.delete('/draft', draftLimiterIP, async (req, res) => { ... });
```

## Acceptance Criteria

- [ ] `draftLimiter` created in rate-limiter.ts
- [ ] Applied to `PUT /draft` endpoint
- [ ] Applied to `POST /publish` endpoint
- [ ] Applied to `DELETE /draft` endpoint
- [ ] Rate limit: 60 requests/minute per IP
- [ ] Error response returns 429 with clear message

## Work Log

| Date       | Action  | Notes                                      |
|------------|---------|-------------------------------------------|
| 2025-12-04 | Created | Security review identified DoS risk       |
| 2025-12-05 | Closed  | Verified: draftAutosaveLimiter at rateLimiter.ts:133, applied to all 3 routes |

## Tags

code-review, landing-page, security, rate-limiting
