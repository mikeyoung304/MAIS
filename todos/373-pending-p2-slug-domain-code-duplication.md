---
status: pending
priority: p2
issue_id: '373'
tags: [code-review, architecture, dry, refactoring]
dependencies: []
---

# P2: Significant Code Duplication Between Slug and Domain Routes (70-95%)

**Priority:** P2 (Important)
**Category:** Architecture / Code Quality
**Source:** Code Review - Architecture Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The custom domain routes (`/t/_domain/*`) are nearly identical copies of the slug routes (`/t/[slug]/(site)/*`) with only the tenant resolution method differing. This creates:
- 70-95% code duplication across 8 files
- Content drift risk (already observable in some pages)
- Double maintenance burden for any feature changes
- Inconsistent behavior between slug and domain access

## Location

Files with high duplication:
- `apps/web/src/app/t/_domain/layout.tsx` (mirrors `[slug]/(site)/layout.tsx`)
- `apps/web/src/app/t/_domain/page.tsx` (mirrors `[slug]/(site)/page.tsx`)
- `apps/web/src/app/t/_domain/about/page.tsx`
- `apps/web/src/app/t/_domain/services/page.tsx`
- `apps/web/src/app/t/_domain/faq/page.tsx`
- `apps/web/src/app/t/_domain/contact/page.tsx`

## Risk

- Features added to slug routes may not be added to domain routes
- Bug fixes must be applied in two places
- Testing overhead doubles
- Content drift already present (observed in contact/faq pages)

## Solution

Extract shared page content into reusable components that accept tenant data as props. Only the data fetching differs between routes.

### Option A: Shared Page Components (Recommended)
```tsx
// Create shared page components
// apps/web/src/components/tenant/pages/AboutPageContent.tsx
export function AboutPageContent({ tenant, basePath }: Props) {
  // All the page rendering logic
}

// Slug route - apps/web/src/app/t/[slug]/(site)/about/page.tsx
export default async function AboutPage({ params }) {
  const tenant = await getTenantStorefrontData(params.slug);
  const basePath = `/t/${params.slug}`;
  return <AboutPageContent tenant={tenant} basePath={basePath} />;
}

// Domain route - apps/web/src/app/t/_domain/about/page.tsx
export default async function AboutPage({ searchParams }) {
  const tenant = await getTenantByDomain(searchParams.domain);
  const basePath = `?domain=${searchParams.domain}`;
  return <AboutPageContent tenant={tenant} basePath={basePath} />;
}
```

### Option B: Higher-Order Component for Tenant Resolution
Create a HOC that handles tenant resolution and passes data to the page.

## Acceptance Criteria

- [ ] Extract shared page content into reusable components
- [ ] Both slug and domain routes use shared components
- [ ] Only tenant resolution logic differs between routes
- [ ] All pages have consistent behavior
- [ ] Tests cover both access patterns
- [ ] No more content drift between routes

## Related Files

- All files in `apps/web/src/app/t/[slug]/(site)/`
- All files in `apps/web/src/app/t/_domain/`
- New: `apps/web/src/components/tenant/pages/`
