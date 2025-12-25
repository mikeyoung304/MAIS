---
status: complete
priority: p2
issue_id: '376'
tags: [code-review, code-quality, dry]
dependencies: []
---

# P2: formatPrice Function Duplicated in 3 Locations

**Priority:** P2 (Important)
**Category:** Code Quality / DRY
**Source:** Code Review - Code Quality Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The `formatPrice` utility function is duplicated across multiple files instead of being centralized. This violates DRY principles and creates maintenance burden.

## Location

Duplicated in:
- `apps/web/src/app/t/[slug]/(site)/services/page.tsx`
- `apps/web/src/app/t/[slug]/(site)/TenantLandingPage.tsx`
- `apps/web/src/app/t/_domain/services/page.tsx`

## Risk

- Inconsistent formatting if implementations diverge
- Triple maintenance for any changes
- Potential bugs if one instance is fixed but others aren't

## Solution

Create a shared utility module and import from there:

```typescript
// apps/web/src/lib/format.ts
export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return 'Price TBD';
  return `$${(cents / 100).toFixed(0)}`;
}

// Usage in pages:
import { formatPrice } from '@/lib/format';
```

## Acceptance Criteria

- [ ] Create `apps/web/src/lib/format.ts` with formatPrice
- [ ] Update all pages to import from shared utility
- [ ] Remove duplicated implementations
- [ ] Add unit tests for formatPrice function

## Related Files

- `apps/web/src/app/t/[slug]/(site)/services/page.tsx`
- `apps/web/src/app/t/[slug]/(site)/TenantLandingPage.tsx`
- `apps/web/src/app/t/_domain/services/page.tsx`
- New: `apps/web/src/lib/format.ts`
