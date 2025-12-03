# TODO: Replace manual fetch with type-safe API client in TenantStorefrontLayout

**Priority:** P2 (Medium)
**Category:** Code Quality
**Source:** Code Review - Architecture Strategist Agent
**Created:** 2025-11-29

## Problem

`TenantStorefrontLayout.tsx` uses manual `fetch()` instead of the type-safe API client. This bypasses type safety, error handling, and interceptors that the API client provides.

Current:
```typescript
const response = await fetch(`${baseUrl}/v1/public/tenants/${tenantSlug}`);
if (response.status === 200) {
  return response.json();
}
```

Should use:
```typescript
const result = await api.getTenantPublic({ params: { slug: tenantSlug } });
if (result.status === 200) {
  return result.body;
}
```

## Location

- `client/src/app/TenantStorefrontLayout.tsx:37-47`

## Impact

- No compile-time type checking on response
- Duplicated error handling logic
- Missing request/response interceptors
- Inconsistent with rest of codebase

## Solution

1. Add `getTenantPublic` to the API client if not already present
2. Replace manual fetch with API client call:

```typescript
const { data: tenant, isLoading, error } = useQuery({
  queryKey: ['tenant-public', tenantSlug],
  queryFn: async () => {
    const result = await api.getTenantPublic({ params: { slug: tenantSlug! } });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error(result.body.message || 'Tenant not found');
  },
  enabled: !!tenantSlug,
  staleTime: 1000 * 60 * 15,
});
```

## Acceptance Criteria

- [ ] Uses API client instead of raw fetch
- [ ] Response type is inferred from contract
- [ ] Error handling follows established patterns
- [ ] No regression in functionality

## Related Files

- `client/src/app/TenantStorefrontLayout.tsx`
- `client/src/lib/api.ts`
- `packages/contracts/src/api.v1.ts`
