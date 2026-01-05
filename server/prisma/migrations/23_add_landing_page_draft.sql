-- Add landingPageConfigDraft column for Build Mode editing
-- This stores the draft version of landing page config before publishing

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Tenant'
    AND column_name = 'landingPageConfigDraft'
  ) THEN
    ALTER TABLE "Tenant" ADD COLUMN "landingPageConfigDraft" JSONB;
    COMMENT ON COLUMN "Tenant"."landingPageConfigDraft" IS
      'Draft version of landing page config for Build Mode editing. Published via copy to landingPageConfig.';
  END IF;
END $$;
