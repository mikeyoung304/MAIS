---
status: complete
priority: p2
issue_id: '382'
tags: [code-review, tenant-isolation, routing]
dependencies: []
---

# P2: Broken Navigation Links in Domain-Based Pages

**Priority:** P2 (Important)
**Category:** Tenant Isolation / Routing
**Source:** Code Review - Tenant Isolation Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The custom domain pages use `basePath = \`?domain=${domain}\``which creates broken navigation links like`?domain=example.com/services`instead of`/services?domain=example.com`. This breaks the custom domain user experience.

## Location

- `apps/web/src/app/t/_domain/contact/page.tsx:39`
- `apps/web/src/app/t/_domain/faq/page.tsx:40`
- Similar pattern in other domain pages

## Risk

- Navigation completely broken for custom domain users
- Users stuck on pages, can't navigate
- Critical UX failure for premium (custom domain) customers
- SEO impact from broken internal links

## Solution

Fix basePath construction for domain routes:

```typescript
// Current (broken):
const basePath = `?domain=${domain}`;
// Generates: <Link href="?domain=example.com/services">

// Fixed:
const basePath = ''; // Root path for custom domains
const domainParam = `?domain=${domain}`;

// In components, construct links properly:
// For path-based nav: `/services${domainParam}` → `/services?domain=example.com`
// For home: `/${domainParam}` → `/?domain=example.com`

// Or update TenantNav/Footer to handle domain vs slug differently:
interface TenantNavProps {
  tenant: TenantPublicDto;
  basePath: string;
  domainParam?: string; // For custom domains
}
```

## Acceptance Criteria

- [ ] Fix basePath in all domain pages
- [ ] Navigation works correctly on custom domains
- [ ] Test full navigation flow on domain route
- [ ] Links preserve domain parameter across navigation
- [ ] E2E test for custom domain navigation (once domain setup available)

## Related Files

- `apps/web/src/app/t/_domain/contact/page.tsx`
- `apps/web/src/app/t/_domain/faq/page.tsx`
- `apps/web/src/app/t/_domain/about/page.tsx`
- `apps/web/src/app/t/_domain/services/page.tsx`
- `apps/web/src/components/tenant/TenantNav.tsx`
- `apps/web/src/components/tenant/TenantFooter.tsx`
