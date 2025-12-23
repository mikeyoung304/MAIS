# P2: Missing Index for Date Availability Queries

## Priority: P2 Important
## Status: complete
## Feature: DATE Booking Flow
## Category: Performance / Data Integrity

## Issue

The schema has an index on `[tenantId, date]` but with the addition of `bookingType`, queries should use a composite index including all three fields.

**File:** `server/prisma/schema.prisma:360`

```prisma
@@index([tenantId, date])  // Missing bookingType
```

## Impact

- DATE booking availability checks may perform sequential scan on bookingType
- Performance degrades as database grows
- Current index is sufficient for small datasets but will degrade with >10,000 bookings per tenant

## Recommended Fix

Add composite index in next migration:

```sql
-- In new migration file
CREATE INDEX CONCURRENTLY idx_booking_tenant_date_type
ON "Booking" ("tenantId", "date", "bookingType");
```

Or in schema.prisma:

```prisma
model Booking {
  // ... fields

  @@index([tenantId, date, bookingType])  // New composite index
  @@index([tenantId, date])                // Keep existing for other queries
}
```

## Note

Use `CONCURRENTLY` in production to avoid locking the table during index creation.

## Testing

- Run EXPLAIN ANALYZE on availability queries before and after
- Verify index is used for DATE booking queries



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Data Integrity Review Finding P2-003 (Missing index)
- Performance Review Finding P3 (Missing Index on Prisma Queries)
