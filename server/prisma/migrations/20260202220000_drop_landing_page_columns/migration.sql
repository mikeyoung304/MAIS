-- Phase 5.2 Section Content Migration: Drop legacy landingPageConfig columns
-- All storefront content is now stored in SectionContent table via SectionContentService
-- See: docs/plans/2026-02-02-refactor-section-content-phase-5.2-simplified-plan.md

-- Drop the three legacy columns
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfig";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfigDraft";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "landingPageConfigDraftVersion";
