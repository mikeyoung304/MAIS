---
status: ready
priority: p3
issue_id: 5219
tags: [code-review, duplication, dashboard-rebuild]
dependencies: []
---

# Duplicated Iframe URL Construction

## Problem Statement

Both `PreviewPanel.tsx` (lines 89-97) and `RevealTransition.tsx` (lines 205-215) independently construct the preview iframe URL with the same `?preview=draft&edit=true&token=JWT` pattern. This duplication means URL format changes must be applied in two places.

## Proposed Solutions

### Option A: Extract buildPreviewUrl helper (Recommended)

- `buildPreviewUrl(slug, previewToken)` in shared location
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Single source of truth for preview iframe URL construction

## Work Log

| Date       | Action  | Notes                                                     |
| ---------- | ------- | --------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review (code-simplicity-reviewer) |
