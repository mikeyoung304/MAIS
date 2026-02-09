---
status: pending
priority: p3
issue_id: '5240'
tags: [code-review, frontend, cleanup, enterprise-review]
dependencies: []
---

# showPreview Still Accepts Dead `page` Parameter After Multi-Page Removal

## Problem Statement

The `showPreview` store action still accepts a `_page` parameter that is silently ignored. 10+ callers still pass `'home'` as the first argument, believing they control navigation. A future developer could add a second page expecting it to work.

**Why it matters:** API dishonesty — callers believe they're doing something that has no effect. The `as PageName` cast in AgentPanel is also an unsafe cast on runtime data.

## Findings

**Source:** TypeScript Reviewer + Frontend Races + Code Simplicity reviews (PR #42, 2026-02-08)

**Locations:**

- `apps/web/src/stores/agent-ui-store.ts:329` — `showPreview(_page = 'home', agentSessionId = null)`
- `apps/web/src/stores/agent-ui-store.ts:202` — interface signature
- `apps/web/src/stores/agent-ui-store.ts:555` — `agentUIActions.showPreview` wrapper
- `AgentPanel.tsx:183` — `(action.page as PageName) || 'home'` unsafe cast
- `apps/web/src/stores/__tests__/agent-ui-store.test.ts` — tests pass dead param
- `e2e/tests/agent-ui-control.spec.ts:224-280` — stale `currentPage` types

Also includes: `PageName` import (line 24), `setPreviewPage` action, `selectCurrentPage` selector, `extractPageFromSectionId` helper — all deprecated multi-page artifacts.

## Proposed Solutions

### Option A: Remove parameter entirely (Recommended)

- Remove `_page` from `showPreview` signature
- Remove `PageName` import
- Remove 4 deprecated artifacts marked with `@deprecated`
- Update 10+ callers to `showPreview(agentSessionId)` or `showPreview()`
- Fix E2E test stale types
- **Pros:** Clean API, no confusion
- **Cons:** Touches many files (but all trivial changes)
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `showPreview` takes 0-1 args (only `agentSessionId`)
- [ ] No `PageName` import in agent-ui-store
- [ ] All 4 `@deprecated` markers resolved (code removed)
- [ ] E2E test stale types cleaned up
- [ ] Typecheck passes

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2026-02-08 | Created | Found during enterprise review PR #42 |
