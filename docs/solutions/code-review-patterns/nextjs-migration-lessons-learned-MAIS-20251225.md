# Next.js Migration: Lessons Learned

**Date:** 2025-12-25
**Project:** MAIS Multi-Tenant Platform
**Migration:** Vite SPA → Next.js 14 App Router
**Duration:** ~2-3 weeks (planned 6-8 weeks)
**Status:** Complete with 14 code review fixes applied

---

## Executive Summary

The MAIS Next.js migration successfully delivered a production-ready multi-tenant storefront with SSR, custom domains, and booking flow. However, code review revealed 14 issues (8 P1, 5 P2, 1 P3) that required post-migration fixes. This document captures key lessons to prevent similar issues in future migrations.

---

## Key Lessons

### 1. Security Tokens Must Never Reach the Client

**What Happened:**
Initial implementation exposed `backendToken` in the NextAuth session, making it accessible via `useSession()` hook and browser dev tools.

**Why It Matters:**
XSS vulnerability → full account compromise. A single malicious script could steal the backend JWT.

**Pattern to Follow:**

```typescript
// ❌ WRONG - Token exposed to client
async session({ session, token }) {
  return {
    ...session,
    user: { ...token, backendToken: token.backendToken } // EXPOSED!
  };
}

// ✅ CORRECT - Token stays server-side
async session({ session, token }) {
  return {
    ...session,
    user: { role: token.role, tenantId: token.tenantId } // Safe metadata only
  };
}

// Access token server-side only
export async function getBackendToken(): Promise<string | null> {
  const token = await getToken({ req, secret });
  return (token as MAISJWT).backendToken || null;
}
```

**Lesson:** Always design auth flows with the assumption that client-side code is hostile.

---

### 2. Build Before Review, Not After

**What Happened:**
The Badge component was imported but never created, causing TypeScript compilation failure. This was only caught during code review.

**Why It Matters:**
A build blocker that reached the review stage indicates missing CI/CD gates.

**Pattern to Follow:**

```bash
# Pre-commit hook (or CI pipeline)
npm run typecheck      # Must pass
npm run build          # Must pass
npm run test           # Must pass
```

**Lesson:** Every PR should require passing build as a merge gate. Code review should catch logic issues, not compilation errors.

---

### 3. Consolidate Auth Systems Early

**What Happened:**
The migration created NextAuth.js alongside the existing `AuthContext`, resulting in two competing authentication systems with potential token sync issues.

**Why It Matters:**
Dual auth systems create:

- Token desync bugs
- Maintenance burden
- Security audit complexity
- Developer confusion

**Pattern to Follow:**

```typescript
// ✅ Single source of truth
// apps/web/src/lib/auth.ts - NextAuth only
export const { auth, signIn, signOut } = NextAuth({ ... });

// ❌ Delete legacy auth
// apps/web/src/contexts/AuthContext/ - REMOVED
```

**Lesson:** When migrating auth, treat it as atomic. Either fully migrate or don't start. Hybrid states are technical debt.

---

### 4. Next.js Error Boundaries Are Not Optional

**What Happened:**
Dynamic routes (`/t/[slug]`, `/t/[slug]/book/[packageSlug]`) lacked `error.tsx` files, causing blank screens on runtime errors.

**Why It Matters:**
Users see white screen of death instead of recoverable error state.

**Pattern to Follow:**

```
app/
├── error.tsx              # Root error boundary
├── global-error.tsx       # Root layout errors
├── t/
│   └── [slug]/
│       ├── error.tsx      # Tenant page errors
│       └── book/
│           └── [packageSlug]/
│               └── error.tsx  # Booking errors
└── (protected)/
    └── tenant/
        └── error.tsx      # Admin errors
```

**Lesson:** Every dynamic route needs an error boundary. Add them proactively, not reactively.

---

### 5. Frontend Features Need Backend Contracts

**What Happened:**

- Sitemap generator called `/v1/public/tenants` but endpoint didn't exist
- Custom domains expected `/v1/public/tenants/by-domain/:domain` but it wasn't implemented

**Why It Matters:**
Frontend code that calls non-existent endpoints fails silently or crashes.

**Pattern to Follow:**

```typescript
// 1. Define contract FIRST
// packages/contracts/src/tenant.ts
export const tenantContract = c.router({
  listActive: {
    method: 'GET',
    path: '/v1/public/tenants',
    responses: { 200: z.array(TenantSlugSchema) },
  },
});

// 2. Implement backend SECOND
// server/src/routes/public-tenant.routes.ts
router.get('/v1/public/tenants', async (req, res) => { ... });

// 3. Call from frontend THIRD
// apps/web/src/app/sitemap.ts
const slugs = await fetch('/v1/public/tenants');
```

**Lesson:** Frontend-backend features require contract-first development. Never assume an endpoint exists.

---

### 6. Replace console.log Before Production

**What Happened:**
6+ `console.log` and `console.error` calls were scattered across auth.ts, sitemap.ts, and route handlers.

**Why It Matters:**

- Violates CLAUDE.md logging standards
- No structured logging for observability
- Security info potentially leaked to browser console

**Pattern to Follow:**

```typescript
// apps/web/src/lib/logger.ts
export const logger = {
  debug: (msg: string, data?: LogData) => {
    if (isDev) console.debug(format(msg, data));
  },
  info: (msg: string, data?: LogData) => {
    console.info(format(msg, data));
  },
  warn: (msg: string, data?: LogData) => {
    console.warn(format(msg, data));
  },
  error: (msg: string, error?: Error | LogData) => {
    console.error(format(msg, error));
  },
};

// Usage
import { logger } from '@/lib/logger';
logger.error('Auth failed', { email, reason: 'invalid_credentials' });
```

**Lesson:** Create a logger utility on day 1 of any new app. Replace console.\* immediately.

---

### 7. Session Duration Should Match Risk Level

**What Happened:**
Initial session `maxAge` was set to 7 days for admin accounts.

**Why It Matters:**
Longer sessions = larger attack window if token is compromised.

**Pattern to Follow:**

```typescript
// Risk-based session duration
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60, // 24 hours for tenant admins
  // Consider: 4 hours for platform admins
  // Consider: 7 days for read-only public sessions
}
```

**OWASP Recommendation:**

- High-privilege accounts: 15-30 minutes
- Standard admin accounts: 1-4 hours
- Regular users: 24 hours
- "Remember me": 7-30 days (with re-auth for sensitive ops)

**Lesson:** Session duration is a security decision, not a UX decision.

---

### 8. ISR Endpoints Need Rate Limiting

**What Happened:**
`/api/revalidate` accepted unlimited requests. A leaked secret could enable cache stampede attacks.

**Why It Matters:**
DoS vector: attacker spams revalidation → Vercel bills spike, cache becomes useless.

**Pattern to Follow:**

```typescript
// apps/web/src/app/api/revalidate/route.ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return false;
  }

  if (record.count >= 10) return true; // 10 requests per minute
  record.count++;
  return false;
}
```

**Lesson:** Any endpoint that triggers expensive operations needs rate limiting, even "internal" ones.

---

### 9. React cache() Prevents Duplicate Fetches

**What Happened:**
`getTenantStorefrontData()` was called twice per page render (once for metadata, once for content), doubling SSR latency.

**Why It Matters:**
~100ms added latency × thousands of requests = significant performance impact.

**Pattern to Follow:**

```typescript
import { cache } from 'react';

// Automatically deduplicates within a single render cycle
export const getTenantStorefrontData = cache(
  async (slug: string): Promise<TenantStorefrontData> => {
    const tenant = await getTenantBySlug(slug);
    const [packages, segments] = await Promise.all([
      getTenantPackages(tenant.apiKeyPublic),
      getTenantSegments(tenant.apiKeyPublic),
    ]);
    return { tenant, packages, segments };
  }
);
```

**Lesson:** Wrap all shared data fetching functions with `cache()` in Next.js Server Components.

---

### 10. Import Real Contracts, Not Placeholders

**What Happened:**
API client used `as never` cast to bypass TypeScript, making all API calls untyped.

**Why It Matters:**
No compile-time validation = runtime errors when API changes.

**Pattern to Follow:**

```typescript
// ❌ WRONG - Bypass type safety
import { initClient } from '@ts-rest/core';
const client = initClient({} as never, { baseUrl });

// ✅ CORRECT - Import real contracts
import { Contracts } from '@macon/contracts';
const client = initClient(Contracts, { baseUrl });
```

**Lesson:** Type placeholders are technical debt. Never merge code with `as never` or `as any` on contract definitions.

---

## Documentation Gaps Identified

The analysis revealed these documentation gaps that should be addressed:

### Priority 1 (Should Create)

1. **ADR for Next.js Migration** - Why App Router, why NextAuth, architectural decisions
2. **NextAuth Multi-Tenant Setup Guide** - JWT handling, session scoping, impersonation
3. **Server/Client Data Fetching Guide** - ts-rest in Server Components, caching strategies

### Priority 2 (Would Help)

4. **Vite to Next.js Migration Playbook** - Component patterns, routing, state management
5. **Tenant Landing Page Implementation** - ISR config, SEO metadata, dynamic routing
6. **Next.js E2E Testing Guide** - Playwright patterns for SSR, middleware testing

### Priority 3 (Nice to Have)

7. **Custom Domain Architecture** - Middleware flow, Vercel configuration
8. **Performance Optimization Guide** - Image optimization, code splitting, bundle analysis

---

## Metrics

| Metric               | Value                                      |
| -------------------- | ------------------------------------------ |
| Total Phases         | 6                                          |
| Planned Duration     | 6-8 weeks                                  |
| Actual Duration      | ~2-3 weeks                                 |
| Code Review Findings | 14                                         |
| P1 (Critical)        | 8                                          |
| P2 (Important)       | 5                                          |
| P3 (Nice to Have)    | 1                                          |
| Already Complete     | 2 (domain endpoint, TOCTOU race condition) |
| Files Changed        | 106                                        |
| Lines Added          | ~16,000                                    |
| E2E Tests Added      | 114                                        |
| E2E Tests Passing    | 22 (after fixes)                           |

---

## Prevention Checklist for Future Migrations

Use this checklist before merging any framework migration:

```markdown
## Pre-Merge Migration Checklist

### Build & Type Safety

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] All imports resolve (no missing components)
- [ ] No `as never` or `as any` on contracts

### Authentication

- [ ] Tokens not exposed to client JavaScript
- [ ] Session duration appropriate for risk level
- [ ] Single auth system (no dual/hybrid)
- [ ] Protected routes have middleware guards

### Error Handling

- [ ] Error boundaries on all dynamic routes
- [ ] Global error boundary exists
- [ ] API errors handled gracefully
- [ ] 404 pages configured

### Performance

- [ ] Data fetching deduplicated (React cache)
- [ ] ISR/revalidation configured appropriately
- [ ] Images use Next.js <Image> component
- [ ] Rate limiting on expensive endpoints

### Code Quality

- [ ] Logger utility used (no console.\*)
- [ ] Environment variables documented
- [ ] Real contracts imported (not placeholders)
- [ ] Frontend features have backend endpoints

### Documentation

- [ ] ADR created for major decisions
- [ ] Environment setup documented
- [ ] Key patterns documented
```

---

## Related Documents

- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Vercel Multi-Tenant Deployment](../../routing/VERCEL_MULTI_TENANT_DEPLOYMENT.md)
- [Brand Voice Guide](../../design/BRAND_VOICE_GUIDE.md)
- [Hosted Website Template Plan](../../../plans/hosted-website-template-plan.md)

---

## Tags

`next.js` `migration` `lessons-learned` `security` `authentication` `multi-tenant` `ssr` `isr` `code-review`
