---
title: 'Preview Canvas Not Updating After Agent Tool Completion'
slug: preview-canvas-agent-tool-singleton-race-condition
category: ui-bugs
severity: P2
component:
  - agent-panel
  - draft-config
  - preview-panel
symptoms:
  - Agent completes tool execution and says "Done. Check your preview - headline's updated" but preview iframe shows old content
  - Preview requires manual refresh or navigation to show changes
  - Console warning "[useDraftConfig] Cannot invalidate - query client not set"
  - Cache invalidation silently fails after agent tool completion
root_cause: Module-level singleton queryClientRef could be null when invalidateDraftConfig() called
solution: Use useQueryClient() hook directly instead of module singleton
files_changed:
  - apps/web/src/components/agent/AgentPanel.tsx
commit: d2998b69
solution_verified: true
created: 2026-01-26
related_pitfalls:
  - 14 # Singleton caches preventing DI
  - 29 # TanStack Query staleTime blocking real-time
  - 30 # Race condition on cache invalidation
  - 86 # Module-level QueryClient singleton (NEW)
tags:
  - preview
  - agent-panel
  - tanstack-query
  - cache-invalidation
  - race-condition
  - module-singleton
  - react-hooks
  - build-mode
---

# Preview Canvas Not Updating After Agent Tool Completion

## Problem Summary

Users would see "Done. Check your preview" after the agent updated storefront content, but the preview canvas still showed old content until manual page navigation or refresh.

## Symptoms

1. AI agent says "Done. Check your preview - headline's updated"
2. Preview iframe still shows old headline/content
3. Console shows: `[useDraftConfig] Cannot invalidate - query client not set`
4. Manual "Refresh preview" button or page navigation shows correct content

## Root Cause: Module-Level Singleton Race Condition

The `useDraftConfig.ts` hook exposed a module-level singleton pattern for external cache invalidation:

```typescript
// useDraftConfig.ts - THE PROBLEM
let queryClientRef: QueryClient | null = null;

export const setQueryClientRef = (client: QueryClient): void => {
  queryClientRef = client;
};

export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    queryClientRef.invalidateQueries({
      queryKey: DRAFT_CONFIG_QUERY_KEY,
      refetchType: 'active',
    });
  } else {
    // Silent failure! No cache invalidation happens.
    logger.warn('[useDraftConfig] Cannot invalidate - query client not set');
  }
};
```

### Why the Singleton Fails

1. **React effect timing**: `queryClientRef` is set via `setQueryClientRef()` in the tenant layout's `useEffect`. Child components (like AgentPanel) can fire callbacks before this effect runs.

2. **Agent tool handlers execute early**: When the agent completes a tool call, `handleConciergeToolComplete` fires immediately. If this happens before the layout's mount effect, `queryClientRef` is still `null`.

3. **HMR resets module state**: During development, Hot Module Replacement reloads the module, resetting `queryClientRef` to `null` while component instances still reference the old callback.

4. **Silent failure**: The function logs a warning but doesn't throw, so the UI appears to work but the preview never updates.

## Solution

Changed `AgentPanel.tsx` to use `useQueryClient()` hook directly instead of the singleton pattern.

### Code Diff

**BEFORE:**

```typescript
import { invalidateDraftConfig } from '@/hooks/useDraftConfig';

export function AgentPanel({ className }: AgentPanelProps) {
  const handleConciergeToolComplete = useCallback(
    (toolCalls) => {
      if (modifiedStorefront) {
        invalidateDraftConfig(); // Could silently fail if queryClientRef was null
      }
    },
    [] // No dependencies
  );
}
```

**AFTER:**

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { getDraftConfigQueryKey } from '@/hooks/useDraftConfig';

export function AgentPanel({ className }: AgentPanelProps) {
  // Use React Query client directly instead of module singleton
  const queryClient = useQueryClient();

  const handleConciergeToolComplete = useCallback(
    (toolCalls) => {
      if (modifiedStorefront) {
        // Guaranteed to work - queryClient comes from React context
        queryClient.invalidateQueries({
          queryKey: getDraftConfigQueryKey(),
          refetchType: 'active',
        });
      }
    },
    [queryClient]
  );
}
```

### Why the Fix Works

1. **`useQueryClient()` is always valid**: The hook reads from React context, which is guaranteed to exist inside `QueryClientProvider`. No timing issues.

2. **Survives HMR**: React context persists across hot reloads because the root provider isn't being replaced.

3. **Proper dependency tracking**: Adding `queryClient` to the dependency array ensures React re-creates the callback if needed.

## Data Flow After Fix

```
Agent Tool Completes (e.g., update_storefront_section)
                    │
                    ▼
handleConciergeToolComplete() in AgentPanel
  • Detects storefront-modifying tool call
  • Calls queryClient.invalidateQueries({ queryKey: ['draft-config'] })
                    │
                    ▼
TanStack Query Cache Invalidation
  • Marks 'draft-config' query as stale
  • refetchType: 'active' triggers immediate refetch
                    │
                    ▼
useDraftConfig queryFn executes
  • Fetches GET /api/draft
  • Returns new { pages, hasDraft, version }
                    │
                    ▼
ContentArea re-renders with new config
  • Passes config to PreviewPanel
                    │
                    ▼
PreviewPanel updates iframe
  • sendConfigToIframe() posts new config
  • Preview canvas displays updated content ✓
```

## Prevention

1. **Prefer React hooks over module singletons** for accessing React context
2. **Export query keys, not invalidation functions** - let components use `useQueryClient()` with the exported key
3. **Add E2E test**: Send 2+ messages to agent that modify storefront, verify preview updates after each
4. **See Pitfall #86** in CLAUDE.md for the full pattern

## Related Documentation

- [MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md](../react-performance/MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md) - Full prevention guide
- [IFRAME_REFRESH_PREVENTION_INDEX.md](../patterns/IFRAME_REFRESH_PREVENTION_INDEX.md) - Iframe refresh patterns
- [AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md](../patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md) - Tool state management

## Related Pitfalls

| Pitfall | Description                                     |
| ------- | ----------------------------------------------- |
| #14     | Singleton caches preventing DI                  |
| #29     | TanStack Query staleTime blocking real-time     |
| #30     | Race condition on cache invalidation            |
| #86     | Module-level QueryClient singleton (this issue) |

## Verification

Tested on production (gethandled.ai):

1. Opened Site Builder with preview visible
2. Sent message: "update my headline to 'Experience Horse Magic at Little Bit Farm'"
3. Agent responded: "Done. Check your preview - headline's updated."
4. **Preview automatically updated** without manual refresh

Screenshot captured confirming fix works.
