# React Query Caching - When to Use vs Raw Fetch

**Status:** Complete Prevention Pattern
**Severity:** P2 (Performance & Code Quality)
**Last Updated:** 2026-01-05
**Related:** P2 Fix #642

## Problem Statement

Frontend code using raw `useEffect` + `fetch` + `useState` misses caching, deduplication, and automatic refetch benefits:

```tsx
// ❌ WRONG - Raw fetch (no caching, refetch on mount)
useEffect(() => {
  fetch('/api/tenant-admin/services')
    .then((r) => r.json())
    .then((data) => setServices(data))
    .catch((err) => setError(err));
}, []);

// ✓ CORRECT - React Query (caching, deduplication, stale-while-revalidate)
const {
  data: services,
  isLoading,
  error,
} = useQuery({
  queryKey: queryKeys.tenantAdmin.services,
  queryFn: () => fetch('/api/tenant-admin/services').then((r) => r.json()),
  enabled: isAuthenticated,
});
```

**Consequences of raw fetch:**

- Data refetched on every page mount
- No deduplication (multiple requests for same data)
- No caching between components
- Manual cache invalidation after mutations
- Slower perceived performance
- More network requests
- Boilerplate code for loading/error states

## Prevention Strategies

### 1. Decision Tree: useQuery vs Raw Fetch

**Use React Query if:**

```
Is the data shared across components? → YES → useQuery ✓
Does the data need caching? → YES → useQuery ✓
Is the endpoint defined in queryKeys? → YES → useQuery ✓
Will you navigate away and return? → YES → useQuery ✓
```

**Use raw fetch only if:**

```
ONE-OFF REQUEST (not shared, not cached)
AND
NO CACHING NEEDED
AND
ENDPOINT NOT DEFINED IN queryKeys

Example: Single image load, single export operation
```

**In practice:** For admin/tenant pages, ALWAYS use useQuery.

### 2. Query Keys Structure

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/query-client.ts`

**Existing keys available:**

```typescript
export const queryKeys = {
  // Tenant storefront data
  packages: {
    all: ['packages'],
    bySlug: (slug: string) => ['packages', slug],
  },
  bookings: {
    all: ['bookings'],
    byId: (id: string) => ['bookings', id],
  },
  tenant: {
    public: (slug: string) => ['tenant', 'public', slug],
    config: (slug: string) => ['tenant', 'config', slug],
  },

  // Admin dashboard
  admin: {
    bookings: ['admin', 'bookings'],
    blackouts: ['admin', 'blackouts'],
    stats: ['admin', 'stats'],
  },

  // Tenant admin pages
  tenantAdmin: {
    dashboard: ['tenant-admin', 'dashboard'],
    depositSettings: ['tenant-admin', 'deposit', 'settings'],
    packages: ['tenant-admin', 'packages'],
    branding: ['tenant-admin', 'branding'],

    // Scheduling-related
    bookings: ['tenant-admin', 'bookings'],
    blackouts: ['tenant-admin', 'blackouts'],
    appointments: (filters?: Record<string, string>) =>
      filters ? ['tenant-admin', 'appointments', filters] : ['tenant-admin', 'appointments'],
    services: ['tenant-admin', 'services'],
    customers: ['tenant-admin', 'customers'],
    availabilityRules: ['tenant-admin', 'availability-rules'],
  },
};

// Cache timing options
export const queryOptions = {
  catalog: {
    // Services, packages (change rarely)
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  bookings: {
    // Bookings (change frequently)
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  realtime: {
    // Live chat, status (needs fresh)
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 1 * 60 * 1000, // 1 minute
  },
};
```

### 3. Migration Pattern

**Step 1: Replace useEffect with useQuery**

```tsx
// ❌ BEFORE
'use client';
import { useEffect, useState } from 'react';

export default function ServicesList() {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/tenant-admin/services')
      .then((r) => r.json())
      .then((data) => setServices(data))
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {services.map((s) => (
        <div key={s.id}>{s.name}</div>
      ))}
    </div>
  );
}
```

**✓ AFTER - With useQuery**

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, queryOptions } from '@/lib/query-client';
import type { ServiceDto } from '@macon/contracts';

export default function ServicesList() {
  const {
    data: services = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.tenantAdmin.services,
    queryFn: async () => {
      const response = await fetch('/api/tenant-admin/services');
      if (!response.ok) throw new Error('Failed to load services');
      return response.json() as Promise<ServiceDto[]>;
    },
    ...queryOptions.catalog, // 5 min cache (services change rarely)
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error?.message}</div>;

  return (
    <div>
      {services.map((s) => (
        <div key={s.id}>{s.name}</div>
      ))}
    </div>
  );
}
```

### 4. Cache Invalidation Pattern

**After mutations, invalidate related queries:**

```tsx
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const response = await fetch('/api/tenant-admin/services', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create');
      return response.json();
    },
    onSuccess: (newService) => {
      // Invalidate services list
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenantAdmin.services,
      });

      // Optionally update cache immediately (optimistic update)
      queryClient.setQueryData(queryKeys.tenantAdmin.services, (old) => [...old, newService]);
    },
  });
}
```

### 5. Patterns for Common Scenarios

**Pattern 1: Simple list fetch**

```tsx
const {
  data = [],
  isLoading,
  error,
} = useQuery({
  queryKey: queryKeys.tenantAdmin.services,
  queryFn: () => fetch('/api/tenant-admin/services').then((r) => r.json()),
  ...queryOptions.catalog,
});
```

**Pattern 2: Fetch with filters**

```tsx
// queryKeys support parameters
const { data = [] } = useQuery({
  queryKey: queryKeys.tenantAdmin.appointments({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  }),
  queryFn: ({ queryKey }) => {
    const [, filters] = queryKey;
    const params = new URLSearchParams(filters);
    return fetch(`/api/tenant-admin/appointments?${params}`).then((r) => r.json());
  },
});
```

**Pattern 3: Conditional fetch (enabled)**

```tsx
const { isAuthenticated } = useAuth();

const { data } = useQuery({
  queryKey: queryKeys.tenantAdmin.dashboard,
  queryFn: () => fetch('/api/tenant-admin/dashboard').then((r) => r.json()),
  enabled: isAuthenticated, // Only fetch after login
});
```

**Pattern 4: Refetch on demand**

```tsx
const { data, refetch } = useQuery({
  queryKey: queryKeys.tenantAdmin.bookings,
  queryFn: () => fetch('/api/tenant-admin/bookings').then((r) => r.json()),
});

// User clicks refresh button
<button onClick={() => refetch()}>Refresh</button>;
```

### 6. Code Review Checklist

**When reviewing data fetching code:**

```markdown
Data Fetching Pattern Review

API Calls
├─ [ ] useQuery used (not raw fetch)?
├─ [ ] Query key is defined in queryKeys?
├─ [ ] Query key includes all parameters?
├─ [ ] Error handling present?
└─ [ ] Loading state handled?

Cache Invalidation
├─ [ ] Mutations use useQueryClient?
├─ [ ] queryClient.invalidateQueries() called on success?
├─ [ ] Invalidation targets correct queryKey?
├─ [ ] Stale queries refetched automatically?
└─ [ ] Cache timing appropriate (catalog vs bookings)?

Query Options
├─ [ ] staleTime appropriate for data type?
├─ [ ] gcTime (garbage collection time) set?
├─ [ ] enabled condition used if needed?
└─ [ ] Comments explain why specific timing?

Error Handling
├─ [ ] Network errors caught?
├─ [ ] HTTP error codes checked (not just JSON errors)?
├─ [ ] Error messages are user-friendly?
└─ [ ] No console.error (use logger)?
```

### 7. Performance Monitoring

**Check if caching is working:**

```bash
# React Query DevTools (already installed in dev)
1. Open DevTools
2. Look for React Query panel
3. Check if queries are in cache
4. Verify cache keys match queryKeys definitions

# Network tab check
1. Navigate to page with useQuery
2. Check network tab - should see fetch
3. Navigate away and back
4. Second navigation should NOT see new fetch (cached)
```

### 8. Migration Checklist

**When converting a page from raw fetch to useQuery:**

```markdown
1. [ ] Identify all fetch() calls in the page
2. [ ] Check if queryKey exists in queryKeys - if not, add it
3. [ ] Replace useEffect + useState with useQuery
4. [ ] Update error handling
5. [ ] Add appropriate queryOptions (catalog/bookings/realtime)
6. [ ] Test: navigate away and back (should not refetch)
7. [ ] Test: modify data, verify queryClient.invalidateQueries works
8. [ ] Check React Query DevTools - query shows in cache
```

## Related Files

**Query configuration:**

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/query-client.ts` - Query keys and options

**Example implementations:**

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx` - Shows correct useQuery pattern
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/admin/dashboard/page.tsx` - Admin dashboard with useQuery

**Documentation:**

- React Query: https://tanstack.com/query/latest
- TanStack Query DevTools: https://tanstack.com/query/latest/docs/devtools

## Key Takeaways

1. **Always use useQuery for shared/cached data** - Raw fetch only for one-offs
2. **Query keys = cache identity** - Same key = same cache entry
3. **staleTime is automatic refetch trigger** - After 5 min, query becomes "stale" and refetches on mount
4. **gcTime is memory cleanup** - Unused data deleted after time elapsed
5. **Invalidate after mutations** - Keep cache fresh with queryClient.invalidateQueries()

## FAQ

**Q: Why caching matters?**
A: Without caching, users see spinners every navigation. With caching, instant data + background refetch.

**Q: Can I use raw fetch in a component?**
A: Yes, for fire-and-forget (upload, export). For any data sharing/caching, use useQuery.

**Q: Should I cache everything?**
A: No. Real-time data (chat messages, live updates) needs short staleTime. Static data can cache longer.

**Q: How long should staleTime be?**
A: Catalog/services: 5-30 min. Bookings: 1 min. Chat: 10-30 sec. Live status: <5 sec.

**Q: Do I need to call refetch manually?**
A: Usually no. React Query refetches automatically when:

- Query becomes stale (after staleTime)
- Window regains focus
- Component remounts
- User clicks refresh button (if you wire it)

**Q: How to test useQuery in tests?**
A: Use QueryClientProvider wrapper in tests. Mock fetch with jest.mock or MSW (Mock Service Worker).
