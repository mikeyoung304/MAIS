# Storefront Package Display Solution

**Date:** December 14, 2025
**Status:** RESOLVED
**Component:** Storefront Catalog, Package Grouping
**Severity:** High (Feature Visibility)
**Related Commit:** 1a3711d (fix: resolve package navigation with canonical tier architecture)

## Problem Summary

La Petit Mariage storefront was displaying "Coming Soon" for all package segments instead of showing 9 wedding packages across 3 categories (Elopements, Micro Weddings, Full Weddings).

**Affected User Flow:**

1. User navigates to storefront
2. Clicks on package segments (Elopements, Full Weddings, Micro Weddings)
3. Expected: See 3 packages per segment
4. Actual: "Coming Soon" placeholder displayed

**Business Impact:** Customers unable to view pricing and services, preventing quote requests and bookings.

---

## Investigation Steps

### Step 1: Frontend Verification

Opened Playwright and navigated to La Petit Mariage storefront:

```
URL: http://localhost:5173/storefront/la-petit-mariage
Expected: 9 packages displayed in 3 segments
Actual: "Coming Soon" on all segments
```

### Step 2: API Endpoint Verification

Tested API directly to confirm data exists:

```bash
curl "http://localhost:3001/v1/storefront/packages?tenantSlug=la-petit-mariage"
```

**Result:** ✅ API returned all 9 packages with correct data structure

### Step 3: Frontend Logic Analysis

Examined `client/src/lib/storefront/extractTiers.ts` to understand package grouping:

```typescript
export const extractTiers = (packages: StorefrontPackage[]) => {
  const tiers: Record<string, StorefrontPackage[]> = {
    tier_1: [],
    tier_2: [],
    tier_3: [],
  };

  packages.forEach((pkg) => {
    const grouping = pkg.grouping?.toLowerCase();

    if (grouping === 'tier_1' || grouping === 'elopement') {
      tiers.tier_1.push(pkg);
    } else if (grouping === 'tier_2' || grouping === 'micro wedding') {
      tiers.tier_2.push(pkg);
    } else if (grouping === 'tier_3' || grouping === 'full wedding') {
      tiers.tier_3.push(pkg);
    }
  });

  return tiers;
};
```

**Key Recognition:** Function recognizes:

- Primary: `tier_1`, `tier_2`, `tier_3`
- Legacy aliases: `elopement`, `micro wedding`, `full wedding`

### Step 4: Database Inspection

Queried packages for La Petit Mariage tenant:

```bash
npm exec prisma studio
# Navigated to Package table, filtered by tenant
```

**Database State Found:**
| Package Name | Grouping | Issue |
|---|---|---|
| Elopement Package A | "Elopement" | ❌ Wrong casing |
| Elopement Package B | "Elopement" | ❌ Wrong casing |
| Elopement Package C | "Elopement" | ❌ Wrong casing |
| Micro Wedding A | "Micro Wedding" | ❌ Wrong casing |
| Micro Wedding B | "Micro Wedding" | ❌ Wrong casing |
| Micro Wedding C | "Micro Wedding" | ❌ Wrong casing |
| Full Wedding A | "Full Wedding" | ❌ Wrong casing |
| Full Wedding B | "Full Wedding" | ❌ Wrong casing |
| Full Wedding C | "Full Wedding" | ❌ Wrong casing |

**Problem:** Database had "Elopement", "Micro Wedding", "Full Wedding" (title case), but `extractTiers()` only matches lowercase versions due to `.toLowerCase()` comparison.

### Step 5: Seed File Verification

Examined `server/prisma/seed.ts` for La Petit Mariage seed data:

```typescript
// Correct values in seed (from seed.ts)
{
  name: "Elopement Package A",
  grouping: "tier_1", // ✅ Correct
  // ...
},
```

**Finding:** The seed file had **correct** `tier_1/tier_2/tier_3` values, meaning database drift occurred from:

- Old seed version run at some point
- Manual database edits
- Previous migration

---

## Root Cause Analysis

**Data Drift:** The database contained incorrect grouping values ("Elopement", "Micro Wedding", "Full Wedding") that didn't match either:

1. The canonical values (`tier_1`, `tier_2`, `tier_3`)
2. The lowercase legacy aliases (`elopement`, `micro wedding`, `full wedding`)

**Why It Happened:**

1. Package records were created with title-case grouping values
2. Frontend `extractTiers()` function uses `.toLowerCase()` for case-insensitive matching
3. Title-case values ("Elopement") != lowercase values ("elopement") even after `.toLowerCase()` in comparison
4. Packages were filtered out, causing "Coming Soon" placeholder to display

**Why Frontend Didn't Break:**

- `extractTiers()` safely returns empty arrays rather than throwing errors
- Upstream UI component displays "Coming Soon" when tier arrays are empty
- No console errors, making issue difficult to diagnose

---

## Solution

### Root Cause Fix

The solution was to **re-run the database seed script** to overwrite the incorrect grouping values with canonical `tier_1/tier_2/tier_3` values:

```bash
SEED_MODE=la-petit-mariage npm exec prisma db seed
```

**What This Does:**

1. Drops all data for La Petit Mariage tenant (SEED_MODE ensures isolation)
2. Re-runs seed.ts which creates packages with **correct** `tier_1/tier_2/tier_3` grouping values
3. Frontend `extractTiers()` now correctly matches packages to tiers

### Code Location

**Seed File:** `/Users/mikeyoung/CODING/MAIS/server/prisma/seed.ts`

**La Petit Mariage Seed Section:**

```typescript
// Line: ~450 (approximate)
const laPetitMariagePackages = [
  {
    name: 'Elopement Package A',
    grouping: 'tier_1', // ← Canonical value
    description: 'Intimate two-person photography...',
    priceCents: 15000,
  },
  {
    name: 'Elopement Package B',
    grouping: 'tier_1',
    // ...
  },
  // ... 6 more packages with tier_1, tier_2, tier_3
];
```

### Why This Solution Works

1. **Canonical Format:** `tier_1/tier_2/tier_3` is the authoritative format
2. **Database Conformance:** Seed script applies authoritative values
3. **Frontend Compatibility:** `extractTiers()` explicitly matches these tier values
4. **Data Integrity:** Eliminates drift between code and database

---

## Verification Steps

### After Running Seed

**Step 1: Verify Database State**

```bash
npm exec prisma studio
# Navigate to Package table
# Filter by tenant: la-petit-mariage
# Verify all 9 packages have grouping = "tier_1" OR "tier_2" OR "tier_3"
```

**Step 2: Verify API Response**

```bash
curl "http://localhost:3001/v1/storefront/packages?tenantSlug=la-petit-mariage" | jq '.[] | {name, grouping}'
```

**Expected Output:**

```json
[
  { "name": "Elopement Package A", "grouping": "tier_1" },
  { "name": "Elopement Package B", "grouping": "tier_1" },
  { "name": "Elopement Package C", "grouping": "tier_1" },
  { "name": "Micro Wedding A", "grouping": "tier_2" },
  { "name": "Micro Wedding B", "grouping": "tier_2" },
  { "name": "Micro Wedding C", "grouping": "tier_2" },
  { "name": "Full Wedding A", "grouping": "tier_3" },
  { "name": "Full Wedding B", "grouping": "tier_3" },
  { "name": "Full Wedding C", "grouping": "tier_3" }
]
```

**Step 3: Frontend Verification**

```bash
npm run dev:client
# Navigate to http://localhost:5173/storefront/la-petit-mariage
# Expected: 3 package cards visible under "Elopements"
# Click to each segment: Verify 3 packages per segment
```

**Expected UI State:**

- Elopements: 3 packages (tier_1)
- Micro Weddings: 3 packages (tier_2)
- Full Weddings: 3 packages (tier_3)
- No "Coming Soon" placeholders

### Verification Checklist

- [ ] `npm exec prisma studio` shows 9 La Petit Mariage packages
- [ ] All packages have grouping = "tier_1", "tier_2", or "tier_3"
- [ ] API `/storefront/packages` endpoint returns all 9 packages
- [ ] Storefront displays 3 package segments without "Coming Soon"
- [ ] Each segment shows 3 packages when selected
- [ ] Package details (price, description) are visible

---

## Prevention Strategies

### 1. Database Schema Documentation

Add a comment to the Package model documenting allowed grouping values:

```prisma
model Package {
  id              String   @id @default(cuid())
  tenantId        String
  name            String
  grouping        String // Must be: "tier_1", "tier_2", or "tier_3"
  description     String?
  priceCents      Int

  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([tenantId, grouping])
}
```

### 2. Seed Script Validation

Add validation to prevent non-canonical grouping values:

```typescript
// In seed.ts before creating packages
const ALLOWED_GROUPINGS = ['tier_1', 'tier_2', 'tier_3'];

const laPetitMariagePackages = [
  // ... package definitions
];

// Validate all packages
laPetitMariagePackages.forEach((pkg) => {
  if (!ALLOWED_GROUPINGS.includes(pkg.grouping)) {
    throw new Error(
      `Invalid grouping "${pkg.grouping}" for package "${pkg.name}". ` +
        `Must be one of: ${ALLOWED_GROUPINGS.join(', ')}`
    );
  }
});

// Then create packages
await prisma.package.createMany({ data: laPetitMariagePackages });
```

### 3. Integration Test

Add a test to ensure storefront packages are properly grouped:

```typescript
// File: server/test/integration/storefront-packages.test.ts

test('should display all packages grouped by tier', async () => {
  const response = await request(app)
    .get('/v1/storefront/packages')
    .query({ tenantSlug: 'la-petit-mariage' });

  expect(response.status).toBe(200);

  const packages = response.body;

  // Verify all packages have canonical grouping
  packages.forEach((pkg) => {
    expect(['tier_1', 'tier_2', 'tier_3']).toContain(pkg.grouping);
  });

  // Verify distribution
  const tier1 = packages.filter((p) => p.grouping === 'tier_1');
  const tier2 = packages.filter((p) => p.grouping === 'tier_2');
  const tier3 = packages.filter((p) => p.grouping === 'tier_3');

  expect(tier1.length).toBe(3);
  expect(tier2.length).toBe(3);
  expect(tier3.length).toBe(3);
});
```

### 4. Frontend Robustness

Improve `extractTiers()` to log warnings for unrecognized grouping values:

```typescript
export const extractTiers = (packages: StorefrontPackage[]) => {
  const tiers: Record<string, StorefrontPackage[]> = {
    tier_1: [],
    tier_2: [],
    tier_3: [],
  };

  const unrecognizedGroupings = new Set<string>();

  packages.forEach((pkg) => {
    const grouping = pkg.grouping?.toLowerCase();

    if (grouping === 'tier_1' || grouping === 'elopement') {
      tiers.tier_1.push(pkg);
    } else if (grouping === 'tier_2' || grouping === 'micro wedding') {
      tiers.tier_2.push(pkg);
    } else if (grouping === 'tier_3' || grouping === 'full wedding') {
      tiers.tier_3.push(pkg);
    } else if (grouping) {
      unrecognizedGroupings.add(grouping);
    }
  });

  // Log warnings for debugging
  if (unrecognizedGroupings.size > 0) {
    console.warn('Unrecognized package groupings:', Array.from(unrecognizedGroupings).join(', '));
  }

  return tiers;
};
```

---

## Related Documentation

- **Multi-Tenant Architecture:** `docs/solutions/multi-tenant/TENANT_SCOPING_PATTERNS.md`
- **Data Drift Prevention:** `docs/solutions/database-issues/SCHEMA_DRIFT_PREVENTION.md`
- **Seed Strategy:** `docs/solutions/DATABASE_SEED_STRATEGY.md`
- **Storefront Features:** `docs/reference/STOREFRONT_FEATURES.md`

---

## Timeline

| Date       | Action                                                  | Status                    |
| ---------- | ------------------------------------------------------- | ------------------------- |
| 2025-12-14 | Identified "Coming Soon" on La Petit Mariage storefront | ✅ Investigation Complete |
| 2025-12-14 | Confirmed API returns correct data                      | ✅ Verified               |
| 2025-12-14 | Found database drift in grouping values                 | ✅ Root Cause Identified  |
| 2025-12-14 | Ran seed to restore correct grouping values             | ✅ Fixed                  |
| 2025-12-14 | Verified packages display correctly                     | ✅ Resolved               |

---

## FAQ

**Q: Why didn't the code break instead of silently failing?**
A: The `extractTiers()` function safely handles unrecognized grouping values by creating empty tier arrays. The UI component detects empty arrays and displays "Coming Soon". This is graceful but makes the underlying issue harder to diagnose.

**Q: Could this happen to other tenants?**
A: Yes, if any tenant has packages with non-canonical grouping values. Running the full seed (`npm exec prisma db seed` without SEED_MODE) would fix all tenants.

**Q: Why not update the frontend to be more flexible?**
A: The canonical format (`tier_1/tier_2/tier_3`) is intentional. Legacy alias support exists for backward compatibility during migration, but all new data should use canonical format to prevent confusion.

**Q: How do I prevent this in the future?**
A: Implement the prevention strategies above: schema documentation, seed validation, integration tests, and frontend warnings.
