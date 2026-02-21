-- Replace OnboardingPhase enum with OnboardingStatus enum
-- State machine: PENDING_PAYMENT → PENDING_INTAKE → BUILDING → SETUP → COMPLETE
-- No real users — clean replacement, no data preservation needed

-- Step 1: Drop the default on the old column
ALTER TABLE "Tenant" ALTER COLUMN "onboardingPhase" DROP DEFAULT;

-- Step 2: Create the new OnboardingStatus enum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING_INTAKE', 'BUILDING', 'SETUP', 'COMPLETE');

-- Step 3: Add new column with the new enum
ALTER TABLE "Tenant" ADD COLUMN "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT';

-- Step 4: Backfill existing tenants based on old phase
-- COMPLETED/SKIPPED → COMPLETE (they've been through onboarding)
-- BUILDING → SETUP (they were mid-onboarding, put them in setup)
-- NOT_STARTED → PENDING_PAYMENT (new flow)
UPDATE "Tenant" SET "onboardingStatus" = 'COMPLETE' WHERE "onboardingPhase" IN ('COMPLETED', 'SKIPPED');
UPDATE "Tenant" SET "onboardingStatus" = 'SETUP' WHERE "onboardingPhase" = 'BUILDING';
UPDATE "Tenant" SET "onboardingStatus" = 'PENDING_PAYMENT' WHERE "onboardingPhase" = 'NOT_STARTED';

-- Step 5: Drop the old column and enum
ALTER TABLE "Tenant" DROP COLUMN "onboardingPhase";
DROP TYPE "OnboardingPhase";

-- Step 6: Add build pipeline fields
ALTER TABLE "Tenant" ADD COLUMN "buildStatus" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "buildError" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "buildIdempotencyKey" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "dismissedChecklistItems" TEXT[] NOT NULL DEFAULT '{}';

-- Step 7: Add unique constraint for build idempotency
CREATE UNIQUE INDEX "Tenant_buildIdempotencyKey_key" ON "Tenant"("buildIdempotencyKey");
