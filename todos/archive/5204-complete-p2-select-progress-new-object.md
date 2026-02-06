---
status: complete
priority: p2
issue_id: 5204
tags: [code-review, zustand, performance, dashboard-rebuild]
dependencies: []
---

# selectProgress Returns New Object (Pitfall #87)

## Problem Statement

`selectProgress` in `apps/web/src/stores/refinement-store.ts:341` returns `{ completed, total, percentage }` — a new object on every call. Zustand's default equality check (`===`) sees `{} !== {}` and triggers re-render even when values are unchanged. Currently latent (no component consumes this selector yet), but will cause unnecessary re-renders when used.

## Findings

- Line 341-346: `selectProgress` creates new object literal every call
- Pitfall #87 in CLAUDE.md documents this exact pattern
- Not yet consumed by any component (latent issue)

## Proposed Solutions

### Option A: Split into primitive selectors (Recommended)

- `selectCompletedCount`, `selectTotalSections`, `selectPercentage`
- **Pros:** Zero re-render overhead, simple
- **Effort:** Small | **Risk:** None

### Option B: Use useShallow

- `useRefinementStore(useShallow(selectProgress))`
- **Pros:** Keeps grouped API
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [x] No new-object selector pattern in refinement-store
- [x] Components using progress data don't re-render on unrelated store changes

## Work Log

| Date       | Action           | Notes                                                                                                       |
| ---------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-02-06 | Created          | Found during /workflows:review                                                                              |
| 2026-02-06 | Fixed (Option A) | Split into selectCompletedCount, selectTotalSections, selectCompletionPercentage; deprecated selectProgress |
