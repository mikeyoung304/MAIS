-- Migration: Add bookingType to Package (idempotent)
-- Purpose: Enable packages to specify which booking flow to use
-- Safe to re-run

-- Add nullable column first (BookingType enum already exists from Booking model)
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "bookingType" "BookingType";

-- Audit logging before backfill
DO $$
BEGIN
  RAISE NOTICE 'Backfilling bookingType for % packages',
    (SELECT COUNT(*) FROM "Package" WHERE "bookingType" IS NULL);
END $$;

-- Backfill existing packages as DATE (safer default for wedding venues)
UPDATE "Package" SET "bookingType" = 'DATE' WHERE "bookingType" IS NULL;

-- Verify no orphaned bookings with mismatched bookingType
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Booking" b
    INNER JOIN "Package" p ON b."packageId" = p.id
    WHERE b."bookingType" != p."bookingType"
  ) THEN
    RAISE WARNING 'Booking/Package bookingType mismatch detected';
  END IF;
END $$;

-- Make non-nullable with default
ALTER TABLE "Package" ALTER COLUMN "bookingType" SET NOT NULL;
ALTER TABLE "Package" ALTER COLUMN "bookingType" SET DEFAULT 'DATE';

-- Rollback:
-- ALTER TABLE "Package" DROP COLUMN IF EXISTS "bookingType";

-- CRITICAL: After applying this migration, run: npm exec prisma generate
