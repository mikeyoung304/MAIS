---
status: complete
priority: p2
issue_id: '641'
tags: [code-review, accessibility, a11y, wcag]
dependencies: []
---

# Scheduling Layout Missing ARIA Accessibility Attributes

## Problem Statement

The scheduling sub-navigation lacks proper ARIA roles for accessibility. Screen reader users cannot properly navigate the scheduling sub-sections.

## Findings

**Source:** Architecture Strategist review of Legacy-to-Next.js Migration

**Location:** `apps/web/src/app/(protected)/tenant/scheduling/layout.tsx` (lines 64-78)

**Current code:**

```tsx
<nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4">
  {schedulingSubNav.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={`...`}
    >
```

**Missing attributes:**

- `aria-label` on the `<nav>` element
- `aria-current="page"` on active links

## Proposed Solutions

### Option A: Add ARIA attributes (Recommended)

**Pros:** WCAG 2.1 AA compliant, better screen reader experience
**Cons:** Minimal code change
**Effort:** Very Low
**Risk:** None

```tsx
<nav
  className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4"
  aria-label="Scheduling sections"
>
  {schedulingSubNav.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? 'page' : undefined}
      className={`...`}
    >
```

## Recommended Action

Option A - Add ARIA attributes for accessibility compliance.

## Technical Details

### Affected Files

- `apps/web/src/app/(protected)/tenant/scheduling/layout.tsx`

## Acceptance Criteria

- [x] `<nav>` has `aria-label="Scheduling sections"`
- [x] Active link has `aria-current="page"`
- [x] Screen reader can identify current page in navigation

## Work Log

| Date       | Action                   | Learnings                                           |
| ---------- | ------------------------ | --------------------------------------------------- |
| 2026-01-05 | Created from code review | Follow auth-form-accessibility-checklist            |
| 2026-01-05 | Completed implementation | Added aria-label and aria-current="page" attributes |

## Resources

- Prevention doc: `docs/solutions/patterns/auth-form-accessibility-checklist-MAIS-20251230.md`
- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/
