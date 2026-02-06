---
status: ready
priority: p3
issue_id: 5220
tags: [code-review, documentation, dashboard-rebuild]
dependencies: []
---

# Stale SectionWidget Comment References in tenant-agent-dispatch.ts

## Problem Statement

`apps/web/src/lib/tenant-agent-dispatch.ts` (lines 4, 8, 11, 67) has multiple JSDoc comments referencing `SectionWidget` as a consumer, but `SectionWidget` was deleted. Comments like "Enables external components (like SectionWidget)" are now misleading.

## Proposed Solutions

### Option A: Update comments to reference actual consumers

- Replace `SectionWidget` refs with `PublishReadyWidget` and `layout.tsx`
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] No stale SectionWidget references in comments

## Work Log

| Date       | Action  | Notes                                                     |
| ---------- | ------- | --------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review (code-simplicity-reviewer) |
