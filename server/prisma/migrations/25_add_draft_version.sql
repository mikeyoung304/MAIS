-- Migration: Add optimistic locking version field for landing page drafts
-- Purpose: Prevents silent data loss when multiple tabs edit the same draft
-- Issue: #620

-- Add version counter for optimistic locking on draft edits
-- Default 0 ensures backward compatibility with existing tenants
ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "landingPageConfigDraftVersion" INTEGER NOT NULL DEFAULT 0;

-- Note: No index needed - this field is only used in WHERE clause during draft writes,
-- which always include the tenantId primary key for efficient lookup.
