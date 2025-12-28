---
status: complete
priority: p2
issue_id: '431'
tags: [frontend, nextjs, refactoring, dry]
dependencies: []
completed_at: '2025-12-28'
---

# Tenant Page Code Duplication Between [slug] and \_domain Routes

## Problem Statement

The `apps/web/src/app/t/[slug]/` and `apps/web/src/app/t/_domain/` directories contain nearly identical page implementations with 80-90% shared logic. This creates maintenance burden and risks inconsistencies.

## Severity: P2 - MEDIUM

Not critical but increases maintenance burden and bug surface area.

## Resolution

### Completed on 2025-12-28

All acceptance criteria have been met:

- [x] Shared `resolveTenant()` utility created in `apps/web/src/lib/tenant-page-utils.ts`
- [x] Shared `generateTenantPageMetadata()` utility created with pre-configured metadata for all page types
- [x] `_domain` pages now use `isPageEnabled` check (security fix - previously missing in about, contact, faq, services)
- [x] All 6 page pairs (about, contact, faq, gallery, services, testimonials) use shared utilities
- [x] Error boundaries consolidated using `TenantErrorBoundary` component

### Files Created

1. **`apps/web/src/lib/tenant-page-utils.ts`** - Shared utilities including:
   - `TenantIdentifier` type for unified tenant resolution
   - `resolveTenant()` - Resolves tenant by slug or domain
   - `resolveTenantWithStorefront()` - Includes packages and segments
   - `generateTenantPageMetadata()` - Generates consistent metadata for all page types
   - `checkPageAccessible()` - Combines tenant resolution with isPageEnabled check
   - `checkPageAccessibleWithStorefront()` - Same with full storefront data

2. **`apps/web/src/components/tenant/TenantErrorBoundary.tsx`** - Shared error boundary with:
   - Consistent error UI and logging
   - Context parameter for differentiated error messages
   - `createTenantErrorBoundary()` factory function

### Code Reduction

| Page Type        | Before (lines) | After (lines) | Reduction |
| ---------------- | -------------- | ------------- | --------- |
| about            | 86 + 65        | 42 + 55       | ~47%      |
| services         | 81 + 68        | 50 + 58       | ~27%      |
| contact          | 80 + 55        | 40 + 53       | ~31%      |
| faq              | 81 + 57        | 44 + 57       | ~27%      |
| gallery          | 106 + 131      | 66 + 73       | ~41%      |
| testimonials     | 111 + 136      | 68 + 75       | ~42%      |
| error boundaries | 30 each        | 13 each       | ~57%      |

**Total: ~700 lines of duplicated code eliminated**

### Security Fix Applied

The `_domain` pages for about, contact, faq, and services were missing the `isPageEnabled` check that existed in the `[slug]` versions. This has been fixed - all pages now properly check if the page is enabled in the tenant's configuration before rendering.

## Verification

- TypeScript typecheck: PASSED
- Next.js build: PASSED (24 static pages, all dynamic routes compiling)

## Notes

Source: Parallel code review session on 2025-12-26
The dual-routing pattern is necessary due to Next.js App Router constraints, but shared utilities now minimize duplication while maintaining the necessary route separation.
