# TODO: Remove unnecessary apiKeySet state from TenantStorefrontLayout

**Priority:** P2 (Medium)
**Category:** Code Quality
**Source:** Code Review - Code Simplicity Reviewer Agent
**Created:** 2025-11-29

## Problem

`TenantStorefrontLayout.tsx` has an `apiKeySet` state that gates rendering child routes:

```typescript
const [apiKeySet, setApiKeySet] = useState(false);

useEffect(() => {
  if (tenant?.apiKeyPublic) {
    api.setTenantKey(tenant.apiKeyPublic);
    setApiKeySet(true);
  }
  return () => { api.setTenantKey(null); setApiKeySet(false); };
}, [tenant?.apiKeyPublic]);

// Later in render:
if (!apiKeySet) {
  return <Loading label="Setting up storefront..." />;
}
```

This creates an extra render cycle and loading state that isn't necessary. The API key can be set synchronously when tenant data arrives.

## Location

- `client/src/app/TenantStorefrontLayout.tsx:33, 54-63, 77-79`

## Impact

- Extra loading flash for users
- Unnecessary state management
- useEffect dependency complexity
- Confusing code flow

## Solution

Remove the `apiKeySet` state and set API key directly when tenant loads:

```typescript
// Set API key synchronously in query success handler
const { data: tenant, isLoading, error } = useQuery({
  queryKey: ['tenant-public', tenantSlug],
  queryFn: async () => {
    const data = await fetchTenant(tenantSlug);
    // Set API key immediately when data arrives
    api.setTenantKey(data.apiKeyPublic);
    return data;
  },
  enabled: !!tenantSlug,
});

// Cleanup on unmount only
useEffect(() => {
  return () => api.setTenantKey(null);
}, []);

// Remove apiKeySet check from render - just use tenant presence
if (isLoading) return <Loading />;
if (!tenant) return <NotFound />;
return <Outlet />;
```

## Acceptance Criteria

- [ ] Remove `apiKeySet` state variable
- [ ] API key set synchronously when tenant data arrives
- [ ] Only one loading state (while fetching tenant)
- [ ] Cleanup still works on unmount
- [ ] No flash of extra loading state

## Related Files

- `client/src/app/TenantStorefrontLayout.tsx`
