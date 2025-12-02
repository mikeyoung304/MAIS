---
status: complete
priority: p1
issue_id: "147"
tags: [code-review, data-integrity, mvp-gaps, balance-payment]
dependencies: []
---

# Balance Payment Race Condition - Double Payments

## Problem Statement

The `onBalancePaymentCompleted` method has no transaction protection. Concurrent balance payment webhooks can result in double balance payments being recorded.

**Why This Matters:**
- Customer charged twice for same balance
- Financial discrepancy in records
- Reconciliation nightmare with Stripe

## Findings

### Agent: data-integrity-guardian

**Location:** `server/src/services/booking.service.ts:389-418`

**Evidence:**
```typescript
async onBalancePaymentCompleted(
  tenantId: string,
  bookingId: string,
  balanceAmountCents: number
): Promise<Booking> {
  // NO TRANSACTION! Race condition possible
  const booking = await this.bookingRepo.findById(tenantId, bookingId);

  // Time gap between check and update - concurrent balance payments possible
  if (extendedBooking.balancePaidAmount || extendedBooking.balancePaidAt) {
    throw new Error('Balance has already been paid for this booking');
  }

  const updated = await this.bookingRepo.update(tenantId, bookingId, {
    balancePaidAmount: balanceAmountCents,
    balancePaidAt: new Date(),
    status: 'PAID',
  });
}
```

**Race Condition Scenario:**
```
Time  |  Request A                    |  Request B
------|-------------------------------|---------------------------
T1    |  Check: no balance paid       |
T2    |                               |  Check: no balance paid
T3    |  Update: balancePaid = 150000 |
T4    |                               |  Update: balancePaid = 150000
T5    |  RESULT: Double payment!      |
```

## Proposed Solutions

### Option A: Transaction with Advisory Lock (Recommended)
**Pros:** Proven pattern in codebase, prevents race
**Cons:** Slightly more complex
**Effort:** Medium (3-4 hours)
**Risk:** Low

```typescript
await this.prisma.$transaction(async (tx) => {
  const lockId = hashBookingId(bookingId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  const booking = await tx.booking.findUnique({ where: { id: bookingId } });

  if (booking.balancePaidAt) {
    throw new Error('Balance already paid - idempotent success');
  }

  await tx.booking.update({ ... });
});
```

### Option B: Unique Constraint
**Pros:** Database-level protection
**Cons:** Error handling required
**Effort:** Small
**Risk:** Low

```prisma
@@unique([id, balancePaidAt]) // Prevents duplicate balance payment
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/src/services/booking.service.ts`

**Components:** Balance payment completion

## Acceptance Criteria

- [ ] Balance payment completion wrapped in transaction
- [ ] Advisory lock prevents concurrent updates
- [ ] Idempotent success if balance already paid
- [ ] Integration test verifies concurrent balance payments handled

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From MVP gaps code review |

## Resources

- PR: MVP gaps implementation (uncommitted)
- Pattern: ADR-006 advisory locks in booking creation
