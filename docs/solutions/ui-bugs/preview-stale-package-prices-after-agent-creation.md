---
title: Site Builder preview showing stale package prices after AI agent creation
slug: preview-stale-prices-server-rendered-packages
category: ui-bugs
severity: P1
component: PreviewPanel
symptoms:
  - Preview showed "$0/session" for all packages after agent created packages with correct prices
  - Changes in agent output not reflected in iframe without manual refresh
  - User complaint that preview should auto-update without requiring refresh
root_cause: Packages are server-rendered in storefront iframe. Existing cache invalidation only refreshes React Query (landing page config), not the iframe's server-rendered content. PostMessage protocol cannot update server-rendered package data.
solution_type: architecture
date_solved: 2026-01-14
time_to_solve: 30m
tags:
  - server-rendering
  - iframe-communication
  - cache-invalidation
  - agent-integration
  - preview-panel
  - real-time-updates
  - zustand
  - react-query
related_issues: []
related_docs:
  - docs/solutions/agent-issues/paintbrush-effect-trust-tier-stale-cache-MAIS-20260111.md
  - docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md
pitfalls_referenced:
  - '29: TanStack Query staleTime blocking real-time'
  - '30: Race condition on cache invalidation'
---

# Site Builder Preview Showing Stale Package Prices

## Problem

After the AI agent successfully created packages with correct prices ($199, $399, $699), the Site Builder preview iframe continued showing "$0/session" for all packages. The user expected automatic updates without manual refresh.

**User complaint:** "the preview isn't showing my new prices - it still shows $0" and "we should not have to refresh, changes should be on auto"

## Root Cause Analysis

Three architectural mismatches caused this issue:

1. **Cache invalidation scope mismatch**: `invalidateDraftConfig()` only refreshes React Query cached data for landing page configuration, not the iframe's content

2. **Server-rendered content**: Packages (names, prices, descriptions) are rendered server-side in the storefront iframe when it loads

3. **PostMessage limitation**: The existing PostMessage protocol (`BUILD_MODE_CONFIG_UPDATE`) can update landing page config (hero text, colors, etc.) but cannot update server-rendered package data

```
┌─────────────────────────────────────────────────────────────────┐
│  Data Flow BEFORE Fix                                           │
├─────────────────────────────────────────────────────────────────┤
│  Agent creates packages → DB updated → invalidateDraftConfig()  │
│                                              ↓                  │
│                                    React Query refreshed        │
│                                              ↓                  │
│                                    Landing page config updated  │
│                                              ↓                  │
│                                    PostMessage sent to iframe   │
│                                              ↓                  │
│                             ❌ Packages NOT updated (server-    │
│                                rendered, not in PostMessage)    │
└─────────────────────────────────────────────────────────────────┘
```

## Solution

Implemented a **refresh key mechanism** that forces iframe reload when packages are updated.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Data Flow AFTER Fix                                            │
├─────────────────────────────────────────────────────────────────┤
│  Agent creates packages → DB updated → handleToolComplete()     │
│                                              ↓                  │
│                          Detects 'packages' or 'packageCount'   │
│                                    in tool result               │
│                                              ↓                  │
│                          agentUIActions.refreshPreview()        │
│                                              ↓                  │
│                          previewRefreshKey incremented          │
│                                              ↓                  │
│                          PreviewPanel useEffect triggers        │
│                                              ↓                  │
│                          iframe.src = newUrl (full reload)      │
│                                              ↓                  │
│                          ✅ Fresh server-rendered packages      │
└─────────────────────────────────────────────────────────────────┘
```

### Files Modified

#### 1. `apps/web/src/stores/agent-ui-store.ts`

Added refresh key state and action:

```typescript
// State (line 136)
previewRefreshKey: number;

// Action (lines 407-410)
refreshPreview: () =>
  set((state) => {
    state.previewRefreshKey += 1;
  }),

// Selector (line 551)
export const selectPreviewRefreshKey = (state: AgentUIState) => state.previewRefreshKey;

// Exposed action (line 511)
refreshPreview: () => useAgentUIStore.getState().refreshPreview(),
```

#### 2. `apps/web/src/components/preview/PreviewPanel.tsx`

Subscribe to refresh key and trigger iframe reload:

```typescript
// Subscribe to preview refresh key (line 117)
const previewRefreshKey = useAgentUIStore(selectPreviewRefreshKey);

// Auto-refresh when key changes (lines 147-161)
const prevRefreshKeyRef = useRef(previewRefreshKey);
useEffect(() => {
  if (previewRefreshKey > 0 && previewRefreshKey !== prevRefreshKeyRef.current) {
    prevRefreshKeyRef.current = previewRefreshKey;
    // Reset iframe state and reload to fetch fresh server-rendered content
    setIsLoading(true);
    setError(null);
    setIsIframeReady(false);
    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl;
    }
  }
}, [previewRefreshKey, iframeUrl]);
```

#### 3. `apps/web/src/components/agent/AgentPanel.tsx`

Detect package updates in tool results and trigger refresh:

```typescript
// Interface for package tool results (lines 47-58)
interface ToolResultWithPackages {
  success: true;
  data: {
    packages?: Array<{ id: string; name: string; priceCents: number }>;
    packageCount?: number;
    [key: string]: unknown;
  };
}

// In handleToolComplete callback (lines 171-192)
const resultWithPackages = toolResults?.find(
  (r): r is ToolResultWithPackages =>
    r.success &&
    r.data != null &&
    typeof r.data === 'object' &&
    ('packages' in r.data || 'packageCount' in r.data)
);

// Trigger iframe refresh when packages are updated (lines 212-218)
if (resultWithPackages) {
  // Small delay to ensure database transaction is committed
  setTimeout(() => {
    agentUIActions.refreshPreview();
  }, 150);
}
```

## Why This Approach

| Consideration        | Decision                                        |
| -------------------- | ----------------------------------------------- |
| **Minimal overhead** | Numeric counter comparison, no polling          |
| **Preserves state**  | Chat conversation persists during iframe reload |
| **Type-safe**        | Discriminated unions for safe result extraction |
| **Reliable timing**  | 150ms delay ensures DB transaction commits      |
| **Targeted reload**  | Only refreshes when packages actually change    |

## Prevention Strategies

### 1. Pattern Recognition

When adding new agent tools that modify server-rendered data:

```
Is the data rendered server-side in an iframe?
├── YES → Can PostMessage update this data?
│         ├── YES → Use existing PostMessage protocol
│         └── NO → Implement refresh key trigger
└── NO → Use React Query cache invalidation
```

**Server-rendered data requiring iframe refresh:**

- Packages (names, prices, descriptions)
- Hero images
- Business name in footer

**Client-updateable via PostMessage:**

- Landing page config (hero text, colors, section visibility)
- Draft indicators

### 2. Code Review Checklist

When reviewing new executor code:

- [ ] Does this executor modify data shown in the storefront iframe?
- [ ] Is that data server-rendered or client-side?
- [ ] If server-rendered, does the executor return an indicator field?
- [ ] Does `handleToolComplete` detect this indicator and trigger refresh?

### 3. New Executor Template

```typescript
// In executor result, include indicator for frontend detection
return {
  success: true,
  message: 'Packages created',
  data: {
    packages: createdPackages, // ← Frontend detects this
    packageCount: createdPackages.length,
    // ... other data
  },
};
```

## Test Cases

### E2E Test: Auto-refresh after package creation

```typescript
test('preview updates automatically after agent creates packages', async ({ page }) => {
  // 1. Navigate to Site Builder
  await page.goto('/tenant/build');

  // 2. Send message to agent requesting package creation
  await page.fill('[data-testid="chat-input"]', 'Create packages at $100, $200, $300');
  await page.click('[data-testid="send-button"]');

  // 3. Wait for agent response (tool execution)
  await page.waitForSelector('text=packages are live', { timeout: 30000 });

  // 4. Verify preview shows correct prices WITHOUT manual refresh
  const iframe = page.frameLocator('[data-testid="preview-iframe"]');
  await expect(iframe.locator('text=$100/session')).toBeVisible();
  await expect(iframe.locator('text=$200/session')).toBeVisible();
  await expect(iframe.locator('text=$300/session')).toBeVisible();
});
```

## Related Documentation

- [Paintbrush Effect: Trust Tier + Stale Cache](../agent-issues/paintbrush-effect-trust-tier-stale-cache-MAIS-20260111.md) - Related cache invalidation timing issues
- [Build Mode Storefront Editor Patterns](../patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md) - PostMessage protocol design
- [CLAUDE.md Pitfall #29](../../CLAUDE.md) - TanStack Query staleTime blocking real-time
- [CLAUDE.md Pitfall #30](../../CLAUDE.md) - Race condition on cache invalidation

## Pitfall Addition

Consider adding to CLAUDE.md:

```
31. Preview stale after package creation (use refreshKey pattern for server-rendered iframe content)
```
