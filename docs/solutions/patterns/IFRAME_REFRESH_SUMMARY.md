# Iframe Refresh Pattern - Quick Reference

**One-liner:** Increment a counter in Zustand to reload iframe when server-rendered data changes

---

## The Pattern in 3 Steps

### Step 1: Server Executor Returns Indicator

```typescript
// server/src/agent/executors/onboarding-executors.ts
return {
  packages: createdPackages, // Signal: data has changed
  packageCount: 3,
  hasDraft: true,
};
```

### Step 2: Frontend Detects and Refreshes

```typescript
// apps/web/src/components/agent/AgentPanel.tsx - handleToolComplete()
const resultWithPackages = toolResults?.find(
  (r): r is ToolResultWithPackages =>
    r.success &&
    r.data != null &&
    typeof r.data === 'object' &&
    ('packages' in r.data || 'packageCount' in r.data)
);

if (resultWithPackages) {
  setTimeout(() => {
    agentUIActions.refreshPreview(); // Increment counter
  }, 150);
}
```

### Step 3: Iframe Reloads

```typescript
// apps/web/src/components/preview/PreviewPanel.tsx
const previewRefreshKey = useAgentUIStore(selectPreviewRefreshKey);

useEffect(() => {
  if (previewRefreshKey > 0 && previewRefreshKey !== prevRefreshKeyRef.current) {
    prevRefreshKeyRef.current = previewRefreshKey;
    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl; // Full reload
    }
  }
}, [previewRefreshKey, iframeUrl]);
```

---

## When to Use This Pattern

✓ **USE refresh key when:**

- Data is server-rendered in HTML
- Packages, prices, hero text, images
- Can't be updated via PostMessage
- Requires full page reload to apply

✗ **DON'T USE (use PostMessage instead):**

- Draft config changes (draftConfig)
- CSS/theme toggles
- Real-time state updates
- Client-side only changes

---

## Critical Details

| Aspect           | Requirement                 | Why                            |
| ---------------- | --------------------------- | ------------------------------ |
| Executor returns | `packages` or `hasDraft`    | Frontend knows when to refresh |
| Frontend delay   | 150ms minimum               | DB transaction must commit     |
| Skip 0 value     | `refreshKey > 0` check      | Don't reload on mount          |
| iframe.src = url | Full URL with token         | Fresh server rendering         |
| Reset state      | loading, ready, error flags | Clean reload state             |

---

## Checklist for New Features

- [ ] Executor returns indicator (packages, hasDraft)
- [ ] handleToolComplete detects result safely
- [ ] 150ms delay before refresh
- [ ] > 0 check prevents mount reload
- [ ] E2E test: create/update → verify refresh → verify content updated
- [ ] No infinite reload loops
- [ ] Tenant-scoped DB queries

---

## Common Mistakes

1. **No delay** → stale data after reload
2. **No > 0 check** → iframe reloads on mount
3. **Missing indicator** → frontend never refreshes
4. **PostMessage for server data** → changes don't persist
5. **No tenant scoping** → data isolation bug

---

## Test It

```typescript
// In agent chat, tell AI:
// "Create a package called 'Premium' for $5000"

// Expected: Preview updates automatically without manual refresh
```

---

## Files Involved

| File                      | Role                                        |
| ------------------------- | ------------------------------------------- |
| `agent-ui-store.ts`       | `refreshPreview()` action + selector        |
| `PreviewPanel.tsx`        | Watches key, reloads iframe                 |
| `AgentPanel.tsx`          | `handleToolComplete()` detects and triggers |
| `onboarding-executors.ts` | Returns packages/hasDraft                   |

---

For detailed guide: see `IFRAME_REFRESH_PREVENTION_INDEX.md`
