---
status: pending
priority: p2
issue_id: '377'
tags: [code-review, code-quality, dry]
dependencies: []
---

# P2: navItems Array Duplicated in Nav and Footer

**Priority:** P2 (Important)
**Category:** Code Quality / DRY
**Source:** Code Review - Code Quality Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The navigation items array is defined separately in both TenantNav.tsx and TenantFooter.tsx with the same structure but slightly different base path handling. This duplication could lead to inconsistent navigation between header and footer.

## Location

- `apps/web/src/components/tenant/TenantNav.tsx:40-46`
- `apps/web/src/components/tenant/TenantFooter.tsx` (similar array)

## Risk

- Adding/removing pages requires changes in two places
- Link labels could diverge between nav and footer
- Ordering inconsistencies possible

## Solution

Extract navigation configuration to a shared constant:

```typescript
// apps/web/src/components/tenant/navigation.ts
export interface NavItem {
  label: string;
  path: string; // relative path from basePath
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '' },
  { label: 'Services', path: '/services' },
  { label: 'About', path: '/about' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
];

// Helper to build full href
export function buildNavHref(basePath: string, item: NavItem): string {
  return item.path ? `${basePath}${item.path}` : basePath;
}

// Usage in TenantNav.tsx:
import { NAV_ITEMS, buildNavHref } from './navigation';

const navItems = NAV_ITEMS.map(item => ({
  label: item.label,
  href: buildNavHref(basePath, item)
}));
```

## Acceptance Criteria

- [ ] Create shared navigation configuration
- [ ] Update TenantNav to use shared config
- [ ] Update TenantFooter to use shared config
- [ ] Verify all navigation links are consistent
- [ ] Add/remove a test page to verify single-point change

## Related Files

- `apps/web/src/components/tenant/TenantNav.tsx`
- `apps/web/src/components/tenant/TenantFooter.tsx`
- New: `apps/web/src/components/tenant/navigation.ts`
