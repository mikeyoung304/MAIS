---
status: complete
priority: p1
issue_id: '150'
tags: [code-review, data-integrity, mvp-gaps, refunds]
dependencies: []
---

# Missing Refund Amount Validation

## Problem Statement

The `processRefund` method has no validation that the refund amount doesn't exceed the total paid. This can lead to over-refunds and incorrect cumulative refund tracking.

**Why This Matters:**

- Over-refunds cause financial loss
- Cumulative refund tracking broken
- Stripe will reject but error handling unclear

## Findings

### Agent: data-integrity-guardian

**Location:** `server/src/services/booking.service.ts:1115-1175`

**Evidence:**

```typescript
async processRefund(
  tenantId: string,
  bookingId: string,
  paymentIntentId: string,
  amountCents?: number
): Promise<Booking> {
  // NO VALIDATION of refund amount vs total paid
  const refundAmount = amountCents ?? booking.totalCents;

  const refundResult = await this.paymentProvider.refund({
    paymentIntentId,
    amountCents: refundAmount, // Could exceed totalCents!
  });
```

**Data Integrity Violations:**

1. **Refund > Total Paid:**

```typescript
// Booking: totalCents = 200000 (already refunded 150000)
// Request: amountCents = 100000
// Result: 150000 + 100000 = 250000 > 200000
```

2. **Deposit Scenario Missing:**

```typescript
// Booking: depositPaidAmount = 50000, balancePaidAmount = 150000
// Refund: totalCents = 200000 -- Wrong! Should only refund what was actually paid
```

3. **Partial Refund Tracking Broken:**

```typescript
// First refund: 50000
// Second refund: 50000
// refundAmount field: 50000 -- Only shows last refund, not cumulative
```

## Proposed Solutions

### Option A: Add Amount Validation (Recommended)

**Pros:** Prevents over-refunds, accurate tracking
**Cons:** Slightly more complex
**Effort:** Small (2-3 hours)
**Risk:** Low

```typescript
const totalPaid = (booking.depositPaidAmount ?? 0) + (booking.balancePaidAmount ?? 0);
const previousRefunds = booking.refundAmount ?? 0;
const maxRefundable = totalPaid - previousRefunds;

if (refundAmount > maxRefundable) {
  throw new Error(`Refund amount ${refundAmount} exceeds remaining ${maxRefundable}`);
}

// Track cumulative refunds
refundAmount: booking.refundAmount
  ? booking.refundAmount + refundResult.amountCents
  : refundResult.amountCents;
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/services/booking.service.ts`

**Components:** Refund processing

## Acceptance Criteria

- [ ] Refund amount validated against remaining refundable amount
- [ ] Cumulative refund tracking accurate
- [ ] Deposit vs full payment refunds handled correctly
- [ ] Clear error message when refund exceeds available
- [ ] Unit test verifies refund validation

## Work Log

| Date       | Action  | Notes                     |
| ---------- | ------- | ------------------------- |
| 2025-12-02 | Created | From MVP gaps code review |

## Resources

- PR: MVP gaps implementation (uncommitted)
- Related: Deposit payment flow
