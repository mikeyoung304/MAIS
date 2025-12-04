---
status: superseded
priority: p1
issue_id: "205"
tags: [frontend, tenant-admin, landing-page, ui, forms]
dependencies: []
superseded_by: "plans/feat-landing-page-visual-editor.md"
superseded_date: "2025-12-04"
---

# TODO-205: Missing Tenant Admin UI for Landing Page Configuration

## Priority: P1 (Critical)

## Status: Superseded

## Superseded By

This TODO has been superseded by a comprehensive implementation plan:
- **Plan File**: `plans/feat-landing-page-visual-editor.md`
- **Date**: 2025-12-04
- **Scope**: The new plan covers all requirements from this TODO plus additional features:
  - WYSIWYG visual editor (not form-based)
  - Draft/publish workflow with auto-save
  - Section opt-in via sidebar
  - Inline editing matching marketplace visual editor patterns

## Original Requirements (Preserved for Reference)

### Required Features

1. **Section Toggle Panel** - Enable/disable each section ✅ Covered in new plan
2. **Hero Editor** - Headline, subheadline, CTA text, background image ✅ Covered
3. **Social Proof Editor** - Add/edit/remove stat items ✅ Covered
4. **About Editor** - Title, description, bullet points, image ✅ Covered
5. **Testimonials Editor** - Add/edit/remove testimonials ✅ Covered
6. **Accommodation Editor** - Title, description, amenities, image ⏸️ Not in MVP sections
7. **Gallery Editor** - Upload/reorder/remove images ✅ Covered
8. **FAQ Editor** - Add/edit/remove Q&A pairs ✅ Covered
9. **Final CTA Editor** - Headline, subheadline, CTA text/link ✅ Covered

### Dependencies (Status Updated)

- ✅ **TODO-202 COMPLETE**: Backend CRUD routes implemented and tested
- ⏳ Image upload integration planned in new visual editor
- ⏳ Client-side router configuration planned

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during landing page code review |
| 2025-12-04 | Superseded | Replaced by comprehensive visual editor plan |

## Tags

frontend, tenant-admin, landing-page, ui, forms
