---
status: complete
priority: p0
issue_id: '426'
tags: [security, payments, idempotency, stripe, critical]
dependencies: []
completed_at: '2025-12-27'
resolution: 'fixed'
---

> **FIXED** on 2025-12-27: Removed timestamp from idempotency keys.
> generateCheckoutKey, generateRefundKey, and generateTransferKey now use deterministic keys
> based on operation identity only (not request timing). This prevents double-charge risk.

# CRITICAL: Idempotency Key Timestamp Causes Double-Charge Risk

## Problem Statement

The `generateCheckoutKey()` method in `IdempotencyService` includes a timestamp component that rounds to 10-second windows. If two checkout requests straddle a 10-second boundary, they receive DIFFERENT idempotency keys, potentially causing double Stripe charges.

## Severity: P0 - CRITICAL

This is a **production payment safety issue** that could result in customers being charged twice for the same booking.

## Findings

- Location: `server/src/services/idempotency.service.ts:374-391`
- Also affects: `generateRefundKey()` (lines 401-409) and `generateTransferKey()` (lines 420-434)
- Root cause: `Math.floor(timestamp / 10000) * 10000` creates 10-second buckets

## Example Failure Scenario

1. User clicks "Pay Now" at T=9.9 seconds → idempotency key uses bucket `0`
2. Network latency, page refreshes at T=10.1 seconds → idempotency key uses bucket `10000`
3. These are DIFFERENT keys → Two separate Stripe checkout sessions → **Double charge**

## Test Evidence

```
FAIL test/integration/payment-flow.integration.spec.ts
  > should enforce idempotency: duplicate checkout request returns same URL

Expected: "https://checkout.stripe.test/session_1766784571263"
Received: "https://checkout.stripe.test/session_1766784569547"
```

## Proposed Solutions

### Option 1: Remove Timestamp from Key (Recommended)

Remove the timestamp parameter entirely. Use only business-identity fields:

```typescript
generateCheckoutKey(
  tenantId: string,
  email: string,
  packageId: string,
  eventDate: string
): string {
  // No timestamp - deterministic key
  return this.generateKey('checkout', tenantId, email, packageId, eventDate);
}
```

- **Pros**: Simple, deterministic, prevents all boundary issues
- **Cons**: Same user can't book same package for same date twice (intentional protection)
- **Effort**: 2 hours
- **Risk**: Low

### Option 2: Use Session-Based Key

Pass a client-generated session UUID instead of timestamp:

```typescript
generateCheckoutKey(tenantId, email, packageId, eventDate, sessionUUID);
```

- **Pros**: Allows retries within same session, prevents cross-session duplicates
- **Cons**: Requires frontend changes to generate/persist UUID
- **Effort**: 4 hours
- **Risk**: Medium

## Recommended Action

Option 1: Remove timestamp entirely. The combination of (tenantId, email, packageId, eventDate) is already unique enough for idempotency purposes.

## Technical Details

- **Affected Files**:
  - `server/src/services/idempotency.service.ts`
  - `server/src/services/checkout-session.factory.ts` (caller)
  - `server/src/services/wedding-booking.orchestrator.ts` (caller)
  - `server/src/services/appointment-booking.service.ts` (caller)
- **Related Components**: PaymentProvider, Stripe Connect checkout
- **Database Changes**: No

## Acceptance Criteria

- [ ] Timestamp removed from `generateCheckoutKey()`, `generateRefundKey()`, `generateTransferKey()`
- [ ] Payment flow integration tests pass consistently (no flakiness)
- [ ] Same (tenant, email, package, date) always produces same idempotency key
- [ ] Manual test: rapid double-click on checkout returns same URL

## Review Sources

- Security Sentinel: P1 - CRITICAL vulnerability
- Data Integrity Guardian: CRITICAL - DATA INTEGRITY RISK
- Code Quality Reviewer: Flaky test confirmed
- Code Simplicity Reviewer: Over-engineered timestamp rounding

## Notes

Source: Parallel code review session on 2025-12-26
Confirmed by 4/8 review agents as critical priority
