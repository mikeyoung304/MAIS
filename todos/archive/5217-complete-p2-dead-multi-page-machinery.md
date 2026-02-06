---
status: ready
priority: p2
issue_id: 5217
tags: [code-review, dead-code, simplicity, dashboard-rebuild]
dependencies: []
---

# Dead Multi-Page Machinery in agent-ui-store

## Problem Statement

The agent-ui-store retains `currentPage`, `setPreviewPage`, `selectCurrentPage`, and multiple code paths managing page state (lines 489-508, 655, 713), despite the entire rebuild being a "single scrolling page" model. The toolbar with page tabs was removed from PreviewPanel, the iframe URL is hardcoded to `home`, and `BUILD_MODE_PAGE_CHANGE` is a no-op. Yet all the multi-page machinery still lives in the store.

## Findings

- `PreviewConfig.currentPage: PageName` still in interface (line 62)
- `setPreviewPage` action still defined and exported
- `selectCurrentPage` selector still defined and exported
- `highlightSection` still sets `currentPage` from section ID prefix (lines 463-474) — unnecessary when page is always `home`
- `BUILD_MODE_PAGE_CHANGE` PostMessage handler is a no-op comment (Pitfall #88)

## Proposed Solutions

### Option A: Mark as @deprecated with cleanup ticket

- Add `@deprecated` JSDoc to all multi-page APIs
- Remove in a follow-up PR to limit this diff's scope
- **Effort:** Small | **Risk:** None

### Option B: Remove entirely now

- Delete `currentPage`, `setPreviewPage`, `selectCurrentPage`, update all refs
- **Effort:** Medium | **Risk:** Low (need to verify no external consumers)

## Acceptance Criteria

- [ ] Multi-page APIs either removed or marked @deprecated
- [ ] No functional code depends on `currentPage` value

## Work Log

| Date       | Action  | Notes                                                     |
| ---------- | ------- | --------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review (code-simplicity-reviewer) |
