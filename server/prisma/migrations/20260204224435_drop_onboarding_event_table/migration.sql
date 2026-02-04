-- DropIndex
DROP INDEX "SectionContent_tenantId_segmentId_blockType_key";

-- DropTable (deprecated OnboardingEvent - event sourcing replaced by state-based discoveryFacts)
-- Verified 0 rows in production on 2026-02-04
DROP TABLE IF EXISTS "OnboardingEvent";
