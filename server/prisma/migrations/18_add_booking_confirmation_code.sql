-- Migration: Add confirmationCode and paidAt fields to Booking model
-- Purpose: Support customer chatbot booking confirmation codes and payment tracking
-- Date: 2025-12-29

-- Add confirmation code column for customer-facing booking lookups
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "confirmationCode" TEXT;

-- Add payment completion timestamp
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- Create unique index for confirmation code lookups
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_confirmationCode_key"
  ON "Booking"("confirmationCode") WHERE "confirmationCode" IS NOT NULL;

-- Backfill existing bookings with generated confirmation codes
-- Format: BK-<first 6 chars of ID uppercase>
UPDATE "Booking"
SET "confirmationCode" = 'BK-' || UPPER(SUBSTRING(id, 1, 6))
WHERE "confirmationCode" IS NULL;

-- Set paidAt for already CONFIRMED/PAID bookings (use confirmedAt as approximation)
UPDATE "Booking"
SET "paidAt" = "confirmedAt"
WHERE "paidAt" IS NULL AND "status" IN ('CONFIRMED', 'PAID', 'FULFILLED');
