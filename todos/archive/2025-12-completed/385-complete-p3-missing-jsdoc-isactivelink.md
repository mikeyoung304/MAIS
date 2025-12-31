---
status: complete
priority: p3
issue_id: '385'
tags: [code-review, code-quality, documentation]
dependencies: []
---

# P3: Missing JSDoc for isActiveLink Function

**Priority:** P3 (Nice-to-Have)
**Category:** Code Quality / Documentation
**Source:** Code Review - Code Quality Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The `isActiveLink` function has non-obvious behavior (exact match for home, prefix match for subpages) that isn't documented. A brief JSDoc comment would help future maintainers understand the matching logic.

## Location

- `apps/web/src/components/tenant/TenantNav.tsx:112-117`

## Risk

- Minor documentation gap
- Future developers might misunderstand matching behavior
- Could lead to bugs if modified without understanding the logic

## Solution

Add JSDoc comment explaining the matching logic:

```typescript
/**
 * Determines if a navigation link is active based on current pathname.
 *
 * - Home link: exact match only (prevents home from being "active" on subpages)
 * - Other links: prefix match (allows /services to match /services/foo)
 *
 * @param href - The navigation link href to check
 * @returns true if the link should be styled as active
 */
const isActiveLink = (href: string) => {
  if (href === basePath) {
    return pathname === basePath;
  }
  return pathname.startsWith(href);
};
```

## Acceptance Criteria

- [ ] Add JSDoc comment to isActiveLink function
- [ ] Explain the different matching behavior for home vs subpages
- [ ] Keep comment concise but informative

## Related Files

- `apps/web/src/components/tenant/TenantNav.tsx`
