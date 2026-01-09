---
module: MAIS
type: quick_reference
related: REACT_QUERY_DEDUPLICATION_PREVENTION.md
date: 2026-01-08
---

# React Query Deduplication: Quick Reference

**Print and pin this!** Use this 2-minute checklist when implementing data-fetching hooks.

---

## The Decision: useState+useEffect vs React Query?

### Use React Query If:

- [ ] Multiple components need the same data
- [ ] Data comes from an API endpoint
- [ ] You need automatic caching + invalidation
- [ ] You need refetching after mutations
- [ ] You want built-in retry logic

### Use useState+useEffect If:

- [ ] Data is computed locally (no API)
- [ ] Each component needs independent state
- [ ] You explicitly want fresh data on every mount

---

## 4-Step Conversion

### 1. Define Query Key

```typescript
// lib/query-client.ts
export const queryKeys = {
  myFeature: {
    all: ['myFeature'] as const,
    byId: (id: string) => ['myFeature', id] as const,
  },
};
```

### 2. Extract Fetch Function

```typescript
async function fetchMyFeature(): Promise<MyFeature> {
  const response = await fetch('/api/feature');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}
```

### 3. Replace useState+useEffect

```typescript
// ❌ Before
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/feature')
    .then((r) => r.json())
    .then(setData);
}, []);

// ✅ After
const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.myFeature.all,
  queryFn: fetchMyFeature,
  staleTime: 5 * 60_000, // 5 min - when to refetch
  gcTime: 10 * 60_000, // 10 min - when to delete from memory
});
```

### 4. Add Mutation + Invalidation

```typescript
const queryClient = useQueryClient();
const saveMutation = useMutation({
  mutationFn: (data) => fetch('/api/feature', { method: 'POST', body: JSON.stringify(data) }),
  onSuccess: () => {
    // After write, refetch all dependent queries
    queryClient.invalidateQueries({ queryKey: queryKeys.myFeature.all });
  },
});
```

---

## Code Review: Red Flags

❌ **Flag these patterns:**

```typescript
// RED FLAG: useState + useEffect for API calls
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/...').then(/* ... */);
}, []);

// RED FLAG: Manual retry logic
if (attempts < 3) setTimeout(retry, 1000 * Math.pow(2, attempts));

// RED FLAG: useCallback with circular deps to prevent refetches
const fetchData = useCallback(() => {
  /* ... */
}, []);
useEffect(() => {
  fetchData();
}, [fetchData]);

// RED FLAG: Manual cache in module scope
let cachedData: Promise<T> | null = null;
```

✅ **Suggest React Query instead**

---

## Testing: Verify Deduplication

### Check Network Tab (Manual)

1. Open DevTools → Network tab
2. Filter: `/api/yourEndpoint`
3. Mount multiple components using the same hook
4. Should see **1 request**, not N requests

### Unit Test

```typescript
it('deduplicates concurrent requests', async () => {
  const mockFetch = vi.spyOn(global, 'fetch');
  mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: 'test' })));

  // Render hook 3 times simultaneously
  const { result: r1 } = renderHook(() => useMyData());
  const { result: r2 } = renderHook(() => useMyData());
  const { result: r3 } = renderHook(() => useMyData());

  await waitFor(() => {
    expect(r1.current.data).toBe('test');
    expect(r2.current.data).toBe('test');
    expect(r3.current.data).toBe('test');
  });

  // Only ONE fetch, not three
  expect(mockFetch).toHaveBeenCalledOnce();
});
```

---

## staleTime vs gcTime Cheat Sheet

| Setting   | Purpose                           | Example            |
| --------- | --------------------------------- | ------------------ |
| staleTime | When to refetch (data is "stale") | 1 min = `60_000`   |
| gcTime    | When to delete from memory        | 10 min = `600_000` |

**Memory timeline:**

- T=0: Data fetched
- T=staleTime: Data becomes stale, auto-refetch on next use
- T=gcTime: Data deleted from memory (can't use even if component remounts)

**Rule:** gcTime >= staleTime (always)

---

## queryKey Structure Patterns

```typescript
// ✅ Resource first, then details
queryKey: ['packages']; // All packages
queryKey: ['packages', 'abc-123']; // Package by ID
queryKey: ['packages', 'abc-123', 'reviews']; // Nested resource

// ✅ Use factory functions for params
const queryKeys = {
  packages: {
    all: ['packages'] as const,
    byId: (id: string) => ['packages', id] as const,
    reviews: (id: string) => ['packages', id, 'reviews'] as const,
  },
};

queryKey: queryKeys.packages.byId('abc-123'); // Generates: ['packages', 'abc-123']
```

---

## Common Mistakes

| Mistake                        | Problem                     | Solution                                 |
| ------------------------------ | --------------------------- | ---------------------------------------- |
| Changing queryKey per render   | Cache lost                  | Use factory functions for params         |
| No invalidation after mutation | Data stays stale            | Add `onSuccess` with `invalidateQueries` |
| Missing QueryClientProvider    | App crashes                 | Wrap app with provider                   |
| Setting gcTime < staleTime     | Data deleted before refetch | Always: gcTime >= staleTime              |
| Logging full error objects     | Security issue              | Use `sanitizeError()` helper             |

---

## Performance Impact

### Before (3 duplicate requests):

```
Network: 150KB (3 × 50KB)
Requests: 3
Time: 1.3s
```

### After (1 coalesced request):

```
Network: 50KB (1 × 50KB)
Requests: 1
Time: 1.2s
Savings: 100KB per page load
```

**With 1000 daily loads:** 100MB saved/day, 3GB/month

---

## Mutation Pattern

```typescript
const queryClient = useQueryClient();

// 1. Create mutation
const mutation = useMutation({
  mutationFn: async (newData) => {
    const res = await fetch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(newData),
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  // 2. Invalidate cache after success
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.myFeature.all });
  },
});

// 3. Use mutation
mutation.mutate(data); // or mutateAsync() for promises
```

---

## Dependency Injection

### For Tests: Inject Mock Cache

```typescript
// lib/query-client.ts
export function createQueryClient(config?: Partial<QueryClientConfig>) {
  return new QueryClient(config);
}

// Test
const mockClient = createQueryClient({ defaultOptions: { queries: { retry: 0 } } });

const wrapper = ({ children }) => (
  <QueryClientProvider client={mockClient}>
    {children}
  </QueryClientProvider>
);

renderHook(() => useMyData(), { wrapper });
```

---

## When In Doubt

| Scenario                | Use React Query | Why                              |
| ----------------------- | --------------- | -------------------------------- |
| 1 component, API data   | ✅ Yes          | Simpler than useState+useEffect  |
| 2+ components, API data | ✅ Yes          | Deduplication + caching built-in |
| Form state              | ❌ No           | Independent per component        |
| UI toggles              | ❌ No           | Not API data                     |
| Shared computed state   | ✅ Yes          | Avoids recalculation             |

---

## Files to Read

1. [Full Prevention Guide](REACT_QUERY_DEDUPLICATION_PREVENTION.md) - 15 min read
2. [Current Implementation](../../apps/web/src/hooks/useOnboardingState.ts) - Reference example
3. [Query Client Setup](../../apps/web/src/lib/query-client.ts) - Configuration reference
4. [React Query Docs](https://tanstack.com/query/latest) - Official docs

---

**Print Section:** Decision tree + 4-step conversion + Red flags checklist
**Last Updated:** 2026-01-08
