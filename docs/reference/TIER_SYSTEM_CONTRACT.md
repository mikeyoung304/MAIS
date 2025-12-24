# Canonical Tier System Contract

**Version:** 1.0
**Status:** Binding Contract
**Last Updated:** December 14, 2025
**Owner:** Data Architecture / Backend

---

## Source of Truth: Database Layer

The `Package.grouping` field is the single source of truth for tier classification.

### Valid Values (Canonical Tier Names)

| Value    | Display Name                 | Price Tier | Use Case             |
| -------- | ---------------------------- | ---------- | -------------------- |
| `tier_1` | Essential / Good / Budget    | Lowest     | Basic service tier   |
| `tier_2` | Popular / Better / Standard  | Middle     | Recommended tier     |
| `tier_3` | Premium / Best / Luxury      | Highest    | Premium service tier |
| `NULL`   | No Grouping (Flat Structure) | N/A        | Single-tier catalog  |

### Invalid Values (Must Not Appear in Database)

The following values **will cause storefront failure** and must be corrected:

- `"Good"`, `"Better"`, `"Best"` (display names, not database values)
- `"Budget"`, `"Standard"`, `"Premium"` (legacy naming)
- `"Essential"`, `"Popular"`, `"Luxury"` (tenant-specific overrides)
- `"Starter"`, `"Middle"`, `"Deluxe"`, `"Ultimate"` (custom variants)

**Any value not in the canonical list is a data integrity violation.**

---

## Three-Layer Architecture

```
Database Layer (Source of Truth)
  Package.grouping = 'tier_1' | 'tier_2' | 'tier_3' | NULL
           ↓
Service Layer (Business Logic)
  CatalogService.getPackagesByTier('tier_1') → Package[]
           ↓
Frontend Layer (Display)
  useTierDisplayName('tier_1') → "The Grounding Reset"
```

### Layer 1: Database (Canonical Values)

```typescript
// server/prisma/schema.prisma
model Package {
  // ...
  grouping      String?   // MUST BE: tier_1|tier_2|tier_3|NULL
  groupingOrder Int?      // Sort order within tier
  // ...
}
```

### Layer 2: Backend Service

```typescript
// server/src/services/catalog.service.ts
async getPackagesByGrouping(tenantId: string, grouping: string): Promise<Package[]> {
  // Validates grouping is canonical BEFORE querying
  if (!['tier_1', 'tier_2', 'tier_3'].includes(grouping)) {
    throw new ValidationError(`Invalid grouping: ${grouping}`);
  }

  return this.repository.getPackages(tenantId, { grouping });
}
```

### Layer 3: Frontend Display

```typescript
// client/src/features/storefront/hooks.ts
function useTierDisplayName(tenantId: string, tier: 'tier_1' | 'tier_2' | 'tier_3'): string {
  const tenant = useTenant(tenantId);

  // Use tenant-specific override, or default display name
  return (
    tenant?.tierDisplayNames?.[tier] ??
    {
      tier_1: 'Essential',
      tier_2: 'Popular',
      tier_3: 'Premium',
    }[tier]
  );
}
```

**Key Insight:** Display names are configurable per-tenant in `Tenant.tierDisplayNames` JSON field.

---

## Seed File Responsibilities

Every seed must create packages with **canonical grouping values only**.

### Correct Seed Implementation

```typescript
// ✅ CORRECT: Uses canonical tier_1/tier_2/tier_3
async function seedPackages(prisma: PrismaClient, tenantId: string) {
  const packages = [
    {
      name: 'Essential Package',
      slug: 'essential',
      basePrice: 45000, // cents
      grouping: 'tier_1', // Canonical value
      groupingOrder: 1,
    },
    {
      name: 'Popular Package',
      slug: 'popular',
      basePrice: 65000,
      grouping: 'tier_2', // Canonical value
      groupingOrder: 2,
    },
    {
      name: 'Premium Package',
      slug: 'premium',
      basePrice: 95000,
      grouping: 'tier_3', // Canonical value
      groupingOrder: 3,
    },
  ];

  return Promise.all(
    packages.map((pkg) =>
      prisma.package.create({
        data: { tenantId, ...pkg },
      })
    )
  );
}
```

### Incorrect Implementations (Will Break Storefront)

```typescript
// ❌ WRONG: Uses display names instead of canonical values
async function seedPackages(prisma: PrismaClient, tenantId: string) {
  // This will fail because "Essential", "Popular", "Premium" are NOT in tier_1|tier_2|tier_3
  const packages = [
    { name: 'Essential Package', grouping: 'Essential', ... },
    { name: 'Popular Package', grouping: 'Popular', ... },
    { name: 'Premium Package', grouping: 'Premium', ... },
  ];
}

// ❌ WRONG: Uses tenant-specific custom names in database
async function seedPackages(prisma: PrismaClient, tenantId: string) {
  // This will fail because these should be in tierDisplayNames, not Package.grouping
  const packages = [
    { name: '...', grouping: 'The Grounding Reset', ... },
    { name: '...', grouping: 'The Team Recharge', ... },
  ];
}

// ❌ WRONG: Uses legacy aliased names
async function seedPackages(prisma: PrismaClient, tenantId: string) {
  const packages = [
    { name: '...', grouping: 'Budget', ... },          // Should be tier_1
    { name: '...', grouping: 'Standard', ... },        // Should be tier_2
    { name: '...', grouping: 'Luxury', ... },          // Should be tier_3
  ];
}
```

---

## Tenant Customization (Display Names Only)

Tenants can customize **how tiers are displayed** via `Tenant.tierDisplayNames`:

```typescript
// Database: Tenant record
{
  id: 'tenant_abc123',
  name: 'Little Bit Horse Farm',
  tierDisplayNames: {
    "tier_1": "The Grounding Reset",
    "tier_2": "The Team Recharge",
    "tier_3": "The Executive Reset"
  }
}

// Database: Package records (still use canonical names)
{
  id: 'pkg_1',
  name: 'Single Person Retreat',
  grouping: 'tier_1'        // ← Always tier_1 in database
},
{
  id: 'pkg_2',
  name: 'Group Team Retreat',
  grouping: 'tier_2'        // ← Always tier_2 in database
}

// Frontend display
useTierDisplayName('tier_1') → "The Grounding Reset"
useTierDisplayName('tier_2') → "The Team Recharge"
useTierDisplayName('tier_3') → "The Executive Reset"
```

**Critical:** Database `Package.grouping` is ALWAYS canonical. Only `Tenant.tierDisplayNames` is customized.

---

## Testing Responsibilities

Every test and seed must verify canonical grouping values.

### Test Checklist

```typescript
describe('Package Seeding', () => {
  it('should create packages with canonical grouping', async () => {
    const packages = await prisma.package.findMany({
      where: { tenantId: testTenantId },
    });

    // ✅ All grouping values must be canonical
    const validGroupings = new Set(['tier_1', 'tier_2', 'tier_3', null]);
    packages.forEach((pkg) => {
      expect(validGroupings.has(pkg.grouping)).toBe(true);
    });

    // ✅ If grouping is set, ensure complete tier structure
    const groupedPackages = packages.filter((p) => p.grouping !== null);
    if (groupedPackages.length > 0) {
      const groupings = new Set(groupedPackages.map((p) => p.grouping));
      // Recommendation: either all 3 tiers present, or single flat structure
      expect(groupings.size === 1 || groupings.size === 3).toBe(true);
    }
  });

  it('should not create packages with non-canonical grouping', async () => {
    expect(() =>
      prisma.package.create({
        data: {
          tenantId,
          slug: 'bad-package',
          name: 'Bad Package',
          basePrice: 100,
          grouping: 'Budget', // Non-canonical
        },
      })
    ).rejects.toThrow();
  });
});
```

---

## Migration Path (If You Have Old Data)

If your database has non-canonical values, use the standardization migration:

```sql
-- Migration 12: Standardize all grouping values to canonical names
-- File: server/prisma/migrations/12_canonical_tier_names.sql

-- Run once to normalize existing data
npm exec prisma migrate deploy
```

**After migration, verify:**

```sql
-- Should return 0 rows (no drift)
SELECT DISTINCT grouping FROM "Package"
WHERE grouping NOT IN ('tier_1', 'tier_2', 'tier_3')
  AND grouping IS NOT NULL;
```

---

## Detection & Monitoring

### Health Check (Recommended)

Add to your `/health` endpoint:

```typescript
// Check for grouping drift
const driftedPackages = await prisma.package.groupBy({
  by: ['grouping'],
  where: {
    grouping: { notIn: ['tier_1', 'tier_2', 'tier_3'], not: null },
    active: true,
  },
  _count: true,
});

if (driftedPackages.length > 0) {
  logger.warn('ALERT: Package grouping drift detected');
  // Return unhealthy status
}
```

See: [Health Check Implementation Guide](/docs/solutions/HEALTH_CHECK_GROUPING_IMPLEMENTATION.md)

### Manual Audit Query

```sql
-- Find any non-canonical grouping values
SELECT grouping, COUNT(*) as package_count
FROM "Package"
WHERE grouping NOT IN ('tier_1', 'tier_2', 'tier_3')
  AND grouping IS NOT NULL
GROUP BY grouping;

-- Should return: (no rows)
```

---

## FAQ

**Q: Can we have more than 3 tiers?**
A: Not with current canonical values. If needed, extend canonical list (tier_4, tier_5) and update all three layers.

**Q: Can we skip tier_2?**
A: Yes. Use tier_1 + tier_3, or keep NULL for flat structure. Consistency within a tenant is recommended.

**Q: What if a tenant wants custom tier order?**
A: Use `Package.groupingOrder` field to control display order within each tier.

**Q: Where are tenant display names stored?**
A: `Tenant.tierDisplayNames` JSON field. See line 94 of `/server/prisma/schema.prisma`.

**Q: Can I set grouping in the frontend?**
A: No. Frontend only displays tiers via `useTierDisplayName()` hook. Grouping creation is backend-only via seed/API.

---

## Related Files

- **Schema:** `/server/prisma/schema.prisma` (Package model, line 211)
- **Migration 12:** `/server/prisma/migrations/12_canonical_tier_names.sql` (standardization)
- **Migration 13:** `/server/prisma/migrations/13_tenant_tier_display_names.sql` (display names)
- **Service:** `/server/src/services/catalog.service.ts` (query implementation)
- **Repository:** `/server/src/adapters/prisma/catalog.repository.ts` (data access)
- **Seed Example:** `/server/prisma/seeds/little-bit-horse-farm.ts` (reference)
- **Frontend Hook:** `/client/src/features/storefront/hooks.ts` (useTierDisplayName)

---

## Sign-Off

By committing code to this repository, you agree to:

1. Use only canonical grouping values (tier_1/tier_2/tier_3/NULL) in Package.grouping
2. Store custom tier labels in Tenant.tierDisplayNames, not Package.grouping
3. Verify all seeds create canonical grouping values before committing
4. Test grouping values in all new package/seed tests

**Violations of this contract will cause production issues.**

---

**Last Updated:** December 14, 2025
**Binding:** Yes - All MAIS developers must follow this contract
**Questions?** Check `/docs/solutions/PACKAGE_GROUPING_DRIFT_PREVENTION.md`
