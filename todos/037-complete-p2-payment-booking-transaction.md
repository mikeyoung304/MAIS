---
status: complete
priority: p2
issue_id: "037"
tags: [code-review, data-integrity, transactions]
dependencies: []
---

# Payment + Booking Not in Same Transaction

## Problem Statement

Webhook handler creates booking and Payment records in separate Prisma calls. If booking succeeds but payment fails, financial reconciliation is broken.

**Why this matters:** Customer paid but booking not recorded, or booking exists without payment record. Revenue reconciliation impossible.

## Findings

### Code Evidence

**Location:** `server/src/routes/webhooks.routes.ts:233` and `server/src/services/booking.service.ts:316`

Webhook handler calls `bookingService.onPaymentCompleted()` which:
1. Creates booking record
2. Creates payment record (separate query)

If step 2 fails:
- Booking exists without corresponding Payment
- Cannot match Stripe charges to bookings
- Financial reports incorrect

## Proposed Solutions

### Option A: Wrap in Explicit Transaction (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
async onPaymentCompleted(tenantId: string, input: {...}): Promise<Booking> {
  return await this.prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({...});
    await tx.payment.create({
      data: {
        tenantId,
        bookingId: booking.id,
        amount: input.totalCents,
        status: 'CAPTURED',
        processor: 'stripe',
        processorId: input.sessionId,
      },
    });
    return booking;
  });
}
```

## Acceptance Criteria

- [ ] Booking and Payment created atomically
- [ ] Transaction rollback on either failure
- [ ] Test: payment failure rolls back booking
- [ ] Webhook idempotency still works

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during data integrity review |
