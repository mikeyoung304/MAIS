---
status: deferred
priority: p3
triage_date: '2026-01-12'
triage_by: master-architect-triage
verified: true
defer_reason: Working correctly - YAGNI concern but functional. Optional simplification.
effort: 15min
---

# P3: Branding History Over-Engineering (5-Level Undo)

**Source:** Code Review - Code Simplicity
**PR:** #28 feat/agent-system-integrity-fixes
**Date:** 2026-01-12
**Reviewer:** code-simplicity-reviewer

## Issue

The branding history stores 5 previous states (`slice(0, 4)` plus current = 5 entries), each with timestamps, for a 24-hour revert window. This is more complex than needed.

## Location

- `server/src/agent/executors/storefront-executors.ts:595-604`

## Current Code

```typescript
// Merge previous branding history with existing history (keep last 5)
const previousHistory = Array.isArray(existingBranding._previousBranding)
  ? (existingBranding._previousBranding as unknown[]).slice(0, 4)
  : [];

brandingUpdates = {
  ...existingBranding,
  ...(fontFamily && { fontFamily }),
  ...(logoUrl && { logo: logoUrl }),
  _previousBranding: [previousBranding, ...previousHistory],
};
```

## Simpler Alternative

Store only **1 previous state** instead of 5. The 24-hour window already limits revert scope, and users realistically won't chain-revert through 5 levels of branding changes. If they need deeper history, they should discard draft or use version control.

```typescript
brandingUpdates = {
  ...existingBranding,
  ...(fontFamily && { fontFamily }),
  ...(logoUrl && { logo: logoUrl }),
  _previousBranding: previousBranding, // Single state, not array
};
```

## YAGNI Assessment

Mild YAGNI violation - 5-level undo is speculative; 1-level solves 99% of "oops, wrong color" cases.

## Severity Justification

P3 because while over-engineered, the current implementation works correctly. Simplification is optional.
