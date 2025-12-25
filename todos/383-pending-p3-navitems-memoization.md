---
status: pending
priority: p3
issue_id: '383'
tags: [code-review, performance, optimization]
dependencies: []
---

# P3: navItems and isActiveLink Could Be Memoized

**Priority:** P3 (Nice-to-Have)
**Category:** Performance
**Source:** Code Review - Performance Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The `navItems` array is recreated on every render even though it depends only on `basePath` which rarely changes. Similarly, `isActiveLink` function is recreated on every render.

## Location

- `apps/web/src/components/tenant/TenantNav.tsx:40-46` - navItems
- `apps/web/src/components/tenant/TenantNav.tsx:112-117` - isActiveLink

## Risk

- Minor performance overhead from array recreation
- Not a critical issue but good practice for frequently rendered components
- May become relevant if navigation is in a virtualized list

## Solution

Memoize the navItems array and isActiveLink function:

```typescript
// Memoize navItems (only recreate when basePath changes)
const navItems = useMemo<NavItem[]>(
  () => [
    { label: 'Home', href: basePath },
    { label: 'Services', href: `${basePath}/services` },
    { label: 'About', href: `${basePath}/about` },
    { label: 'FAQ', href: `${basePath}/faq` },
    { label: 'Contact', href: `${basePath}/contact` },
  ],
  [basePath]
);

// Memoize isActiveLink (only recreate when basePath or pathname changes)
const isActiveLink = useCallback(
  (href: string) => {
    if (href === basePath) {
      return pathname === basePath;
    }
    return pathname.startsWith(href);
  },
  [basePath, pathname]
);
```

## Acceptance Criteria

- [ ] Add useMemo for navItems
- [ ] Add useCallback for isActiveLink
- [ ] Verify no functional changes
- [ ] Profile before/after (optional, low priority)

## Related Files

- `apps/web/src/components/tenant/TenantNav.tsx`
