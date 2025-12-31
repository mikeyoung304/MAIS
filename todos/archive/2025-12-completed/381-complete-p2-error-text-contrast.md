---
status: complete
priority: p2
issue_id: '381'
tags: [code-review, accessibility, wcag, design]
dependencies: []
---

# P2: Error Text Contrast Fails WCAG AA (red-500)

**Priority:** P2 (Important)
**Category:** Accessibility / Design
**Source:** Code Review - Accessibility Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

Form validation error messages use `text-red-500` which may not meet WCAG 2.1 AA contrast requirements (4.5:1 for normal text) against the white background. This affects users with visual impairments.

## Location

- `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx` - error message styling

## Risk

- WCAG 2.1 Level AA failure for contrast
- Users with color vision deficiencies may miss errors
- Legal/compliance risk for accessibility

## Solution

Use `text-red-600` or `text-red-700` which provide better contrast:

```tsx
// Current (may fail WCAG AA):
<p className="text-sm text-red-500">Name is required</p>

// Better contrast (passes WCAG AA):
<p className="text-sm text-red-700">Name is required</p>

// Or use custom error color from design system:
<p className="text-sm text-destructive">Name is required</p>
```

Contrast ratios:

- `red-500` (#ef4444) on white: ~4.0:1 (fails AA for small text)
- `red-600` (#dc2626) on white: ~5.1:1 (passes AA)
- `red-700` (#b91c1c) on white: ~6.5:1 (passes AA)

## Acceptance Criteria

- [ ] Update error text color to meet 4.5:1 contrast ratio
- [ ] Verify with contrast checker tool (WebAIM)
- [ ] Apply consistently across all form error messages
- [ ] Consider adding icon alongside text for color-blind users
- [ ] Document error styling in design system

## Related Files

- `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx`
- Design system / Tailwind config
