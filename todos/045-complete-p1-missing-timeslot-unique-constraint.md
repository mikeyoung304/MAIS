---
status: complete
priority: p1
issue_id: "045"
tags: [code-review, scheduling, data-integrity, database, double-booking, critical]
dependencies: ["043"]
---

# CRITICAL: No Database Constraint Prevents TIMESLOT Double-Booking

## Problem Statement

The Booking model has a unique constraint on `(tenantId, date, bookingType)` but NO constraint that prevents overlapping time ranges for TIMESLOT bookings. If the application-level conflict detection fails (see #043), the database cannot catch double-bookings.

**Why this matters:** The only defense against double-booking is application code. If that fails, two bookings with identical `tenantId`, `date`, `serviceId`, `startTime`, and `endTime` can be created.

## Findings

### Code Evidence - Current Schema

**Location:** `server/prisma/schema.prisma:306-312`

```prisma
model Booking {
  // ... fields ...

  @@unique([tenantId, date, bookingType])  // Only prevents same type on same DATE
  @@index([tenantId, status])
  @@index([tenantId, date])
  @@index([tenantId, startTime])
  // NO unique constraint on (tenantId, serviceId, startTime, endTime)!
}
```

### What This Constraint Allows

Current constraint: `@@unique([tenantId, date, bookingType])`

This ONLY prevents:
- Same tenant + same date + same booking type (e.g., two DATE bookings on same day)

This DOES NOT prevent:
- Two TIMESLOT bookings with different times on same date ✓ (correct)
- Two TIMESLOT bookings with SAME times on same date ❌ (BUG!)

### Example of Double-Booking

Both bookings pass the unique constraint:

| Field | Booking 1 | Booking 2 | Unique? |
|-------|-----------|-----------|---------|
| tenantId | "A" | "A" | Same |
| date | 2025-06-15 | 2025-06-15 | Same |
| bookingType | TIMESLOT | TIMESLOT | Same |
| startTime | 14:00 | 14:00 | **Not checked!** |
| endTime | 14:30 | 14:30 | **Not checked!** |

Result: Both rows inserted - constraint doesn't prevent this.

### Impact Chain

1. Application check fails (returns empty - see #043)
2. No pessimistic locking for time ranges
3. No unique constraint catches overlap
4. **Double-booking persists in database**

## Proposed Solutions

### Option A: Composite Unique Constraint (Recommended)
**Effort:** Small | **Risk:** Low

Add unique constraint for TIMESLOT bookings on exact time match:

```prisma
model Booking {
  // ... existing fields ...

  @@unique([tenantId, date, bookingType])
  @@unique([tenantId, serviceId, startTime, endTime])  // NEW: Exact slot match
  @@index([tenantId, serviceId, startTime])  // NEW: Query performance
}
```

**Pros:**
- Database enforces uniqueness as last line of defense
- Simple to implement
- Prevents exact duplicates

**Cons:**
- Doesn't prevent overlapping (but different) time ranges
- Requires migration

### Option B: PostgreSQL Exclusion Constraint (Best)
**Effort:** Medium | **Risk:** Medium

Use PostgreSQL's exclusion constraint for range overlap detection:

```sql
-- Requires btree_gist extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint
ALTER TABLE "Booking" ADD CONSTRAINT no_time_overlap
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "serviceId" WITH =,
    tstzrange("startTime", "endTime") WITH &&
  )
  WHERE ("bookingType" = 'TIMESLOT' AND "status" IN ('PENDING', 'CONFIRMED'));
```

**Pros:**
- Prevents ANY overlapping time ranges (not just exact matches)
- Database-level enforcement
- Handles edge cases like partial overlaps

**Cons:**
- Requires btree_gist extension
- More complex migration
- Need to verify Prisma compatibility

### Option C: Application-Level Advisory Lock
**Effort:** Medium | **Risk:** Medium

Enhance booking creation with pessimistic locking:

```typescript
await prisma.$transaction(async (tx) => {
  // Lock on tenant + service + time range
  const lockId = hashTimeRange(tenantId, serviceId, startTime, endTime);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Check for conflicts
  const conflicts = await tx.booking.findMany({
    where: {
      tenantId,
      serviceId,
      bookingType: 'TIMESLOT',
      OR: [
        { startTime: { lt: endTime }, endTime: { gt: startTime } },
      ],
    },
  });

  if (conflicts.length > 0) {
    throw new ConflictError('Time slot already booked');
  }

  // Create booking
  return tx.booking.create({ data: { ... } });
});
```

**Pros:**
- Works without schema changes

**Cons:**
- Only as reliable as the application code
- Lock hash collisions possible

## Recommended Action

Implement **Option A** immediately (simple safety net), then evaluate **Option B** for full range overlap protection.

## Technical Details

**Migration for Option A:**

```sql
-- Check for existing duplicates first
SELECT "tenantId", "serviceId", "startTime", "endTime", COUNT(*)
FROM "Booking"
WHERE "bookingType" = 'TIMESLOT'
GROUP BY "tenantId", "serviceId", "startTime", "endTime"
HAVING COUNT(*) > 1;

-- If no duplicates, add constraint
ALTER TABLE "Booking"
ADD CONSTRAINT booking_timeslot_unique
UNIQUE ("tenantId", "serviceId", "startTime", "endTime");

-- Add index for performance
CREATE INDEX idx_booking_timeslot_lookup
ON "Booking" ("tenantId", "serviceId", "startTime")
WHERE "bookingType" = 'TIMESLOT';
```

**Files to Update:**
- `server/prisma/schema.prisma` - Add unique constraint
- Create migration: `prisma migrate dev --name add_timeslot_unique_constraint`

## Acceptance Criteria

- [ ] Unique constraint added: `@@unique([tenantId, serviceId, startTime, endTime])`
- [ ] Database migration created and tested
- [ ] Index added for query performance
- [ ] Existing data verified for duplicates before migration
- [ ] Integration test: concurrent booking attempts hit constraint error

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during Data Integrity Guardian review - BLOCKS MERGE |
| 2025-12-01 | Complete | Already implemented in `07_add_scheduling_platform.sql` (lines 147-159): `CREATE UNIQUE INDEX IF NOT EXISTS "Booking_timeslot_unique" ON "Booking"("tenantId", "serviceId", "startTime") WHERE "startTime" IS NOT NULL AND "serviceId" IS NOT NULL;` |

## Resources

- Data Integrity Guardian analysis
- PostgreSQL exclusion constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- CLAUDE.md ADR-001: Double-Booking Prevention
