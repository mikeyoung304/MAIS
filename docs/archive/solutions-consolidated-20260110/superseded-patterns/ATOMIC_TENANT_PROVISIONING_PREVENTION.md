# Atomic Tenant Provisioning Prevention Strategies

**Status:** Lessons learned from resolving P1 data integrity issues (Jan 5, 2026)
**Problem Fixed:** Admin API created orphaned tenants without segments/packages
**Root Cause:** Parallel code paths implementing tenant creation independently
**Solution:** Centralized atomic provisioning service with multi-layer validation

---

## Problem Summary

Multi-tenant systems must guarantee data consistency when creating related entities. The original MAIS codebase had separate tenant creation paths (admin API vs signup) that didn't share logic, resulting in:

- **Admin API:** Created tenant without segment or packages → broken storefront
- **Signup:** Created tenant + segment + 3 packages (correct)
- **Agent Tools:** Created packages without segment assignment → orphaned packages
- **CatalogService:** No validation layer to catch missing segments

**Impact:** Tenants could be created in inconsistent states, breaking downstream features.

---

## Prevention Strategies

### 1. Code Review Checklist for Multi-Entity Creation

**When reviewing code that creates multiple related entities, ensure:**

#### Schema Relationships

- [ ] **Identify all required relationships**
  - What parent entities must exist?
  - What child entities are mandatory?
  - Are foreign keys optional (nullable) or required?

- [ ] **Verify deletion cascades**

  ```prisma
  // Example: Package references Segment
  model Package {
    segmentId String?  // Nullable allows cascade to null on deletion
    segment   Segment? @relation(fields: [segmentId], references: [id], onDelete: SetNull)
  }
  ```

  - If a parent can be deleted, children become orphaned (acceptable design)
  - But NEW children created without parent is a bug (not acceptable)

#### Code Paths

- [ ] **List all code paths that create related entities**
  - Admin API endpoints
  - Signup flows
  - Agent/script operations
  - Bulk operations

- [ ] **For each path, ask:**
  - Does it create parent + child atomically?
  - Does it handle partial failures?
  - Does it validate child → parent relationships?
  - What happens if parent creation succeeds but child fails?

#### Atomicity

- [ ] **Are all operations in a single transaction?**

  ```typescript
  ❌ WRONG - Can fail between tenant and segment creation
  const tenant = await prisma.tenant.create(...);
  const segment = await prisma.segment.create(...);  // Fails, tenant is orphaned

  ✅ CORRECT - All-or-nothing
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create(...);
    const segment = await tx.segment.create(...);
    return { tenant, segment };
  });
  ```

- [ ] **What about in-process errors?**
  - If API key generation fails, is transaction rolled back?
  - If validation fails midway, are previous creates undone?

#### Shared Constants

- [ ] **Are default values defined once?**

  ```typescript
  ❌ WRONG - Duplicated across files (one path might miss an update)
  // Admin API
  const DEFAULT_PACKAGES = [{ name: 'Basic' }, ...];
  // Signup
  const TIER_1 = { name: 'Basic' }, ...;  // Inconsistent!

  ✅ CORRECT - Centralized
  // lib/tenant-defaults.ts
  export const DEFAULT_PACKAGE_TIERS = { ... };
  // Used by both paths
  ```

- [ ] **Are tier count and names consistent across all code paths?**
  - Default is 3 tiers (Basic, Standard, Premium)
  - What if one path creates 2, another creates 3?
  - What if tier names differ?

#### Validation Layers

- [ ] **Are there multiple validation layers?**
  1. Database constraints (lowest layer)
  2. Service layer validation (mid layer)
  3. Route validation (highest layer)

  ```typescript
  // Layer 1: Route validates input
  if (!data.segmentId) throw new ValidationError('segmentId required');

  // Layer 2: Service validates ownership
  const segment = await this.segmentRepo.findById(tenantId, segmentId);
  if (!segment) throw new ValidationError('Segment not found or access denied');

  // Layer 3: Database enforces uniqueness/constraints
  // @unique([tenantId, slug]) prevents duplicate packages
  ```

- [ ] **Is validation idempotent?**
  - Can you run it twice safely?
  - Does it use locks to prevent TOCTOU (time-of-check-time-of-use)?

#### Error Recovery

- [ ] **On error, are partial creates cleaned up?**

  ```typescript
  // ❌ WRONG - Transaction fails, partial data persists
  try {
    await tx.tenant.create(...);
    await tx.segment.create(...);
  } catch (error) {
    // Database state inconsistent!
  }

  // ✅ CORRECT - Automatic rollback
  const result = await prisma.$transaction(async (tx) => {
    return { tenant: await tx.tenant.create(...), ... };
  });  // On error, entire transaction rolls back
  ```

- [ ] **Are orphaned entities cleaned up by migrations?**
  - What if old code created orphaned records before fix?
  - Is there a migration to fix historical data?

---

### 2. Architectural Pattern: Atomic Provisioning Services

**Use this pattern when creating multi-entity aggregates (tenant + defaults, order + items, etc.):**

#### Pattern Structure

```typescript
// ✅ Pattern: Centralized provisioning service
export class TenantProvisioningService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates fully provisioned tenant in single transaction
   * - Tenant record with API keys
   * - Default segment
   * - Default packages (tier 1, 2, 3)
   * All-or-nothing: if any step fails, entire transaction rolls back
   */
  async createFullyProvisioned(input: AdminCreateTenantInput): Promise<ProvisionedTenantResult> {
    // Generate API keys BEFORE transaction (keys include random component)
    const keys = apiKeyService.generateKeyPair(input.slug);

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Step 1: Create parent
      const tenant = await tx.tenant.create({
        data: {
          slug: input.slug,
          apiKeyPublic: keys.publicKey,
          apiKeySecret: keys.secretKeyHash,
          // ... other fields
        },
      });

      // Step 2: Create first child (segment)
      const segment = await tx.segment.create({
        data: {
          tenantId: tenant.id,
          slug: 'general',
          name: 'General',
          // ... other fields
        },
      });

      // Step 3: Create remaining children (packages)
      const packagePromises = DEFAULT_PACKAGE_TIERS.map((tier) =>
        tx.package.create({
          data: {
            tenantId: tenant.id,
            segmentId: segment.id, // ✅ Link to segment
            ...tier,
          },
        })
      );
      const packages = await Promise.all(packagePromises);

      // Return all created entities
      return { tenant, segment, packages };
    });

    // Return secrets OUTSIDE transaction (not stored in DB)
    return { ...result, secretKey: keys.secretKey };
  }

  /**
   * Same atomic guarantees for signup flow
   * (Different input types: password vs API key)
   */
  async createFromSignup(input: SignupCreateTenantInput): Promise<ProvisionedTenantResult> {
    const keys = apiKeyService.generateKeyPair(input.slug);

    return await this.prisma.$transaction(async (tx) => {
      // ... same pattern with password credentials
    });
  }
}
```

#### Key Principles

1. **Generate Secrets Before Transaction**
   - API key generation includes randomness
   - Random operations should not be in transaction (can't retry)
   - Generate once, use in transaction

2. **Single Transaction Per Aggregate**
   - All related entities created in one `$transaction()` call
   - No intermediate commits
   - Automatic rollback on any error

3. **Validate Input Before Transaction**
   - Check slugs are available (no race condition if validated before TX)
   - Validate input schema
   - Don't do DB lookups in early validation (use service instead)

4. **Use Same Service Everywhere**
   - Don't duplicate provisioning logic in routes
   - Admin API: uses `provisioningService.createFullyProvisioned()`
   - Signup: uses `provisioningService.createFromSignup()`
   - Scripts: use same service

5. **Log at Service Boundary**
   ```typescript
   logger.info(
     { tenantId: tenant.id, segmentId: segment.id, packagesCreated: packages.length },
     'Fully provisioned new tenant'
   );
   ```

#### Dependency Injection Setup

```typescript
// di.ts - Build provisioning service once
const provisioningService = new TenantProvisioningService(prisma);

// buildAdminRoutes() - Pass to routes
createAdminTenantsRoutes({
  prisma,
  provisioningService, // Use shared instance
});

// buildAuthRoutes() - Pass to auth routes
createUnifiedAuthRoutes({
  // ...
  tenantProvisioningService: provisioningService, // Use shared instance
});
```

---

### 3. Testing Strategy for Orphaned Entities

**Detect orphaned entity bugs before they ship:**

#### Test Categories

**A. Happy Path: All Entities Created**

```typescript
test('createFullyProvisioned creates tenant + segment + 3 packages atomically', async () => {
  const result = await provisioningService.createFullyProvisioned({
    slug: 'test-tenant',
    name: 'Test Tenant',
  });

  // Verify parent
  expect(result.tenant).toHaveProperty('id');
  expect(result.tenant.slug).toBe('test-tenant');

  // Verify child relationships
  expect(result.segment).toHaveProperty('id');
  expect(result.segment.tenantId).toBe(result.tenant.id);

  // Verify grandchildren
  expect(result.packages).toHaveLength(3);
  result.packages.forEach((pkg) => {
    expect(pkg.tenantId).toBe(result.tenant.id);
    expect(pkg.segmentId).toBe(result.segment.id); // ✅ Key assertion
  });

  // Verify in database
  const dbSegments = await prisma.segment.findMany({
    where: { tenantId: result.tenant.id },
  });
  expect(dbSegments).toHaveLength(1);

  const dbPackages = await prisma.package.findMany({
    where: { tenantId: result.tenant.id },
  });
  expect(dbPackages).toHaveLength(3);
  // ✅ All packages have segmentId (none are orphaned)
  dbPackages.forEach((pkg) => {
    expect(pkg.segmentId).toBeDefined();
    expect(pkg.segmentId).not.toBeNull();
  });
});
```

**B. Rollback on Failure: Detect Partial Creation**

```typescript
test('rolls back all entities if package creation fails', async () => {
  // Mock failure in second package creation
  const mockPrisma = {
    $transaction: jest.fn(async (callback) => {
      const tx = {
        tenant: { create: jest.fn().mockResolvedValue({ id: 'tenant-1', slug: 'test' }) },
        segment: { create: jest.fn().mockResolvedValue({ id: 'seg-1', tenantId: 'tenant-1' }) },
        package: {
          create: jest.fn()
            .mockResolvedValueOnce({ id: 'pkg-1' })
            .mockRejectedValueOnce(new Error('Unique constraint failed')),  // Fail on 2nd
        },
      };
      try {
        return await callback(tx);
      } catch (error) {
        // Simulate transaction rollback
        throw error;
      }
    }),
  };

  const service = new TenantProvisioningService(mockPrisma);

  // Should throw error
  await expect(service.createFullyProvisioned({ ... })).rejects.toThrow();

  // Verify database is clean (nothing created)
  const tenants = await prisma.tenant.findMany({ where: { slug: 'test' } });
  expect(tenants).toHaveLength(0);
});
```

**C. Cross-Path Consistency: Admin vs Signup**

```typescript
test('admin and signup paths create identical default structure', async () => {
  // Create via admin API
  const admin = await provisioningService.createFullyProvisioned({
    slug: 'admin-tenant',
    name: 'Admin Tenant',
  });

  // Create via signup
  const signup = await provisioningService.createFromSignup({
    slug: 'signup-tenant',
    businessName: 'Signup Tenant',
    email: 'test@example.com',
    passwordHash: 'hash',
  });

  // Compare structure
  expect(admin.packages).toHaveLength(signup.packages.length);
  expect(admin.packages.map((p) => p.slug)).toEqual(signup.packages.map((p) => p.slug));

  // Verify all have segment assignments
  admin.packages.forEach((pkg) => {
    expect(pkg.segmentId).toBe(admin.segment.id);
  });
  signup.packages.forEach((pkg) => {
    expect(pkg.segmentId).toBe(signup.segment.id);
  });
});
```

**D. Service-Layer Validation Catches Orphans**

```typescript
test('CatalogService auto-assigns segmentId if not provided', async () => {
  // Create tenant with provisioning service
  const { tenant, segment } = await provisioningService.createFullyProvisioned({ ... });

  // Try to create package without segmentId (simulates agent tool path)
  const pkg = await catalogService.createPackage(tenant.id, {
    name: 'New Package',
    slug: 'new-pkg',
    basePrice: 5000,
    // No segmentId provided
  });

  // Service auto-assigns to General segment
  expect(pkg.segmentId).toBe(segment.id);  // ✅ Not orphaned
});
```

**E. Query-Based Orphan Detection**

```typescript
test('detects orphaned packages (integration sanity check)', async () => {
  // Query for packages with null segmentId (should be 0)
  const orphans = await prisma.package.findMany({
    where: {
      segmentId: null,
    },
  });

  expect(orphans).toHaveLength(0);
});
```

#### Test Maintenance

- **Run orphan detection regularly:** Add to nightly CI checks
- **Update when schema changes:** If you add new child entities, add tests
- **Keep tests in sync:** If you change provisioning logic, update both admin + signup tests together

---

### 4. Warning Signs: When This Pattern Is Needed

**Audit your codebase for these symptoms:**

#### Red Flag #1: Duplicate Entity Creation Logic

```typescript
// ❌ Admin API path
const tenant = await prisma.tenant.create({ ... });
const segment = await prisma.segment.create({ tenantId: tenant.id, ... });
const packages = await Promise.all([...]);

// ❌ Signup path (different implementation)
const newTenant = await this.tenantRepo.create({ ... });
await this.onboardingService.createDefaultData({ tenantId: newTenant.id });

// ❌ Agent tool path (yet another implementation)
const pkg = await prisma.package.create({ name, price, tenantId });
// No segment assignment
```

**Action:** Create `TenantProvisioningService`, use in all paths.

#### Red Flag #2: Missing Validation Layer

```typescript
// ❌ No validation - segmentId can be null
async createPackage(tenantId: string, data: CreatePackageInput) {
  return await this.prisma.package.create({
    data: {
      tenantId,
      segmentId: data.segmentId ?? null,  // No check!
    },
  });
}

// ✅ Validation layer added
async createPackage(tenantId: string, data: CreatePackageInput) {
  let segmentId = data.segmentId;
  if (!segmentId) {
    const segment = await this.segmentRepo.findBySlug(tenantId, 'general');
    if (!segment) throw new ValidationError('No default segment');
    segmentId = segment.id;
  }
  return await this.repository.createPackage(tenantId, { ...data, segmentId });
}
```

**Action:** Add validation in service layer before calling repository.

#### Red Flag #3: Optional Foreign Keys Without Validation

```typescript
// ❌ Schema allows orphans
model Package {
  id       String
  tenantId String
  segmentId String?  // Optional - but should we allow it?
  segment  Segment? @relation(fields: [segmentId], references: [id], onDelete: SetNull)
}

// ✅ Check usage
// - If nullable for deletion cascade: OK (old packages become orphaned on segment delete)
// - If nullable "for flexibility": Not OK (new packages should never be created without segment)
```

**Action:** Add service-layer validation that rejects new entities without parent.

#### Red Flag #4: Partial Error Handling

```typescript
// ❌ Partial creation on error
try {
  const tenant = await this.tenantRepo.create(data);
  const segment = await this.segmentRepo.create({ tenantId: tenant.id, ... });
} catch (error) {
  // Tenant created but segment failed!
  // Partial state persists
}

// ✅ Atomic creation
const result = await this.prisma.$transaction(async (tx) => {
  const tenant = await tx.tenant.create(data);
  const segment = await tx.segment.create({ tenantId: tenant.id, ... });
  return { tenant, segment };
});  // Entire transaction rolls back on error
```

**Action:** Wrap in `prisma.$transaction()`.

#### Red Flag #5: Inconsistent Defaults Across Paths

```typescript
// ❌ Different tier names in different places
// admin.routes.ts
const TIERS = ['Basic', 'Standard', 'Premium'];

// auth.routes.ts
const DEFAULT_PACKAGES = [
  { name: 'Entry Package', ... },
  { name: 'Popular', ... },
  { name: 'Elite', ... },
];

// ✅ Centralized
// lib/tenant-defaults.ts
export const DEFAULT_PACKAGE_TIERS = { ... };

// Both paths import:
import { DEFAULT_PACKAGE_TIERS } from '../lib/tenant-defaults';
```

**Action:** Create `lib/tenant-defaults.ts`, import everywhere.

#### Red Flag #6: Silent Failures

```typescript
// ❌ No error if onboarding fails
try {
  await this.onboardingService.createDefaultData({ tenantId });
} catch (error) {
  logger.warn(...);  // Just log and continue
  // Tenant now has no packages!
}

// ✅ Fail atomically
// Let error propagate, transaction rolls back entire tenant creation
const result = await this.prisma.$transaction(async (tx) => {
  const tenant = await tx.tenant.create(...);
  const segment = await tx.segment.create(...);  // If this fails, tenant is rolled back
  return { tenant, segment };
});
```

**Action:** Use transactions, let errors propagate (don't swallow).

---

## Implementation Checklist

**Before adding multi-entity creation feature:**

- [ ] Identify parent → child relationships
- [ ] Design transaction boundaries
- [ ] Centralize default values
- [ ] Create provisioning service
- [ ] Add validation layer
- [ ] Use DI to inject provisioning service everywhere
- [ ] Write tests for:
  - All entities created
  - Rollback on failure
  - Cross-path consistency
  - Validation catches orphans
- [ ] Add nightly orphan detection query to CI
- [ ] Document expected state in CLAUDE.md

**After shipping feature:**

- [ ] Monitor logs for partial failures
- [ ] Run orphan detection query on production data
- [ ] If orphans found, create migration to fix
- [ ] Update prevention strategies doc if new patterns emerge

---

## Real-World Example: MAIS Tenant Provisioning

**The Fix:** Commit 57868990 (`fix(server): atomic tenant provisioning with segment validation`)

### Before (Three Separate Paths)

```
Admin API Path:
  1. Create tenant
  2. Return (NO segment, NO packages)
  ❌ Result: Empty storefront

Signup Path:
  1. Create tenant
  2. Call onboardingService.createDefaultData()
  3. Create segment + 3 packages
  ✅ Result: Full storefront

Agent Tool Path:
  1. Create package (no segmentId)
  2. Create orphaned package (segmentId = null)
  ❌ Result: Disconnected from segment
```

### After (Single Atomic Service)

```
TenantProvisioningService.createFullyProvisioned() {
  atomically {
    1. Create tenant + API keys
    2. Create segment ("General")
    3. Create 3 packages linked to segment
    4. Commit all or rollback all
  }
}

Both admin API and signup use same service
Both agent tools use CatalogService validation
All paths create identical initial state
✅ Result: Consistency guaranteed
```

### Changes Made

| Component                   | Change                                              | Reason                                |
| --------------------------- | --------------------------------------------------- | ------------------------------------- |
| `TenantProvisioningService` | Created                                             | Single source for atomic provisioning |
| `admin/tenants.routes.ts`   | Uses `provisioningService.createFullyProvisioned()` | Atomic creation                       |
| `auth.routes.ts`            | Uses `provisioningService.createFromSignup()`       | Atomic creation                       |
| `write-tools.ts`            | Added `segmentId` parameter                         | Packages link to segment              |
| `catalog.service.ts`        | Added validation layer                              | Auto-assign segment if missing        |
| `lib/tenant-defaults.ts`    | Created                                             | Centralized constants                 |
| `di.ts`                     | Injects `provisioningService`                       | DI ensures singleton                  |

---

## Related Prevention Strategies

- **[Agent Tools Prevention Index](AGENT_TOOLS_PREVENTION_INDEX.md)** - Tenant isolation in tools, executor registry
- **[Booking Links Prevention](BOOKING_LINKS_PHASE_0_PREVENTION_STRATEGIES.md)** - TOCTOU prevention, transaction locks
- **[Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)** - Comprehensive multi-tenant patterns
- **[Circular Dependency Executor Registry](circular-dependency-executor-registry-MAIS-20251229.md)** - Avoiding circular deps with registry pattern

---

## Decision Record

**ADR:** Atomic Provisioning Service for Multi-Entity Creation
**Status:** Implemented (commit 57868990)
**Date:** 2026-01-05
**Outcome:** P1 issues #629, #630, #631, #632 resolved

**Rationale:**

- Prevents partial state through transactions
- Eliminates duplicate logic through shared service
- Catches regressions through validation layers
- Ensures consistency across all code paths
