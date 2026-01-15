---
title: Atomic Tenant Provisioning with Defense-in-Depth
category: patterns
tags: [tenant-provisioning, atomic-transactions, defense-in-depth, di-container, dry-constants, prisma]
severity: p1
date: 2026-01-05
symptoms:
  - Empty storefronts with no packages displayed
  - Tenants created but unusable
  - Segments missing for new tenants
  - "No packages found" errors in customer chatbot
root_cause: Admin API bypassed TenantOnboardingService, creating tenants without segments/packages
components_affected:
  - server/src/services/tenant-provisioning.service.ts
  - server/src/lib/tenant-defaults.ts
  - server/src/di.ts
  - server/src/routes/admin/tenants.routes.ts
related_commits:
  - 57868990 (atomic tenant provisioning fix)
  - 492a947e (P2 code review fixes)
related_todos:
  - "#629: upsert_package creates orphaned packages"
  - "#630: admin API skips tenant onboarding"
  - "#633: duplicate tenant defaults constants"
  - "#634: TenantProvisioningService not in DI"
---

# Atomic Tenant Provisioning with Defense-in-Depth

## Problem Statement

The admin API (`POST /api/v1/admin/tenants`) was creating tenant records without their required segments and packages, leaving tenants in an orphaned state where:

- Storefronts showed no services
- Customer chatbots returned "no packages found"
- Tenants were technically created but completely unusable

**Root Cause:** Two separate code paths existed:

1. **Signup flow** - Used `TenantOnboardingService` (correct, atomic)
2. **Admin API** - Created tenant directly without segments/packages (broken)

## Solution

### 1. Atomic Transaction Pattern

Created `TenantProvisioningService` that wraps all tenant creation in a single transaction:

```typescript
// server/src/services/tenant-provisioning.service.ts
export class TenantProvisioningService {
  constructor(private readonly prisma: PrismaClient) {}

  async createFullyProvisioned(input: AdminCreateTenantInput): Promise<ProvisionedTenantResult> {
    const { slug, name, commissionPercent = 10.0 } = input;

    // Generate API keys BEFORE transaction (avoid retry issues)
    const keys = apiKeyService.generateKeyPair(slug);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name,
          apiKeyPublic: keys.publicKey,
          apiKeySecret: keys.secretKeyHash,
          commissionPercent,
        },
      });

      // 2. Create default segment
      const segment = await tx.segment.create({
        data: {
          tenantId: tenant.id,
          ...DEFAULT_SEGMENT,
          sortOrder: 0,
          active: true,
        },
      });

      // 3. Create default packages (parallel within transaction)
      const packages = await Promise.all(
        Object.values(DEFAULT_PACKAGE_TIERS).map((tier) =>
          tx.package.create({
            data: {
              tenantId: tenant.id,
              segmentId: segment.id, // Critical: links to segment
              ...tier,
              active: true,
            },
          })
        )
      );

      return { tenant, segment, packages };
    });

    return { ...result, secretKey: keys.secretKey };
  }
}
```

**Key Guarantees:**

- Either ALL entities created (tenant + segment + 3 packages) or NONE
- No orphaned tenants possible
- Single source of truth for provisioning logic

### 2. Defense-in-Depth: Segment Validation

Even with atomic transactions, we added service-layer validation to prevent orphaned packages:

```typescript
// In package upsert operations
async upsertPackage(tenantId: string, data: PackageInput) {
  let resolvedSegmentId = data.segmentId;

  if (!resolvedSegmentId) {
    // Auto-assign to "General" segment if not provided
    const generalSegment = await this.prisma.segment.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'general' } },
    });
    if (generalSegment) {
      resolvedSegmentId = generalSegment.id;
    }
  } else {
    // Verify segment belongs to tenant (prevent cross-tenant access)
    const segment = await this.prisma.segment.findFirst({
      where: { id: resolvedSegmentId, tenantId },
    });
    if (!segment) {
      throw new ResourceNotFoundError('segment', resolvedSegmentId);
    }
  }

  // Now safe to create/update package
  return this.prisma.package.upsert({
    where: { tenantId_slug: { tenantId, slug: data.slug } },
    create: { ...data, tenantId, segmentId: resolvedSegmentId },
    update: { ...data, segmentId: resolvedSegmentId },
  });
}
```

### 3. DRY Constants Extraction

Extracted duplicate constants to a shared file:

```typescript
// server/src/lib/tenant-defaults.ts
export const DEFAULT_SEGMENT = {
  name: 'General',
  slug: 'general',
  heroTitle: 'Our Services',
  description: 'Your main service offerings',
} as const;

export const DEFAULT_PACKAGE_TIERS = {
  BASIC: {
    slug: 'basic-package',
    name: 'Basic Package',
    description: 'Essential services for getting started',
    basePrice: 0,
    groupingOrder: 1,
  },
  STANDARD: {
    slug: 'standard-package',
    name: 'Standard Package',
    description: 'Our most popular option',
    basePrice: 0,
    groupingOrder: 2,
  },
  PREMIUM: {
    slug: 'premium-package',
    name: 'Premium Package',
    description: 'The complete experience',
    basePrice: 0,
    groupingOrder: 3,
  },
} as const;

export type PackageTierKey = keyof typeof DEFAULT_PACKAGE_TIERS;
```

**Benefits:**

- Single source of truth for defaults
- Changes propagate to all code paths
- Type safety with `as const`

### 4. DI Container Consistency

Added service to dependency injection container:

```typescript
// server/src/di.ts
const tenantProvisioningService = new TenantProvisioningService(prisma);

const services = {
  catalog: catalogService,
  booking: bookingService,
  // ... other services
  tenantProvisioning: tenantProvisioningService, // NEW
};
```

Routes receive service via options:

```typescript
// server/src/routes/admin/tenants.routes.ts
export interface AdminTenantsRoutesOptions {
  prisma: PrismaClient;
  provisioningService: TenantProvisioningService;
}

export function createAdminTenantsRoutes(options: AdminTenantsRoutesOptions): Router {
  const { prisma, provisioningService } = options;
  // Use provisioningService instead of direct Prisma calls
}
```

## Prevention Strategies

### Code Review Checklist

When reviewing multi-entity creation:

- [ ] **Single transaction?** All related entities created in one `$transaction`
- [ ] **Shared service?** All code paths use same provisioning service
- [ ] **Centralized defaults?** Constants in shared file, not duplicated
- [ ] **Defense-in-depth?** Service-layer validation beyond DB constraints
- [ ] **DI container?** Service created once, injected everywhere

### Warning Signs

| Red Flag                                       | Risk                  | Fix                              |
| ---------------------------------------------- | --------------------- | -------------------------------- |
| Duplicate creation logic in multiple routes    | Inconsistent behavior | Extract to shared service        |
| Hard-coded default values in route files       | Config drift          | Move to `lib/tenant-defaults.ts` |
| Direct Prisma calls in routes for multi-entity | Non-atomic creation   | Use provisioning service         |
| Optional foreign keys without validation       | Orphaned records      | Add service-layer checks         |
| `new Service()` in route files                 | Multiple instances    | Add to DI container              |

### Testing Strategy

```typescript
describe('Tenant Provisioning', () => {
  it('creates tenant with segment and packages atomically', async () => {
    const result = await provisioningService.createFullyProvisioned({
      slug: 'test-tenant',
      name: 'Test Tenant',
    });

    expect(result.tenant).toBeDefined();
    expect(result.segment).toBeDefined();
    expect(result.packages).toHaveLength(3);

    // Verify all linked correctly
    expect(result.segment.tenantId).toBe(result.tenant.id);
    result.packages.forEach((pkg) => {
      expect(pkg.tenantId).toBe(result.tenant.id);
      expect(pkg.segmentId).toBe(result.segment.id);
    });
  });

  it('rolls back all entities on failure', async () => {
    // Force failure mid-transaction
    vi.spyOn(prisma.package, 'create').mockRejectedValueOnce(new Error('DB error'));

    await expect(
      provisioningService.createFullyProvisioned({ slug: 'fail', name: 'Fail' })
    ).rejects.toThrow();

    // Verify no orphaned tenant
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'fail' } });
    expect(tenant).toBeNull();
  });
});
```

### Orphan Detection Query

Run periodically to detect data integrity issues:

```sql
-- Find tenants without segments
SELECT t.id, t.slug, t.name
FROM "Tenant" t
LEFT JOIN "Segment" s ON s."tenantId" = t.id
WHERE s.id IS NULL AND t."isActive" = true;

-- Find packages without segments
SELECT p.id, p.slug, p."tenantId"
FROM "Package" p
LEFT JOIN "Segment" s ON s.id = p."segmentId"
WHERE s.id IS NULL AND p.active = true;
```

## Key Insights

1. **Atomicity > Error Handling** - A rolled-back transaction is better than a partially created entity with error handling

2. **Defense-in-Depth Works** - Multiple validation layers catch edge cases that slip through any single layer

3. **DRY Constants Prevent Drift** - When defaults are duplicated, they inevitably diverge

4. **DI Container = Single Instance** - Services should be created once and injected, not instantiated per-route

5. **Code Path Audit Essential** - List ALL ways an entity can be created, ensure they all use the same service

## Related Documentation

- [MAIS Critical Patterns](./mais-critical-patterns.md) - Multi-tenant isolation patterns
- [Circular Dependency Executor Registry](./circular-dependency-executor-registry-MAIS-20251229.md) - Breaking import cycles
- [Agent Tools Prevention Index](./AGENT_TOOLS_PREVENTION_INDEX.md) - Defense-in-depth for agent tools
- [Booking Links Phase 0 Prevention](./BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md) - Transaction patterns

## Files Changed

| File                                                 | Change                       |
| ---------------------------------------------------- | ---------------------------- |
| `server/src/services/tenant-provisioning.service.ts` | NEW - Atomic provisioning    |
| `server/src/lib/tenant-defaults.ts`                  | NEW - Shared constants       |
| `server/src/di.ts`                                   | Add service to container     |
| `server/src/routes/admin/tenants.routes.ts`          | Use provisioning service     |
| `server/src/routes/index.ts`                         | Pass service from DI         |
| `server/src/services/tenant-onboarding.service.ts`   | Import from shared constants |
