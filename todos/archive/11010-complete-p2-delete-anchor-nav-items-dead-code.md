---
status: pending
priority: p2
issue_id: '11010'
tags: [code-review, navigation, dead-code]
---

# P2: Delete `getAnchorNavigationItems()` in same commit as nav fix

## Problem Statement

After Phase 2c switches `TenantNav.tsx` to `getNavItemsFromHomeSections()`, `getAnchorNavigationItems()` has zero callers. Leaving it as dead code misleads future contributors into thinking there are two valid nav derivation paths. Its file-level docstring ("Derives navigation from PagesConfig — only enabled pages appear in nav") will actively point developers at the wrong function.

Per "No Debt" principle and Pitfall #14, dead code is deleted in the same commit.

## Required Changes

In `apps/web/src/components/tenant/navigation.ts`:

- [ ] Delete `getAnchorNavigationItems()` function (lines 135-147 currently)
- [ ] Update file-level docstring to reflect single-page scroll architecture (remove "only enabled pages appear in nav")
- [ ] Also audit `getNavigationItems()` (the multi-page path-based function) — if nothing imports it, delete that too

## Acceptance Criteria

- [ ] `getAnchorNavigationItems` does not exist in `navigation.ts` after Phase 2c commit
- [ ] No files import `getAnchorNavigationItems`
- [ ] `grep -r "getAnchorNavigationItems" apps/web/` returns no results
- [ ] TypeScript passes cleanly
