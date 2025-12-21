# P2: Query Key Missing tenantId - Cache Pollution Risk

## Priority: P2 Important
## Status: pending
## Feature: DATE Booking Flow
## Category: Multi-Tenant Security

## Issue

The React Query key for fetching unavailable dates doesn't include tenantId, which could cause cache pollution in a multi-tenant scenario.

**File:** `client/src/features/storefront/DateBookingWizard.tsx:69`

```typescript
const { data: unavailableDatesData, isLoading: isLoadingDates } = useQuery({
  queryKey: ['unavailable-dates', today.toISOString().split('T')[0]],
  // ❌ Missing tenantId in query key
  queryFn: async () => { ... }
});
```

## Impact

While the API call includes tenant context via headers, the cache key doesn't differentiate between tenants. If a user somehow accessed multiple tenant storefronts in the same browser session:
- Cached unavailable dates from Tenant A could be shown for Tenant B
- This is a multi-tenant data isolation concern

## Recommended Fix

Include tenantId (or tenantSlug) in the query key:

```typescript
// Get tenantSlug from context or URL
const { tenantSlug } = useTenantContext();

const { data: unavailableDatesData } = useQuery({
  queryKey: ['unavailable-dates', tenantSlug, today.toISOString().split('T')[0]],
  queryFn: async () => { ... }
});
```

Or use the package ID as a proxy for tenant context:

```typescript
queryKey: ['unavailable-dates', pkg.id, today.toISOString().split('T')[0]],
```

## Testing

- Verify cache isolation between tenants
- Test switching between storefronts

## Review Reference
- Code Review PR: feat/date-booking-hardening (ce6443d)
