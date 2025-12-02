-- Migration: Add Booking Management Fields
-- Description: Adds cancellation, refund, reminder, and deposit tracking fields
-- Related Plan: plans/mvp-gaps-phased-implementation.md
-- Author: Claude Code

-- ============================================================================
-- PHASE 1: Cancellation & Refund Tracking
-- ============================================================================

-- Create CancelledBy enum for tracking who cancelled the booking
DO $$ BEGIN
  CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'TENANT', 'ADMIN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create RefundStatus enum for tracking refund processing state
DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add cancellation tracking fields to Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledBy" "CancelledBy";
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

-- Add refund tracking fields to Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "refundStatus" "RefundStatus" DEFAULT 'NONE';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "refundAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stripeRefundId" TEXT;

-- ============================================================================
-- PHASE 2: Reminder Tracking
-- ============================================================================

-- Add reminder tracking fields to Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "reminderDueDate" TIMESTAMP(3);

-- ============================================================================
-- PHASE 4: Deposit Tracking
-- ============================================================================

-- Add deposit tracking fields to Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "depositPaidAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "balanceDueDate" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "balancePaidAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "balancePaidAt" TIMESTAMP(3);

-- Add deposit settings to Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "depositPercent" DECIMAL(5,2);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "balanceDueDays" INTEGER DEFAULT 30;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for finding bookings needing reminders (Phase 2)
-- Partial index: Only index bookings that haven't had reminders sent yet
CREATE INDEX IF NOT EXISTS "idx_booking_reminder_due"
ON "Booking" ("tenantId", "reminderDueDate")
WHERE "reminderSentAt" IS NULL AND "status" = 'CONFIRMED';

-- Index for finding bookings needing balance payment (Phase 4)
-- Partial index: Only index bookings with deposit status
CREATE INDEX IF NOT EXISTS "idx_booking_balance_due"
ON "Booking" ("tenantId", "balanceDueDate")
WHERE "balancePaidAt" IS NULL AND "depositPaidAmount" IS NOT NULL;

-- Index for refund tracking queries
CREATE INDEX IF NOT EXISTS "idx_booking_refund_status"
ON "Booking" ("tenantId", "refundStatus")
WHERE "refundStatus" != 'NONE';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify columns were added
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'Booking'
    AND column_name IN ('cancelledBy', 'refundStatus', 'reminderDueDate', 'depositPaidAmount');

  IF col_count < 4 THEN
    RAISE EXCEPTION 'Migration failed: Not all Booking columns were created (found %)', col_count;
  END IF;
END $$;

DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'Tenant'
    AND column_name IN ('depositPercent', 'balanceDueDays');

  IF col_count < 2 THEN
    RAISE EXCEPTION 'Migration failed: Not all Tenant columns were created (found %)', col_count;
  END IF;
END $$;

-- Migration complete
-- Next: Run `npx prisma generate` to update Prisma Client
