---
status: complete
priority: p2
issue_id: "030"
tags: [code-review, security, multi-tenant, data-integrity]
dependencies: []
---

# Missing Tenant Validation in AddOn Cross-Tenant Reference

## Problem Statement

`getAddOnsByPackageId()` filters by tenantId for addOns but does NOT verify packageId belongs to same tenant. An attacker could provide a packageId from tenant B while authenticated as tenant A.

**Why this matters:** Cross-tenant data exposure allows reading add-ons from other tenants by guessing package IDs.

## Findings

### Code Evidence

**Location:** `server/src/adapters/prisma/catalog.repository.ts:70-91`

```typescript
async getAddOnsByPackageId(tenantId: string, packageId: string): Promise<AddOn[]> {
  // Filters addOns by tenantId - GOOD
  // Does NOT verify packageId belongs to tenantId - BAD
  const addOns = await this.prisma.addOn.findMany({
    where: {
      tenantId,
      packages: { some: { packageId } },  // packageId not validated
    },
  });
}
```

### Exploitation Scenario

```typescript
// Attacker is tenant A
const addOns = await catalogRepo.getAddOnsByPackageId(
  'tenantA',
  'packageB_from_tenantB'  // Not validated!
);
// Could return add-ons associated with packageB
```

## Proposed Solutions

### Option A: Add Package Ownership Validation (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
async getAddOnsByPackageId(tenantId: string, packageId: string): Promise<AddOn[]> {
  // CRITICAL: Verify package belongs to tenant
  const pkg = await this.prisma.package.findFirst({
    where: { tenantId, id: packageId },
    select: { id: true },
  });

  if (!pkg) {
    throw new NotFoundError(`Package not found or unauthorized`);
  }

  // Now safe to query add-ons
  const addOns = await this.prisma.addOn.findMany({
    where: { tenantId, packages: { some: { packageId } } },
  });
  return addOns;
}
```

## Acceptance Criteria

- [ ] Package ownership verified before add-on query
- [ ] NotFoundError thrown for cross-tenant access
- [ ] Test: accessing other tenant's package returns 404
- [ ] No change to valid tenant queries

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during data integrity review |
