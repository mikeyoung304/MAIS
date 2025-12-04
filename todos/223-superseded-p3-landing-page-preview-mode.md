---
status: superseded
priority: p3
issue_id: "223"
tags: [ux, admin, preview, landing-page]
dependencies: []
superseded_by: "plans/feat-landing-page-visual-editor.md"
superseded_date: "2025-12-04"
---

# TODO-223: Missing Landing Page Preview Mode for Admin

## Priority: P3 (Nice-to-have)

## Status: Superseded

## Superseded By

This TODO has been superseded by a comprehensive implementation plan:
- **Plan File**: `plans/feat-landing-page-visual-editor.md`
- **Date**: 2025-12-04
- **Coverage**: The new plan implements a WYSIWYG editor where:
  - Users edit directly on the landing page view (inherent preview)
  - Draft/publish workflow with explicit publish button
  - Auto-save (1s debounce) for draft changes
  - Discard changes button to revert to published state

## Original Requirements (All Addressed)

- ✅ Draft config saved separately from published - Covered by `draftConfig`/`publishedConfig` split
- ✅ Preview route shows draft content - WYSIWYG editing IS the preview
- ✅ Preview banner visible in preview mode - Editor toolbar serves this purpose
- ✅ Publish action updates live site - Covered by `publishAll()` action
- ✅ Discard action reverts to published - Covered by `discardAll()` action

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during landing page code review |
| 2025-12-04 | Superseded | Replaced by visual editor plan with WYSIWYG approach |

## Tags

ux, admin, preview, landing-page
