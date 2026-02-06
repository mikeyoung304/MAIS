---
status: ready
priority: p2
issue_id: 5209
tags: [code-review, security, zustand, dashboard-rebuild]
dependencies: []
---

# Stores Exposed on window in Production

## Problem Statement

Both `agent-ui-store.ts` (lines 762-766) and `refinement-store.ts` (lines 383-388) unconditionally expose their Zustand stores on `window` for E2E test support. This runs in production, allowing any user to call `window.useRefinementStore.getState().setPublishStatus('published')` from the browser console — potentially triggering publish flows or corrupting UI state.

## Findings

- `agent-ui-store.ts:762-766`: `window.useAgentUIStore = useAgentUIStore`
- `refinement-store.ts:383-388`: `window.useRefinementStore = useRefinementStore` and `window.refinementActions = refinementActions`
- No `NODE_ENV` or `IS_E2E` guard
- Exposes all store actions including `setPublishStatus`, `setMode`, `reset`

## Proposed Solutions

### Option A: Guard with environment check (Recommended)

- `if (process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_E2E === 'true')`
- **Effort:** Small | **Risk:** None

### Option B: Use Playwright page.evaluate

- Remove window exposure entirely; E2E tests use `page.evaluate()` to access stores
- **Effort:** Medium | **Risk:** Low (E2E tests need updating)

## Acceptance Criteria

- [ ] Stores not exposed on window in production builds
- [ ] E2E tests still have access when needed

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
