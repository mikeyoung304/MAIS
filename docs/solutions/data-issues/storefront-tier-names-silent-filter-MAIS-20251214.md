---
title: 'Storefront Package Categories Display Silently Fails with Custom Tier Names'
slug: 'storefront-tier-names-silent-filter'
category: 'data-issues'
tags:
  - tier-architecture
  - data-mismatch
  - storefront
  - seed-data
  - canonical-naming
  - silent-failure
date_documented: 2025-12-14
severity: high
symptoms:
  - "Package category buttons show 'Coming Soon' instead of packages"
  - 'No error messages or console warnings'
  - 'API returns correct data but UI filters it out'
affected_components:
  - client/src/features/storefront/utils.ts
  - server/prisma/seeds/la-petit-mariage.ts
  - Database Package.grouping field
---

# Storefront Packages Not Displaying - Silent Tier Name Filter

## Problem

La Petit Mariage customer storefront showed "Coming Soon" on category pages instead of displaying 9 wedding packages. No errors in console or API - packages silently filtered out.

## Symptoms

- Elopements: "Coming Soon" (0/3 packages visible)
- Micro-Weddings: 1 package visible (1/3)
- Full-Weddings: "Coming Soon" (0/3 packages visible)

## Root Cause

Database had incorrect `grouping` field values:

| Segment        | Database Value  | Expected Value       |
| -------------- | --------------- | -------------------- |
| Elopements     | "Elopement"     | tier_1/tier_2/tier_3 |
| Micro-Weddings | "Micro Wedding" | tier_1/tier_2/tier_3 |
| Full-Weddings  | "Full Wedding"  | tier_1/tier_2/tier_3 |

The frontend `extractTiers()` function (`client/src/features/storefront/utils.ts:93-110`) only recognizes:

- Canonical: `tier_1`, `tier_2`, `tier_3`
- Legacy aliases: `budget`, `middle`, `luxury`, `good`, `better`, `best`, etc.

Custom names like "Elopement" are **silently dropped** - no warning, no error.

## Investigation Steps

1. **Playwright verification** - Confirmed "Coming Soon" on 2/3 segments
2. **API check** - `GET /v1/segments/elopements/packages` returned all packages correctly
3. **Frontend analysis** - `extractTiers()` filters by `normalizeGrouping()` which returns `null` for unrecognized values
4. **Database query** - Found wrong grouping values
5. **Seed file check** - Confirmed seed has correct `tier_1/tier_2/tier_3` values

## Solution

Re-run the seed (already has correct values):

```bash
SEED_MODE=la-petit-mariage npm exec prisma db seed
```

The seed uses idempotent upserts - safe to run multiple times.

## Verification

```bash
# Check database
psql "$DATABASE_URL" -c "
  SELECT s.slug, p.slug, p.grouping
  FROM \"Package\" p
  JOIN \"Segment\" s ON p.\"segmentId\" = s.id
  JOIN \"Tenant\" t ON p.\"tenantId\" = t.id
  WHERE t.slug = 'la-petit-mariage'
  ORDER BY s.slug, p.\"groupingOrder\";
"

# Expected: All packages show tier_1, tier_2, or tier_3
```

Then visit `/t/la-petit-mariage` and verify each category shows 3 packages.

## Prevention

**Detection (add to `npm run doctor`):**

```sql
SELECT COUNT(*) FROM "Package"
WHERE grouping NOT IN ('tier_1', 'tier_2', 'tier_3')
  AND grouping IS NOT NULL;
-- Should return 0
```

**If this recurs:** Consider adding CHECK constraint to Package.grouping field.

## Related Documentation

- `docs/solutions/integration-issues/storefront-cors-and-tier-display-regression.md`
- `docs/solutions/SCHEMA_DRIFT_PREVENTION.md`
- `plans/fix-storefront-package-click-navigation.md`

## Key Lesson

Silent filtering is dangerous. When `normalizeGrouping()` doesn't recognize a value, it returns `null` and the package disappears without trace. Consider adding console.warn for unrecognized groupings in development mode.
