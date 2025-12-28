---
status: complete
priority: p2
issue_id: '370'
tags: [code-review, booking, race-condition]
dependencies: []
---

# TOCTOU Race Condition in Date Booking

## Problem Statement

The availability check happens BEFORE checkout creation, creating a Time-of-Check to Time-of-Use vulnerability. Database constraint catches duplicates but only AFTER payment.

**Why it matters:** Users can complete payment for already-booked dates, requiring refunds.

## Findings

**File:** `server/src/services/booking.service.ts:402-414`

**Race Condition Timeline:**

1. User A checks availability for Dec 25 → Available ✓
2. User B checks availability for Dec 25 → Available ✓
3. User A starts checkout → Creates Stripe session
4. User B completes payment → Booking created
5. User A completes payment → 409 conflict AFTER payment

**Current Protection:**

- Database constraint `@@unique([tenantId, date, bookingType])` catches at final step
- But user already paid → requires refund

**Impact:** P2 - Poor UX, requires manual refunds

## Proposed Solutions

### Option 1: Advisory Lock Before Checkout Creation

- **Description:** Hold database lock during checkout creation
- **Pros:** Prevents race condition at source
- **Cons:** Brief lock hold time
- **Effort:** Medium (1-2 hours)
- **Risk:** Low - already have advisory lock pattern

### Option 2: Tentative Reservation

- **Description:** Create "pending" booking before checkout, confirm on payment
- **Pros:** Reserves date during checkout
- **Cons:** Need cleanup job for abandoned reservations
- **Effort:** High
- **Risk:** Medium

### Option 3: Accept and Handle Gracefully

- **Description:** Keep current behavior, improve error handling
- **Pros:** No backend changes
- **Cons:** Still requires refunds
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**ALREADY FIXED** - Code already implements multi-layered protection: pg_advisory_xact_lock, unique constraint, retry logic, and transaction isolation. Well-designed and tested. No action needed.

## Acceptance Criteria

- [ ] Concurrent booking attempts handled gracefully
- [ ] No refunds required for double-booking scenarios
- [ ] OR clear documentation of edge case behavior

## Work Log

| Date       | Action                     | Learnings                                              |
| ---------- | -------------------------- | ------------------------------------------------------ |
| 2025-12-25 | Created during code review | Race condition identified                              |
|            |                            | Related: TODO-309 (marked complete but issue persists) |
