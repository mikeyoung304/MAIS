-- Remove legacy OnboardingPhase enum values: DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING
-- These were replaced by BUILDING in the onboarding conversation redesign (PR #47)
-- Safety: First migrate any rows still using dead values to BUILDING

-- Step 1: Migrate any remaining rows using dead values
UPDATE "Tenant"
SET "onboardingPhase" = 'BUILDING'
WHERE "onboardingPhase" IN ('DISCOVERY', 'MARKET_RESEARCH', 'SERVICES', 'MARKETING');

-- Step 2: Recreate enum type without dead values
-- PostgreSQL doesn't support DROP VALUE from enums, so we recreate the type
CREATE TYPE "OnboardingPhase_new" AS ENUM ('NOT_STARTED', 'BUILDING', 'COMPLETED', 'SKIPPED');

-- Step 3: Alter column to use new type
ALTER TABLE "Tenant"
  ALTER COLUMN "onboardingPhase"
  TYPE "OnboardingPhase_new"
  USING "onboardingPhase"::text::"OnboardingPhase_new";

-- Step 4: Drop old type and rename
DROP TYPE "OnboardingPhase";
ALTER TYPE "OnboardingPhase_new" RENAME TO "OnboardingPhase";
