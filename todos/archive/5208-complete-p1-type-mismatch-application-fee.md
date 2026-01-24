---
status: complete
priority: p1
issue_id: '5208'
tags: [code-review, stripe, type-safety, booking]
dependencies: []
---

# Type Mismatch: applicationFeeAmount number | undefined

## Problem Statement

The `applicationFeeAmount` parameter is passed as `number | undefined` but the receiving function expects `number`. This type mismatch could cause runtime errors or incorrect fee calculations.

**Why it matters:** Stripe Connect application fees are critical for platform revenue. An undefined fee could mean $0 revenue on a booking.

## Findings

**Location:** `server/src/services/checkout-session.factory.ts`

**Evidence:**

```typescript
// Called with optional fee
createCheckoutSession({
  applicationFeeAmount: tenant.platformFee, // Could be undefined
});

// But signature expects required number
interface CheckoutSessionParams {
  applicationFeeAmount: number; // Not number | undefined
}
```

**Reviewer:** Code Simplicity Reviewer (CS-001)

## Proposed Solutions

### Option A: Make Parameter Optional with Default (Recommended)

**Pros:** Explicit handling, no runtime surprises
**Cons:** Slight API change
**Effort:** Small
**Risk:** Low

```typescript
interface CheckoutSessionParams {
  applicationFeeAmount?: number; // Mark optional
}

// In implementation:
const fee = params.applicationFeeAmount ?? 0;
```

### Option B: Validate at Call Site

**Pros:** No interface change
**Cons:** Scattered validation
**Effort:** Small
**Risk:** Low

```typescript
if (tenant.platformFee === undefined) {
  throw new Error('Platform fee required for checkout');
}
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/services/checkout-session.factory.ts`
- `server/src/services/booking.service.ts`

**Stripe Impact:**

- `application_fee_amount` sent to Stripe must be a positive integer (cents)
- Undefined would fail Stripe API validation

## Acceptance Criteria

- [ ] Type signature matches actual usage
- [ ] TypeScript compiles without type assertions
- [ ] Unit test covers undefined fee case
- [ ] Stripe integration test passes

## Work Log

| Date       | Action                         | Learnings                                            |
| ---------- | ------------------------------ | ---------------------------------------------------- |
| 2026-01-24 | Created from /workflows:review | Code Simplicity found type mismatch in Stripe params |

## Resources

- Review: Code Simplicity Reviewer
- Stripe Docs: https://stripe.com/docs/connect/direct-charges#application-fee
