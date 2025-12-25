---
status: complete
priority: p1
issue_id: '371'
tags: [code-review, accessibility, wcag]
dependencies: []
---

# P1 CRITICAL: Duplicate id="main-content" Causes WCAG Violation

**Priority:** P1 (Critical - Blocks Merge)
**Category:** Accessibility
**Source:** Code Review - Accessibility Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The FAQ page has duplicate `id="main-content"` elements - one in the root layout (via skip link target) and another in FAQAccordion.tsx. This creates invalid HTML (IDs must be unique) and breaks skip link functionality for keyboard/screen reader users.

## Location

- `apps/web/src/app/t/[slug]/(site)/faq/FAQAccordion.tsx:66` - Has `id="main-content"` on wrapper div
- Root layout already provides `id="main-content"` as skip link target

## Risk

- **WCAG 2.1 Failure:** Duplicate IDs are a Level A violation
- **Screen Reader Confusion:** Skip link jumps to wrong location
- **Validation Failures:** HTML validators will flag as error
- **Legal Risk:** Accessibility lawsuits for public-facing websites

## Solution

Remove the duplicate `id="main-content"` from FAQAccordion.tsx since the root layout already provides the skip link target:

```typescript
// FAQAccordion.tsx - REMOVE this:
<div id="main-content" className="...">

// CHANGE TO:
<div className="...">
```

The skip link in the layout should target the main content area at the layout level, not individual page components.

## Acceptance Criteria

- [ ] Remove `id="main-content"` from FAQAccordion.tsx
- [ ] Verify skip link still works on FAQ page
- [ ] Run HTML validator on all tenant pages
- [ ] Verify no duplicate IDs across all pages
- [ ] Test with screen reader (VoiceOver/NVDA)

## Related Files

- `apps/web/src/app/t/[slug]/(site)/faq/FAQAccordion.tsx`
- `apps/web/src/app/t/[slug]/(site)/layout.tsx`
