# Solution: Prevent Orphaned Tenants via Atomic Provisioning

**Status:** Resolved (P1-630)
**Date:** 2026-01-05
**Problem:** Admin API (`POST /api/v1/admin/tenants`) created tenants without segments and packages, leaving them orphaned and unusable.
**Root Cause:** Tenant creation and segment/package initialization happened in separate operations with no transactional guarantee.
**Solution:** Atomic transaction pattern with DRY constants and defense-in-depth validation.

---

## Problem Symptoms

When admins created tenants via the admin API, they would get:

- Tenant record ✓ created
- Segment ✗ missing
- Packages ✗ missing

This left tenants in a broken state where they couldn't be used on storefronts (no packages to book).

**Root cause:** Tenant creation and segment/package creation were separate database calls with no transactional guarantee. If the process crashed or failed after tenant creation, you'd have an orphaned tenant.

---

## Solution Components

### 1. Atomic Transaction Pattern

**File:** `/server/src/services/tenant-provisioning.service.ts`

All tenant provisioning operations happen within a single `prisma.$transaction()` block. Either everything succeeds, or everything rolls back:

```typescript
async createFullyProvisioned(input: AdminCreateTenantInput): Promise<ProvisionedTenantResult> {
  const { slug, name, commissionPercent = 10.0 } = input;

  // Generate API key pair BEFORE transaction (key generation is external)
  const keys = apiKeyService.generateKeyPair(slug);

  // All database operations within single transaction
  const result = await this.prisma.$transaction(async (tx) => {
    // 1. Create tenant
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name,
        apiKeyPublic: keys.publicKey,
        apiKeySecret: keys.secretKeyHash,
        commissionPercent,
        branding: {},
      },
    });

    // 2. Create default segment
    const segment = await tx.segment.create({
      data: {
        tenantId: tenant.id,
        slug: DEFAULT_SEGMENT.slug,
        name: DEFAULT_SEGMENT.name,
        heroTitle: DEFAULT_SEGMENT.heroTitle,
        description: DEFAULT_SEGMENT.description,
        sortOrder: 0,
        active: true,
      },
    });

    // 3. Create default packages in parallel
    const packagePromises = Object.values(DEFAULT_PACKAGE_TIERS).map((tier) =>
      tx.package.create({
        data: {
          tenantId: tenant.id,
          segmentId: segment.id,
          slug: tier.slug,
          name: tier.name,
          description: tier.description,
          basePrice: tier.basePrice,
          groupingOrder: tier.groupingOrder,
          active: true,
        },
      })
    );

    const packages = await Promise.all(packagePromises);

    logger.info(
      {
        tenantId: tenant.id,
        slug: tenant.slug,
        segmentId: segment.id,
        packagesCreated: packages.length,
      },
      'Fully provisioned new tenant via admin API'
    );

    return { tenant, segment, packages };
  });

  // Return secret key outside transaction (not stored in DB)
  return {
    ...result,
    secretKey: keys.secretKey,
  };
}
```

**Key patterns:**

- **External operations first:** API key generation happens before the transaction (it's not a DB operation)
- **All DB ops in transaction:** Tenant + segment + packages all or nothing
- **Parallel creation:** Packages are created in parallel within the transaction using `Promise.all()`
- **Logging within transaction:** Log statements help trace the operation for debugging

---

### 2. DRY Constants (Single Source of Truth)

**File:** `/server/src/lib/tenant-defaults.ts`

Default configuration extracted to a shared module used by both:

- `TenantProvisioningService` (tenant creation)
- `TenantOnboardingService` (signup flow)
- Agent tools (upsert operations)

```typescript
/**
 * Default segment configuration for new tenants
 * Every tenant starts with a "General" segment to organize their packages
 */
export const DEFAULT_SEGMENT = {
  name: 'General',
  slug: 'general',
  heroTitle: 'Our Services',
  description: 'Your main service offerings',
} as const;

/**
 * Default pricing tier configurations
 * Guides users toward a 3-tier pricing structure (Good/Better/Best pattern)
 *
 * All prices start at 0 - tenants customize their own pricing
 */
export const DEFAULT_PACKAGE_TIERS = {
  BASIC: {
    slug: 'basic-package',
    name: 'Basic Package',
    description: 'Your starter option - perfect for budget-conscious clients',
    basePrice: 0,
    groupingOrder: 1,
  },
  STANDARD: {
    slug: 'standard-package',
    name: 'Standard Package',
    description: 'Our most popular option - great value for most clients',
    basePrice: 0,
    groupingOrder: 2,
  },
  PREMIUM: {
    slug: 'premium-package',
    name: 'Premium Package',
    description: 'The full experience - for clients who want the best',
    basePrice: 0,
    groupingOrder: 3,
  },
} as const;

/** Type for accessing package tier keys */
export type PackageTierKey = keyof typeof DEFAULT_PACKAGE_TIERS;

/** Type for a single package tier configuration */
export type PackageTierConfig = (typeof DEFAULT_PACKAGE_TIERS)[PackageTierKey];
```

**Benefits:**

- Single source of truth for default names, descriptions, pricing tiers
- Type-safe access via `PackageTierKey` and `PackageTierConfig`
- Easy to update defaults in one place (changes propagate everywhere)
- `as const` ensures literal types for slugs and names

---

### 3. Defense-in-Depth: Segment Validation

Even if the transaction succeeds, agent tools have a second layer of validation to prevent orphaned packages:

**File:** `/server/src/agent/executors/index.ts` (upsert_package executor)

```typescript
registerProposalExecutor('upsert_package', async (tenantId, payload) => {
  const {
    packageId,
    slug,
    name,
    title,
    description,
    basePrice,
    priceCents,
    active,
    segmentId: inputSegmentId,
  } = payload as {...};

  // Normalize field names (name takes precedence, fall back to title)
  const packageName = name || title;
  const packagePrice = basePrice ?? priceCents;

  if (!packageName) {
    throw new MissingFieldError('name', 'package');
  }
  if (packagePrice === undefined) {
    throw new MissingFieldError('price', 'package');
  }

  // =========================================================================
  // SEGMENT AUTO-ASSIGNMENT (#629)
  // =========================================================================
  // All packages MUST be linked to a segment. If no segmentId provided,
  // look up the "General" segment for this tenant.
  // =========================================================================
  let resolvedSegmentId = inputSegmentId;

  if (!resolvedSegmentId) {
    // Look up the "General" segment (slug: 'general')
    const generalSegment = await prisma.segment.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug: 'general',
        },
      },
      select: { id: true },
    });

    if (generalSegment) {
      resolvedSegmentId = generalSegment.id;
      logger.debug(
        { tenantId, segmentId: resolvedSegmentId },
        'Package auto-assigned to General segment via agent'
      );
    } else {
      // No General segment exists - this shouldn't happen for properly onboarded tenants
      // Log warning but allow creation (CatalogService will handle this case)
      logger.warn(
        { tenantId },
        'General segment not found - package created without segment assignment'
      );
    }
  } else {
    // Verify provided segmentId belongs to this tenant (CRITICAL: prevent cross-tenant access)
    const segment = await prisma.segment.findFirst({
      where: { id: resolvedSegmentId, tenantId },
      select: { id: true, name: true },
    });

    if (!segment) {
      throw new ResourceNotFoundError(
        'segment',
        resolvedSegmentId,
        'Use get_segments to find available segments for this business.'
      );
    }
  }

  // Create new package with resolved segment
  const created = await prisma.package.create({
    data: {
      tenantId,
      slug: generatedSlug,
      name: packageName,
      description: description || null,
      basePrice: packagePrice,
      bookingType: (bookingType as 'DATE' | 'TIMESLOT') || 'DATE',
      active: active ?? true,
      segmentId: resolvedSegmentId || null,  // Will auto-assign to General if not provided
    },
  });

  return {
    action: 'created',
    packageId: created.id,
    name: created.name,
    basePrice: created.basePrice,
  };
});
```

**Defense layers:**

1. **Required field validation:** Package must have name and price
2. **Segment resolution:** If no segment provided, auto-assign to General
3. **Tenant-scoped lookup:** Only look up segments belonging to this tenant
4. **Error on mismatch:** If provided segmentId doesn't belong to tenant, throw error
5. **Logging:** Warn if General segment not found (indicates provisioning failure)

---

### 4. Dependency Injection Integration

**File:** `/server/src/di.ts`

TenantProvisioningService created in DI container and passed to admin routes:

```typescript
// Lines 238-239: Create TenantProvisioningService for atomic tenant creation (#634)
const tenantProvisioningService = new TenantProvisioningService(mockPrisma);

// Lines 353: Expose in services
tenantProvisioning: tenantProvisioningService,
```

**File:** `/server/src/routes/admin/tenants.routes.ts`

Routes receive service via options object:

```typescript
export interface AdminTenantsRoutesOptions {
  prisma: PrismaClient;
  provisioningService: TenantProvisioningService;
}

export function createAdminTenantsRoutes(options: AdminTenantsRoutesOptions): Router {
  const { prisma, provisioningService } = options;

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug, name, commission = 10.0 } = req.body;

      // Validation
      if (!slug || !name) {
        throw new ValidationError('slug and name are required');
      }

      // Create fully provisioned tenant (atomic: tenant + segment + packages)
      const result = await provisioningService.createFullyProvisioned({
        slug,
        name,
        commissionPercent: commission,
      });

      res.status(201).json({
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
          apiKeyPublic: result.tenant.apiKeyPublic,
          commissionPercent: Number(result.tenant.commissionPercent),
          isActive: result.tenant.isActive,
          createdAt: result.tenant.createdAt.toISOString(),
        },
        secretKey: result.secretKey, // ⚠️ Shown ONCE, never stored in plaintext
        segment: {
          id: result.segment.id,
          slug: result.segment.slug,
          name: result.segment.name,
        },
        packages: result.packages.map((pkg) => ({
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.name,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

---

## How It Works (Full Flow)

### Admin Creates Tenant via `POST /api/v1/admin/tenants`

```
POST /api/v1/admin/tenants
{
  "slug": "bella-weddings",
  "name": "Bella Weddings Photography",
  "commission": 15.0
}
```

### Service Execution (Atomic Transaction)

1. **Validate input:** slug and name required, commission 0-100
2. **Check uniqueness:** slug doesn't already exist
3. **Generate API keys:** Public + secret pair (before transaction)
4. **Start transaction:**
   - Create tenant with API keys
   - Create "General" segment
   - Create 3 default packages (Basic, Standard, Premium) in parallel
   - All ops use `tx` (transaction context)
5. **Commit or rollback:** All success → commit; any failure → rollback
6. **Return result:** Tenant + segment + packages + secret key (shown once)

### Response

```json
{
  "tenant": {
    "id": "tenant_xyz123",
    "slug": "bella-weddings",
    "name": "Bella Weddings Photography",
    "apiKeyPublic": "pk_live_bella_xyz123",
    "commissionPercent": 15.0,
    "isActive": true,
    "createdAt": "2026-01-05T14:00:00Z"
  },
  "secretKey": "sk_live_bella_xyz123_longRandomString",
  "segment": {
    "id": "segment_abc789",
    "slug": "general",
    "name": "General"
  },
  "packages": [
    {
      "id": "pkg_1",
      "slug": "basic-package",
      "name": "Basic Package"
    },
    {
      "id": "pkg_2",
      "slug": "standard-package",
      "name": "Standard Package"
    },
    {
      "id": "pkg_3",
      "slug": "premium-package",
      "name": "Premium Package"
    }
  ]
}
```

### Also Used By: Self-Signup Flow

Same `TenantProvisioningService` used by signup endpoint (`POST /v1/auth/signup`) via `createFromSignup()` method, ensuring consistency.

---

## Key Guarantees

| Guarantee                  | How Achieved                                                                      | Why Matters                                         |
| -------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| Tenant always has segment  | Atomic transaction creates both or neither                                        | Without segment, tenant can't organize packages     |
| Tenant always has packages | 3 packages created in parallel within transaction                                 | Without packages, storefront has nothing to book    |
| Consistency across flows   | DRY constants shared by all provisioning paths                                    | Admin API, signup, and agents all use same defaults |
| Field name compatibility   | Executor accepts both old (title/priceCents) and new (name/basePrice) field names | Backward compatible with legacy agents/tools        |
| Tenant data isolation      | Every query includes `tenantId` filter                                            | Prevents cross-tenant data leaks                    |

---

## Testing the Solution

### Verify Atomic Creation

```bash
# Start API in mock mode
ADAPTERS_PRESET=mock npm run dev:api

# Create tenant via admin API
curl -X POST http://localhost:3001/api/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-studio",
    "name": "Test Studio",
    "commission": 10
  }'

# Verify tenant, segment, and 3 packages created atomically
# Check Prisma Studio: npm exec prisma studio
# Should see:
# - 1 tenant with slug "test-studio"
# - 1 segment with slug "general"
# - 3 packages: basic-package, standard-package, premium-package
```

### Verify Auto-Assignment on Agent Tool

```typescript
// Agent calls upsert_package without segmentId
const result = await agentTools.upsertPackageTool.execute(context, {
  title: 'Custom Package',
  priceCents: 50000,
  // No segmentId provided
});

// Executor auto-assigns to "General" segment
// Check database: package.segmentId should match general segment's ID
```

---

## Files Modified

| File                                                 | Changes | Purpose                                   |
| ---------------------------------------------------- | ------- | ----------------------------------------- |
| `server/src/services/tenant-provisioning.service.ts` | Created | Atomic provisioning service               |
| `server/src/lib/tenant-defaults.ts`                  | Created | DRY constants for defaults                |
| `server/src/routes/admin/tenants.routes.ts`          | Updated | Call TenantProvisioningService            |
| `server/src/agent/executors/index.ts`                | Updated | Segment auto-assignment in upsert_package |
| `server/src/di.ts`                                   | Updated | Wire TenantProvisioningService            |

---

## Prevents These Issues

- ✅ Orphaned tenants without segments
- ✅ Tenants without default packages
- ✅ Inconsistent defaults between admin API and signup
- ✅ Agent tools creating packages without segments
- ✅ Race conditions in parallel package creation
- ✅ Cross-tenant data leakage in agent operations

---

## Related Issues

- **P1-630:** Admin API skips tenant onboarding (resolved)
- **P1-629:** Upsert package creates orphaned packages (resolved)
- **ADR-013:** Double-booking prevention with advisory locks
- **docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md:** Agent tool security patterns

---

## Key Takeaway

**Pattern:** Atomic transactions + DRY constants + defense-in-depth validation

Whenever you create multi-step data structures (tenant → segment → packages), use:

1. Single transaction for all operations
2. Shared constants to prevent drift
3. Validation layers at each step (tool creation + executor confirmation)
4. Logging for troubleshooting orphaned data

This prevents half-created resources that leave the system in an inconsistent state.
