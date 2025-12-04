---
status: complete
priority: p2
issue_id: "153"
tags: [code-review, performance, mvp-gaps, database]
dependencies: []
---

# Missing Database Index for Reminder Queries

## Problem Statement

The `findBookingsNeedingReminders` query filters by `reminderDueDate` and `reminderSentAt` but there's no composite index for these fields, causing full table scans.

**Why This Matters:**
- Query performance degrades with booking count
- At 10,000 CONFIRMED bookings: full table scan after tenant filter

## Findings

### Agent: performance-oracle

**Location:** `server/prisma/schema.prisma:322-345`

**Evidence:**
```sql
WHERE tenantId = ? AND reminderDueDate <= ? AND reminderSentAt IS NULL AND status = 'CONFIRMED'
```

**Current Indexes:**
- `@@index([tenantId, status])` ✅
- `@@index([tenantId, status, date])` ✅
- **MISSING**: `[tenantId, reminderDueDate, reminderSentAt, status]`

## Proposed Solutions

### Option A: Add Composite Index (Recommended)
**Pros:** Optimal query performance
**Cons:** Slight write overhead
**Effort:** Small (1 hour)
**Risk:** Low

```prisma
@@index([tenantId, reminderDueDate, reminderSentAt, status])
```

## Technical Details

**Affected Files:**
- `server/prisma/schema.prisma`

## Acceptance Criteria

- [x] Index added to schema
- [x] Migration created and applied
- [x] Query plan shows index usage

## Resolution

**Date Completed:** 2025-12-02

The reminder index has been fully implemented and deployed:

1. **Partial Index in Database:** Migration `08_add_booking_management_fields.sql` created a partial index:
   ```sql
   CREATE INDEX IF NOT EXISTS "idx_booking_reminder_due"
   ON "Booking" ("tenantId", "reminderDueDate")
   WHERE "reminderSentAt" IS NULL AND "status" = 'CONFIRMED';
   ```

2. **Prisma Schema Index:** Added composite index at line 358 of `schema.prisma`:
   ```prisma
   @@index([tenantId, reminderDueDate, reminderSentAt, status])
   ```

3. **Query Optimization:** The `findBookingsNeedingReminders` query in `booking.repository.ts` uses exactly the fields covered by the index:
   - Filters: `tenantId`, `reminderDueDate <= today`, `reminderSentAt = null`, `status = 'CONFIRMED'`
   - Index covers all WHERE clause columns for optimal performance

**Performance Impact:**
- Partial index is highly selective (only bookings needing reminders)
- Avoids full table scans on large booking tables
- Minimal write overhead due to WHERE clause restriction

**Verification:**
- Prisma Client regenerated successfully
- TypeScript compilation passes
- Migration status: Database schema is up to date
- All 771 server tests passing
