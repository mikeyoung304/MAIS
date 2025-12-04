---
status: complete
priority: p1
issue_id: "088"
tags: [todo]
dependencies: []
---

# TODO: Integrate public-tenant route with DI container

**Priority:** P1 (High)
**Category:** Architecture
**Source:** Code Review - Architecture Strategist Agent
**Created:** 2025-11-29

## Problem

The `public-tenant.routes.ts` file directly imports PrismaClient instead of using the DI container and repository pattern. This breaks the established architecture pattern and makes testing harder.

Current:
```typescript
export function createPublicTenantRoutes(prisma: PrismaClient): Router {
  // Uses raw prisma.tenant.findUnique()
}
```

Should use:
```typescript
export function createPublicTenantRoutes(tenantRepository: TenantRepository): Router {
  // Uses tenantRepository.findBySlug()
}
```

## Location

- `server/src/routes/public-tenant.routes.ts` - Line 11-35
- `server/src/routes/index.ts` - Line where routes are mounted

## Risk

- Cannot mock for unit tests
- Bypasses any repository-level caching or validation
- Inconsistent with other routes that use DI
- Makes refactoring harder

## Solution

1. Add `findBySlugPublic` method to tenant repository interface:

```typescript
// server/src/lib/ports.ts
interface TenantRepository {
  findBySlugPublic(slug: string): Promise<TenantPublicDto | null>;
}
```

2. Implement in Prisma adapter:

```typescript
// server/src/adapters/prisma/tenant.repository.ts
async findBySlugPublic(slug: string): Promise<TenantPublicDto | null> {
  const tenant = await this.prisma.tenant.findUnique({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true, apiKeyPublic: true, branding: true },
  });
  return tenant ? mapToPublicDto(tenant) : null;
}
```

3. Wire through DI container in `di.ts`

## Acceptance Criteria

- [ ] Route receives repository via DI, not raw Prisma
- [ ] Repository interface defined in ports.ts
- [ ] Mock implementation exists for testing
- [ ] Integration tests use real repository
- [ ] No direct Prisma imports in route file

## Related Files

- `server/src/routes/public-tenant.routes.ts`
- `server/src/lib/ports.ts`
- `server/src/adapters/prisma/tenant.repository.ts`
- `server/src/di.ts`
