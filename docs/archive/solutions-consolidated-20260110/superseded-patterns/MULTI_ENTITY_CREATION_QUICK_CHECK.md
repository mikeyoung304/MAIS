# Multi-Entity Creation: 30-Second Quick Check

**Use this before writing code that creates related entities (tenant+segment+packages, order+items, etc.)**

---

## Red Flags: Stop and Refactor If You See These

| Red Flag                | Example                                              | Fix                                       |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------- |
| **Duplicate logic**     | Admin and signup both create segment                 | Centralize in `TenantProvisioningService` |
| **Non-atomic ops**      | `tenant.create()` then `segment.create()`            | Wrap in `prisma.$transaction()`           |
| **No validation layer** | Packages created without segmentId check             | Add service-layer auto-assignment         |
| **Silent errors**       | `try { ... } catch { logger.warn() }`                | Let errors propagate, fail atomically     |
| **Hard-coded defaults** | `['Basic', 'Standard', 'Premium']` in multiple files | Move to `lib/tenant-defaults.ts`          |
| **Missing tests**       | No tests for rollback on error                       | Add rollback test                         |

---

## 60-Second Implementation Pattern

```typescript
// 1. Centralize defaults
// lib/tenant-defaults.ts
export const DEFAULT_PACKAGE_TIERS = {
  BASIC: { slug: 'basic-package', name: 'Basic Package', ... },
  STANDARD: { slug: 'standard-package', name: 'Standard Package', ... },
  PREMIUM: { slug: 'premium-package', name: 'Premium Package', ... },
} as const;

// 2. Create provisioning service
// services/tenant-provisioning.service.ts
export class TenantProvisioningService {
  async createFullyProvisioned(input: CreateTenantInput) {
    const keys = apiKeyService.generateKeyPair(input.slug);  // Generate before TX

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { ...input, ...keys } });
      const segment = await tx.segment.create({ data: { tenantId: tenant.id, ... } });
      const packages = await Promise.all(
        Object.values(DEFAULT_PACKAGE_TIERS).map((tier) =>
          tx.package.create({
            data: { tenantId: tenant.id, segmentId: segment.id, ...tier }
          })
        )
      );
      return { tenant, segment, packages };
    });

    return { ...result, secretKey: keys.secretKey };  // Outside TX
  }
}

// 3. Use same service everywhere
// routes/admin/tenants.routes.ts
const result = await provisioningService.createFullyProvisioned({ slug, name });
res.status(201).json({ tenant: result.tenant, packages: result.packages });

// routes/auth.routes.ts
const result = await provisioningService.createFromSignup({ slug, email, password });
res.status(201).json({ token, tenant: result.tenant });

// 4. Add validation layer
// services/catalog.service.ts
async createPackage(tenantId: string, data: CreatePackageInput) {
  let segmentId = data.segmentId;
  if (!segmentId) {
    const general = await this.segmentRepo.findBySlug(tenantId, 'general');
    segmentId = general?.id ?? (await this.createDefaultSegment(tenantId)).id;
  }
  return this.repository.createPackage(tenantId, { ...data, segmentId });
}

// 5. Test it
// test/services/tenant-provisioning.service.spec.ts
test('creates tenant + segment + 3 packages atomically', async () => {
  const result = await service.createFullyProvisioned({ slug: 'test', name: 'Test' });

  expect(result.packages).toHaveLength(3);
  result.packages.forEach((pkg) => {
    expect(pkg.segmentId).toBe(result.segment.id);  // No orphans
  });
});

test('rolls back all on error', async () => {
  // Mock failure in second package creation
  // Verify entire transaction rolled back
  const tenants = await prisma.tenant.findMany({ where: { slug: 'test' } });
  expect(tenants).toHaveLength(0);
});
```

---

## Injection Setup (di.ts)

```typescript
// Create once
const provisioningService = new TenantProvisioningService(prisma);

// Use everywhere
createAdminTenantsRoutes({ provisioningService });
createUnifiedAuthRoutes({ tenantProvisioningService: provisioningService });
```

---

## Validation Layers (Defense in Depth)

```
Layer 1: Route validates input
  ↓ (reject invalid input early)
Layer 2: Service validates relationships
  ↓ (auto-assign defaults, verify ownership)
Layer 3: Database enforces constraints
  ↓ (unique, foreign key, NOT NULL)
```

---

## Orphan Detection Queries

**Run nightly in CI to catch regressions:**

```typescript
// Find packages without segments
const orphans = await prisma.package.findMany({
  where: { tenantId: undefined, segmentId: null }, // Impossible state
});
expect(orphans).toHaveLength(0);

// Find tenants without segments
const emptyTenants = await prisma.tenant.findMany({
  where: {
    segments: { none: {} }, // No related segments
  },
});
// Should only be old tenants from before provisioning service
```

---

## Decision Tree

```
Are you creating 2+ related entities?
├─ YES → Use atomic provisioning service
│        └─ Create all in single transaction
│        └─ Share service across code paths
│
├─ NO → Single entity, no provisioning needed
         └─ Just use repository method
```

---

## Real-World Example

**MAIS Tenant Provisioning (Jan 5, 2026)**

**Before:** 3 separate implementations

- Admin API: tenant only ❌
- Signup: tenant + onboarding ✅
- Agent: orphaned packages ❌

**After:** 1 shared service

- Admin API: `provisioningService.createFullyProvisioned()` ✅
- Signup: `provisioningService.createFromSignup()` ✅
- Agent: `catalogService.createPackage()` validates ✅

**Result:** All paths create identical initial state

---

## See Also

- **[Full Prevention Strategies](ATOMIC_TENANT_PROVISIONING_PREVENTION.md)** - Detailed patterns
- **[Agent Tools Index](AGENT_TOOLS_PREVENTION_INDEX.md)** - Tools isolation patterns
- **MAIS CLAUDE.md** - "Atomic Transaction Services" section
