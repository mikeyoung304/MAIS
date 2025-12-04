---
status: superseded
priority: p3
issue_id: '224'
tags: [ux, admin, landing-page, drag-drop]
dependencies: []
superseded_by: 'plans/feat-landing-page-visual-editor.md'
superseded_date: '2025-12-04'
---

# TODO-224: Landing Page Section Order is Hardcoded

## Priority: P3 (Nice-to-have)

## Status: Superseded

## Superseded By

This TODO has been superseded by a comprehensive implementation plan:

- **Plan File**: `plans/feat-landing-page-visual-editor.md`
- **Date**: 2025-12-04
- **Coverage**: The new plan uses a fixed "Apple-style closed system" design:
  - Sections have a fixed professional order (Hero → Social Proof → About → etc.)
  - Users opt-in to sections via sidebar toggle panel
  - Order is intentionally hardcoded for consistent brand experience
  - This aligns with user's explicit preference for "polished fixed layouts"

## Design Decision

The user explicitly requested an **Apple-style closed system** where:

> "It should be a closed apple style system. fixed, polished section layouts that work well. not a drag and drop page builder."

This means section reordering is intentionally NOT part of the MVP visual editor. The fixed order ensures:

1. Consistent professional appearance across all tenant storefronts
2. Proven section flow optimized for conversion
3. Simpler implementation and maintenance
4. Better brand consistency

## Future Consideration

If section reordering becomes necessary post-MVP, the implementation approach documented in this TODO remains valid. The `sectionOrder` array pattern and `@dnd-kit` approach would integrate well with the visual editor architecture.

## Work Log

| Date       | Action     | Notes                                                                |
| ---------- | ---------- | -------------------------------------------------------------------- |
| 2025-12-01 | Created    | Identified during landing page code review                           |
| 2025-12-04 | Superseded | User chose fixed layouts; reordering intentionally excluded from MVP |

## Tags

ux, admin, landing-page, drag-drop
