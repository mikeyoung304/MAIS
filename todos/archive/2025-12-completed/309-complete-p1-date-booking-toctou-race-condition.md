---
status: complete
priority: p1
issue_id: '309'
tags: [data-integrity, security, race-condition, date-booking]
dependencies: []
---

# P1: TOCTOU Race Condition in DATE Booking Flow

## Problem Statement

The date booking route performs availability check BEFORE creating the checkout session, creating a Time-of-Check to Time-of-Use (TOCTOU) vulnerability.

## Findings

- **Location:** `server/src/routes/public-date-booking.routes.ts:84-106`
- Check happens outside booking transaction
- Checkout created separately (could be minutes later)
- Window between availability check and payment could be 5-10 minutes

**Race Condition Timeline:**

```
Time  Request A                    Request B
----  ---------------------------  ---------------------------
T0    Check date 2025-06-15 ✓
T1                                  Check date 2025-06-15 ✓
T2    Create checkout
T3                                  Create checkout (DOUBLE BOOK!)
T4    Complete payment
T5                                  Complete payment
```

## Proposed Solutions

### Option 1: Acquire advisory lock during availability check (BEST)

- **Pros**: Prevents race at earliest point, clean API
- **Cons**: Requires lock timeout management
- **Effort**: Medium (2-4 hours)
- **Risk**: Low

### Option 2: Re-check in webhook handler

- **Pros**: Simpler implementation, uses existing patterns
- **Cons**: Refund required if conflict detected after payment
- **Effort**: Small (1-2 hours)
- **Risk**: Medium (customer experience impact)

### Option 3: Use idempotency key that includes date

- **Pros**: Leverages existing infrastructure
- **Cons**: Doesn't prevent double checkout creation
- **Effort**: Small
- **Risk**: Medium

## Recommended Action

Implement Option 2 (re-check in webhook) as immediate fix, then evaluate Option 1 for more robust solution.

## Technical Details

- **Affected Files**:
  - `server/src/services/availability.service.ts`
  - `server/src/services/booking.service.ts`
  - `server/src/routes/public-date-booking.routes.ts`
- **Related Components**: Advisory locks, Stripe webhook handler
- **Database Changes**: No

## Resources

- Data Integrity Review Finding P1-006 (Missing transaction atomicity)
- Security Review Finding P2-004 (Race Condition in Date Availability Check)

## Acceptance Criteria

- [ ] Concurrent booking attempts for same date result in only one successful booking
- [ ] Second user receives clear error message (not double charge)
- [ ] Tests verify race condition is prevented
- [ ] Code reviewed

## Work Log

### 2025-12-21 - Approved for Work

**By:** Claude Triage System
**Actions:**

- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

**Learnings:**

- TOCTOU vulnerabilities require early lock acquisition or re-validation before final action

## Notes

Source: Triage session on 2025-12-21
The advisory lock in `bookingRepo.create()` mitigates but doesn't eliminate the race during checkout creation phase.
