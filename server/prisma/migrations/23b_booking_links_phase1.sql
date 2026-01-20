-- Migration: 23_booking_links_phase1.sql
-- Description: Add booking link scheduling fields to Service and Tenant models
-- Phase: Booking Links Phase 1 (Calendly-style scheduling)
-- Date: 2026-01-05
--
-- Changes:
-- 1. Service: Add minNoticeMinutes, maxAdvanceDays, maxPerDay columns
-- 2. Tenant: Add timezone column
--
-- This migration is idempotent and can be safely re-run.

-- ============================================================================
-- Service Model: Booking Link Settings
-- ============================================================================

-- Add minNoticeMinutes - minimum advance notice required (default 2 hours)
ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "minNoticeMinutes" INTEGER NOT NULL DEFAULT 120;

-- Add maxAdvanceDays - how far in advance bookings can be made (default 60 days)
ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60;

-- Add maxPerDay - maximum bookings per day (null = unlimited)
ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "maxPerDay" INTEGER;

-- ============================================================================
-- Tenant Model: Timezone Setting
-- ============================================================================

-- Add timezone - tenant's timezone for availability calculations
ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/New_York';

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN "Service"."minNoticeMinutes" IS 'Minimum advance notice required before booking (in minutes). Default: 120 (2 hours)';
COMMENT ON COLUMN "Service"."maxAdvanceDays" IS 'How far in advance bookings can be made (in days). Default: 60 days';
COMMENT ON COLUMN "Service"."maxPerDay" IS 'Maximum bookings allowed per day. NULL means unlimited.';
COMMENT ON COLUMN "Tenant"."timezone" IS 'Tenant timezone for availability calculations. IANA timezone identifier (e.g., America/New_York)';
