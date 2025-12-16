-- Migration: Add bookingType to Package (idempotent)
-- Purpose: Enable packages to specify which booking flow to use
-- Safe to re-run

-- Add nullable column first (BookingType enum already exists from Booking model)
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "bookingType" "BookingType";

-- Backfill existing packages as DATE (safer default for wedding venues)
UPDATE "Package" SET "bookingType" = 'DATE' WHERE "bookingType" IS NULL;

-- Make non-nullable with default
ALTER TABLE "Package" ALTER COLUMN "bookingType" SET NOT NULL;
ALTER TABLE "Package" ALTER COLUMN "bookingType" SET DEFAULT 'DATE';

-- Rollback:
-- ALTER TABLE "Package" DROP COLUMN IF EXISTS "bookingType";
