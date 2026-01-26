---
status: closed
priority: p3
issue_id: paintbrush-query-singleton
tags: [code-review, react, react-query, hmr]
dependencies: []
triage_notes: "WON'T FIX: Documented as intentional pattern in docs/solutions/react-performance/MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md. The fallback behavior is acceptable for this use case."
closed_at: '2026-01-26'
---

# P3 MEDIUM: QueryClient Singleton Pattern Fragile with HMR

**Priority:** P3 - MEDIUM
**Status:** CLOSED - Documented intentional pattern
**Source:** Code Simplicity Review (agent a66feb4)
**Date:** 2026-01-11

## Problem

The `queryClientRef` singleton pattern for cache invalidation is fragile:

1. Module-level singleton can be cleared during HMR (Hot Module Replacement)
2. If `invalidateDraftConfig()` is called before `setQueryClientRef()` runs, it silently fails
3. Race condition between layout effect and external invalidation calls

## Current Implementation

```typescript
// apps/web/src/hooks/useDraftConfig.ts

let queryClientRef: QueryClient | null = null;

export const setQueryClientRef = (client: QueryClient): void => {
  queryClientRef = client;
};

export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    queryClientRef.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
  } else {
    logger.warn('[useDraftConfig] Cannot invalidate - query client not set');
    // Silently fails!
  }
};
```

## Alternative Approaches

### Option 1: Use useQueryClient Hook (Recommended)

Pass invalidation as a callback instead of exporting it:

```typescript
// In AgentPanel.tsx
const queryClient = useQueryClient();

const handleToolComplete = useCallback(() => {
  queryClient.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
}, [queryClient]);
```

### Option 2: Global QueryClient Instance

Create QueryClient outside React tree:

```typescript
// lib/query-client.ts
export const queryClient = new QueryClient({...});

// In providers
<QueryClientProvider client={queryClient}>
```

### Option 3: Keep Singleton but Add Retry

```typescript
export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    queryClientRef.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
  } else {
    // Retry after a short delay
    setTimeout(() => {
      if (queryClientRef) {
        queryClientRef.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
      }
    }, 100);
  }
};
```

## Verification

1. Make a change via agent
2. Do HMR (edit a file and save)
3. Make another change via agent
4. Both changes should appear in preview (no silent failures)
