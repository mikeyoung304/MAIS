# P1: Migration Missing Audit Trail and Rollback Safety

## Priority: P1 Critical
## Status: pending
## Feature: DATE Booking Flow
## Category: Data Integrity

## Issue

The migration backfills NULL `bookingType` values to `'DATE'` without:
1. Checking if existing `Booking` records reference these packages
2. Validating that setting packages to `DATE` is semantically correct
3. Logging which packages were backfilled
4. Providing rollback mechanism

**File:** `server/prisma/migrations/14_package_booking_type.sql:8-13`

```sql
-- Line 8-9: Backfill without validation
UPDATE "Package" SET "bookingType" = 'DATE' WHERE "bookingType" IS NULL;
```

## Impact

- Existing production tenants could have packages incorrectly marked as `DATE`
- If a tenant was using appointment-style bookings pre-TIMESLOT, those packages would be incorrectly backfilled
- No rollback mechanism beyond commented SQL
- Silent data corruption with no audit trail

## Recommended Fix

```sql
-- Add audit logging before backfill
DO $$
BEGIN
  -- Log packages being backfilled
  RAISE NOTICE 'Backfilling bookingType for % packages',
    (SELECT COUNT(*) FROM "Package" WHERE "bookingType" IS NULL);

  -- Record pre-migration state (if audit table exists)
  -- INSERT INTO "MigrationAudit" ...
END $$;

-- Then perform backfill
UPDATE "Package" SET "bookingType" = 'DATE' WHERE "bookingType" IS NULL;

-- Verify no orphaned bookings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Booking" b
    INNER JOIN "Package" p ON b."packageId" = p.id
    WHERE b."bookingType" != p."bookingType"
  ) THEN
    RAISE EXCEPTION 'Booking/Package bookingType mismatch detected';
  END IF;
END $$;
```

## Also Required

Add to migration file documentation:
```sql
-- CRITICAL: After applying this migration, run:
-- npm exec prisma generate
```

## Review Reference
- Data Integrity Review Finding P1-003 (Migration does not regenerate Prisma Client)
- Data Integrity Review Finding P1-005 (No backward compatibility check)
