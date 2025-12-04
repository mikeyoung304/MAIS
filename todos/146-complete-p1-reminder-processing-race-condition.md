---
status: complete
priority: p1
issue_id: '146'
tags: [code-review, data-integrity, mvp-gaps, reminders]
dependencies: []
---

# Race Condition in Reminder Processing

## Problem Statement

The reminder processing loop has no concurrency protection. If two dashboard tabs load simultaneously, both will fetch the same pending reminders and send duplicate emails.

**Why This Matters:**

- Customers receive duplicate reminder emails
- Professional reputation impact
- Customer confusion and complaints

## Findings

### Agent: architecture-strategist, performance-oracle

**Location:** `server/src/services/reminder.service.ts:86-114`

**Evidence:**

```typescript
for (const booking of bookingsToRemind) {
  await this.sendReminderForBooking(tenantId, booking);
  await this.bookingRepo.markReminderSent(tenantId, booking.id); // Race window
}
```

**Race Condition Scenario:**

```
Time  |  Tab A                        |  Tab B
------|-------------------------------|---------------------------
T1    |  Fetch pending reminders      |
T2    |  Gets bookings [1,2,3]        |  Fetch pending reminders
T3    |  Send reminder for booking 1  |  Gets bookings [1,2,3] (same!)
T4    |  Mark booking 1 sent          |  Send reminder for booking 1 (DUPLICATE!)
T5    |                               |  Mark booking 1 sent
```

## Proposed Solutions

### Option A: Atomic Update with Timestamp Check (Recommended)

**Pros:** Simple, database-level protection
**Cons:** Requires query modification
**Effort:** Small (2-3 hours)
**Risk:** Low

```sql
UPDATE bookings
SET reminderSentAt = NOW()
WHERE id = $1 AND reminderSentAt IS NULL
RETURNING *
```

### Option B: Advisory Locks

**Pros:** Proven pattern in codebase
**Cons:** More complex
**Effort:** Medium (3-4 hours)
**Risk:** Low

Use PostgreSQL advisory locks like booking creation.

### Option C: Batch Processing with Lock

**Pros:** Process all at once
**Cons:** All-or-nothing
**Effort:** Medium
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/services/reminder.service.ts`
- `server/src/adapters/prisma/booking.repository.ts`

**Components:** Reminder processing, booking repository

## Acceptance Criteria

- [ ] Reminder processing uses atomic update to prevent duplicates
- [ ] Concurrent dashboard loads cannot send duplicate reminders
- [ ] Integration test verifies race condition handling
- [ ] markReminderSent returns false if already sent

## Work Log

| Date       | Action  | Notes                     |
| ---------- | ------- | ------------------------- |
| 2025-12-02 | Created | From MVP gaps code review |

## Resources

- PR: MVP gaps implementation (uncommitted)
- Pattern: ADR-006 advisory locks
