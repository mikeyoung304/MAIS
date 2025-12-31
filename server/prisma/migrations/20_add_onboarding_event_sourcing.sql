-- Migration: 20_add_onboarding_event_sourcing
-- Description: Add OnboardingEvent model and Tenant onboarding fields for agent-powered tenant onboarding
-- Date: 2025-12-31
-- Related: Agent-Powered Tenant Onboarding Phase 1

-- ============================================================================
-- Step 1: Create OnboardingPhase enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "OnboardingPhase" AS ENUM (
    'NOT_STARTED',
    'DISCOVERY',
    'MARKET_RESEARCH',
    'SERVICES',
    'MARKETING',
    'COMPLETED',
    'SKIPPED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Step 2: Add onboarding fields to Tenant table
-- ============================================================================

-- Add onboardingPhase column with default
ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "onboardingPhase" "OnboardingPhase" NOT NULL DEFAULT 'NOT_STARTED';

-- Add onboardingCompletedAt column
ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- Add onboardingVersion column for optimistic locking
ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "onboardingVersion" INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- Step 3: Create OnboardingEvent table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "OnboardingEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL,

  CONSTRAINT "OnboardingEvent_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Step 4: Add indexes for OnboardingEvent
-- ============================================================================

-- Index for querying events by tenant and timestamp (for replay)
CREATE INDEX IF NOT EXISTS "OnboardingEvent_tenantId_timestamp_idx"
ON "OnboardingEvent"("tenantId", "timestamp");

-- Index for querying events by tenant and version (for optimistic locking)
CREATE INDEX IF NOT EXISTS "OnboardingEvent_tenantId_version_idx"
ON "OnboardingEvent"("tenantId", "version");

-- ============================================================================
-- Step 5: Add foreign key constraint
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE "OnboardingEvent"
  ADD CONSTRAINT "OnboardingEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify enum exists
DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingPhase'),
    'OnboardingPhase enum should exist';
END $$;

-- Verify columns exist
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Tenant' AND column_name = 'onboardingPhase'
  ), 'Tenant.onboardingPhase column should exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Tenant' AND column_name = 'onboardingVersion'
  ), 'Tenant.onboardingVersion column should exist';
END $$;

-- Verify table exists
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'OnboardingEvent'
  ), 'OnboardingEvent table should exist';
END $$;
