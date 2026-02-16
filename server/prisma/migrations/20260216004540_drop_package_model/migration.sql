-- Drop Package model and all related references
-- Safe: No real user data exists, only seed data

-- Drop PackageAddOn join table
DROP TABLE IF EXISTS "PackageAddOn";

-- Drop packageId from Booking
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_packageId_fkey";
DROP INDEX IF EXISTS "Booking_packageId_idx";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "packageId";

-- Drop Package table
DROP TABLE IF EXISTS "Package";

-- Update audit log references from Package to Tier
UPDATE "ConfigChangeLog"
SET "entityType" = 'Tier'
WHERE "entityType" = 'Package';
