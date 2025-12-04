---
status: complete
priority: p2
issue_id: '067'
tags: [code-review, security, rate-limiting, performance]
dependencies: []
---

# Rate Limiting is Per-IP, Not Per-Tenant (Abuse Prevention Gap)

## Problem Statement

The upload rate limiter uses IP-based limiting (100 uploads/hour/IP), which doesn't prevent per-tenant abuse. A single tenant with dynamic IPs can bypass limits, while shared IPs (corporate NAT) unfairly punish multiple tenants. No storage quota enforcement exists.

**Why This Matters:**

- One tenant can exhaust storage quota (cost explosion)
- Mobile users with changing IPs bypass limits
- Corporate users behind NAT share rate limit unfairly
- No defense against storage exhaustion attacks

## Findings

### Evidence from Code Review

**Current Implementation:**

```typescript
// rateLimiter.ts
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 500 : 100, // per IP
  // No tenant-level limiting
});
```

**Attack Scenario:**

```
Malicious tenant uses 10 different IPs (VPN/mobile):
- 10 IPs × 100 uploads/hour × 5MB = 5GB/hour storage consumption
- No per-tenant limit stops this
- Supabase storage bill explodes
```

### Performance Oracle & Security Sentinel Assessment

- HIGH: Single tenant can exhaust storage resources
- Shared IPs punish legitimate multi-tenant usage
- No storage quota enforcement at all

## Proposed Solutions

### Option A: Multi-Layer Rate Limiting (Recommended)

**Description:** IP-level + tenant-level rate limits, plus storage quota.

**Pros:**

- Protects against distributed attacks (IP layer)
- Protects against single-tenant abuse (tenant layer)
- Fair to all tenants

**Cons:**

- More complex middleware chain
- Two rate limit checks per request
- Requires tenant ID extraction before limit check

**Effort:** Medium (2-3 hours)
**Risk:** Low

```typescript
// IP-level (DDoS protection)
export const uploadLimiterIP = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200, // Higher limit for shared IPs
  keyGenerator: (req) => req.ip,
  message: { error: 'too_many_uploads_ip' },
});

// Tenant-level (quota enforcement)
export const uploadLimiterTenant = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50, // Per tenant per hour
  keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId || req.ip,
  skip: (req, res) => !res.locals.tenantAuth, // Only apply to authenticated
  message: { error: 'too_many_uploads_tenant' },
});

// Route usage
router.post(
  '/segment-image',
  uploadLimiterIP, // Layer 1
  uploadLimiterTenant // Layer 2
  // ... rest of middleware
);
```

### Option B: Tenant-Only Rate Limiting

**Description:** Replace IP-based with tenant-based limiting.

**Pros:**

- Simpler (single layer)
- Fair per-tenant limits

**Cons:**

- No IP-level DDoS protection
- Unauthenticated requests unprotected

**Effort:** Small (1 hour)
**Risk:** Medium

### Option C: Add Storage Quota Enforcement

**Description:** Track storage per tenant, reject uploads when quota exceeded.

**Pros:**

- Hard limit on storage abuse
- Cost control

**Cons:**

- Database schema change required
- Need to track all uploads

**Effort:** Medium (3-4 hours)
**Risk:** Low

## Recommended Action

**Option A: Multi-Layer Rate Limiting** - comprehensive protection without schema changes. Add **Option C** as follow-up.

## Technical Details

**Affected Files:**

- `server/src/middleware/rateLimiter.ts` - Add tenant-level limiter
- `server/src/routes/tenant-admin.routes.ts` - Apply both limiters

## Acceptance Criteria

- [ ] IP-level rate limiter (200/hour) for DDoS protection
- [ ] Tenant-level rate limiter (50/hour) for abuse prevention
- [ ] Both applied to upload endpoints
- [ ] Test: Single IP can do 200 uploads
- [ ] Test: Single tenant limited to 50 uploads regardless of IP count

## Work Log

| Date       | Action  | Notes                                         |
| ---------- | ------- | --------------------------------------------- |
| 2025-11-29 | Created | Found during code review - Performance Oracle |

## Resources

- express-rate-limit docs: https://www.npmjs.com/package/express-rate-limit
- keyGenerator option for custom keys
