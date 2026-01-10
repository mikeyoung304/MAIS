-- Migration: Make Booking.packageId optional for TIMESLOT bookings
-- TIMESLOT bookings use serviceId instead of packageId

-- Make packageId nullable (idempotent - checks if already nullable)
DO $$
BEGIN
    -- Check if the column is NOT NULL and alter it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Booking'
        AND column_name = 'packageId'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "Booking" ALTER COLUMN "packageId" DROP NOT NULL;
        RAISE NOTICE 'Made Booking.packageId nullable';
    ELSE
        RAISE NOTICE 'Booking.packageId is already nullable, skipping';
    END IF;
END $$;
