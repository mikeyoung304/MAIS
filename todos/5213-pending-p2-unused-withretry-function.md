---
status: pending
priority: p2
issue_id: '5213'
tags: [code-review, session-bootstrap, dead-code, simplicity, concierge]
dependencies: []
---

# Unused withRetry() Function - Two Retry Mechanisms

## Problem Statement

There are TWO retry mechanisms in the concierge agent:

1. `withRetry()` with exponential backoff - UNUSED
2. `shouldRetry()`/`clearRetry()` with per-request tracking - USED

**Why it matters:** Dead code confusion. New developers may use the wrong one.

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts:690-784`

**Unused withRetry (lines 714-739):**

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 1000): Promise<T> {
  // Exponential backoff implementation
  // ... but this function is NEVER CALLED
}
```

**Used shouldRetry/clearRetry (lines 752-784):**

```typescript
function shouldRetry(key: string): boolean {
  /* ... */
}
function clearRetry(key: string): void {
  /* ... */
}
// These ARE used in delegation tools
```

**Reviewer:** Code Simplicity (P2 - OVER_ENGINEERING)

## Proposed Solutions

### Option A: Remove withRetry (Recommended)

**Pros:** Eliminates dead code, clarifies retry strategy
**Cons:** Need to rewrite if exponential backoff needed later
**Effort:** Small
**Risk:** Low

Delete lines 714-739.

### Option B: Replace shouldRetry with withRetry

**Pros:** Uses more sophisticated retry logic
**Cons:** Requires refactor of delegation tools
**Effort:** Medium
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`

**Lines to Remove:** ~25 lines (withRetry function)

## Acceptance Criteria

- [ ] Only ONE retry mechanism exists in concierge agent
- [ ] The remaining mechanism is clearly documented

## Work Log

| Date       | Action                         | Learnings                                 |
| ---------- | ------------------------------ | ----------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Code Simplicity reviewer found dual retry |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Code Simplicity (DHH style)
