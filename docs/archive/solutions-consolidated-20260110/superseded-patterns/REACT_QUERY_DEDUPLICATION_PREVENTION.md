---
module: MAIS
date: 2026-01-08
problem_type: network_efficiency
component: hooks/useOnboardingState, lib/query-client
symptoms:
  - Multiple identical network requests when multiple components use the same hook
  - Wasted bandwidth and increased server load
  - Race conditions between requests
  - useState + useEffect pattern misused for shared data
root_cause: data_fetching_patterns
resolution_type: prevention_strategy
severity: P2
tags: [react-query, hooks, caching, data-fetching, deduplication, phase-6]
---

# Prevention Strategies: React Query Request Deduplication

**Problem Solved:** useOnboardingState hook was making duplicate API calls when used by multiple components. Fixed by converting from useState/useEffect to TanStack Query.

**Purpose:** Prevent duplicate API calls and enable intelligent request sharing across components.

**When to Read:** Before implementing any data-fetching hook that will be used by multiple components.

---

## The Issue: Duplicate API Calls with useState + useEffect

### What Went Wrong

The original implementation used the classic React pattern:

```typescript
// ❌ WRONG - Creates duplicate requests
export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // EACH component instance calls this independently
    fetch('/api/agent/onboarding-state')
      .then(r => r.json())
      .then(data => setState(data))
      .catch(e => console.error(e));
  }, []);

  return { state, loading };
}

// In App.tsx
<GrowthAssistantPanel />      // Makes API call
<OnboardingProgress />          // Makes ANOTHER API call (duplicate!)
<OnboardingPhaseIndicator />    // Makes THIRD API call (duplicate!)
```

**Result:** 3 identical `/api/agent/onboarding-state` requests fired in parallel, wasting bandwidth and causing race conditions.

### Why This Pattern Fails

1. **No Deduplication:** Each hook instance is independent - React doesn't know they're fetching the same data
2. **No Caching:** Every render of any component triggers a new fetch
3. **Race Conditions:** Multiple requests finish out of order, last one wins (unpredictable state)
4. **Memory Leaks:** Each useEffect sets up independent fetch logic that can't be coordinated
5. **Hard to Invalidate:** After mutations, you'd need to refetch all instances separately

### Why TanStack Query Solves This

TanStack Query (React Query) is built specifically for this problem:

```typescript
// ✅ CORRECT - TanStack Query deduplicates automatically
export function useOnboardingState() {
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'state'],
    queryFn: fetchOnboardingState,
    staleTime: 60_000,
  });
  return { state: data, isLoading };
}

// In App.tsx
<GrowthAssistantPanel />      // Makes API call
<OnboardingProgress />          // Uses CACHED response (no new request!)
<OnboardingPhaseIndicator />    // Uses CACHED response (no new request!)
```

**Result:** Single request, three components all get the same cached response. Efficient and predictable.

---

## Decision Tree: useState+useEffect vs TanStack Query

### Use TanStack Query If:

- [ ] Multiple components need the same data
- [ ] Data is fetched from an API endpoint
- [ ] You want automatic caching and invalidation
- [ ] You need to refetch after mutations
- [ ] Component unmounts shouldn't cancel the fetch (other components may need it)
- [ ] You want retry logic built-in
- [ ] You need to deduplicate concurrent requests

**Example:** `useOnboardingState`, `usePackages`, `useAvailability`, `useBookings`, `useTenantConfig`

### Use useState + useEffect If:

- [ ] Data is computed locally (no API call)
- [ ] Each component needs its own independent state
- [ ] You explicitly want fresh data on every mount
- [ ] Data is tied to component lifecycle

**Example:** Form state, UI-only toggles, component-specific animations

### Anti-Pattern: useState + useEffect for Shared API Data

```typescript
// ❌ ANTI-PATTERN - Do NOT do this
function useSharedData() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/shared-endpoint')
      .then((r) => r.json())
      .then(setData);
  }, []);
  return data;
}

// This will make N duplicate requests if used by N components
```

---

## Implementation Pattern: React Query Data Fetching Hook

### 1. Define Query Key

Query keys are tuples that uniquely identify a piece of cached data:

```typescript
// lib/query-client.ts
export const queryKeys = {
  onboarding: {
    state: ['onboarding', 'state'] as const,
    phase: (phase: string) => ['onboarding', 'phase', phase] as const,
    events: (tenantId: string) => ['onboarding', 'events', tenantId] as const,
  },
  packages: {
    all: ['packages'] as const,
    bySlug: (slug: string) => ['packages', slug] as const,
    details: (id: string) => ['packages', 'details', id] as const,
  },
} as const;
```

**Key Rules:**

- Always include the resource type first: `['onboarding', ...]`, `['packages', ...]`
- Use functions for parameterized queries: `bySlug: (slug) => ['packages', slug]`
- Make keys as specific as needed to avoid cache collisions
- All instances of the hook with the same queryKey share the same cache

### 2. Create Fetch Function

```typescript
/**
 * Fetch function for API call
 * - Must be async
 * - Must throw on error (TanStack Query looks for thrown errors)
 * - Returns typed data
 */
async function fetchOnboardingState(): Promise<OnboardingStateResponse> {
  const response = await fetch('/api/agent/onboarding-state');

  if (!response.ok) {
    if (response.status === 401) {
      return { isAuthenticated: false } as OnboardingStateResponse;
    }
    throw new Error('Failed to fetch onboarding state');
  }

  return response.json();
}

// With parameters
async function fetchPackageBySlug(slug: string): Promise<Package> {
  const response = await fetch(`/api/packages/${slug}`);
  if (!response.ok) throw new Error('Package not found');
  return response.json();
}
```

### 3. Create Hook with useQuery

```typescript
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

export function useOnboardingState() {
  const queryClient = useQueryClient();

  // useQuery handles caching, deduplication, refetching
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.onboarding.state,  // Shared cache key
    queryFn: fetchOnboardingState,         // Fetch function
    staleTime: 60_000,                     // 1 minute before re-fetch
    gcTime: 10 * 60_000,                   // 10 minutes before delete from memory
    refetchOnWindowFocus: false,           // Don't refetch when tab regains focus
    retry: 1,                              // Retry once on failure
  });

  return {
    state: data,
    isLoading,
    error: error?.message,
    refetch: () => queryClient.invalidateQueries({
      queryKey: queryKeys.onboarding.state
    }),
  };
}

// Usage in multiple components - all share same cache
function ComponentA() {
  const { state, isLoading } = useOnboardingState(); // Cache hit
  return <div>{isLoading ? '...' : state?.phase}</div>;
}

function ComponentB() {
  const { state } = useOnboardingState(); // Same cache, no new request
  return <div>{state?.isComplete ? 'Done' : 'In Progress'}</div>;
}
```

### 4. Handle Mutations with Cache Invalidation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useOnboardingState() {
  const queryClient = useQueryClient();

  // Skip onboarding mutation
  const skipMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const response = await fetch('/api/agent/skip-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to skip');
      return response.json();
    },
    onSuccess: () => {
      // After mutation succeeds, invalidate cache
      // This triggers automatic refetch of all components using this query
      queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.state,
      });
    },
  });

  return {
    skipOnboarding: skipMutation.mutateAsync,
    isSkipping: skipMutation.isPending,
  };
}
```

---

## Code Review Checklist: Detecting useState+useEffect Anti-Patterns

### Red Flags in Code Review

When reviewing hooks for data fetching, flag these patterns:

```typescript
// ❌ RED FLAG 1: useState + useEffect for API calls
function useSomething() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/...').then(/* ... */);
  }, []);
}

// ❌ RED FLAG 2: Manual retry logic
useEffect(() => {
  let attempts = 0;
  const retry = async () => {
    try {
      const data = await fetch('/api/...');
      // ...
    } catch (e) {
      if (attempts < 3) {
        attempts++;
        setTimeout(retry, 1000 * Math.pow(2, attempts)); // Manual exponential backoff!
      }
    }
  };
  retry();
}, []);

// ❌ RED FLAG 3: useCallback to prevent "unnecessary" refetches
const fetchData = useCallback(async () => {
  const data = await fetch('/api/...');
  setData(data);
}, []);

useEffect(() => {
  fetchData();
}, [fetchData]); // Circular dependency, defeats the purpose

// ❌ RED FLAG 4: Manual deduplication attempts
let cachedData: Promise<Data> | null = null;
useEffect(() => {
  if (!cachedData) {
    cachedData = fetch('/api/...').then((r) => r.json());
  }
  cachedData.then(setData);
}, []);
```

### How to Respond

```typescript
// ✅ SUGGEST: Use React Query instead

// Before (manual caching)
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/data')
    .then((r) => r.json())
    .then(setData);
}, []);

// After (React Query handles all of this)
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: () => fetch('/api/data').then((r) => r.json()),
});
```

### Checklist for All Data Fetching Hooks

- [ ] Does this hook fetch from an API? → Use React Query
- [ ] Will multiple components use this hook? → Must use React Query
- [ ] Does this need cache invalidation? → Must use React Query with mutations
- [ ] Is there manual retry logic? → Use React Query's built-in retry
- [ ] Is staleTime configured? → Prevents unnecessary refetches
- [ ] Is gcTime (garbage collection time) configured? → Prevents memory leaks
- [ ] Is there a queryKey defined? → Required for cache identity
- [ ] Does mutation invalidate cache? → Required for consistency

---

## Testing: Detecting Duplicate Network Calls

### Unit Test Pattern: Verify Deduplication

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { useOnboardingState } from '@/hooks/useOnboardingState';

describe('useOnboardingState deduplication', () => {
  it('deduplicates concurrent requests', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ phase: 'DISCOVERY' }))
    );

    const queryClient = getQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    // Render hook 3 times simultaneously
    const { result: result1 } = renderHook(() => useOnboardingState(), { wrapper });
    const { result: result2 } = renderHook(() => useOnboardingState(), { wrapper });
    const { result: result3 } = renderHook(() => useOnboardingState(), { wrapper });

    await waitFor(() => {
      expect(result1.current.state?.phase).toBe('DISCOVERY');
      expect(result2.current.state?.phase).toBe('DISCOVERY');
      expect(result3.current.state?.phase).toBe('DISCOVERY');
    });

    // Should only fetch ONCE, not 3 times
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('uses cached data on subsequent renders', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ phase: 'DISCOVERY' }))
    );

    const queryClient = getQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result, rerender } = renderHook(() => useOnboardingState(), { wrapper });

    await waitFor(() => {
      expect(result.current.state?.phase).toBe('DISCOVERY');
    });

    expect(mockFetch).toHaveBeenCalledOnce();

    // Re-render should use cache (no new fetch within staleTime)
    rerender();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce(); // Still just one call
    });
  });

  it('refetches after cache expires', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.spyOn(global, 'fetch');
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ phase: 'DISCOVERY' }))
    );

    const queryClient = getQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useOnboardingState(), { wrapper });

    await waitFor(() => {
      expect(result.current.state?.phase).toBe('DISCOVERY');
    });

    expect(mockFetch).toHaveBeenCalledOnce();

    // Wait for staleTime (60 seconds) to expire
    vi.advanceTimersByTime(61_000);

    // Component re-renders, triggers refetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });
});
```

### E2E Test Pattern: Network Tab Verification

```typescript
import { test, expect } from '@playwright/test';

test('useOnboardingState makes single request for multiple components', async ({ page }) => {
  const requests: string[] = [];

  // Intercept all network requests
  page.on('request', (request) => {
    if (request.url().includes('/api/agent/onboarding-state')) {
      requests.push(request.url());
    }
  });

  await page.goto('http://localhost:3000/dashboard');

  // Wait for page to fully load
  await page.waitForLoadState('networkidle');

  // Only one request should have been made to onboarding-state
  // even though multiple components use the hook
  const onboardingRequests = requests.filter((url) => url.includes('/api/agent/onboarding-state'));

  expect(onboardingRequests).toHaveLength(1);
});

test('mutation invalidates cache and refetches', async ({ page }) => {
  const requests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/api/agent/onboarding-state')) {
      requests.push(request.url());
    }
  });

  await page.goto('http://localhost:3000/dashboard');
  await page.waitForLoadState('networkidle');

  // Initial load: 1 request
  expect(requests).toHaveLength(1);

  // Click "skip onboarding" button
  await page.click('button:has-text("Skip Onboarding")');

  // Wait for mutation and refetch
  await page.waitForLoadState('networkidle');

  // Should now have 2 requests: initial + refetch after skip
  expect(requests.length).toBeGreaterThan(1);
});
```

### Browser DevTools Network Tab Verification (Manual)

1. Open DevTools (F12) → Network tab
2. Filter by `/api/agent/onboarding-state`
3. Navigate to a page with multiple components using `useOnboardingState`
4. Observe network requests:

**Before (useState+useEffect):**

```
GET /api/agent/onboarding-state  200  1.2s  [Request 1]
GET /api/agent/onboarding-state  200  1.3s  [Request 2]  ← Duplicate!
GET /api/agent/onboarding-state  200  1.1s  [Request 3]  ← Duplicate!
```

**After (React Query):**

```
GET /api/agent/onboarding-state  200  1.2s  [Request 1]
(no more requests - all components share cached response)
```

---

## Architecture: How React Query Deduplication Works

### Request Coalescing (Automatic Deduplication)

```typescript
// Time: T=0ms - Component A mounts
useQuery({
  queryKey: ['data'],
  queryFn: () => fetch('/api/data'),
});
// → Starts fetch A

// Time: T=1ms - Component B mounts (while A still pending)
useQuery({
  queryKey: ['data'],
  queryFn: () => fetch('/api/data'),
});
// → Request coalesced! Uses same fetch A, no new request

// Time: T=2ms - Component C mounts (while A still pending)
useQuery({
  queryKey: ['data'],
  queryFn: () => fetch('/api/data'),
});
// → Request coalesced! Uses same fetch A, no new request

// Time: T=1000ms - Fetch A completes with data
// All three components (A, B, C) get the same response simultaneously
```

### Cache Key Structure

```typescript
const queryKeys = {
  // Scoped by resource type
  onboarding: {
    // Specific slice of onboarding state
    state: ['onboarding', 'state'] as const,
    // Parameterized by phase
    phase: (phase: string) => ['onboarding', 'phase', phase] as const,
  },
};

// Same key = same cache
queryKey: queryKeys.onboarding.state; // Cache key 1
queryKey: queryKeys.onboarding.state; // Same = cache HIT
queryKey: queryKeys.onboarding.phase('DISCOVERY'); // Different key = new cache
```

### Cache Lifecycle

```
Component A mounts
  ↓
Check cache for queryKey → MISS
  ↓
Start fetch (request coalescing state: "pending")
  ↓
Component B mounts (while fetch pending)
  ↓
Check cache for queryKey → PENDING (coalesce)
  ↓
Both A and B wait for same fetch
  ↓
Fetch completes → Cache updated
  ↓
Both A and B re-render with cached data
  ↓
Component A unmounts
  ↓
Cache still holds data (gcTime = 10 min) for Component B if it remounts
  ↓
Component B unmounts
  ↓
Cache timeout reached → Data garbage collected
```

### staleTime vs gcTime

```typescript
useQuery({
  staleTime: 60_000, // 1 minute - WHEN to refetch
  gcTime: 10 * 60_000, // 10 minutes - WHEN to delete
});

// T=0: Query fetches data
// T=30s: Component unmounts (data still in cache)
// T=60s: Component remounts → Sees stale data, auto-refetches
//        (gcTime not reached, so data still exists)
// T=600s: Data deleted from memory (gcTime expired)
```

---

## Real-World Scenario: Onboarding Flow

### The Problem

```
UserOnboards
  ├── <GrowthAssistantPanel />
  │   └── useOnboardingState() ← Call #1
  ├── <OnboardingProgress />
  │   └── useOnboardingState() ← Call #2 (DUPLICATE)
  └── <OnboardingPhaseIndicator />
      └── useOnboardingState() ← Call #3 (DUPLICATE)

Network tab: 3 identical requests for same data
```

### The Solution

```
UserOnboards
  ├── <GrowthAssistantPanel />
  │   └── useOnboardingState() ← Call #1
  ├── <OnboardingProgress />
  │   └── useOnboardingState() ← Cache HIT (same queryKey)
  └── <OnboardingPhaseIndicator />
      └── useOnboardingState() ← Cache HIT (same queryKey)

Network tab: 1 request, 3 components use cached response
```

### After User Skips Onboarding

```typescript
// User clicks skip button
<button onClick={() => skipOnboarding()}>Skip</button>

// In useOnboardingState:
const skipMutation = useMutation({
  mutationFn: async () => {
    const response = await fetch('/api/agent/skip-onboarding', {
      method: 'POST',
    });
    return response.json();
  },
  onSuccess: () => {
    // Invalidate cache - triggers automatic refetch
    queryClient.invalidateQueries({
      queryKey: queryKeys.onboarding.state,
    });
  },
});
```

**Result:**

1. Skip request sent to API
2. After success, cache is invalidated
3. All three components automatically refetch with new data
4. Each component re-renders with updated `isOnboarding: false`

---

## Performance Metrics: Impact of Proper Caching

### Before (useState+useEffect - 3 duplicate requests):

```
Initial Load:
├── GrowthAssistantPanel: 1.2s (request 1)
├── OnboardingProgress: 1.3s (request 2)
└── OnboardingPhaseIndicator: 1.1s (request 3)
Total load time: 1.3s (parallel requests)
Total network: 3 requests × ~50KB = 150KB
```

### After (React Query - request coalescing):

```
Initial Load:
├── All components: Wait for 1 request
└── Single request: 1.2s
Total load time: 1.2s (single request)
Total network: 1 request × ~50KB = 50KB
Bandwidth saved: 100KB per page load
```

### With 1000 daily page loads:

```
Daily network savings: 100KB × 1000 = 100MB
Monthly savings: 3GB
Annual savings: 36GB
Server load reduction: 66% fewer API calls
```

---

## Quick Reference: Converting Hook to React Query

### Step 1: Add queryKey

```typescript
// Before
// (no key)

// After
export const queryKeys = {
  myFeature: {
    all: ['myFeature'] as const,
    details: (id: string) => ['myFeature', 'details', id] as const,
  },
};
```

### Step 2: Extract fetch function

```typescript
// Before
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/feature')
    .then((r) => r.json())
    .then(setData);
}, []);

// After
async function fetchMyFeature(): Promise<MyFeature> {
  const response = await fetch('/api/feature');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}
```

### Step 3: Replace useState+useEffect with useQuery

```typescript
// Before
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
useEffect(() => {
  setLoading(true);
  fetch('/api/feature')
    .then((r) => r.json())
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);

// After
const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.myFeature.all,
  queryFn: fetchMyFeature,
  staleTime: 5 * 60_000,
  gcTime: 10 * 60_000,
});
```

### Step 4: Add mutation for writes

```typescript
// Before (no automatic cache update)
const [isLoading, setIsLoading] = useState(false);
const handleSave = async (newData) => {
  setIsLoading(true);
  try {
    await fetch('/api/feature', { method: 'POST', body: JSON.stringify(newData) });
    // Manually refetch all data!
    const response = await fetch('/api/feature');
    setData(await response.json());
  } finally {
    setIsLoading(false);
  }
};

// After (automatic cache invalidation + refetch)
const queryClient = useQueryClient();
const saveMutation = useMutation({
  mutationFn: (newData) => fetch('/api/feature', { method: 'POST', body: JSON.stringify(newData) }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.myFeature.all });
  },
});
const handleSave = (newData) => saveMutation.mutate(newData);
```

---

## Common Pitfalls and How to Avoid Them

### Pitfall 1: Forgetting queryClient Provider

```typescript
// ❌ WRONG - Missing Provider
function App() {
  return <MyComponent />;
}

function MyComponent() {
  useQuery(...); // ❌ Will crash - no QueryClient context
}

// ✅ CORRECT - Wrap with Provider
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';

function App() {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MyComponent />
    </QueryClientProvider>
  );
}
```

### Pitfall 2: Changing queryKey (destroys cache)

```typescript
// ❌ WRONG - queryKey changes, loses cache
function useMyData(filter: string) {
  return useQuery({
    queryKey: ['myData', filter], // Key changes when filter changes
    queryFn: () => fetchData(filter),
  });
}

// ✅ CORRECT - Use parameterized queryKey function
export const queryKeys = {
  data: {
    byFilter: (filter: string) => ['data', filter] as const,
  },
};

function useMyData(filter: string) {
  return useQuery({
    queryKey: queryKeys.data.byFilter(filter), // Function generates key
    queryFn: () => fetchData(filter),
  });
}
```

### Pitfall 3: Mutating response data without triggers

```typescript
// ❌ WRONG - Cache never updates after mutation
function useUpdateData() {
  return useMutation({
    mutationFn: (newData) => updateAPI(newData),
    // No onSuccess - cache becomes stale!
  });
}

// ✅ CORRECT - Invalidate after mutation
function useUpdateData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newData) => updateAPI(newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.data.all });
    },
  });
}
```

### Pitfall 4: Inconsistent staleTime

```typescript
// ❌ WRONG - Different components have different cache times
function ComponentA() {
  useQuery({ queryKey: ['data'], queryFn: fetchData, staleTime: 30_000 });
}

function ComponentB() {
  useQuery({ queryKey: ['data'], queryFn: fetchData, staleTime: 60_000 });
}
// Unpredictable behavior - which staleTime wins?

// ✅ CORRECT - Define in queryOptions and reuse
export const queryOptions = {
  realtime: { staleTime: 30_000 },
  normal: { staleTime: 60_000 },
  static: { staleTime: 15 * 60_000 },
};

function ComponentA() {
  useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
    ...queryOptions.realtime,
  });
}

function ComponentB() {
  useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
    ...queryOptions.normal,
  });
}
```

---

## Related Documentation

- [React Query Official Docs](https://tanstack.com/query/latest)
- [Phase 5 Testing and Caching Prevention](./phase-5-testing-and-caching-prevention-MAIS-20251231.md)
- [useOnboardingState Hook Implementation](../../apps/web/src/hooks/useOnboardingState.ts)
- [Query Client Configuration](../../apps/web/src/lib/query-client.ts)

---

## Implementation Checklist

When converting a hook to React Query:

- [ ] Define queryKey in `query-client.ts`
- [ ] Extract fetch function outside hook
- [ ] Replace useState + useEffect with useQuery
- [ ] Set staleTime and gcTime appropriately
- [ ] Add mutation for any write operations
- [ ] Invalidate cache in mutation onSuccess
- [ ] Add tests for deduplication
- [ ] Verify Network tab shows single request
- [ ] Document in component comments
- [ ] Update any dependent components

---

**Last Updated:** 2026-01-08
**Severity:** P2
**Status:** Documented - Deduplication pattern established
**Example Implementation:** `/apps/web/src/hooks/useOnboardingState.ts`
