---
status: complete
priority: p3
issue_id: "347"
tags: [code-review, performance, optimization]
dependencies: []
---

# Performance: Package Data Prefetch Opportunity

## Problem Statement

DateBookingPage fetches package data that may already be available from TierDetail navigation. This causes an unnecessary API call per booking flow.

**Why it matters:** Could save 1 API call per booking, improving user experience.

## Findings

**File:** `client/src/pages/DateBookingPage.tsx:22-39`

```typescript
const { data: packageData, isLoading } = useQuery({
  queryKey: ['package', packageSlug],
  queryFn: async () => { ... },
  staleTime: 5 * 60 * 1000,
});
```

**Agent:** performance-oracle

## Proposed Solutions

### Option A: Pass via route state (Recommended)
- **Pros:** Eliminates redundant fetch, fast navigation
- **Cons:** Requires fallback if navigated directly
- **Effort:** Small
- **Risk:** Low

```typescript
// TierDetail.tsx
navigate(bookingLink, { state: { package: pkg } });

// DateBookingPage.tsx
const location = useLocation();
const prefetchedPackage = location.state?.package;
// Fall back to fetch if not available
```

### Option B: React Query prefetch
- **Pros:** Works with any navigation pattern
- **Cons:** Still makes request (from cache)
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option A for immediate improvement with Option B as enhancement.

## Technical Details

- **Affected files:** `TierDetail.tsx`, `DateBookingPage.tsx`
- **Components:** Storefront navigation
- **Database changes:** None

## Acceptance Criteria

- [ ] No redundant API call when navigating from tier detail
- [ ] Fallback works for direct URL access
- [ ] Loading states handle both scenarios

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-12-24 | Created from code review | performance-oracle agent finding |

## Resources

- TierDetail: `client/src/features/storefront/TierDetail.tsx`
- DateBookingPage: `client/src/pages/DateBookingPage.tsx`
