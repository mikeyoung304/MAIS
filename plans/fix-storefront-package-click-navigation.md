# Fix: Storefront Package Click Navigation + Tier Naming Architecture

## Executive Summary

**Issue:** Package clicks on Little Bit Farm storefront don't navigate to detail pages.

**Root Cause:** Mismatch between URL tier slugs (`budget`) and database values (`Good`).

**Solution:** Implement canonical tier architecture with tenant-customizable display names.

**Decisions Made:**
- Canonical tier names: `tier_1`, `tier_2`, `tier_3`
- DHH approach: Migrate DB to canonical, add tenant display config
- Fix all bugs including Kieran's rootPackages filter find

---

## Phase 1: Immediate Bug Fix (Export normalizeGrouping)

**Goal:** Unblock Little Bit Farm storefront TODAY

### Files to Modify

#### 1. Export normalizeGrouping
**File:** `client/src/features/storefront/utils.ts`
```typescript
// Line 36 - Change from private to exported
export function normalizeGrouping(grouping: string): TierLevel | null {
```

#### 2. Add to barrel export
**File:** `client/src/features/storefront/index.ts`
```typescript
export { normalizeGrouping } from './utils';
```

#### 3. Fix SegmentTierDetailContent (line 54)
**File:** `client/src/pages/TierDetailPage.tsx`
```typescript
// Import
import { TierDetail, TIER_LEVELS, normalizeGrouping, type TierLevel } from '@/features/storefront';

// Line 54 - Use normalizeGrouping
const pkg = packages.find((p: PackageDto) => {
  if (!p.grouping) return false;
  return normalizeGrouping(p.grouping) === tierLevel;
});
```

#### 4. Fix RootTierDetailContent (line 110)
**File:** `client/src/pages/TierDetailPage.tsx`
```typescript
// Line 110 - Same fix
const pkg = rootPackages.find((p: PackageDto) => {
  if (!p.grouping) return false;
  return normalizeGrouping(p.grouping) === tierLevel;
});
```

#### 5. Fix rootPackages filter (Kieran's critical find - line 100-107)
**File:** `client/src/pages/TierDetailPage.tsx`
```typescript
// Line 100-107 - Fix filter to use normalizeGrouping
const rootPackages = useMemo(
  () =>
    packages.filter(
      (p: PackageDto) =>
        !p.segmentId && p.grouping && normalizeGrouping(p.grouping) !== null
    ),
  [packages]
);
```

#### 6. Add .trim() to normalizeGrouping
**File:** `client/src/features/storefront/utils.ts`
```typescript
export function normalizeGrouping(grouping: string): TierLevel | null {
  const lower = grouping.trim().toLowerCase(); // Add .trim()
  // ... rest of function
}
```

---

## Phase 2: Database Migration to Canonical Tiers

**Goal:** Migrate all `Package.grouping` values to canonical `tier_1/tier_2/tier_3`

### 2.1 Create Migration SQL

**File:** `server/prisma/migrations/YYYYMMDD_canonical_tier_names/migration.sql`

```sql
-- Migrate existing grouping values to canonical tier names
-- This is a one-way migration - we'll store display names separately

-- Budget tier aliases → tier_1
UPDATE "Package" SET grouping = 'tier_1'
WHERE LOWER(TRIM(grouping)) IN ('budget', 'good', 'essential', 'basic', 'starter');

-- Middle tier aliases → tier_2
UPDATE "Package" SET grouping = 'tier_2'
WHERE LOWER(TRIM(grouping)) IN ('middle', 'better', 'popular', 'standard', 'recommended');

-- Luxury tier aliases → tier_3
UPDATE "Package" SET grouping = 'tier_3'
WHERE LOWER(TRIM(grouping)) IN ('luxury', 'best', 'premium', 'deluxe', 'ultimate');

-- Log any packages that didn't match (for manual review)
-- SELECT id, "tenantId", name, grouping FROM "Package"
-- WHERE grouping NOT IN ('tier_1', 'tier_2', 'tier_3') AND grouping IS NOT NULL;
```

### 2.2 Update Seed Files

**File:** `server/prisma/seeds/little-bit-horse-farm.ts`
- Change `grouping: 'Good'` → `grouping: 'tier_1'`
- Change `grouping: 'Better'` → `grouping: 'tier_2'`
- Change `grouping: 'Best'` → `grouping: 'tier_3'`

### 2.3 Update TIER_LEVELS constant

**File:** `client/src/features/storefront/utils.ts`
```typescript
// Old
export const TIER_LEVELS = ['budget', 'middle', 'luxury'] as const;

// New
export const TIER_LEVELS = ['tier_1', 'tier_2', 'tier_3'] as const;
export type TierLevel = (typeof TIER_LEVELS)[number];
```

### 2.4 Update getTierDisplayName (default display names)

**File:** `client/src/features/storefront/utils.ts`
```typescript
export function getTierDisplayName(tierLevel: TierLevel): string {
  switch (tierLevel) {
    case 'tier_1':
      return 'Essential';
    case 'tier_2':
      return 'Popular';
    case 'tier_3':
      return 'Premium';
  }
}
```

### 2.5 Simplify normalizeGrouping (only canonical names now)

**File:** `client/src/features/storefront/utils.ts`
```typescript
// After migration, this becomes much simpler
export function normalizeGrouping(grouping: string): TierLevel | null {
  const normalized = grouping.trim().toLowerCase();
  if (TIER_LEVELS.includes(normalized as TierLevel)) {
    return normalized as TierLevel;
  }
  return null;
}
```

---

## Phase 3: Add Tenant Tier Display Names

**Goal:** Allow tenants to customize how tiers appear in their storefront

### 3.1 Schema Update

**File:** `server/prisma/schema.prisma`
```prisma
model Tenant {
  // ... existing fields ...

  // Tier display name customization
  // Structure: {"tier_1": "The Grounding Reset", "tier_2": "The Team Recharge", "tier_3": "The Executive Reset"}
  tierDisplayNames Json? @default("{}")
}
```

### 3.2 Migration

**File:** `server/prisma/migrations/YYYYMMDD_tenant_tier_display_names/migration.sql`
```sql
-- Add tierDisplayNames column
ALTER TABLE "Tenant" ADD COLUMN "tierDisplayNames" JSONB DEFAULT '{}';

-- Backfill Little Bit Horse Farm with their original names
UPDATE "Tenant"
SET "tierDisplayNames" = '{"tier_1": "The Grounding Reset", "tier_2": "The Team Recharge", "tier_3": "The Executive Reset"}'
WHERE slug = 'little-bit-farm';
```

### 3.3 DTO Schema

**File:** `packages/contracts/src/dto.ts`
```typescript
export const TierDisplayNamesSchema = z.object({
  tier_1: z.string().max(50).optional(),
  tier_2: z.string().max(50).optional(),
  tier_3: z.string().max(50).optional(),
});

// Add to TenantPublicDtoSchema
export const TenantPublicDtoSchema = z.object({
  // ... existing fields ...
  tierDisplayNames: TierDisplayNamesSchema.optional(),
});
```

### 3.4 Tenant Admin API Endpoint

**File:** `packages/contracts/src/api.v1.ts`
```typescript
updateTierDisplayNames: {
  method: 'PUT',
  path: '/v1/tenant-admin/settings/tier-names',
  body: TierDisplayNamesSchema,
  responses: {
    200: z.object({ success: z.boolean() }),
    400: ValidationErrorSchema,
  },
},
```

### 3.5 Server Route Implementation

**File:** `server/src/routes/tenant-admin.routes.ts`
```typescript
// Add endpoint to update tier display names
router.put('/settings/tier-names', async (req, res) => {
  const { tier_1, tier_2, tier_3 } = req.body;

  await prisma.tenant.update({
    where: { id: req.tenantId },
    data: {
      tierDisplayNames: { tier_1, tier_2, tier_3 },
    },
  });

  return res.json({ success: true });
});
```

---

## Phase 4: Update Frontend Architecture

**Goal:** Use tenant's display names in storefront UI

### 4.1 Update TenantStorefrontLayout to expose tier names

**File:** `client/src/app/TenantStorefrontLayout.tsx`
```typescript
// Add tierDisplayNames to context
const tierDisplayNames = tenant?.tierDisplayNames ?? {};
```

### 4.2 Create useTierDisplayName hook

**File:** `client/src/features/storefront/hooks.ts`
```typescript
import { useTenantContext } from '@/app/TenantStorefrontLayout';
import { getTierDisplayName, type TierLevel } from './utils';

export function useTierDisplayName(tierLevel: TierLevel): string {
  const { tenant } = useTenantContext();

  // Use tenant's custom name if available, otherwise default
  return tenant?.tierDisplayNames?.[tierLevel] ?? getTierDisplayName(tierLevel);
}
```

### 4.3 Update TierCard to use display names

**File:** `client/src/features/storefront/TierCard.tsx`
```typescript
import { useTierDisplayName } from './hooks';

// In component:
const displayName = useTierDisplayName(tierLevel);

// Use displayName instead of getTierDisplayName(tierLevel)
```

### 4.4 Update TierDetail to use display names

**File:** `client/src/features/storefront/TierDetail.tsx`
```typescript
// Similar updates to show tenant's custom tier names
```

### 4.5 Update URL structure

**File:** `client/src/router.tsx`
```typescript
// URLs now use canonical tier names
// /t/:tenantSlug/s/:slug/tier_1  (instead of /budget)
// /t/:tenantSlug/s/:slug/tier_2  (instead of /middle)
// /t/:tenantSlug/s/:slug/tier_3  (instead of /luxury)
```

### 4.6 Add legacy URL redirects

**File:** `client/src/pages/TierDetailPage.tsx`
```typescript
// Redirect old URLs to new canonical URLs
const LEGACY_TIER_REDIRECTS: Record<string, TierLevel> = {
  'budget': 'tier_1',
  'middle': 'tier_2',
  'luxury': 'tier_3',
  'good': 'tier_1',
  'better': 'tier_2',
  'best': 'tier_3',
};

// At top of component:
if (tier && tier in LEGACY_TIER_REDIRECTS) {
  return <Navigate to={`../${LEGACY_TIER_REDIRECTS[tier]}`} replace />;
}
```

---

## Phase 5: Testing & Verification

### 5.1 Unit Tests for normalizeGrouping

**File:** `client/src/features/storefront/utils.test.ts`
```typescript
describe('normalizeGrouping', () => {
  it('normalizes tier_1', () => {
    expect(normalizeGrouping('tier_1')).toBe('tier_1');
    expect(normalizeGrouping('TIER_1')).toBe('tier_1');
    expect(normalizeGrouping(' tier_1 ')).toBe('tier_1');
  });

  // Similar for tier_2, tier_3

  it('returns null for unknown values', () => {
    expect(normalizeGrouping('unknown')).toBeNull();
    expect(normalizeGrouping('good')).toBeNull(); // No longer supported after migration
  });
});
```

### 5.2 E2E Test for Package Navigation

**File:** `e2e/tests/storefront-navigation.spec.ts`
```typescript
test('navigates from tier card to detail page', async ({ page }) => {
  await page.goto('/t/little-bit-farm/s/corporate-wellness-retreat');

  // Click tier_1 card (The Grounding Reset)
  await page.getByTestId('tier-card-tier_1').click();

  // Verify URL
  await expect(page).toHaveURL(/.*\/tier_1$/);

  // Verify content
  await expect(page.getByRole('heading')).toContainText('Grounding Reset');
  await expect(page.getByRole('button', { name: /Book Now/i })).toBeVisible();
});

test('legacy URLs redirect to canonical', async ({ page }) => {
  await page.goto('/t/little-bit-farm/s/corporate-wellness-retreat/budget');
  await expect(page).toHaveURL(/.*\/tier_1$/);
});
```

### 5.3 Manual Testing Checklist

- [ ] Navigate to `/t/little-bit-farm`
- [ ] Click segment card → lands on tier selector
- [ ] Click each tier card → navigates to detail page
- [ ] Verify tenant's custom tier names displayed
- [ ] Verify "Book Now" button works
- [ ] Test legacy URL redirects
- [ ] Verify no console errors

---

## Implementation Order

| Phase | Tasks | Parallel Agents |
|-------|-------|-----------------|
| **1** | Fix bug (export normalizeGrouping, fix 3 locations) | 1 agent |
| **2** | DB migration + seed updates + TIER_LEVELS update | 2 agents |
| **3** | Schema + API for tierDisplayNames | 2 agents |
| **4** | Frontend updates (hooks, components, router) | 3 agents |
| **5** | Tests + verification | 2 agents |

---

## Success Criteria

1. Little Bit Farm storefront navigation works
2. All tiers use canonical `tier_1/tier_2/tier_3` in database
3. Tenant display names show in UI
4. Legacy URLs redirect correctly
5. All tests pass
6. No console errors

---

Generated with [Claude Code](https://claude.com/claude-code)
