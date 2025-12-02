---
status: complete
priority: p1
issue_id: "149"
tags: [code-review, data-integrity, mvp-gaps, deposits]
dependencies: []
---

# Missing DEPOSIT_PAID Booking Status

## Problem Statement

The BookingStatus enum is missing `DEPOSIT_PAID` status. The service layer references this status but it doesn't exist in the schema, causing state ambiguity between new bookings and deposit-paid bookings.

**Why This Matters:**
- Cannot distinguish deposit-only from incomplete bookings
- Balance payment logic broken (queries for PENDING get both)
- Financial reconciliation impossible

## Findings

### Agent: data-integrity-guardian

**Location:** `server/prisma/schema.prisma:360-365`

**Evidence:**
```prisma
enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELED
  FULFILLED
}
```

**Service layer references missing status:**
```typescript
// booking.service.ts:582-587
let bookingStatus: 'PENDING' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'FULFILLED' = 'PAID';

if (input.isDeposit && input.depositPercent) {
  depositPaidAmount = input.totalCents;
  bookingStatus = 'PENDING'; // Should be 'DEPOSIT_PAID'!
}
```

**State Transition Gap:**
```
Current (WRONG):
PENDING → CONFIRMED (full payment)
PENDING → CONFIRMED (deposit) -- No distinction!

Expected:
PENDING → CONFIRMED (full payment)
PENDING → DEPOSIT_PAID (deposit)
DEPOSIT_PAID → CONFIRMED (balance paid)
```

## Proposed Solutions

### Option A: Add DEPOSIT_PAID to Enum (Recommended)
**Pros:** Clear state distinction, proper state machine
**Cons:** Requires migration
**Effort:** Medium (3-4 hours)
**Risk:** Low

```prisma
enum BookingStatus {
  PENDING
  DEPOSIT_PAID  // NEW
  CONFIRMED
  CANCELED
  FULFILLED
}
```

Migration:
```sql
ALTER TYPE "BookingStatus" ADD VALUE 'DEPOSIT_PAID';
```

### Option B: Use Separate depositStatus Field
**Pros:** No enum change
**Cons:** Two fields to track, more complex
**Effort:** Medium
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/prisma/schema.prisma`
- `server/src/services/booking.service.ts`
- `server/src/adapters/prisma/booking.repository.ts`

**Database Changes:** Add enum value, update booking service

## Acceptance Criteria

- [ ] DEPOSIT_PAID added to BookingStatus enum
- [ ] Migration created and applied
- [ ] Service layer uses DEPOSIT_PAID for deposit bookings
- [ ] Balance payment only allowed for DEPOSIT_PAID status
- [ ] Unit test verifies state transitions

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From MVP gaps code review |

## Resources

- PR: MVP gaps implementation (uncommitted)
- Schema: `server/prisma/schema.prisma`
