# CL-TENANT-001: Missing Tenant Scoping in Queries

**Severity:** P0 | **Category:** Security | **Impact:** Cross-tenant data leakage

## Problem

Database queries without `tenantId` filtering return data from all tenants, causing security vulnerabilities and data leakage in multi-tenant SaaS.

## Bug Pattern

```typescript
// BROKEN: No tenant isolation - returns ALL packages across tenants
const packages = await prisma.package.findMany({
  where: { active: true },
});

// BROKEN: Cache key collision across tenants
const cacheKey = `catalog:packages`;
```

## Fix Pattern

```typescript
// CORRECT: Always scope by tenantId
const packages = await prisma.package.findMany({
  where: { tenantId, active: true }, // tenantId FIRST in where clause
});

// CORRECT: Tenant-scoped cache keys
const cacheKey = `tenant:${tenantId}:catalog:packages`;

// CORRECT: Repository interface enforces tenant scoping
interface CatalogRepository {
  getPackages(tenantId: string): Promise<Package[]>;
  getPackageBySlug(tenantId: string, slug: string): Promise<Package>;
}
```

## Prevention Checklist

- [ ] Every Prisma query has `tenantId` in WHERE clause
- [ ] Repository interfaces require `tenantId` as first parameter
- [ ] Cache keys include `tenant:${tenantId}:` prefix
- [ ] Integration tests verify tenant isolation
- [ ] Code review: search for `.findMany`, `.findFirst` without tenantId

## Detection

- Data from wrong tenant appears in UI
- User sees other company's packages/bookings
- Cache returns stale/wrong data across tenants
- Tests pass in isolation, fail with multiple tenants
