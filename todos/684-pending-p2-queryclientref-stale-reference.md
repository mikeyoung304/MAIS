---
status: pending
priority: p2
issue_id: '684'
tags: [code-review, agent-first-architecture, react-patterns, stale-reference]
dependencies: []
---

# P2: Module-Level queryClientRef Can Become Stale

## Problem Statement

The `queryClientRef` in `useDraftConfig.ts` is a module-level singleton. If React's Strict Mode or Fast Refresh causes the QueryClient to be recreated, the ref could point to an old client that's no longer connected to the provider. External invalidation would then silently fail to update the UI.

**Why This Matters:**

- After HMR in development, cache invalidation may silently fail
- Agent tool handlers could call `invalidateDraftConfig()` on wrong client
- Hard to debug - no errors, just stale UI

## Findings

**Agents:** TypeScript/React Reviewer, Security Sentinel, Data Integrity Guardian

**Location:** `apps/web/src/hooks/useDraftConfig.ts` (lines 230-256)

**Current State:**

```typescript
let queryClientRef: QueryClient | null = null;

export const setQueryClientRef = (client: QueryClient): void => {
  queryClientRef = client;
};
```

**Risk Scenarios:**

1. HMR replaces QueryClient but module keeps old ref
2. No cleanup when component unmounts
3. Multiple layouts could call setQueryClientRef with different clients

## Proposed Solutions

### Option A: Document as intentional with cleanup (Recommended)

- Add cleanup logic in useEffect return
- Document the pattern and its limitations
- **Pros:** Minimal change, addresses most cases
- **Cons:** Still has edge cases in unusual setups
- **Effort:** Small
- **Risk:** Low

### Option B: Use WeakRef

```typescript
let queryClientRef: WeakRef<QueryClient> | null = null;

export const invalidateDraftConfig = (): void => {
  const client = queryClientRef?.deref();
  if (client) {
    client.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
  }
};
```

- **Pros:** Allows garbage collection of old clients
- **Cons:** WeakRef browser support (modern only)
- **Effort:** Small
- **Risk:** Low

### Option C: Use React Context instead

- Create a DraftConfigProvider context
- Expose invalidate through context value
- **Pros:** More React-idiomatic
- **Cons:** More structural change, context drilling
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

**Option A** - Add cleanup and documentation. This pattern is acceptable for the use case but should be clearly documented.

## Technical Details

**Affected Files:**

- `apps/web/src/hooks/useDraftConfig.ts`

## Acceptance Criteria

- [ ] Cleanup added when component unmounts (optional)
- [ ] Pattern documented with acknowledged limitations
- [ ] No silent failures in HMR scenarios

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
