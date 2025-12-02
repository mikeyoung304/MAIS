-- Migration: Add new BookingStatus enum values
-- P1-149: Add DEPOSIT_PAID, PAID, and REFUNDED status values

-- Add DEPOSIT_PAID status (deposit received, balance due)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public."BookingStatus"'::regtype
        AND enumlabel = 'DEPOSIT_PAID'
    ) THEN
        ALTER TYPE "BookingStatus" ADD VALUE 'DEPOSIT_PAID' BEFORE 'CONFIRMED';
    END IF;
END $$;

-- Add PAID status (full payment received)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public."BookingStatus"'::regtype
        AND enumlabel = 'PAID'
    ) THEN
        ALTER TYPE "BookingStatus" ADD VALUE 'PAID' BEFORE 'CONFIRMED';
    END IF;
END $$;

-- Add REFUNDED status (full refund processed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'public."BookingStatus"'::regtype
        AND enumlabel = 'REFUNDED'
    ) THEN
        ALTER TYPE "BookingStatus" ADD VALUE 'REFUNDED' AFTER 'CANCELED';
    END IF;
END $$;

-- Note: Existing bookings with CONFIRMED status represent paid bookings
-- No data migration needed - CONFIRMED remains valid and means "payment confirmed"
