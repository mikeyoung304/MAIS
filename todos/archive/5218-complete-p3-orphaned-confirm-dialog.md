---
status: ready
priority: p3
issue_id: 5218
tags: [code-review, dead-code, dashboard-rebuild]
dependencies: []
---

# Orphaned ConfirmDialog.tsx After Toolbar Removal

## Problem Statement

`apps/web/src/components/build-mode/ConfirmDialog.tsx` was only consumed by PreviewPanel for publish/discard confirmations. Those dialogs were removed in this rebuild. The file still exists and is exported from `build-mode/index.ts` but has zero importers.

## Findings

- `ConfirmDialog.tsx` exists with zero importers
- Previously used by PreviewPanel toolbar (now deleted)
- Exported from barrel but never imported

## Proposed Solutions

### Option A: Remove the file and barrel export

- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] File removed or confirmed needed for future use

## Work Log

| Date       | Action  | Notes                                                     |
| ---------- | ------- | --------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review (code-simplicity-reviewer) |
