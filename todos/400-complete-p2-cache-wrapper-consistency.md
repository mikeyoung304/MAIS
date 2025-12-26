---
status: ready
priority: p2
issue_id: "400"
tags:
  - performance
  - nextjs
  - code-review
dependencies: []
---

# Missing cache() Wrapper and Duplicate Data Fetching

## Problem Statement

Multiple performance issues related to React's `cache()` wrapper and data fetching patterns:

1. `getTenantBySlug()` is NOT wrapped with `cache()`, causing duplicate API calls
2. Layout and page components both call `getTenantStorefrontData()`, causing triple API calls during SSR

## Findings

**Found by:** Performance Oracle + Architecture Strategist agents

### Issue 1: Missing cache() on getTenantBySlug

**Location:** `apps/web/src/lib/tenant.ts:104-129`

```typescript
// NOT cached - causes duplicate calls
export async function getTenantBySlug(slug: string): Promise<TenantPublicDto> {
  const url = `${API_BASE_URL}/v1/public/tenants/${encodeURIComponent(slug)}`;
  // ...
}

// Correctly cached
export const getTenantByDomain = cache(async (domain: string): Promise<TenantPublicDto> => {
  // ...
});
```

**Impact:** Booking pages at `/t/[slug]/book/[packageSlug]` make 2x API calls (generateMetadata + page component).

### Issue 2: Duplicate Data Fetching in Layout + Page

**Locations:**
- `apps/web/src/app/t/[slug]/(site)/layout.tsx` - calls `getTenantStorefrontData()`
- `apps/web/src/app/t/[slug]/(site)/page.tsx` - calls `getTenantStorefrontData()`
- `generateMetadata` in each page - also calls `getTenantStorefrontData()`

**Flow during SSR:**
1. `generateMetadata()` calls `getTenantStorefrontData(slug)`
2. `layout.tsx` calls `getTenantStorefrontData(slug)`
3. `page.tsx` calls `getTenantStorefrontData(slug)`

While `cache()` deduplicates within a single request, Next.js may call these at different lifecycle stages.

## Proposed Solutions

### Option 1: Add cache() wrapper to getTenantBySlug (Quick fix)
```typescript
export const getTenantBySlug = cache(async (slug: string): Promise<TenantPublicDto> => {
  // existing implementation
});
```

**Pros:** Simple one-line fix
**Cons:** Doesn't address layout/page duplication
**Effort:** Trivial
**Risk:** Very Low

### Option 2: Consolidate data fetching in layout (Recommended)
- Fetch data once in layout
- Pass to children via React Context or page params
- Remove redundant fetches from pages

**Pros:** Single fetch point, clear data flow
**Cons:** Requires refactoring
**Effort:** Medium
**Risk:** Low

### Option 3: Use Next.js 14 `unstable_cache` for cross-request caching
- Cache tenant data across requests
- Reduces API load significantly

**Pros:** Better performance at scale
**Cons:** Requires cache invalidation strategy
**Effort:** Medium
**Risk:** Medium

## Recommended Action

Option 1 immediately, Option 2 as follow-up.

## Technical Details

**File to modify (Option 1):**
- `apps/web/src/lib/tenant.ts` - Wrap getTenantBySlug with cache()

**Files affected (Option 2):**
- `apps/web/src/app/t/[slug]/(site)/layout.tsx`
- `apps/web/src/app/t/[slug]/(site)/page.tsx`
- All sibling pages: about, contact, faq, services

## Acceptance Criteria

- [ ] `getTenantBySlug()` wrapped with `cache()`
- [ ] Verify no duplicate API calls per page load (check network tab)
- [ ] TypeScript compiles without errors
- [ ] Existing functionality unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from performance review | cache() crucial for SSR deduplication |
| 2025-12-25 | **Approved for work** - Status: ready | P2 - Trivial fix |

## Resources

- Performance Oracle report
- Architecture Strategist report
- React cache() documentation
