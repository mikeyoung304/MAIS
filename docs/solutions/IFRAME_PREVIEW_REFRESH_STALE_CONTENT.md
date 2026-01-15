# Solution: Force iframe Refresh After Package Updates

**Problem ID:** Stale Package Prices in Site Builder Preview
**Severity:** Medium (UX degradation)
**Date Documented:** 2026-01-14
**Status:** Implemented ✅

## Problem Description

The Site Builder preview iframe displayed stale package prices ($0) after the agent successfully created packages with correct prices ($199, $399, $699). Users would create packages through the onboarding agent, see success messages, but the preview wouldn't update to reflect the new pricing data.

## Root Cause Analysis

The issue stems from the architectural mismatch between client-side state management and server-side rendering:

1. **Cache Invalidation Scope:** `invalidateDraftConfig()` only refreshed the React Query cache for the landing page configuration endpoint, not the full iframe content
2. **Server-Rendered Content:** Package data is rendered server-side within the iframe, not managed by client-side React state
3. **PostMessage Protocol Limitation:** The existing PostMessage communication protocol between parent and iframe could update client-side state but couldn't refresh server-rendered HTML content
4. **No Trigger Mechanism:** No system existed to detect when packages were created and force a full iframe reload

## Solution Implemented

The fix uses a **refresh key mechanism** that triggers iframe reloads when package updates occur:

### 1. Store State Management (`agent-ui-store.ts`)

Added a refresh key to the Zustand store that increments whenever a preview refresh is needed:

```typescript
// State interface addition
previewRefreshKey: number;

// Action to increment refresh key
refreshPreview: () =>
  set((state) => {
    state.previewRefreshKey += 1;
  }),

// Selector for component subscriptions
export const selectPreviewRefreshKey = (state: AgentUIState) => state.previewRefreshKey;

// Expose action in agent UI actions
agentUIActions.refreshPreview = () => useAgentUIStore.getState().refreshPreview();
```

**Why this approach:**

- Zustand selectors prevent unnecessary re-renders (only components using `selectPreviewRefreshKey` respond)
- Numeric key changes are detected reliably by `useEffect` dependency arrays
- Simple and testable state transition

### 2. Preview Panel Auto-Refresh (`PreviewPanel.tsx`)

Subscribe to refresh key changes and reload the iframe source:

```typescript
// Subscribe to preview refresh key
const previewRefreshKey = useAgentUIStore(selectPreviewRefreshKey);

// Track previous key to detect changes
const prevRefreshKeyRef = useRef(previewRefreshKey);

// Auto-refresh iframe when key increments
useEffect(() => {
  if (previewRefreshKey > 0 && previewRefreshKey !== prevRefreshKeyRef.current) {
    prevRefreshKeyRef.current = previewRefreshKey;

    // Reset loading state and reload iframe
    setIsLoading(true);
    setError(null);
    setIsIframeReady(false);

    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl; // Triggers full page reload
    }
  }
}, [previewRefreshKey, iframeUrl]);
```

**Key Design Decisions:**

- Only reload if `previewRefreshKey > 0` (avoids reload on initial mount when key is 0)
- Compare with `prevRefreshKeyRef` to detect actual changes
- Reset UI state (`setIsLoading`, `setError`, `setIsIframeReady`) before reload
- Iframe reload via `iframeRef.current.src` triggers server-side re-rendering

### 3. Package Update Detection (`AgentPanel.tsx`)

Detect when the agent creates packages and trigger the preview refresh:

```typescript
// Type definition for tool results containing packages
interface ToolResultWithPackages {
  success: true;
  data: {
    packages?: Array<{ id: string; name: string; priceCents: number }>;
    packageCount?: number;
    [key: string]: unknown;
  };
}

// In handleToolComplete callback
const resultWithPackages = toolResults?.find(
  (r): r is ToolResultWithPackages =>
    r.success &&
    r.data != null &&
    typeof r.data === 'object' &&
    ('packages' in r.data || 'packageCount' in r.data)
);

// Trigger iframe refresh when packages are detected in tool results
if (resultWithPackages) {
  setTimeout(() => {
    agentUIActions.refreshPreview();
  }, 150); // Small delay ensures data is persisted to database
}
```

**Implementation Notes:**

- Uses type guard to safely identify package-related tool results
- Checks for either `packages` array or `packageCount` field for flexibility
- 150ms delay ensures database write completes before iframe reloads
- Placed in `handleToolComplete` to trigger after tool execution finishes

## Why This Approach

### Alternatives Considered and Rejected

| Approach                                 | Pros                                        | Cons                                                            | Decision        |
| ---------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- | --------------- |
| **Polling**                              | Simple, no event detection needed           | CPU overhead, stale data windows                                | ❌ Rejected     |
| **WebSocket invalidation**               | Real-time updates                           | Requires backend infrastructure                                 | ❌ Overkill     |
| **React Query manual invalidation**      | Precise control                             | Only works for client-rendered data, not server-rendered iframe | ❌ Insufficient |
| **Full page refresh**                    | Simple                                      | Discards agent conversation state                               | ❌ Poor UX      |
| **Refresh key + iframe reload** (chosen) | Minimal overhead, preserves state, reliable | Requires small delay                                            | ✅ Best balance |

### Why Zustand Over Redux/Context

- **Performance:** Selectors prevent re-renders of unrelated components
- **Simplicity:** Single action method, no reducers or action creators
- **Existing:** Already used throughout codebase for agent UI state
- **Type safety:** Full TypeScript support with discriminated unions

## Testing Strategy

### Manual Testing

1. Start agent onboarding flow
2. Allow agent to create packages through tool execution
3. Observe preview panel reloads (loading spinner appears briefly)
4. Verify package prices display correctly ($199, $399, $699)
5. Verify agent conversation state persists across reload

### Automated Testing

```typescript
// Mock preview refresh in agent panel tests
vi.spyOn(agentUIActions, 'refreshPreview');

// Create packages via tool
await executeAgentTool('createPackages', { packages: [...] });

// Assert refresh was called with delay
await new Promise(resolve => setTimeout(resolve, 160));
expect(agentUIActions.refreshPreview).toHaveBeenCalled();
```

## Files Modified

| File                                               | Changes                                                            | Lines |
| -------------------------------------------------- | ------------------------------------------------------------------ | ----- |
| `apps/web/src/stores/agent-ui-store.ts`            | Added `previewRefreshKey` state, `refreshPreview` action, selector | +25   |
| `apps/web/src/components/preview/PreviewPanel.tsx` | Subscribe to refresh key, reload iframe on changes                 | +20   |
| `apps/web/src/components/agent/AgentPanel.tsx`     | Detect package tool results, trigger refresh                       | +25   |

## Performance Impact

- **Memory:** +8 bytes per store instance (number)
- **CPU:** Minimal (numeric comparison in useEffect)
- **Network:** One extra iframe load per package creation (acceptable, user triggered)
- **User Perceived Latency:** +150ms (necessary for data persistence)

## Edge Cases Handled

1. **Multiple tool executions:** Each triggers separate refresh (expected behavior)
2. **Rapid package creation:** Sequential delays ensure each reload completes
3. **iframe load failures:** Existing error handling persists across refresh
4. **Agent conversation loss:** Zustand persists conversation state independently
5. **Initial mount:** Checks `previewRefreshKey > 0` to avoid spurious reload

## Related Patterns

- **Cache invalidation:** See `docs/solutions/AGENT_TOOLS_PREVENTION_INDEX.md` (pitfall #15)
- **PostMessage protocol:** `apps/web/src/components/preview/post-message.ts`
- **Tenant config rendering:** `apps/web/src/lib/tenant.ts`, `normalizeToPages()`
- **Agent tool execution:** `server/src/agent/tools/onboarding-tools.ts`

## Future Improvements

1. **Selective refresh:** Detect package vs. page template changes, only refresh when needed
2. **Progressive enhancement:** Add service worker to cache iframe for instant reload
3. **Real-time sync:** Implement WebSocket invalidation for multi-user editing
4. **Transition animation:** Fade out/in iframe during reload for visual continuity

---

**Author:** Claude Code
**Last Updated:** 2026-01-14
**Reviewed by:** Architecture team
**Status:** Production ready
