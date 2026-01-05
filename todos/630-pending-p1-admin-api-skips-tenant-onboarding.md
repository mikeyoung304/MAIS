---
status: pending
priority: p1
issue_id: '630'
tags: [code-review, tenant-onboarding, admin-api, data-integrity]
dependencies: []
---

# Admin API Skips Tenant Onboarding

## Problem Statement

The `POST /v1/admin/tenants` endpoint creates tenants WITHOUT calling `TenantOnboardingService`, resulting in tenants with no default segment or packages. This creates an inconsistent experience where tenants created via admin API start with an empty catalog.

**Why it matters:**

- Tenants created via admin API have no packages (empty storefront)
- Inconsistent with signup flow which creates default segment + 3 packages
- Admin thinks tenant is "ready" but customer booking flow is broken
- Silent failure - no error message indicates missing setup

## Findings

### Evidence from Onboarding Flow Analysis (CRITICAL)

> "POST /v1/admin/tenants creates tenants WITHOUT calling TenantOnboardingService"

**Location:** `server/src/routes/admin/tenants.routes.ts` (lines 87-111)

**Current Code - Missing Onboarding:**

```typescript
// Create tenant
const tenant = await tenantRepo.create({
  slug,
  name,
  apiKeyPublic: keys.publicKey,
  apiKeySecret: keys.secretKeyHash,
  commissionPercent: commission,
  branding: {},
});

res.status(201).json({
  tenant: { ... },
  secretKey: keys.secretKey,
});
// ❌ NO CALL TO tenantOnboardingService.createDefaultData()
```

### Contrast with Auth Signup

Auth signup correctly calls onboarding:

```typescript
// server/src/routes/auth.routes.ts (lines 442-457)
if (tenantOnboardingService) {
  try {
    await tenantOnboardingService.createDefaultData({ tenantId: tenant.id });
  } catch (defaultDataError) {
    logger.warn({...}, 'Failed to create default segment/packages');
  }
}
```

### Impact Scenario

```
Admin tenant creation flow:
1. Admin creates tenant via API ✅
2. NO onboarding service called ❌
3. Admin thinks tenant is "ready" ⚠️
4. Customer visits storefront → Empty catalog → Page breaks
```

## Proposed Solutions

### Option A: Add Onboarding Call (Recommended)

**Pros:** Consistent with signup flow, minimal code change
**Cons:** None significant
**Effort:** Small
**Risk:** Low

```typescript
// After tenant creation, before response
const tenant = await tenantRepo.create({ ... });

// ADD THIS:
await tenantOnboardingService.createDefaultData({ tenantId: tenant.id });

res.status(201).json({ tenant, secretKey });
```

### Option B: Add Onboarding with Error Handling

**Pros:** More robust, mirrors auth signup pattern
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Low

```typescript
const tenant = await tenantRepo.create({ ... });

try {
  await tenantOnboardingService.createDefaultData({ tenantId: tenant.id });
} catch (error) {
  logger.warn({ tenantId: tenant.id, error }, 'Failed to create default data');
  // Continue - tenant can manually create packages
}

res.status(201).json({ tenant, secretKey });
```

### Option C: Transaction with Rollback

**Pros:** Atomic - either full setup or nothing
**Cons:** More complex, may fail entire tenant creation
**Effort:** Medium
**Risk:** Medium

Wrap tenant creation + onboarding in single transaction.

## Recommended Action

**Option C** - Transaction with rollback (atomic tenant provisioning)

### Triage Notes (2026-01-05)

**Reviewer Split:** DHH + TypeScript reviewers recommend Option C (transaction). Simplicity reviewer recommends Option B (try/catch).

**Decision: Option C** - Given priority on quality/stability, atomic operations prevent partial state.

**Implementation Guidance:**

- Use `prisma.$transaction()` to wrap tenant creation + onboarding
- Extract to shared `TenantProvisioningService.createFullyProvisioned()`
- Both signup and admin API should use the same service method
- If onboarding fails, entire tenant creation rolls back

**Key Quote (DHH):** "One way to create a tenant, one outcome."

**Architectural Pattern:**

```typescript
class TenantProvisioningService {
  async createFullyProvisioned(tx: PrismaTransaction, data: CreateTenantInput) {
    const tenant = await this.tenantService.create(tx, data);
    await this.onboardingService.initializeDefaults(tx, tenant.id);
    return tenant;
  }
}
```

## Technical Details

**Affected Files:**

- `server/src/routes/admin/tenants.routes.ts` - Add onboarding call

**Related Files:**

- `server/src/routes/auth.routes.ts` - Reference implementation
- `server/src/services/tenant-onboarding.service.ts` - Service to call
- `server/src/di.ts` - Ensure service is injected into admin routes

**DI Consideration:**
Verify `tenantOnboardingService` is available in admin routes container. May need to add to `buildAdminRoutes()` parameters.

## Acceptance Criteria

- [ ] `TenantProvisioningService` created with `createFullyProvisioned()` method
- [ ] Admin API uses `TenantProvisioningService` in transaction
- [ ] Auth signup refactored to use same `TenantProvisioningService`
- [ ] Transaction rolls back if onboarding fails (no partial tenants)
- [ ] New tenant created via admin API has 1 segment + 3 packages
- [ ] Existing tests pass
- [ ] New test validates admin tenant gets default setup
- [ ] New test validates rollback on onboarding failure

## Work Log

| Date       | Action                     | Learnings                                    |
| ---------- | -------------------------- | -------------------------------------------- |
| 2026-01-05 | Created from system review | Admin API path bypasses onboarding           |
| 2026-01-05 | Triaged by 3 reviewers     | Option C (transaction) for quality/stability |

## Resources

- System Review: Tenant Packages & Segments Architecture
- Reference: Auth signup flow in `auth.routes.ts`
- Service: `TenantOnboardingService` in `tenant-onboarding.service.ts`
