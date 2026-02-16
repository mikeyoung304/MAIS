---
status: deferred
priority: p3
triage_date: '2026-01-12'
triage_by: master-architect-triage
verified: true
defer_reason: Premature optimization - structuredClone is fast. Profile before optimizing. Downgraded to P3.
effort: 30min
---

# P2: structuredClone on Hot Path

**Source:** Code Review - Performance
**PR:** #28 feat/agent-system-integrity-fixes
**Date:** 2026-01-12
**Reviewer:** performance-oracle

## Issue

`normalizeToPages()` uses `structuredClone(DEFAULT_PAGES_CONFIG)` on every call. While structuredClone is faster than `JSON.parse(JSON.stringify(...))`, it's still O(n) where n is the size of the config object. `DEFAULT_PAGES_CONFIG` contains ~850 lines of nested data including 6 sections with arrays of items.

## Locations

- `apps/web/src/lib/tenant.client.ts:78`
- `server/src/agent/tools/utils.ts:134,137,224,316`

## Call Frequency

The function is called:

1. On every storefront page render (client-side)
2. During `validateAndExtractPages()` in tool utilities (multiple times per agent turn)
3. In `buildStorefrontCompletionStatus()` via `getDefaultPages()` (every session context build)

## Recommended Fix

Consider caching the cloned default at module initialization time:

```typescript
// Option 1: Lazy singleton clone (only clone once)
let cachedDefaultConfig: PagesConfig | null = null;
function getDefaultPagesConfig(): PagesConfig {
  if (!cachedDefaultConfig) {
    cachedDefaultConfig = Object.freeze(structuredClone(DEFAULT_PAGES_CONFIG));
  }
  return structuredClone(cachedDefaultConfig); // Still clone when mutating
}

// Option 2: Immutable-first pattern (avoid cloning for reads)
// Use Object.freeze deeply and only clone when writing
```

## Impact

Increased CPU usage per request, especially for high-traffic tenant pages. The normalization logic is deterministic - same input always produces same output - but isn't cached.

## Severity Justification

P2 because it compounds under load during page renders and agent interactions.
