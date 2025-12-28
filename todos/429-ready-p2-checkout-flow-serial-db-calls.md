---
status: ready
priority: p2
issue_id: '429'
tags: [performance, checkout, optimization]
dependencies: []
---

# Checkout Flow Has Serial Database Calls

## Problem Statement

The `CheckoutSessionFactory.createCheckoutSession()` method makes 4-5 sequential database calls that could be parallelized, adding unnecessary latency to the checkout flow.

## Severity: P2 - MEDIUM

Adds ~50-100ms latency to checkout. Not critical but affects user experience.

## Findings

- Location: `server/src/services/checkout-session.factory.ts:60-125`
- Sequential calls: tenant fetch, idempotency check, idempotency store, Stripe call, idempotency update

## Current Flow (Sequential)

```typescript
// Line 65 - DB call 1
const tenant = await this.tenantRepo.findById(tenantId);

// Line 72 - Generate key (CPU)
const idempotencyKey = this.idempotencyService.generateCheckoutKey(...);

// Line 75 - DB call 2
const cachedResponse = await this.idempotencyService.getStoredResponse(idempotencyKey);

// Line 82 - DB call 3
const isNew = await this.idempotencyService.checkAndStore(idempotencyKey);

// Lines 85-92 - Race condition handling with 100ms sleep
await new Promise((resolve) => setTimeout(resolve, 100));

// Lines 99-116 - Stripe API call 4
session = await this.paymentProvider.createCheckoutSession(...);

// Line 119 - DB call 5
await this.idempotencyService.updateResponse(idempotencyKey, {...});
```

## Proposed Solution

Parallelize independent operations:

```typescript
async createCheckoutSession(params: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
  const idempotencyKey = this.idempotencyService.generateCheckoutKey(...);

  // Parallelize: tenant fetch + idempotency check (independent)
  const [tenant, cachedResponse] = await Promise.all([
    this.tenantRepo.findById(tenantId),
    this.idempotencyService.getStoredResponse(idempotencyKey),
  ]);

  if (!tenant) throw new NotFoundError('Tenant not found');

  // Return cached if exists
  if (cachedResponse) {
    return { checkoutUrl: cachedResponse.data.url };
  }

  // ... rest of flow
}
```

## Technical Details

- **Affected Files**: `server/src/services/checkout-session.factory.ts`
- **Estimated Latency Improvement**: 50-100ms (one DB roundtrip saved)
- **Risk**: Low - operations are independent

## Acceptance Criteria

- [ ] Tenant fetch and idempotency check run in parallel
- [ ] No change to functional behavior
- [ ] Checkout flow latency reduced by ~50ms (measure before/after)

## Review Sources

- Performance Oracle: P2 - Serial database calls

## Notes

Source: Parallel code review session on 2025-12-26
Also noted: 100ms hardcoded sleep for race conditions could use exponential backoff starting at 50ms
