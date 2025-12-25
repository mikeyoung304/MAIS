---
status: complete
priority: p1
issue_id: '372'
tags: [code-review, accessibility, wcag, html-validation]
dependencies: []
---

# P1 CRITICAL: Nested <main> Elements Create Invalid HTML

**Priority:** P1 (Critical - Blocks Merge)
**Category:** Accessibility
**Source:** Code Review - Accessibility Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The codebase has nested `<main>` elements - one in the root layout and another potentially in tenant layouts. HTML spec requires only ONE `<main>` element per page. Nested main elements confuse assistive technologies about the primary content area.

## Location

- Root layout likely has `<main>` wrapper
- Individual page components may also have `<main>` wrappers
- `apps/web/src/app/t/[slug]/(site)/layout.tsx` - Check for main element

## Risk

- **HTML Validation Error:** <main> cannot be nested
- **Screen Reader Confusion:** Multiple "main" landmarks
- **WCAG 2.1 Failure:** Landmark regions must be unique
- **SEO Impact:** Search engines may penalize invalid HTML

## Solution

Ensure only ONE `<main>` element exists in the document hierarchy. The root layout should provide the single `<main>` element, and all child layouts/pages should use `<div>` or `<section>` instead.

Option 1: Remove `<main>` from child layouts:
```tsx
// In tenant layout.tsx - use div or section instead
<div className="min-h-screen">
  <TenantNav tenant={tenant} />
  <div id="main-content">
    {children}
  </div>
  <TenantFooter tenant={tenant} />
</div>
```

Option 2: Remove `<main>` from root layout and add to tenant layout only:
```tsx
// Root layout uses div
// Tenant layout provides the single <main>
<main id="main-content">
  {children}
</main>
```

## Acceptance Criteria

- [ ] Only ONE `<main>` element per rendered page
- [ ] HTML validates without errors
- [ ] Screen reader announces single "main" landmark
- [ ] Skip link targets the correct main content area
- [ ] All tenant pages verified for correct structure

## Related Files

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/t/[slug]/(site)/layout.tsx`
- `apps/web/src/app/t/_domain/layout.tsx`
