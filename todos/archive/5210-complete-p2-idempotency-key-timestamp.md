---
status: complete
priority: p2
issue_id: '5210'
tags: [code-review, stripe, idempotency, booking, data-integrity]
dependencies: []
---

# Idempotency Keys Include Date.now() - Defeats Retry Safety

## Problem Statement

Idempotency keys include `Date.now()`, which generates a NEW key on every retry attempt. This defeats the purpose of idempotency - if a Stripe API call fails transiently and is retried, it creates a new charge instead of resuming the original.

**Why it matters:** Double charges are a P0 incident. Customers get charged twice, requiring manual refunds and damaging trust.

## Findings

**Location:** `server/src/services/booking.service.ts`, `server/src/adapters/stripe.adapter.ts`

**Evidence:**

```typescript
// WRONG - Different key on every call
const idempotencyKey = `booking-${tenantId}-${packageId}-${Date.now()}`;

// Retry after 500ms timeout...
const idempotencyKey = `booking-${tenantId}-${packageId}-${Date.now()}`; // Different!
```

**Why This Fails:**

1. First attempt: key = `booking-abc-pkg-1706123456789`
2. Network timeout (Stripe received request but response lost)
3. Retry: key = `booking-abc-pkg-1706123456800` (NEW KEY!)
4. Stripe creates SECOND charge

**Reviewer:** Data Integrity Guardian (DI-001, DI-002, DI-003, DI-004)

## Proposed Solutions

### Option A: Use Deterministic Components Only (Recommended)

**Pros:** True idempotency, safe retries
**Cons:** Requires stable identifier
**Effort:** Small
**Risk:** Low

```typescript
// Use only stable identifiers
const idempotencyKey = `checkout-${tenantId}-${bookingRequestId}`;

// Or use customer email + package + date
const idempotencyKey = `checkout-${tenantId}-${email}-${packageId}-${selectedDate}`;
```

### Option B: Generate Key Once and Pass Through

**Pros:** Complete control
**Cons:** More plumbing
**Effort:** Small
**Risk:** Low

```typescript
// Generate at entry point, pass to all calls
const bookingAttempt = {
  id: generateCUID(),
  idempotencyKey: `booking-${generateCUID()}`, // Generate ONCE
  ...params,
};
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/services/booking.service.ts`
- `server/src/adapters/stripe.adapter.ts`
- `server/src/services/checkout-session.factory.ts`

**Stripe Idempotency Rules:**

- Keys must be unique per distinct operation
- Same key with same params = Stripe returns cached response
- Same key with different params = Stripe returns error
- Keys expire after 24 hours

**Pattern to Follow:**

```typescript
// At request entry point
const requestId = req.headers['x-request-id'] || generateCUID();

// Pass through to Stripe calls
await stripe.checkout.sessions.create(params, {
  idempotencyKey: `checkout-${tenantId}-${requestId}`,
});
```

## Acceptance Criteria

- [ ] Idempotency keys do not include Date.now()
- [ ] Keys are deterministic for same booking attempt
- [ ] Retry of same request uses same key
- [ ] Different bookings get different keys
- [ ] Integration test verifies idempotency behavior

## Work Log

| Date       | Action                         | Learnings                                          |
| ---------- | ------------------------------ | -------------------------------------------------- |
| 2026-01-24 | Created from /workflows:review | Data Integrity found timestamp in idempotency keys |

## Resources

- Review: Data Integrity Guardian
- Stripe Idempotency: https://stripe.com/docs/api/idempotent_requests
- ADR-002: Webhook idempotency pattern
