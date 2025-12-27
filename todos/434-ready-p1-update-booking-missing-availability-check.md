---
status: ready
priority: p1
issue_id: "434"
tags: [code-review, data-integrity, agent-tools]
dependencies: []
---

# update_booking Executor Missing Availability Check

## Problem Statement

The `update_booking` executor updates booking dates without verifying the new date is available. This allows moving a booking to an already-booked date, causing double-booking.

**Why it matters:** Date changes are the most impactful booking modification. Without availability verification, the agent can corrupt the schedule by creating overlapping bookings.

## Findings

- **Location:** `server/src/agent/executors/index.ts:140-185`
- When `payload.newDate` is set, updates directly without checking availability
- No advisory lock acquisition for the new date
- Current booking should be excluded from conflict check (can't conflict with itself)
- Missing: availability check, advisory lock, graceful conflict error

## Proposed Solutions

### Option A: Add Availability Check + Lock (Recommended)

**Approach:** Wrap date change in transaction with advisory lock and availability check.

**Pros:**
- Maintains data integrity
- Follows established ADR-013 pattern
- Clear error message on conflict

**Cons:**
- Additional query

**Effort:** Small (1-2 hours)

**Risk:** Low

---

### Option B: Use AvailabilityService

**Approach:** Inject and use existing availabilityService.

**Pros:**
- Reuses service logic

**Cons:**
- Requires service injection

**Effort:** Medium (2-3 hours)

**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `server/src/agent/executors/index.ts` (lines 140-185)

**Related components:**
- `server/src/services/availability.service.ts`
- `hashTenantDate` function (already in file)

**Database changes:** None

## Resources

- ADR-013: Advisory Locks
- Commit 0d3cba5: Agent action parity implementation

## Acceptance Criteria

- [ ] Date changes check availability before update
- [ ] Advisory lock acquired for new date
- [ ] Current booking excluded from conflict check
- [ ] Clear error message on conflict
- [ ] Test: date change to occupied date returns error
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** data-integrity-guardian agent (code review)

**Actions:**
- Identified missing availability check in update_booking executor
- Noted advisory lock pattern not applied to date changes

**Learnings:**
- Date changes need same protection as initial booking creation
