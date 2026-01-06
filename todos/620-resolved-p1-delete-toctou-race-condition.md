---
status: resolved
priority: p1
issue_id: 620
tags: [code-review, data-integrity, booking-links, race-condition, must-fix-now]
dependencies: []
created: 2026-01-05
triaged: 2026-01-05
resolved: 2026-01-05
---

# TOCTOU Race Condition on Service Delete

## Problem Statement

The delete operation in `booking-link-executors.ts` performs two sequential queries (check for bookings, then delete) without transaction protection. A booking could be created between the check and the delete, resulting in a service being deleted with an active booking.

## Findings

**Source:** data-integrity-guardian

**Evidence:**

```typescript
// Lines 198-205: Check for bookings OUTSIDE transaction
const upcomingBookings = await prisma.booking.count({
  where: {
    serviceId,
    tenantId,
    date: { gte: new Date() },
    status: { in: ['PENDING', 'CONFIRMED'] },
  },
});

if (upcomingBookings > 0) {
  throw new ValidationError(...);
}

// Lines 213-216: Delete service in separate operation
await prisma.service.delete({
  where: { id: serviceId },
});
```

**Risk:** Time-of-Check to Time-of-Use (TOCTOU) race condition. A concurrent booking creation could succeed between the count query and the delete, resulting in:

1. Service deleted with active booking (orphaned foreign key)
2. Customer has booking but service doesn't exist
3. Runtime errors when accessing booking details

## Proposed Solutions

### Option 1: Wrap in transaction with row lock (Recommended)

**Pros:** Atomic check-then-act, prevents race condition
**Cons:** Slightly longer lock duration
**Effort:** Small
**Risk:** Very low

```typescript
await prisma.$transaction(async (tx) => {
  // Lock the service row to prevent concurrent modifications
  await tx.$executeRaw`SELECT id FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;

  const upcomingBookings = await tx.booking.count({
    where: {
      serviceId,
      tenantId,
      date: { gte: new Date() },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  });

  if (upcomingBookings > 0) {
    throw new ValidationError(
      `Cannot delete service with ${upcomingBookings} upcoming booking(s).`
    );
  }

  await tx.service.delete({ where: { id: serviceId } });
});
```

### Option 2: Use database trigger/constraint

**Pros:** Database-level enforcement
**Cons:** Complex, harder to maintain, less clear error messages
**Effort:** Large
**Risk:** Medium (schema change)

### Option 3: Soft delete with booking check in availability calculation

**Pros:** Never actually deletes, maintains history
**Cons:** Changes product behavior, requires more code changes
**Effort:** Large
**Risk:** Medium

## Recommended Action

**TRIAGE RESULT: MUST FIX NOW** (Unanimous 3/3 votes)

**Reviewers:** security-sentinel, architecture-strategist, data-integrity-guardian

**Decision:** Wrap in transaction with row lock. TOCTOU race conditions violate ADR-013 patterns and can orphan bookings.

**Implementation:** Option 1 - Wrap in transaction with row lock

## Technical Details

**Affected Files:**

- `server/src/agent/executors/booking-link-executors.ts` (lines 196-227)

**Pattern Reference:**

- See `server/src/services/booking.service.ts` for advisory lock pattern used in double-booking prevention

## Acceptance Criteria

- [x] Delete operation wrapped in transaction
- [x] Row-level lock prevents concurrent booking creation
- [ ] Test for race condition scenario (deferred - complex to test)
- [x] Error message remains user-friendly

## Work Log

| Date       | Action                           | Learnings                                       |
| ---------- | -------------------------------- | ----------------------------------------------- |
| 2026-01-05 | Created during /workflows:review | Identified by data-integrity-guardian agent     |
| 2026-01-05 | Resolved via parallel agent      | Added $transaction with FOR UPDATE lock pattern |

## Resources

- [ADR-013: Advisory Locks for Double-Booking Prevention](../docs/adrs/ADR-013-advisory-locks.md)
- PR: Booking Links Phase 0 - commit 1bd733c9
