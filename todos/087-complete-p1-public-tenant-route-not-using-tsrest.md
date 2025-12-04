---
status: complete
priority: p1
issue_id: "087"
tags: [todo]
dependencies: []
---

# TODO: Migrate public-tenant route to ts-rest binding

**Priority:** P1 (High)
**Category:** Architecture
**Source:** Code Review - Architecture Strategist Agent
**Created:** 2025-11-29

## Problem

The `public-tenant.routes.ts` file uses raw Express Router instead of ts-rest binding. This bypasses the contract enforcement that other routes use and creates inconsistency in the codebase.

Current implementation:
```typescript
const router = Router();
router.get('/:slug', async (req, res) => { ... });
```

Should use:
```typescript
const publicTenantRouter = createExpressEndpoints(
  contract.getTenantPublic,
  { getTenantPublic: handler },
  router
);
```

## Location

- `server/src/routes/public-tenant.routes.ts` - Entire file

## Risk

- Contract drift (route may not match contract definition)
- Response types not validated at runtime
- Inconsistent error handling patterns
- Missing middleware integrations that ts-rest provides

## Solution

Refactor to use ts-rest binding:

```typescript
import { initServer } from '@ts-rest/express';
import { contract } from '@macon/contracts';

const s = initServer();

export const publicTenantRouter = s.router(contract, {
  getTenantPublic: async ({ params }) => {
    const tenant = await tenantRepository.findBySlug(params.slug);
    if (!tenant) {
      return { status: 404, body: { error: 'NOT_FOUND', message: 'Tenant not found' } };
    }
    return { status: 200, body: mapToPublicDto(tenant) };
  },
});
```

## Acceptance Criteria

- [ ] Route uses ts-rest `initServer()` pattern
- [ ] Response matches contract schema exactly
- [ ] Error responses follow standard format
- [ ] All existing functionality preserved
- [ ] Tests pass

## Related Files

- `server/src/routes/public-tenant.routes.ts`
- `packages/contracts/src/api.v1.ts`
- `server/src/routes/index.ts`
