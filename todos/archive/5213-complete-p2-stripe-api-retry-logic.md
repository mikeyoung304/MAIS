---
status: complete
priority: p2
issue_id: '5213'
tags: [code-review, stripe, resilience, performance]
dependencies: ['5210']
---

# Missing Stripe API Retry Logic for Transient Failures

## Problem Statement

Stripe API calls have no retry logic for transient failures (network timeouts, 5xx errors). A single network blip fails the entire booking attempt, requiring the customer to start over.

**Why it matters:** Network issues are common. Without retry, booking conversion drops during infrastructure hiccups.

## Findings

**Location:** `server/src/adapters/stripe.adapter.ts`

**Current Pattern:**

```typescript
// Single attempt, no retry
const session = await stripe.checkout.sessions.create(params);
// If this fails, error propagates immediately
```

**Missing:**

- Exponential backoff for 5xx errors
- Retry for network timeouts
- Circuit breaker for sustained failures

**Reviewer:** Performance Oracle (PO-002)

## Proposed Solutions

### Option A: Add Retry with Exponential Backoff (Recommended)

**Pros:** Handles transient failures, industry standard
**Cons:** Increases max latency for failures
**Effort:** Small
**Risk:** Low

```typescript
import { retry } from '@/lib/resilience';

async createCheckoutSession(params: CheckoutParams) {
  return retry(
    () => this.stripe.checkout.sessions.create(params, {
      idempotencyKey: params.idempotencyKey,
    }),
    {
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 2000,
      retryOn: (error) =>
        error.type === 'StripeConnectionError' ||
        error.statusCode >= 500,
    }
  );
}
```

### Option B: Use Stripe SDK Built-in Retry

**Pros:** Zero custom code
**Cons:** Less control
**Effort:** Trivial
**Risk:** Low

```typescript
const stripe = new Stripe(apiKey, {
  maxNetworkRetries: 3, // SDK handles retry
});
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/adapters/stripe.adapter.ts`

**Retry Strategy:**

- Max 3 attempts
- Exponential backoff: 100ms, 200ms, 400ms
- Only retry on:
  - `StripeConnectionError` (network issues)
  - 5xx status codes (server errors)
- Never retry on:
  - 4xx errors (client errors, card declined)
  - `StripeCardError`

**Idempotency Dependency:**
Must fix #5210 (idempotency keys) first - retry without proper idempotency causes double charges.

## Acceptance Criteria

- [ ] Stripe calls retry on transient failures
- [ ] Exponential backoff between retries
- [ ] No retry on permanent failures (4xx)
- [ ] Idempotency keys work correctly with retry
- [ ] Metrics track retry counts

## Work Log

| Date       | Action                         | Learnings                                      |
| ---------- | ------------------------------ | ---------------------------------------------- |
| 2026-01-24 | Created from /workflows:review | Performance reviewer found missing retry logic |

## Resources

- Review: Performance Oracle
- Stripe SDK retry: https://stripe.com/docs/error-handling
- Dependency: #5210 (idempotency keys)
