---
status: ready
priority: p2
issue_id: 5211
tags: [code-review, naming, dashboard-rebuild]
dependencies: []
---

# SectionWidget.tsx Filename Mismatch

## Problem Statement

`apps/web/src/components/build-mode/SectionWidget.tsx` no longer exports `SectionWidget` — it was refactored to only contain `PublishReadyWidget`. The filename is misleading; developers looking for publish-ready UI won't find it, and those looking for section widgets will find the wrong file.

## Findings

- File: `SectionWidget.tsx`
- Exports: `PublishReadyWidget` only
- Original `SectionWidget` was removed during Phase 4 refactor

## Proposed Solutions

### Option A: Rename file to PublishReadyWidget.tsx (Recommended)

- Update all imports
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] File renamed to match its export
- [ ] All imports updated
- [ ] TypeScript compiles clean

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
