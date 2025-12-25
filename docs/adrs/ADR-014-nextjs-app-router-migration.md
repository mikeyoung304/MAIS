# ADR-014: Next.js App Router Migration for Tenant Storefronts

**Status:** Accepted
**Date:** 2025-12-25
**Deciders:** Mike Young, Claude Code Review Agents
**Context:** Multi-tenant SaaS platform requiring SEO-optimized tenant websites

---

## Context

MAIS is a multi-tenant business growth platform. Each tenant (photographer, coach, consultant) needs a public-facing website/storefront for:
- SEO discoverability (Google indexing)
- Custom domain support (janephotography.com → MAIS tenant)
- Booking flow with Stripe integration
- Admin dashboard for managing packages, branding, scheduling

The existing Vite SPA client (`/client`) was client-side rendered, which:
- Provided no SEO value (empty HTML for crawlers)
- Required complex custom domain routing hacks
- Made SSR/ISR impossible without major refactoring

---

## Decision

**Migrate public-facing tenant storefronts to Next.js 14 App Router** while keeping the Express API backend unchanged.

### Key Architectural Choices

| Decision | Choice | Alternatives Considered |
|----------|--------|------------------------|
| Meta-framework | Next.js 14 App Router | Remix, Astro, SvelteKit |
| Rendering Strategy | ISR with 60s revalidation | SSR, SSG, CSR |
| Authentication | NextAuth.js v5 (Auth.js) | Custom JWT, Clerk, Auth0 |
| API Integration | Keep Express backend, call via ts-rest | Migrate to Next.js API routes |
| Deployment | Vercel (Pro for custom domains) | Self-hosted, Cloudflare |
| Styling | Tailwind CSS (existing tokens) | CSS Modules, styled-components |

### Why Next.js App Router

1. **SEO Requirements** - Server-rendered HTML for Google indexing
2. **Vercel Custom Domains** - Built-in support via wildcard domains
3. **React Server Components** - Reduces client bundle size
4. **ISR** - Fast pages with automatic revalidation
5. **Ecosystem** - NextAuth, next/image, next/font built-in
6. **Team Familiarity** - React-based, minimal learning curve

### Why Keep Express Backend

1. **Working Code** - 771 tests passing, battle-tested
2. **Multi-tenant Security** - Tenant isolation patterns proven
3. **Low Risk** - No backend changes = no new bugs
4. **Separation of Concerns** - API vs presentation layer
5. **Future Flexibility** - Mobile apps can use same API

---

## Implementation

### Directory Structure

```
apps/
└── web/                         # NEW - Next.js app
    ├── src/
    │   ├── app/                 # App Router pages
    │   │   ├── t/[slug]/        # Tenant storefronts
    │   │   ├── (protected)/     # Admin routes
    │   │   └── api/             # Next.js API routes
    │   ├── lib/
    │   │   ├── auth.ts          # NextAuth.js config
    │   │   ├── tenant.ts        # Tenant data fetching
    │   │   └── api.ts           # ts-rest client
    │   └── middleware.ts        # Custom domain resolution
    └── package.json

server/                          # UNCHANGED - Express API
client/                          # DEPRECATED - Vite SPA
```

### Tenant Resolution Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Request: janephotography.com/book/portrait-session         │
└────────────────────────────────┬────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Next.js Middleware      │
                    │ Is known MAIS domain?   │
                    └────────────┬────────────┘
                                 │ NO
                    ┌────────────▼────────────┐
                    │ Rewrite to:             │
                    │ /t/_domain/book/...     │
                    │ ?domain=janephoto...    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ getTenantByDomain()     │
                    │ → Express API lookup    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ TenantLandingPage       │
                    │ (Same component as      │
                    │  /t/[slug] route)       │
                    └─────────────────────────┘
```

### Authentication Architecture

```typescript
// NextAuth.js with Credentials Provider
// Delegates all validation to Express backend

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        // Call Express API for validation
        const response = await fetch(`${API_URL}/v1/auth/login`, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        // Return user with backend token (stored in JWT)
        return {
          id: data.tenantId,
          email: data.email,
          role: data.role,
          backendToken: data.token,  // Server-side only
        };
      },
    }),
  ],

  callbacks: {
    // Token stays in JWT, not exposed to client
    async session({ session, token }) {
      return {
        ...session,
        user: {
          role: token.role,
          tenantId: token.tenantId,
          // backendToken: EXCLUDED for security
        },
      };
    },
  },
});
```

### ISR Configuration

```typescript
// Tenant pages: 60s revalidation
export const revalidate = 60;

// On-demand revalidation endpoint
// POST /api/revalidate?secret=xxx&path=/t/jane-photography
export async function POST(request: NextRequest) {
  const secret = searchParams.get('secret');
  if (secret !== process.env.NEXTJS_REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid' }, { status: 401 });
  }

  revalidatePath(path);
  return NextResponse.json({ revalidated: true });
}
```

---

## Consequences

### Positive

- **SEO Enabled** - Tenant pages indexable by Google
- **Performance** - ISR provides sub-200ms TTFB
- **Custom Domains** - Vercel handles SSL/routing
- **Developer Experience** - React patterns, hot reload
- **Type Safety** - ts-rest contracts shared with backend
- **Future-Proof** - App Router is Next.js recommended approach

### Negative

- **Two Build Systems** - Vite client remains for admin (temporary)
- **Deployment Complexity** - Monorepo with Vercel + Render
- **Learning Curve** - Server Components require new mental model
- **Vercel Lock-in** - Custom domains require Vercel Pro

### Neutral

- **Bundle Size** - Slightly larger than Vite (offset by RSC)
- **Build Time** - Longer than Vite (acceptable for ISR benefits)

---

## Migration Phases

| Phase | Scope | Duration | Status |
|-------|-------|----------|--------|
| 1 | Next.js Foundation | Week 1-2 | ✅ Complete |
| 2 | Tenant Landing Page | Week 3 | ✅ Complete |
| 3 | Component Extraction | Week 4 | ✅ Complete |
| 4 | Admin Migration | Week 5 | ✅ Complete |
| 5 | Booking Flow | Week 6 | ✅ Complete |
| 6 | Custom Domains + Polish | Week 7-8 | ✅ Complete |

---

## Lessons Learned

During post-migration code review, 14 issues were identified and fixed:

1. **Security:** Backend token must not reach client session
2. **Build:** Missing components cause build failures (CI gates needed)
3. **Auth:** Consolidate to single auth system immediately
4. **Errors:** Error boundaries required on all dynamic routes
5. **API:** Frontend features require backend contracts first
6. **Logging:** Create logger utility on day 1
7. **Sessions:** Duration should match risk level (24h for admins)
8. **Rate Limiting:** ISR endpoints need protection
9. **Caching:** Use React cache() for data deduplication
10. **Types:** Never use placeholder contracts

See: [Next.js Migration Lessons Learned](../solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)

---

## Related ADRs

- [ADR-006: Modular Monolith Architecture](ADR-006-modular-monolith-architecture.md)
- [ADR-007: Mock-First Development](ADR-007-mock-first-development.md)
- [ADR-013: PostgreSQL Advisory Locks](ADR-013-postgresql-advisory-locks.md)

---

## References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [NextAuth.js v5 Documentation](https://authjs.dev/)
- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/domains)
- [Hosted Website Template Plan](../../plans/hosted-website-template-plan.md)
