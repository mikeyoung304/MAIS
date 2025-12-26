---
status: ready
priority: p2
issue_id: "425"
tags: [test, mock, stripe, idempotency]
dependencies: []
---

# Mock Stripe Adapter Not Respecting Idempotency Keys

## Problem Statement
The mock Stripe adapter generates new checkout session URLs for each call, ignoring idempotency keys. This causes the payment flow integration test to fail when verifying that duplicate requests with the same idempotency key return identical URLs.

## Findings
- Location: `server/test/integration/payment-flow.integration.spec.ts:283`
- Test: `should enforce idempotency: duplicate checkout request returns same URL`
- Expected: Same URL for same idempotency key
- Actual: Different URLs each call (`session_1766776211483` vs `session_1766776209877`)
- Mock adapter location: `server/src/adapters/mock/stripe.adapter.ts`

## Proposed Solutions

### Option 1: Add Idempotency Cache to Mock Adapter (Recommended)
- Add `Map<string, CheckoutSession>` to mock adapter
- Check cache before generating new session
- Return cached session if idempotency key exists
- **Pros**: Properly simulates real Stripe behavior
- **Cons**: Slightly more complex mock
- **Effort**: Small
- **Risk**: Low

### Option 2: Skip Idempotency Test in Mock Mode
- Mark test as `skip` when using mock adapter
- Only run against real Stripe in integration env
- **Pros**: Quick fix
- **Cons**: Loses test coverage, bad practice
- **Effort**: Small
- **Risk**: Medium (reduced coverage)

## Recommended Action
Option 1: Add idempotency key caching to the mock Stripe adapter. This properly simulates Stripe's idempotency behavior and validates our code handles it correctly.

```typescript
// Pseudocode for fix
private idempotencyCache = new Map<string, CheckoutSession>();

async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
  if (params.idempotencyKey && this.idempotencyCache.has(params.idempotencyKey)) {
    return this.idempotencyCache.get(params.idempotencyKey)!;
  }

  const session = { /* generate new session */ };

  if (params.idempotencyKey) {
    this.idempotencyCache.set(params.idempotencyKey, session);
  }

  return session;
}
```

## Technical Details
- **Affected Files**: `server/src/adapters/mock/stripe.adapter.ts`
- **Related Components**: PaymentService, CheckoutSession flow
- **Database Changes**: No

## Acceptance Criteria
- [ ] Mock adapter caches sessions by idempotency key
- [ ] Duplicate requests with same key return identical URL
- [ ] `payment-flow.integration.spec.ts` idempotency test passes
- [ ] Cache cleared between test runs (or per-instance)

## Work Log

### 2025-12-26 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue identified from test failure analysis
- Root cause: mock adapter missing idempotency simulation
- Status: ready

**Learnings:**
- Mock adapters should simulate key behaviors of real services
- Idempotency is critical for payment flows

## Notes
Source: Triage session on 2025-12-26
Related test output: Background task b018b77
