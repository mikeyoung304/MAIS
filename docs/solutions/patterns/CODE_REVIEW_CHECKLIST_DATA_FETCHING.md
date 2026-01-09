---
module: MAIS
type: code_review_checklist
related:
  - REACT_QUERY_DEDUPLICATION_PREVENTION.md
  - REACT_QUERY_DEDUPLICATION_QUICK_REFERENCE.md
date: 2026-01-08
severity: P2
---

# Code Review Checklist: Data Fetching Hooks

**Purpose:** Catch duplicate API call patterns and data-fetching anti-patterns during code review.

**When to Use:** During PR review of any hook that fetches data from an API.

**Estimated Time:** 2-3 minutes per hook

---

## Quick Scan: Is This a Data-Fetching Hook?

Before applying the full checklist, determine scope:

```typescript
// Does this hook make network requests?
export function useMyHook() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/...').then(/* ... */); // ← YES, this is a data-fetching hook
    return data;
  });
}
```

**If YES → Continue with full checklist below**

**If NO (computed/local state only) → Skip this checklist**

---

## Section 1: Architecture Pattern (Required)

### Rule: Use React Query for API Data

- [ ] Hook makes API call? → Must use `useQuery` from `@tanstack/react-query`
- [ ] Hook will be used by 2+ components? → Must use React Query (deduplication)
- [ ] Hook updates data after mutation? → Must use React Query (cache invalidation)

### Red Flag Patterns

```typescript
// ❌ FAIL - Using useState + useEffect for API calls
export function useSomething() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/endpoint')
      .then((r) => r.json())
      .then(setData);
  }, []);
}

// ✅ PASS - Using React Query
export function useSomething() {
  return useQuery({
    queryKey: queryKeys.something.all,
    queryFn: () => fetch('/api/endpoint').then((r) => r.json()),
  });
}
```

**Decision Tree:**

```
Does hook fetch from API?
├─ YES
│  ├─ Will 2+ components use it?
│  │  ├─ YES → React Query required
│  │  └─ NO → React Query still recommended
│  └─ Should it cache results?
│     ├─ YES → React Query required
│     └─ NO → Unusual, document why
└─ NO (computed data, form state, UI toggles)
   └─ Skip to Section 4
```

---

## Section 2: Query Configuration (If Using React Query)

### queryKey Definition

- [ ] queryKey is defined in `queryKeys` object in `lib/query-client.ts`?
- [ ] queryKey uses tuples (e.g., `['resource', param]`)?
- [ ] queryKey uses factory functions for parameters? E.g., `byId: (id) => ['resource', id]`
- [ ] queryKey won't change on every render (would destroy cache)?

### Code Review Example

```typescript
// ❌ FAIL - Query key changes on every render, destroys cache
function useMyData(filter: string) {
  return useQuery({
    queryKey: ['data', filter], // Changes when filter changes!
    queryFn: () => fetchData(filter),
  });
}

// ✅ PASS - Query key properly parameterized
export const queryKeys = {
  data: {
    byFilter: (filter: string) => ['data', filter] as const,
  },
};

function useMyData(filter: string) {
  return useQuery({
    queryKey: queryKeys.data.byFilter(filter),
    queryFn: () => fetchData(filter),
  });
}
```

### staleTime + gcTime Configuration

- [ ] Hook has explicit `staleTime` set (not relying on default)?
- [ ] Hook has explicit `gcTime` set (not relying on default)?
- [ ] gcTime >= staleTime (garbage collection doesn't delete before re-fetch)?
- [ ] Values are appropriate for data type:
  - Static content (e.g., packages): 15+ minutes
  - User data (e.g., onboarding state): 1-5 minutes
  - Real-time data (e.g., availability): 30 seconds
  - Form state: 5 minutes

### Code Review Example

```typescript
// ❌ FAIL - No explicit staleTime, unpredictable behavior
useQuery({
  queryKey: queryKeys.onboarding.state,
  queryFn: fetchOnboardingState,
  // Using defaults - may not match intent
});

// ❌ FAIL - gcTime < staleTime (data deleted before refetch)
useQuery({
  queryKey: queryKeys.onboarding.state,
  queryFn: fetchOnboardingState,
  staleTime: 5 * 60_000, // 5 min
  gcTime: 1 * 60_000, // 1 min (WRONG - deletes before staleTime!)
});

// ✅ PASS - Explicit times, gcTime >= staleTime
useQuery({
  queryKey: queryKeys.onboarding.state,
  queryFn: fetchOnboardingState,
  staleTime: 1 * 60_000, // 1 min
  gcTime: 10 * 60_000, // 10 min
  refetchOnWindowFocus: false,
  retry: 1,
});
```

---

## Section 3: Mutations and Cache Invalidation

### If Hook Has Write Operations

- [ ] Hook uses `useMutation` for write operations?
- [ ] Mutation has `onSuccess` callback?
- [ ] `onSuccess` calls `queryClient.invalidateQueries()`?
- [ ] Invalidated queryKey matches data that was modified?
- [ ] Cache invalidation happens for all affected queries (not just one)?

### Code Review Example

```typescript
// ❌ FAIL - No cache invalidation after mutation
export function useOnboardingState() {
  const skipMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/agent/skip-onboarding', { method: 'POST' });
    },
    // Missing onSuccess - cache never updates!
  });
  return { skipOnboarding: skipMutation.mutateAsync };
}

// ✅ PASS - Proper cache invalidation
export function useOnboardingState() {
  const queryClient = useQueryClient();
  const skipMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/agent/skip-onboarding', { method: 'POST' });
    },
    onSuccess: () => {
      // After mutation succeeds, invalidate cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.state,
      });
    },
  });
  return { skipOnboarding: skipMutation.mutateAsync };
}
```

### If No Write Operations

- [ ] Confirm hook is read-only (no mutations)?
- [ ] Document why mutation is not needed?

---

## Section 4: Error Handling

### Fetch Function Error Handling

- [ ] Fetch function throws on non-200 status?
- [ ] Error type is appropriate (Error class, domain error)?
- [ ] Error message is descriptive?

### Hook Error Exposure

- [ ] Hook exposes error to component? (e.g., `error`, `isError`, `error.message`)
- [ ] Components handle error state gracefully?
- [ ] Error messages are sanitized (no sensitive data)?

### Code Review Example

```typescript
// ❌ FAIL - Silent failure on non-200 response
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json(); // What if response.ok === false?
}

// ❌ FAIL - Error object logged directly (may contain secrets)
const { data, error } = useQuery({
  /* ... */
});
console.error(error); // Logs full error with potentially sensitive data

// ✅ PASS - Proper error throwing
async function fetchData(): Promise<MyData> {
  const response = await fetch('/api/data');
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status}`);
  }
  return response.json();
}

// ✅ PASS - Sanitized error handling
const { data, error, isLoading } = useQuery({
  /* ... */
});
if (error) {
  // Use sanitizeError helper before logging
  logger.error({ error: sanitizeError(error) }, 'Query failed');
}
```

---

## Section 5: Testing

### Unit Tests Exist

- [ ] Hook has unit tests?
- [ ] Tests verify deduplication (concurrent requests)?
- [ ] Tests verify cache behavior (staleTime/gcTime)?
- [ ] Tests verify mutation invalidation?
- [ ] Tests use QueryClientProvider wrapper?

### Code Review Example

```typescript
// ❌ FAIL - No deduplication test
describe('useMyData', () => {
  it('fetches data', async () => {
    const { result } = renderHook(() => useMyData());
    await waitFor(() => expect(result.current.data).toBeDefined());
  });
});

// ✅ PASS - Tests deduplication + cache behavior
describe('useMyData', () => {
  it('deduplicates concurrent requests', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: 'test' })));

    const queryClient = getQueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Render hook 3 times simultaneously
    renderHook(() => useMyData(), { wrapper });
    renderHook(() => useMyData(), { wrapper });
    renderHook(() => useMyData(), { wrapper });

    // Should only fetch once, not three times
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
  });

  it('uses cached data within staleTime', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: 'test' })));

    const queryClient = getQueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { rerender } = renderHook(() => useMyData(), { wrapper });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    // Re-render within staleTime - no new fetch
    rerender();
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});
```

### E2E Tests

- [ ] Network tab verification: only 1 request for multiple components using hook?
- [ ] Mutation refetch verification: cache refreshes after write?

---

## Section 6: Documentation

### Hook Comments

- [ ] Hook has JSDoc explaining what it does?
- [ ] Comment explains when to use this vs alternatives?
- [ ] Comment explains caching behavior (staleTime/gcTime)?
- [ ] Comment explains mutation behavior (if applicable)?

### Code Review Example

````typescript
// ❌ FAIL - No documentation
export function useMyData() {
  return useQuery({
    queryKey: queryKeys.myData.all,
    queryFn: fetchMyData,
  });
}

// ✅ PASS - Clear documentation
/**
 * Hook for fetching application data
 *
 * Uses TanStack Query for:
 * - Automatic request deduplication (multiple components share one request)
 * - Intelligent caching with 5-minute staleTime
 * - Coordinated refetching after mutations
 *
 * Cache behavior:
 * - staleTime: 5 minutes (data considered fresh for this period)
 * - gcTime: 10 minutes (data removed from memory after this)
 *
 * Features:
 * - Automatically retries once on failure
 * - Doesn't refetch on window focus
 * - Provides loading and error states
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { data, isLoading, error } = useMyData();
 *   return <div>{data?.name}</div>;
 * }
 * ```
 *
 * Multiple components using this hook will share the same cached response.
 */
export function useMyData() {
  return useQuery({
    queryKey: queryKeys.myData.all,
    queryFn: fetchMyData,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
````

---

## Section 7: Anti-Patterns (Automatic FAIL)

If any of these are present, request changes:

### Critical Anti-Patterns

- [ ] ❌ useState + useEffect for API calls (instead of React Query)
- [ ] ❌ Manual retry logic in useEffect
- [ ] ❌ useCallback with circular dependency to prevent refetches
- [ ] ❌ No cache invalidation after mutations
- [ ] ❌ Changing queryKey based on data (breaks cache)
- [ ] ❌ Multiple fetch calls to same endpoint in one component
- [ ] ❌ localStorage used as temporary cache (use React Query instead)
- [ ] ❌ Module-level cache variable (use React Query context)

### Comment Pattern: Catch Manual Caching

Look for these telltale comments:

```typescript
// ❌ Red flag comments
let cachedData = null; // Manual cache!
// TODO: debounce this fetch
// Re-fetch to get latest data
// Need to coordinate multiple requests
// This should only fetch once per session
// Check if we already have this data
```

---

## Section 8: Network Behavior Verification

### Manual Testing Checklist

- [ ] Open DevTools Network tab, filter by endpoint
- [ ] Mount page with multiple components using hook
- [ ] Verify only **1 request** appears, not N
- [ ] Change to different page/component, come back
- [ ] Verify cache is used (no new request within staleTime)
- [ ] Wait for staleTime to expire, interact with page
- [ ] Verify new request fires after staleTime expires
- [ ] Perform mutation, verify refetch happens
- [ ] Verify all components re-render with new data

### Network Tab Expectations

```
✅ CORRECT - Single request for multiple components
GET /api/endpoint  200  1.2s

❌ WRONG - Duplicate requests
GET /api/endpoint  200  1.2s
GET /api/endpoint  200  1.3s
GET /api/endpoint  200  1.1s
```

---

## Quick Scan Template (Copy for PRs)

```markdown
## Data Fetching Hook Review

### Architecture

- [ ] Uses `useQuery` or `useMutation` from React Query
- [ ] queryKey defined in queryKeys object
- [ ] staleTime and gcTime explicitly set

### Cache

- [ ] Mutations have cache invalidation in onSuccess
- [ ] Query key won't change on every render
- [ ] Appropriate cache times for data type

### Error Handling

- [ ] Fetch function throws on error
- [ ] Hook exposes error to component
- [ ] Error messages are descriptive

### Testing

- [ ] Unit tests verify deduplication
- [ ] Cache behavior tested
- [ ] Network requests verified (1 request, not N)

### Documentation

- [ ] Hook has JSDoc comment
- [ ] Cache behavior explained
- [ ] When to use this hook is clear

### Manual Verification

- [ ] Tested in DevTools Network tab
- [ ] Single request for multiple components
- [ ] Cache persists within staleTime
```

---

## Severity Guidelines

### MUST FIX (Block PR)

- Using useState + useEffect for API calls
- No cache invalidation after mutations
- Duplicate network requests in Network tab
- gcTime < staleTime

### SHOULD FIX (Request Changes)

- Missing tests for deduplication
- Missing documentation
- Error not properly handled
- No explicit staleTime/gcTime

### NICE TO HAVE (Suggestions)

- Additional tests for edge cases
- More detailed JSDoc
- Performance optimizations
- Additional error states

---

## Related Documentation

- [Full Prevention Guide](REACT_QUERY_DEDUPLICATION_PREVENTION.md)
- [Quick Reference](REACT_QUERY_DEDUPLICATION_QUICK_REFERENCE.md)
- [useOnboardingState Example](../../apps/web/src/hooks/useOnboardingState.ts)
- [React Query Documentation](https://tanstack.com/query/latest)

---

**Last Updated:** 2026-01-08
**Severity:** P2
**Estimated Review Time:** 2-3 minutes per hook
