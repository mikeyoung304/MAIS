---
status: ready
priority: p3
issue_id: 5215
tags: [code-review, exports, dashboard-rebuild]
dependencies: []
---

# Missing Barrel Exports in stores/index.ts

## Problem Statement

`apps/web/src/stores/index.ts` is missing exports for `selectIsOnboardingView` and `selectPreviewRefreshKey` from the agent-ui-store. Consumers must import directly from the store file instead of the barrel.

## Proposed Solutions

### Option A: Add missing exports (Recommended)

- Add to stores/index.ts barrel
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] All public selectors exported from barrel file

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
