# TanStack Query API Call Deduplication - useOnboardingState

---

slug: tanstack-query-api-deduplication
category: performance-issues
severity: P2
component: apps/web/src/hooks/useOnboardingState.ts
symptoms:

- Duplicate API calls on page load
- Network tab shows 2 identical requests
- Increased server load
  root_cause: useState + useEffect pattern creates independent state per component instance
  solution: Convert to TanStack Query for automatic request deduplication
  commit: 996c3bf6
  date: 2026-01-08
  tags: [tanstack-query, react-query, deduplication, hooks, performance]
  related:
- docs/solutions/patterns/REACT_QUERY_CACHING_PREVENTION.md
- apps/web/src/lib/query-client.ts

---

## Problem

Both `TenantLayoutContent` (layout.tsx) and `GrowthAssistantPanel` (child component) called `useOnboardingState()`, causing **2 duplicate API calls** to `/api/agent/onboarding-state` on every tenant dashboard page load.

### Symptoms

- Network tab shows 2 identical GET requests to `/api/agent/onboarding-state`
- +150-300ms overhead on page load
- Double server load for onboarding state endpoint

### Observable Behavior

```
Page Load Timeline:
├─ TenantLayoutContent mounts → fetch('/api/agent/onboarding-state')
├─ GrowthAssistantPanel mounts → fetch('/api/agent/onboarding-state')  ← DUPLICATE
└─ Both components wait for their own response
```

## Root Cause

The hook used `useState` + `useEffect` + `fetch()` pattern. Each component instance has its own state and triggers its own API call.

```typescript
// BEFORE: Each component instance creates independent state
export function useOnboardingState() {
  const [state, setState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // ... 4 more useState calls ...

  const fetchState = useCallback(async () => {
    const response = await fetch(`${API_PROXY}/onboarding-state`);
    // ...
  }, []);

  useEffect(() => {
    fetchState(); // ← Each component instance runs this independently
  }, [fetchState]);
}
```

**Why this happens:**

- React hooks are instance-scoped
- Two components = two hook instances = two useEffect callbacks = two fetch calls
- No shared cache or request deduplication

## Solution

Refactored to TanStack Query which provides automatic request deduplication via shared cache keys.

### 1. Added Query Key (query-client.ts)

```typescript
export const queryKeys = {
  // ... existing keys ...
  onboarding: {
    state: ['onboarding', 'state'] as const,
  },
};
```

### 2. Refactored Hook (useOnboardingState.ts)

```typescript
// AFTER: All components share same cache entry
export function useOnboardingState() {
  const queryClient = useQueryClient();

  // Multiple hook instances share this cache entry
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.onboarding.state,  // ← Deduplication key
    queryFn: fetchOnboardingState,
    staleTime: 60_000,  // 1 minute
  });

  // Mutation with automatic cache invalidation
  const skipMutation = useMutation({
    mutationFn: async (reason?: string) => { ... },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.state });
    },
  });

  // Same return interface - zero consumer changes
  return {
    state,
    currentPhase,
    isOnboarding,
    // ... all existing properties preserved
  };
}
```

### How TanStack Query Deduplication Works

```
Query Key Matching:
['onboarding', 'state'] ← TenantLayoutContent
['onboarding', 'state'] ← GrowthAssistantPanel (SAME KEY = REUSES)

Timeline After Fix:
├─ TenantLayoutContent mounts → useQuery starts fetch, stores in cache
├─ GrowthAssistantPanel mounts → useQuery finds same key pending
│   └─ Waits for first request instead of creating new one
└─ Both components receive same data from cache
```

## Files Changed

| File                                       | Change                             |
| ------------------------------------------ | ---------------------------------- |
| `apps/web/src/lib/query-client.ts`         | Added `onboarding.state` query key |
| `apps/web/src/hooks/useOnboardingState.ts` | Refactored to useQuery/useMutation |

**No changes to consuming components** - return interface is identical.

## Performance Impact

| Metric            | Before     | After      | Improvement |
| ----------------- | ---------- | ---------- | ----------- |
| API Requests/page | 2          | 1          | -50%        |
| Overhead          | +150-300ms | 0ms        | -150-300ms  |
| Server Load       | 2 req/page | 1 req/page | -50%        |

## Prevention Strategies

### Code Review Checklist

When reviewing hooks that fetch data, check for:

- [ ] Uses TanStack Query (not useState + useEffect for shared data)
- [ ] Query key defined in `queryKeys` registry
- [ ] `staleTime` configured appropriately
- [ ] Mutations invalidate related queries
- [ ] No duplicate fetch logic in multiple components

### Red Flags (Block PR)

```typescript
// RED FLAG 1: useState + useEffect for API data used by multiple components
const [data, setData] = useState(null);
useEffect(() => { fetch(...).then(setData); }, []);

// RED FLAG 2: Manual caching at module level
const cache = new Map();  // Prevents test injection

// RED FLAG 3: Duplicate fetching across components
// Component A: useEffect(() => { fetchUser(); }, []);
// Component B: useEffect(() => { fetchUser(); }, []);  // DUPLICATE
```

### Decision Tree

```
Is data fetched from API?
├─ YES: Is it used by multiple components?
│   ├─ YES: Use TanStack Query (useQuery)
│   └─ NO: Is caching beneficial?
│       ├─ YES: Use TanStack Query
│       └─ NO: useState + useEffect is acceptable
└─ NO: Use useState
```

### Testing for Deduplication

```typescript
// Manual verification
// 1. Open DevTools → Network tab
// 2. Navigate to tenant dashboard
// 3. Filter by "onboarding-state"
// 4. Should see exactly 1 request, not 2+
```

## Related Documentation

- [React Query Caching Prevention](../patterns/REACT_QUERY_CACHING_PREVENTION.md) - Full TanStack Query patterns
- [React Hook Extraction Prevention](../patterns/REACT-HOOK-EXTRACTION-PREVENTION.md) - Custom hook patterns
- [React Memoization Prevention](../patterns/REACT-MEMOIZATION-PREVENTION-STRATEGY.md) - Performance optimization

## Key Insight

**useState + useEffect = Instance-Scoped State**
Each component instance maintains its own state. Two components = two states = two fetches.

**TanStack Query = Shared Cache by Key**
All useQuery calls with the same key share a single cache entry. First fetch populates cache; subsequent calls return cached data.

The `staleTime` configuration (60s in this case) determines how long cached data is considered fresh before triggering a background refetch.
