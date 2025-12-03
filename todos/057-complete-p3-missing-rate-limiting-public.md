---
status: complete
priority: p3
issue_id: "057"
tags: [code-review, scheduling, security, rate-limiting]
dependencies: []
---

# Missing Rate Limiting on Public Scheduling Endpoints

## Problem Statement

Public scheduling endpoints have no rate limiting. An attacker could enumerate all dates/services or DoS the availability service.

## Findings

**Location:** `server/src/routes/public-scheduling.routes.ts`

Current state:
- `GET /v1/public/services` - No rate limit
- `GET /v1/public/availability/slots` - No rate limit (expensive query!)

## Proposed Solutions

Add rate limiting middleware:

```typescript
import rateLimit from 'express-rate-limit';

const schedulingLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,             // 100 requests per minute per tenant
  keyGenerator: (req) => req.tenantId || req.ip,
});

app.use('/v1/public/scheduling', schedulingLimiter);
```

## Acceptance Criteria

- [x] Rate limit: 100 requests/minute per tenant
- [x] 429 response when limit exceeded
- [x] Consider lower limit for /availability/slots (expensive)

## Resolution

**Date:** 2025-12-03

Rate limiting has been fully implemented:

1. **Middleware Created:** `publicSchedulingLimiter` in `server/src/middleware/rateLimiter.ts`
   - 100 requests per minute per tenant/IP
   - Uses tenantId when available, falls back to normalized IP
   - Handles IPv6 addresses properly
   - Returns 429 with proper error message

2. **Applied to Routes:** All public scheduling endpoints protected via `router.use(publicSchedulingLimiter)` in `server/src/routes/public-scheduling.routes.ts`

3. **Tests Added:** 7 comprehensive tests in `server/test/middleware/rateLimiter.spec.ts`
   - Request within limit validation
   - 429 error after exceeding limit
   - TenantId vs IP keying
   - Enumeration attack prevention
   - DoS attack prevention
   - All 27 tests passing

4. **TypeScript:** All type checks pass

The implementation protects both `/services` and `/availability/slots` endpoints with the same rate limit (100/min), which is appropriate since:
- The limit is per-tenant, preventing abuse
- 100 requests/minute allows legitimate use cases
- The limit applies equally to both cheap (services list) and expensive (availability slots) queries

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during Security Sentinel review |
| 2025-12-03 | Completed | Rate limiting fully implemented and tested |
