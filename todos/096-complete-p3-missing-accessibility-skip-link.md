---
status: complete
priority: p3
issue_id: "096"
tags: [todo]
dependencies: []
---

# TODO: Add accessibility skip link to TenantStorefrontLayout

**Priority:** P3 (Low)
**Category:** Accessibility
**Source:** Code Review - Pattern Recognition Specialist Agent
**Created:** 2025-11-29
**Status:** Complete
**Completed:** 2025-12-02

## Problem

`TenantStorefrontLayout.tsx` renders a header with navigation but lacks a "Skip to main content" link that `AppShell.tsx` provides. This makes keyboard navigation harder for users relying on assistive technology.

## Location

- `client/src/app/TenantStorefrontLayout.tsx:132-173` (render section)
- `client/src/app/AppShell.tsx` (has skip link for reference)

## Impact

- Keyboard users must tab through entire header on every page
- Screen reader users have poor navigation experience
- WCAG 2.1 Level A compliance issue (2.4.1 Bypass Blocks)
- Inconsistent accessibility between storefront and main site

## Solution

Add skip link matching AppShell pattern:

```typescript
return (
  <div className="min-h-screen flex flex-col">
    {/* Skip link for accessibility */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-primary focus:underline"
    >
      Skip to main content
    </a>

    {/* Tenant branded header */}
    <header className="bg-white border-b border-gray-200 px-4 py-4">
      {/* ... header content */}
    </header>

    {/* Main content with id for skip link target */}
    <main id="main-content" className="flex-1">
      <Outlet />
    </main>

    {/* Footer */}
    <footer>...</footer>
  </div>
);
```

## Acceptance Criteria

- [x] Skip link present at start of DOM
- [x] Skip link hidden by default, visible on focus
- [x] Main content has matching id attribute
- [x] Tab order: skip link → header nav → main content
- [x] Matches styling of AppShell skip link

## Implementation Details

Added skip link using the `.skip-link` CSS class from `@/styles/a11y.css`:

1. Imported `a11y.css` stylesheet
2. Added skip link at the start of the component return
3. Added `id="main"` and `tabIndex={-1}` to the `<main>` element
4. Used same pattern as `AppShell.tsx` for consistency

## Related Files

- `client/src/app/TenantStorefrontLayout.tsx`
- `client/src/app/AppShell.tsx` (reference implementation)
- `client/src/styles/a11y.css` (skip-link styling)
