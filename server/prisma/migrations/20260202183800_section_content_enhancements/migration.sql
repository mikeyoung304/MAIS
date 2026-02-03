-- Section Content Enhancements Migration
--
-- This migration adds:
-- 1. FEATURES to BlockType enum (for feature highlight sections)
-- 2. pageName field to SectionContent for multi-page support
-- 3. Updated unique constraint to include pageName
-- 4. Index for efficient page-based queries
--
-- @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md

-- Add FEATURES to BlockType enum
ALTER TYPE "BlockType" ADD VALUE 'FEATURES';

-- Add pageName field with default 'home' for existing rows
ALTER TABLE "SectionContent" ADD COLUMN "pageName" TEXT NOT NULL DEFAULT 'home';

-- Drop the old unique constraint
ALTER TABLE "SectionContent" DROP CONSTRAINT IF EXISTS "SectionContent_tenantId_segmentId_blockType_key";

-- Add new unique constraint that includes pageName
-- This allows multiple sections of the same blockType on different pages
ALTER TABLE "SectionContent" ADD CONSTRAINT "SectionContent_tenantId_segmentId_blockType_pageName_key"
  UNIQUE ("tenantId", "segmentId", "blockType", "pageName");

-- Add index for efficient page-based queries with ordering
CREATE INDEX "SectionContent_tenantId_pageName_order_idx"
  ON "SectionContent"("tenantId", "pageName", "order");
