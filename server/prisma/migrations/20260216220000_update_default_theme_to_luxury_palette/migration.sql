-- Update default theme colors to warm luxury palette
-- WCAG AA: accent #5A7C65 on white text = 4.67:1 contrast ratio
-- Only affects NEW tenants — existing tenants keep their stored values
ALTER TABLE "Tenant"
  ALTER COLUMN "primaryColor" SET DEFAULT '#1C1917',
  ALTER COLUMN "secondaryColor" SET DEFAULT '#A78B5A',
  ALTER COLUMN "accentColor" SET DEFAULT '#5A7C65',
  ALTER COLUMN "backgroundColor" SET DEFAULT '#FAFAF7';
