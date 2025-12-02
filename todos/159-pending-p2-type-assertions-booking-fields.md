---
status: pending
priority: p2
issue_id: "159"
tags: [code-review, quality, mvp-gaps, typescript]
dependencies: []
---

# Type Assertions for Extended Booking Fields

## Problem Statement

Multiple unsafe type assertions scattered throughout BookingService for deposit/refund fields that should be in the Booking interface.

**Why This Matters:**
- Type safety bypassed
- Fields may not exist at runtime
- Maintenance burden

## Findings

### Agent: code-quality-reviewer

**Location:** `server/src/services/booking.service.ts:257-261, 1129-1130`

**Evidence:**
```typescript
const extendedBooking = booking as Booking & {
  depositPaidAmount?: number;
  balancePaidAmount?: number;
  balancePaidAt?: Date | string;
};

const extendedBooking = booking as Booking & { refundStatus?: string };
```

## Proposed Solutions

### Option A: Update Booking Entity (Recommended)
**Pros:** Type safety, single definition
**Cons:** Interface change
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
// In lib/entities.ts
export interface Booking {
  // ... existing fields
  depositPaidAmount?: number;
  balancePaidAmount?: number;
  balancePaidAt?: Date | string;
  refundStatus?: RefundStatus;
  refundAmount?: number;
  refundedAt?: Date | string;
}
```

## Technical Details

**Affected Files:**
- `server/src/lib/entities.ts`
- `server/src/services/booking.service.ts`
- `server/src/adapters/prisma/booking.repository.ts`

## Acceptance Criteria

- [ ] All deposit/refund fields added to Booking interface
- [ ] Type assertions removed from service
- [ ] Repository mapper updated
- [ ] Type check passes
