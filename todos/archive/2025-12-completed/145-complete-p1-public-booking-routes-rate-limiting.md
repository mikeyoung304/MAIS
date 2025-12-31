---
status: complete
priority: p1
issue_id: '145'
tags: [code-review, security, mvp-gaps, rate-limiting]
dependencies: []
---

# Missing Rate Limiting on Public Booking Routes

## Problem Statement

Public booking management and balance payment routes have NO rate limiting applied, making them vulnerable to token brute-force attacks, DoS attacks, and checkout session spam.

**Why This Matters:**

- Security vulnerability (token enumeration)
- Resource exhaustion risk (DoS)
- Stripe API cost from excessive checkout creation

## Findings

### Agent: security-sentinel

**Location:** `server/src/routes/index.ts:373-396`

**Evidence:**

```typescript
// Lines 373-396: No rate limiter middleware
app.use('/v1/public/bookings', publicBookingManagementRouter); // No rate limiting
app.use('/v1/public/bookings', publicBalancePaymentRouter); // No rate limiting
```

**Comparison - Other public endpoints ARE rate-limited:**

```typescript
// Line 370: Public tenant lookup HAS rate limiting
app.use('/v1/public/tenants', publicTenantLookupLimiter, publicTenantRoutes);
```

## Proposed Solutions

### Option A: Add Dedicated Rate Limiters (Recommended)

**Pros:** Proper security, configurable limits per action
**Cons:** None significant
**Effort:** Small (2-3 hours)
**Risk:** Low

```typescript
// server/src/middleware/rateLimiter.ts
export const publicBookingActionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes per IP
  message: 'Too many booking actions from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicBalancePaymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 checkout sessions per hour per IP
  message: 'Too many payment attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Option B: Reuse Existing Limiter

**Pros:** Minimal code change
**Cons:** May not be appropriate limits for these actions
**Effort:** Minimal
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/middleware/rateLimiter.ts`
- `server/src/routes/index.ts`

**Components:** Public booking management, balance payment

## Acceptance Criteria

- [ ] Rate limiter created for public booking actions
- [ ] Rate limiter applied to public booking management routes
- [ ] Rate limiter applied to balance payment routes
- [ ] Returns 429 Too Many Requests when limit exceeded
- [ ] Unit test verifies rate limiting works

## Work Log

| Date       | Action  | Notes                     |
| ---------- | ------- | ------------------------- |
| 2025-12-02 | Created | From MVP gaps code review |

## Resources

- PR: MVP gaps implementation (uncommitted)
- Similar: `publicTenantLookupLimiter` in rateLimiter.ts
