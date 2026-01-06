---
status: completed
priority: p2
issue_id: '642'
tags: [code-review, performance, react-query, caching]
dependencies: []
---

# Missing React Query Integration in Scheduling Pages

## Problem Statement

All scheduling pages use raw `useEffect` + `fetch` + `useState` pattern despite React Query being properly configured in the app. This misses caching, deduplication, and automatic refetch benefits.

## Findings

**Source:** Performance Oracle review of Legacy-to-Next.js Migration

**Affected pages:**

- `apps/web/src/app/(protected)/tenant/scheduling/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointments/page.tsx`
- `apps/web/src/app/(protected)/admin/dashboard/page.tsx`

**Existing infrastructure (not used):**

- `query-client.ts` defines proper query keys and cache options
- `queryKeys.admin` and `queryKeys.tenantAdmin` are defined but NOT used

**Impact:**

- Data is re-fetched on every page mount
- No shared cache between components viewing the same data
- Slower perceived performance on navigation
- Unnecessary network requests

## Proposed Solutions

### Option A: Migrate to useQuery (Recommended)

**Pros:** Caching, deduplication, automatic refetch, stale-while-revalidate
**Cons:** Requires refactoring each page
**Effort:** Medium
**Risk:** Low

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

const { data: bookings, isLoading } = useQuery({
  queryKey: queryKeys.tenantAdmin.bookings,
  queryFn: () => fetch('/api/tenant-admin/bookings').then((r) => r.json()),
  enabled: isAuthenticated,
});
```

### Option B: Keep current pattern with manual cache

**Pros:** No refactoring
**Cons:** Misses React Query benefits, more code
**Effort:** Low
**Risk:** Medium - technical debt

## Recommended Action

Option A - Migrate to React Query for proper caching.

## Technical Details

### Affected Files

- `apps/web/src/app/(protected)/tenant/scheduling/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointments/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/appointment-types/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/availability/page.tsx`
- `apps/web/src/app/(protected)/tenant/scheduling/blackouts/page.tsx`
- `apps/web/src/app/(protected)/admin/dashboard/page.tsx`

### Query Keys Location

`apps/web/src/lib/query-client.ts`

## Acceptance Criteria

- [x] All scheduling pages use `useQuery` for data fetching
- [x] Admin dashboard uses `useQuery` for stats
- [x] Query keys follow existing patterns in `query-client.ts`
- [x] Caching works between page navigations

## Work Log

| Date       | Action                   | Learnings                                                      |
| ---------- | ------------------------ | -------------------------------------------------------------- |
| 2026-01-05 | Created from code review | React Query is already configured                              |
| 2026-01-05 | Completed implementation | Migrated all scheduling pages + admin dashboard to React Query |

## Resources

- Existing pattern: `apps/web/src/lib/query-client.ts`
- React Query docs: https://tanstack.com/query/latest
