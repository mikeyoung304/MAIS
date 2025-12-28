# Multi-Tenant Routing Documentation Index

## Overview

This directory contains documentation for multi-tenant routing in MAIS. The platform uses **Next.js 14 App Router** for tenant storefronts (since December 2025), with Vercel handling custom domains and deployment.

## Current Documents

### Active Documentation

| Document                                                               | Purpose                                         | Status                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| [VERCEL_MULTI_TENANT_DEPLOYMENT.md](VERCEL_MULTI_TENANT_DEPLOYMENT.md) | Deployment guide for Vercel with custom domains | **Active** - Updated for Next.js                   |
| [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)                     | Visual diagrams of routing flow                 | **Active** - Concepts still apply                  |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md)                               | Quick lookup for common patterns                | **Partially Active** - Vercel patterns still valid |

### Primary Next.js Documentation

For Next.js App Router patterns, see:

- [ADR-014: Next.js App Router Migration](../adrs/ADR-014-nextjs-app-router-migration.md) - Architecture decisions
- [Next.js Migration Lessons Learned](../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md) - Key lessons and patterns
- `apps/web/README.md` - Next.js app-specific documentation

## Archived Documents

The following React Router v7 documents were archived on 2025-12-25 after the Next.js migration:

- `docs/archive/2025-12/2025-12-25_REACT_ROUTER_V7_PATTERNS.md` - React Router v7 specific patterns
- `docs/archive/2025-12/2025-12-25_TENANT_SCOPED_ROUTING.md` - Vite SPA tenant routing
- `docs/archive/2025-12/2025-12-25_REACT_ROUTER_IMPLEMENTATION_EXAMPLES.md` - React Router code examples

These are kept for historical reference but are no longer applicable.

## Next.js Routing Overview

### Tenant Resolution Flow

```
Request → Next.js Middleware → Route Handler → Component
              │
              ├─ Known MAIS domain? → Continue to app routes
              │
              └─ Custom domain? → Rewrite to /t/_domain/... with ?domain= param
                                     │
                                     └─ getTenantByDomain() → Tenant page
```

### Key Route Patterns

| Route                          | Purpose                | Rendering           |
| ------------------------------ | ---------------------- | ------------------- |
| `/t/[slug]`                    | Tenant landing page    | ISR (60s)           |
| `/t/[slug]/book/[packageSlug]` | Booking flow           | ISR (60s)           |
| `/t/_domain/*`                 | Custom domain routes   | ISR (60s)           |
| `/(protected)/tenant/*`        | Tenant admin           | CSR (authenticated) |
| `/api/revalidate`              | ISR cache invalidation | Edge                |

### File Structure

```
apps/web/src/
├── app/
│   ├── t/[slug]/              # Tenant storefronts
│   │   ├── page.tsx           # Landing page
│   │   ├── error.tsx          # Error boundary
│   │   └── book/[packageSlug]/
│   │       ├── page.tsx       # Booking page
│   │       └── error.tsx      # Error boundary
│   ├── (protected)/           # Auth-required routes
│   │   └── tenant/            # Tenant admin dashboard
│   └── api/
│       └── revalidate/        # ISR cache invalidation
├── middleware.ts              # Custom domain resolution
└── lib/
    ├── tenant.ts              # getTenantStorefrontData()
    └── auth.ts                # NextAuth.js config
```

## Deployment Strategy

### Current: Vercel Pro with Custom Domains

- **Path-based:** `app.maconaisolutions.com/t/[slug]` (default)
- **Custom domains:** `janephotography.com` → rewritten to `/t/_domain/...`
- **ISR:** 60-second revalidation with on-demand `/api/revalidate`
- **SSL:** Automatic via Vercel

See [VERCEL_MULTI_TENANT_DEPLOYMENT.md](VERCEL_MULTI_TENANT_DEPLOYMENT.md) for detailed deployment instructions.

## Quick Reference

### Access Tenant Data (Server Component)

```typescript
import { getTenantStorefrontData } from '@/lib/tenant';

export default async function TenantPage({ params }: { params: { slug: string } }) {
  const { tenant, packages, segments } = await getTenantStorefrontData(params.slug);
  // ...
}
```

### ISR Configuration

```typescript
// In page.tsx
export const revalidate = 60; // Revalidate every 60 seconds
```

### Custom Domain Middleware

```typescript
// middleware.ts
if (!isKnownMAISDomain(host)) {
  return NextResponse.rewrite(new URL(`/t/_domain${pathname}?domain=${host}`, request.url));
}
```

## Related Documentation

- [ADR-014: Next.js App Router Migration](../adrs/ADR-014-nextjs-app-router-migration.md)
- [Multi-Tenant Implementation Guide](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Custom Domains Setup](CUSTOM_DOMAINS_SETUP.md) (if exists)

---

**Last Updated:** December 25, 2025
**Framework:** Next.js 14 App Router, NextAuth.js v5
**Status:** Active (post-migration)
