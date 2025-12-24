# Package Grouping Drift Prevention

**Issue:** Database values for `Package.grouping` drifted from canonical tier names (tier_1/tier_2/tier_3) to custom names, causing packages to fail display in storefront.

**Timeline:**

- Canonical tier migration (commit 1a3711d, Dec 13) standardized all grouping values
- La Petit Mariage seed used custom names instead (commit ba13f94)
- Storefront failed to display packages with non-canonical grouping values

**Root Cause:** Unknown mechanism (likely old seed version or manual database edit)

**Current Safeguards:**

- Migration 12 standardizes existing data to tier_1/tier_2/tier_3
- Seed files use correct canonical values
- Frontend supports both canonical + legacy aliases via normalizeGrouping()

---

## Prevention Strategy 1: Health Check Query (Detection-First)

**Purpose:** Catch grouping drift early via automated detection

**Implementation:**

Add this query to your health check/diagnostics endpoint:

```typescript
// server/src/routes/health.routes.ts (add to existing health check)

async function checkPackageGroupingHealth(prisma: PrismaClient): Promise<HealthCheckResult> {
  // Query packages with non-canonical grouping values
  const driftedPackages = await prisma.package.groupBy({
    by: ['grouping'],
    where: {
      grouping: {
        notIn: ['tier_1', 'tier_2', 'tier_3'],
      },
      active: true, // Only check active packages
    },
    _count: true,
  });

  if (driftedPackages.length === 0) {
    return { status: 'healthy', message: 'All packages have canonical tier names' };
  }

  // Log alert with details
  const drift = driftedPackages.map((g) => `${g.grouping} (${g._count} packages)`);
  logger.warn('CRITICAL: Package grouping drift detected', {
    driftedGroupings: drift,
  });

  return {
    status: 'degraded',
    message: `Found ${driftedPackages.length} non-canonical grouping values`,
    driftedGroupings: drift,
  };
}
```

**When to Run:**

- Part of `/health` endpoint (called every minute by monitoring)
- Manual: `curl http://localhost:3001/health`
- CI: Run before/after seed in test suite

**Output Example:**

```json
{
  "status": "degraded",
  "message": "Found 2 non-canonical grouping values",
  "driftedGroupings": ["Good (3 packages)", "Premium (5 packages)"]
}
```

**Why This Works:**

- Simple GROUP BY query with zero overhead
- Catches drift before storefront breaks
- Actionable output (tells you exact non-canonical values)
- No false positives (NULL grouping is allowed)

---

## Prevention Strategy 2: Documentation - Canonical Tier Contract

**Purpose:** Document the tier system as a contract that both DB and seed must honor

**Location:** `/docs/reference/TIER_SYSTEM_CONTRACT.md`

**Content:**

````markdown
# Canonical Tier System Contract

## Database Layer (Source of Truth)

Package.grouping field MUST contain only these values:

| Value  | Meaning             | Price Tier |
| ------ | ------------------- | ---------- |
| tier_1 | Essential/Good tier | Lowest     |
| tier_2 | Popular/Better tier | Middle     |
| tier_3 | Premium/Best tier   | Highest    |
| NULL   | No grouping (flat)  | N/A        |

**Invalid values:** "Good", "Better", "Best", "Budget", "Standard", "Luxury"

## Seed File Responsibility

Every seed MUST create packages with canonical grouping:

```typescript
// CORRECT
const packages = [
  { name: 'Essential', grouping: 'tier_1', ... },
  { name: 'Popular', grouping: 'tier_2', ... },
];

// WRONG - Will cause storefront failure
const packages = [
  { name: 'Budget Package', grouping: 'Budget', ... },  // ❌ Non-canonical
];
```
````

## Frontend Layer (Consumer)

Tier display names are configured per-tenant:

```typescript
// Tenant configuration (tenant.tierDisplayNames JSON field)
{
  "tier_1": "The Grounding Reset",
  "tier_2": "The Team Recharge",
  "tier_3": "The Executive Reset"
}

// Frontend uses this mapping to display custom labels
// while maintaining canonical database values
```

## Detection & Recovery

If drift is detected:

1. **Immediate:** Check health endpoint for drift details
2. **Diagnosis:** Query `SELECT DISTINCT grouping FROM Package WHERE grouping NOT IN (...)`
3. **Fix:** Run migration 12 again or manual UPDATE

```sql
-- Manual fix for specific tenant
UPDATE "Package"
SET grouping = 'tier_1'
WHERE tenantId = 'tenant_id' AND grouping IN ('Budget', 'Good', 'Basic');
```

## Testing

Every seed/test that creates packages MUST verify grouping:

```typescript
// Add to seed tests
it('should create packages with canonical grouping', async () => {
  const packages = await prisma.package.findMany({
    where: { tenantId: 'test_tenant' },
  });

  const validGroupings = new Set(['tier_1', 'tier_2', 'tier_3', null]);
  packages.forEach((pkg) => {
    expect(validGroupings.has(pkg.grouping)).toBe(true);
  });
});
```

````

---

## Prevention Strategy 3: Optional Future Safeguard (Only if Repeats)

**Trigger:** If grouping drift happens again after implementing strategies 1 & 2

**Implementation:** Add database constraint (with audit logging)

```sql
-- Add CHECK constraint to database schema (Pattern B: Manual SQL)
ALTER TABLE "Package"
ADD CONSTRAINT check_grouping_canonical
CHECK (grouping IS NULL OR grouping IN ('tier_1', 'tier_2', 'tier_3'));

-- If constraint violation occurs, PostgreSQL will return:
-- ERROR: new row for relation "Package" violates check constraint "check_grouping_canonical"
````

**Trade-offs:**

- **Pro:** Prevents drift at database layer (guaranteed)
- **Con:** Requires migration if new tier levels added
- **When:** Only deploy if drift happens repeatedly

**Add to schema.prisma documentation:**

```typescript
model Package {
  // ...
  grouping      String? // CHECK: tier_1|tier_2|tier_3|NULL (enforced by constraint)
}
```

---

## Quick Reference Checklist

When you encounter package grouping issues:

- [ ] Run health check: `/health`
- [ ] Check detected drift groupings in output
- [ ] Query the affected packages: `SELECT * FROM "Package" WHERE grouping NOT IN (...)`
- [ ] Verify seed file uses canonical values
- [ ] Confirm Tenant.tierDisplayNames is configured
- [ ] Run migration 12 to normalize: `prisma migrate deploy`
- [ ] Test seed: `npm run db:seed`
- [ ] Verify storefront displays tiers correctly

---

## Implementation Priority

**Priority 1 (Deploy Immediately):** Health check detection

- 30 minutes to implement
- Zero breaking changes
- Catches issues day-1

**Priority 2 (This Sprint):** Documentation contract

- 15 minutes to write
- Prevents human error in new seeds
- Reference for code reviews

**Priority 3 (Optional):** Database constraint

- Deploy only if drift repeats
- Requires downtime migration
- Strong guarantee but less flexible

---

## Related Files

- Migration 12: `/server/prisma/migrations/12_canonical_tier_names.sql`
- Tier display names: `/server/src/adapters/prisma/tenant.repository.ts` (lines 259-268)
- Frontend normalization: `/client/src/features/storefront/utils.ts` (normalizeGrouping)
- Seed reference: `/server/prisma/seeds/little-bit-horse-farm.ts` (lines 314, 341, 369)

---

## Monitoring

Add to your monitoring dashboard:

```
Metric: package_grouping_canonical_compliance
Query: COUNT(*) FROM Package WHERE grouping NOT IN ('tier_1', 'tier_2', 'tier_3') AND grouping IS NOT NULL
Alert if: > 0 packages with non-canonical grouping
```

---

**Last Updated:** December 14, 2025
**Owner:** Prevention Strategy / Cloud Architecture
**Status:** Implemented (Priority 1 ready, Priority 2 documentation added)
