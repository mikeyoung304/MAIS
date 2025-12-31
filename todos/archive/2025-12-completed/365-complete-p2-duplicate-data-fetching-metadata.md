---
status: complete
priority: p2
issue_id: '365'
tags: [code-review, performance, nextjs]
dependencies: []
---

# Duplicate Data Fetching in generateMetadata

## Problem Statement

`generateMetadata` and the page component both call `getTenantStorefrontData()` separately, causing duplicate API requests on every page load.

**Why it matters:** Adds ~100ms to SSR latency, doubles API load.

## Findings

**File:** `apps/web/src/app/t/[slug]/page.tsx`

```typescript
// Lines 31-45: Fetch for metadata
export async function generateMetadata({ params }: TenantPageProps) {
  const data = await getTenantStorefrontData(slug);  // Fetch 1
  // ... metadata generation
}

// Lines 66-81: Fetch again for page
export default async function TenantPage({ params }: TenantPageProps) {
  const data = await getTenantStorefrontData(slug);  // Fetch 2 (DUPLICATE)
  return <TenantLandingPage data={data} />;
}
```

Same issue in:

- `apps/web/src/app/t/_domain/page.tsx`

**Impact:** P2 - 100ms+ added to every tenant page SSR

## Proposed Solutions

### Option 1: Use React Cache

- **Description:** Wrap fetch function with React cache()
- **Pros:** Automatic deduplication, no code changes to callers
- **Cons:** Only works within same request
- **Effort:** Small (15 min)
- **Risk:** Low

**Fix:**

```typescript
import { cache } from 'react';

export const getTenantStorefrontData = cache(async (slug: string) => {
  // existing implementation
});
```

### Option 2: Fetch in Layout, Pass via Context

- **Description:** Fetch once in layout, pass to page via context
- **Pros:** Explicit data flow
- **Cons:** More complex, harder to type
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

**FIX NOW** - Use React `cache()` to deduplicate the fetch. This is a simple fix with significant performance impact. Wrap `getTenantStorefrontData` in `cache()` from React.

## Acceptance Criteria

- [ ] API called only once per page render
- [ ] Both metadata and page use same data
- [ ] No SSR performance regression
- [ ] Verify with network tab in devtools

## Work Log

| Date       | Action                     | Learnings               |
| ---------- | -------------------------- | ----------------------- |
| 2025-12-25 | Created during code review | Performance issue found |

## Resources

- React Cache: https://react.dev/reference/react/cache
