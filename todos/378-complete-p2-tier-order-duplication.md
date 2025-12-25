---
status: complete
priority: p2
issue_id: '378'
tags: [code-review, code-quality, dry]
dependencies: []
---

# P2: tierOrder Object Duplicated Across Pages

**Priority:** P2 (Important)
**Category:** Code Quality / DRY
**Source:** Code Review - Code Quality Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The `tierOrder` object used for sorting packages by tier/segment is duplicated across multiple pages. This is business logic that should be centralized.

## Location

Duplicated in:
- `apps/web/src/app/t/[slug]/(site)/services/page.tsx`
- `apps/web/src/app/t/[slug]/(site)/TenantLandingPage.tsx`
- `apps/web/src/app/t/_domain/services/page.tsx`

## Risk

- Tier ordering could become inconsistent
- New tiers require changes in multiple files
- Business logic scattered across UI components

## Solution

Create a shared package utilities module:

```typescript
// apps/web/src/lib/packages.ts
export const TIER_ORDER: Record<string, number> = {
  basic: 1,
  standard: 2,
  premium: 3,
  enterprise: 4,
};

export function sortPackagesByTier<T extends { segment?: string | null }>(
  packages: T[]
): T[] {
  return [...packages].sort((a, b) => {
    const orderA = a.segment ? TIER_ORDER[a.segment.toLowerCase()] ?? 99 : 99;
    const orderB = b.segment ? TIER_ORDER[b.segment.toLowerCase()] ?? 99 : 99;
    return orderA - orderB;
  });
}

export function groupPackagesBySegment<T extends { segment?: string | null }>(
  packages: T[]
): Map<string, T[]> {
  // ... grouping logic
}
```

## Acceptance Criteria

- [ ] Create `apps/web/src/lib/packages.ts`
- [ ] Move tierOrder and related logic to shared module
- [ ] Update all pages to import from shared utility
- [ ] Add unit tests for sorting and grouping functions
- [ ] Document tier ordering for future maintainers

## Related Files

- `apps/web/src/app/t/[slug]/(site)/services/page.tsx`
- `apps/web/src/app/t/[slug]/(site)/TenantLandingPage.tsx`
- `apps/web/src/app/t/_domain/services/page.tsx`
- New: `apps/web/src/lib/packages.ts`
