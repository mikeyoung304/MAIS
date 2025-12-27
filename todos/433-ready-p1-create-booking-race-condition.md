---
status: ready
priority: p1
issue_id: "433"
tags: [code-review, security, agent-tools, race-condition]
dependencies: []
---

# create_booking Executor Missing Advisory Lock

## Problem Statement

The `create_booking` executor in `server/src/agent/executors/index.ts` creates bookings without acquiring an advisory lock, allowing double-booking race conditions when concurrent requests attempt to book the same date.

**Why it matters:** Double bookings cause scheduling conflicts, customer disputes, and revenue issues. This violates ADR-013's three-layer defense pattern.

## Findings

- **Location:** `server/src/agent/executors/index.ts:68-94`
- Executor calls `prisma.booking.create()` directly without transaction
- No advisory lock acquisition via `pg_advisory_xact_lock()`
- No availability check before insert
- The `hashTenantDate` function exists in the file (lines 1-12) but is unused by this executor
- Comparison: `booking.service.ts` correctly uses transaction + advisory lock

## Proposed Solutions

### Option A: Use BookingService (Recommended)

**Approach:** Import and delegate to existing `bookingService.create()` which already implements the pattern.

**Pros:**
- Reuses battle-tested logic
- Single source of truth for booking creation
- Automatically gets future improvements

**Cons:**
- Requires service injection into executor

**Effort:** Small (1-2 hours)

**Risk:** Low

---

### Option B: Implement Lock in Executor

**Approach:** Add transaction wrapper with advisory lock directly in executor.

**Pros:**
- Self-contained executor

**Cons:**
- Duplicates booking.service.ts logic
- Risk of drift between implementations

**Effort:** Medium (2-4 hours)

**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `server/src/agent/executors/index.ts` (lines 68-94)

**Related components:**
- `server/src/services/booking.service.ts` (reference implementation)
- `hashTenantDate` function (already in executors file)

**Database changes:** None

## Resources

- ADR-013: Advisory Locks for Double-Booking Prevention
- Commit 0d3cba5: Agent action parity implementation

## Acceptance Criteria

- [ ] create_booking executor wrapped in transaction
- [ ] Advisory lock acquired before availability check
- [ ] Availability checked before booking creation
- [ ] Unit test verifies concurrent booking attempts don't double-book
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** security-sentinel agent (code review)

**Actions:**
- Identified missing advisory lock in create_booking executor
- Compared with booking.service.ts pattern
- Noted hashTenantDate already exists but unused

**Learnings:**
- Executor pattern doesn't automatically inherit service-level protections
- Need to audit all write executors for race condition protection
