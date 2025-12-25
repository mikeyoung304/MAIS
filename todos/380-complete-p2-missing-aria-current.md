---
status: complete
priority: p2
issue_id: '380'
tags: [code-review, accessibility, wcag]
dependencies: []
---

# P2: Missing aria-current="page" on Active Navigation Links

**Priority:** P2 (Important)
**Category:** Accessibility
**Source:** Code Review - Accessibility Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The TenantNav component uses visual styling (color changes) to indicate the active link but doesn't use `aria-current="page"` attribute. Screen reader users can't identify which page they're currently on from the navigation.

## Location

- `apps/web/src/components/tenant/TenantNav.tsx:147-158` - Desktop nav links
- `apps/web/src/components/tenant/TenantNav.tsx:194-208` - Mobile nav links

## Risk

- Screen reader users can't identify current page
- WCAG 2.1 Level AA recommendation not met
- Reduced accessibility for users with visual impairments

## Solution

Add `aria-current="page"` to active links:

```tsx
// TenantNav.tsx - Desktop navigation
{navItems.map((item) => (
  <Link
    key={item.href}
    href={item.href}
    aria-current={isActiveLink(item.href) ? 'page' : undefined}
    className={`text-sm font-medium transition-colors ${
      isActiveLink(item.href)
        ? 'text-sage'
        : 'text-text-muted hover:text-text-primary'
    }`}
  >
    {item.label}
  </Link>
))}

// Mobile navigation - same pattern
<Link
  key={item.href}
  ref={index === 0 ? firstFocusableRef : undefined}
  href={item.href}
  aria-current={isActiveLink(item.href) ? 'page' : undefined}
  className={/* ... */}
  tabIndex={isOpen ? 0 : -1}
>
  {item.label}
</Link>
```

## Acceptance Criteria

- [ ] Add `aria-current="page"` to active desktop nav links
- [ ] Add `aria-current="page"` to active mobile nav links
- [ ] Test with VoiceOver (macOS) or NVDA (Windows)
- [ ] Verify screen reader announces "current page" for active link

## Related Files

- `apps/web/src/components/tenant/TenantNav.tsx`
