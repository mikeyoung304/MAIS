---
status: ready
priority: p2
issue_id: "431"
tags: [frontend, nextjs, refactoring, dry]
dependencies: []
---

# Tenant Page Code Duplication Between [slug] and _domain Routes

## Problem Statement
The `apps/web/src/app/t/[slug]/` and `apps/web/src/app/t/_domain/` directories contain nearly identical page implementations with 80-90% shared logic. This creates maintenance burden and risks inconsistencies.

## Severity: P2 - MEDIUM

Not critical but increases maintenance burden and bug surface area.

## Findings
- Location: `apps/web/src/app/t/[slug]/` (27 files) vs `apps/web/src/app/t/_domain/` (25 files)
- Duplication: About page, Services page, Contact page, FAQ page, Gallery page, Testimonials page
- Difference: Only tenant resolution method differs (`params.slug` vs `searchParams.domain`)

## Example Comparison

### [slug]/(site)/about/page.tsx (86 lines)
```typescript
const tenant = await getTenantStorefrontData(params.slug);
// ... shared rendering logic ...
```

### _domain/about/page.tsx (72 lines)
```typescript
const tenant = await getTenantByDomain(searchParams.domain);
// ... same rendering logic ...
```

## Additional Issues Found
1. `_domain/about/page.tsx` is **missing the `isPageEnabled` check** that exists in `[slug]` version (security/UX inconsistency)
2. Metadata generation is duplicated with ~95% shared logic
3. Error boundaries are identical except for log message string

## Proposed Solution
Create shared utilities:

### 1. Unified Tenant Resolution
```typescript
// lib/tenant-page-utils.ts
export type TenantIdentifier =
  | { type: 'slug'; slug: string }
  | { type: 'domain'; domain: string };

export async function resolveTenant(identifier: TenantIdentifier) {
  if (identifier.type === 'slug') {
    return getTenantStorefrontData(identifier.slug);
  } else {
    return getTenantByDomain(identifier.domain);
  }
}
```

### 2. Shared Metadata Generator
```typescript
export function generateTenantPageMetadata(
  pageType: 'about' | 'services' | 'contact' | 'faq',
  tenant: Tenant
): Metadata {
  // Shared metadata logic
}
```

### 3. Shared Error Boundary Factory
```typescript
export function createTenantErrorBoundary(context: string) {
  return function Error({ error, reset }) {
    logger.error({ error }, `${context} error`);
    // ... shared error UI ...
  };
}
```

## Technical Details
- **Affected Files**:
  - 7 page pairs in `[slug]/(site)/` and `_domain/`
  - 7 error boundary pairs
- **New Files**:
  - `apps/web/src/lib/tenant-page-utils.ts`
  - `apps/web/src/components/tenant/TenantErrorBoundary.tsx`
- **Risk**: Medium - refactoring multiple pages

## Acceptance Criteria
- [ ] Shared `resolveTenant()` utility created
- [ ] Shared `generateTenantPageMetadata()` utility created
- [ ] `_domain` pages use `isPageEnabled` check (consistency fix)
- [ ] All 7 page pairs use shared utilities
- [ ] Error boundaries consolidated

## Review Sources
- Code Quality Reviewer: 7 page pairs with significant duplication
- Pattern Recognition Specialist: P1 (High) - Tenant page duplication
- Code Simplicity Reviewer: Necessary but improvable

## Notes
Source: Parallel code review session on 2025-12-26
Note: Full unification is risky due to Next.js App Router constraints.
The dual-routing pattern is necessary but shared utilities can reduce duplication.
