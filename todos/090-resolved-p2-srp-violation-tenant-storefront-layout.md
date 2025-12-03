# TODO: Extract concerns from TenantStorefrontLayout (SRP violation)

**Priority:** P2 (Medium)
**Category:** Code Quality
**Source:** Code Review - Code Simplicity Reviewer Agent
**Created:** 2025-11-29

## Problem

`TenantStorefrontLayout.tsx` violates Single Responsibility Principle by handling 3 distinct concerns in one component:
1. Tenant data fetching and API key management
2. CSS branding application
3. Layout rendering (header/footer/outlet)

This makes the component harder to test, maintain, and reuse.

## Location

- `client/src/app/TenantStorefrontLayout.tsx` (174 lines)

## Impact

- Difficult to test individual concerns in isolation
- Branding logic cannot be reused (e.g., in WidgetApp)
- Changes to one concern risk breaking others
- Component is harder to understand

## Solution

Extract into focused hooks and components:

### 1. useTenantBranding hook
```typescript
// client/src/hooks/useTenantBranding.ts
export function useTenantBranding(branding?: TenantBranding) {
  useEffect(() => {
    if (!branding) return;
    const root = document.documentElement;
    const originalValues: Record<string, string> = {};

    // Store original values and apply new ones
    if (branding.primaryColor) {
      originalValues['--color-primary'] = root.style.getPropertyValue('--color-primary');
      root.style.setProperty('--color-primary', branding.primaryColor);
    }
    // ... other properties

    return () => {
      // Restore original values
      Object.entries(originalValues).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    };
  }, [branding]);
}
```

### 2. useTenantContext hook
```typescript
// client/src/hooks/useTenantContext.ts
export function useTenantContext(tenantSlug: string | undefined) {
  const query = useQuery({
    queryKey: ['tenant-public', tenantSlug],
    queryFn: () => api.getTenantPublic({ params: { slug: tenantSlug! } }),
    enabled: !!tenantSlug,
  });

  useEffect(() => {
    if (query.data?.apiKeyPublic) {
      api.setTenantKey(query.data.apiKeyPublic);
    }
    return () => api.setTenantKey(null);
  }, [query.data?.apiKeyPublic]);

  return query;
}
```

### 3. Simplified layout component
```typescript
export function TenantStorefrontLayout() {
  const { tenantSlug } = useParams();
  const { data: tenant, isLoading, error } = useTenantContext(tenantSlug);
  useTenantBranding(tenant?.branding);

  if (isLoading) return <TenantLoadingSkeleton />;
  if (error || !tenant) return <TenantNotFound />;

  return (
    <TenantStorefrontShell tenant={tenant}>
      <Outlet />
    </TenantStorefrontShell>
  );
}
```

## Acceptance Criteria

- [ ] Branding logic extracted to reusable hook
- [ ] Tenant context/API key logic extracted to hook
- [ ] Layout component is thin orchestrator only
- [ ] Each piece can be tested independently
- [ ] No regression in functionality

## Related Files

- `client/src/app/TenantStorefrontLayout.tsx`
- `client/src/app/WidgetApp.tsx` (has similar branding logic)
