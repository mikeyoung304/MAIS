# Multi-Tenant Routing Documentation

> **Note:** As of December 2025, MAIS uses **Next.js 14 App Router** for tenant storefronts. The React Router v7 documentation has been archived.

## Current Architecture

MAIS tenant storefronts use:

- **Frontend:** Next.js 14 App Router with React Server Components
- **Auth:** NextAuth.js v5 with Credentials Provider
- **Rendering:** ISR (Incremental Static Regeneration) with 60s revalidation
- **Deployment:** Vercel Pro with custom domain support
- **API:** Express backend with tenant isolation (unchanged)

## Primary Documentation

For Next.js patterns and implementation, see:

| Document                                                                                                         | Purpose                              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| [ADR-014: Next.js App Router Migration](../adrs/ADR-014-nextjs-app-router-migration.md)                          | Architecture decisions and rationale |
| [Migration Lessons Learned](../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md) | 10 key lessons from the migration    |
| `apps/web/README.md`                                                                                             | Next.js app-specific documentation   |

## Active Routing Docs

| Document                                                                 | Purpose                                 | Status      |
| ------------------------------------------------------------------------ | --------------------------------------- | ----------- |
| [INDEX.md](./INDEX.md)                                                   | Documentation index and quick reference | **Updated** |
| [VERCEL_MULTI_TENANT_DEPLOYMENT.md](./VERCEL_MULTI_TENANT_DEPLOYMENT.md) | Deployment with custom domains          | **Active**  |
| [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)                     | Visual architecture diagrams            | **Active**  |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)                               | Quick lookup patterns                   | **Partial** |

## Archived (React Router v7)

The following docs are archived at `docs/archive/2025-12/`:

- `2025-12-25_REACT_ROUTER_V7_PATTERNS.md` - React Router v7 patterns
- `2025-12-25_TENANT_SCOPED_ROUTING.md` - Vite SPA tenant routing
- `2025-12-25_REACT_ROUTER_IMPLEMENTATION_EXAMPLES.md` - Code examples

These are kept for historical reference but are no longer applicable to the current codebase.

## Quick Start

### Tenant Storefront Development

```bash
# Start the Next.js dev server
cd apps/web && npm run dev

# Visit tenant storefront
open http://localhost:3000/t/demo-tenant
```

### Key Files

```
apps/web/src/
├── app/t/[slug]/page.tsx     # Tenant landing page
├── middleware.ts              # Custom domain resolution
├── lib/tenant.ts              # Tenant data fetching
└── lib/auth.ts                # NextAuth.js config
```

### Tenant Resolution Flow

1. Request arrives at Next.js
2. Middleware checks if host is a known MAIS domain
3. If custom domain → rewrite to `/t/_domain/...?domain=host`
4. Route handler calls `getTenantByDomain()` or `getTenantBySlug()`
5. Server Component renders with tenant data

## Deployment

See [VERCEL_MULTI_TENANT_DEPLOYMENT.md](./VERCEL_MULTI_TENANT_DEPLOYMENT.md) for:

- Path-based routing (`/t/[slug]`)
- Custom domain support
- SSL provisioning
- Cache invalidation

---

**Last Updated:** December 25, 2025
**Framework:** Next.js 14 App Router
