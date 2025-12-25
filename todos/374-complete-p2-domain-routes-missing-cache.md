---
status: complete
priority: p2
issue_id: '374'
tags: [code-review, performance, caching]
dependencies: []
---

# P2: getTenantByDomain Not Wrapped with cache()

**Priority:** P2 (Important)
**Category:** Performance
**Source:** Code Review - Architecture Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The `getTenantByDomain()` function in domain routes is not wrapped with React's `cache()` function, unlike `getTenantStorefrontData()` in slug routes. This causes duplicate database queries when the same domain is resolved multiple times within a single request (e.g., in `generateMetadata` and `page` component).

## Location

- `apps/web/src/lib/tenant.ts` - `getTenantByDomain` function
- `apps/web/src/app/t/_domain/*/page.tsx` - All domain pages calling getTenantByDomain

## Risk

- Database queries duplicated per request (2x+ for pages with generateMetadata)
- Higher latency for custom domain users
- Inconsistent caching strategy between slug and domain routes
- Increased database load

## Solution

Wrap `getTenantByDomain` with React's `cache()` function like `getTenantStorefrontData`:

```typescript
// apps/web/src/lib/tenant.ts
import { cache } from 'react';

// Already wrapped
export const getTenantStorefrontData = cache(async (slug: string) => {
  // ...
});

// Add cache wrapper
export const getTenantByDomain = cache(async (domain: string) => {
  // ... existing implementation
});
```

## Acceptance Criteria

- [ ] `getTenantByDomain` wrapped with `cache()`
- [ ] Verify deduplication in domain routes (add console.log temporarily)
- [ ] Performance test comparing with/without cache
- [ ] Both slug and domain routes have consistent caching strategy

## Related Files

- `apps/web/src/lib/tenant.ts`
- `apps/web/src/app/t/_domain/about/page.tsx`
- `apps/web/src/app/t/_domain/services/page.tsx`
- `apps/web/src/app/t/_domain/faq/page.tsx`
- `apps/web/src/app/t/_domain/contact/page.tsx`
