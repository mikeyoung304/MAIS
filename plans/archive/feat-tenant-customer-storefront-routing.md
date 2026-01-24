# Feature: Tenant-Scoped Customer Storefront Routing

## Overview

Implement URL-based tenant routing so end customers can access tenant storefronts via:

- **Path-based:** `maconaisolutions.com/t/little-bit-farm` (MVP)
- **Custom domains:** `little-bit-farm.com` (future - deferred)

The storefront serves as both landing page and booking flow, creating a white-label experience where customers feel they're on the tenant's own website.

## Problem Statement

Currently, there's no way for end customers to view a tenant's storefront. The existing routes:

- `/storefront` - requires `X-Tenant-Key` header (not URL-accessible)
- `/s/:slug` - segment slug, not tenant slug
- `/tiers` - no tenant context

**User Types Affected:**
| Viewer | Current State | Desired State |
|--------|---------------|---------------|
| A) Potential tenant | ✅ `maconaisolutions.com` | No change |
| B) Tenant admin | ✅ `/tenant/dashboard` (after login) | No change |
| C) Platform admin | ✅ `/admin/dashboard` (after login) | No change |
| D) End customer | ❌ No URL access | ✅ `/t/{tenant-slug}` |

---

## Simplified Technical Approach

> **Review Feedback Applied:** Original plan was overengineered (11 hours, 400+ lines).
> Simplified to ~90 minutes, ~105 lines by reusing existing infrastructure.

### What We Already Have

1. **`useBranding()` hook** - Already fetches branding and applies CSS variables
2. **`api.setTenantKey()`** - Already exists for setting tenant context
3. **`StorefrontHome`, `SegmentTiers`, `TierCard`** - Existing components, just need routing
4. **`AppShell`** - Existing layout, can adapt for tenant storefronts

### What We Need

1. **One new endpoint:** `GET /v1/public/tenants/:slug` - Returns tenant public info + API key
2. **One new layout:** `TenantStorefrontLayout.tsx` (~80 lines)
3. **Router updates:** Add `/t/:tenantSlug/*` routes (~20 lines)

---

## Phase 1: MVP Implementation (90 minutes)

### 1.1 Backend: Add Public Tenant Lookup Endpoint

**File:** `packages/contracts/src/api.v1.ts`

```typescript
// Add to existing contract
getTenantPublic: {
  method: 'GET',
  path: '/v1/public/tenants/:slug',
  pathParams: z.object({ slug: z.string() }),
  responses: {
    200: TenantPublicDtoSchema,
    404: ErrorSchema,
  },
  summary: 'Get public tenant info by slug (for storefront routing)',
}
```

**File:** `packages/contracts/src/dto.ts`

```typescript
// TenantPublicDto - SECURITY: Only safe public fields
export const TenantPublicDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  apiKeyPublic: z.string(), // Needed to set X-Tenant-Key for subsequent API calls
  branding: z
    .object({
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      fontFamily: z.string().optional(),
      logoUrl: z.string().optional(),
    })
    .optional(),
});

// SECURITY: Never expose in TenantPublicDto:
// - apiKeySecret (sk_live_*)
// - stripeAccountId
// - encryptedSecrets
// - email addresses
// - internal configuration
```

**File:** `server/src/routes/public.routes.ts` (new)

```typescript
import { initServer } from '@ts-rest/express';
import { contract } from '@macon/contracts';
import { PrismaClient } from '../generated/prisma';
import { logger } from '../lib/core/logger';

export function createPublicRoutes(prisma: PrismaClient) {
  const s = initServer();

  return s.router(contract, {
    getTenantPublic: async ({ params }) => {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: params.slug, isActive: true },
        select: {
          id: true,
          slug: true,
          name: true,
          apiKeyPublic: true,
          branding: true,
        },
      });

      if (!tenant) {
        logger.info({ slug: params.slug }, 'Tenant not found for public lookup');
        return {
          status: 404,
          body: { error: 'Tenant not found', code: 'TENANT_NOT_FOUND' },
        };
      }

      logger.info({ tenantId: tenant.id, slug: tenant.slug }, 'Public tenant lookup');

      return {
        status: 200,
        body: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          apiKeyPublic: tenant.apiKeyPublic,
          branding: tenant.branding as any,
        },
      };
    },
  });
}
```

### 1.2 Frontend: Create TenantStorefrontLayout

**File:** `client/src/app/TenantStorefrontLayout.tsx`

```typescript
/**
 * Layout for public tenant storefronts at /t/:tenantSlug/*
 * Resolves tenant from URL slug, sets API key, applies branding
 */

import { useEffect, useState } from 'react';
import { Outlet, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Loading } from '../ui/Loading';
import { Container } from '../ui/Container';
import type { TenantPublicDto } from '@macon/contracts';

export function TenantStorefrontLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [apiKeySet, setApiKeySet] = useState(false);

  // Fetch tenant by slug
  const { data: tenant, isLoading, error } = useQuery<TenantPublicDto>({
    queryKey: ['tenant-public', tenantSlug],
    queryFn: async () => {
      const response = await api.getTenantPublic({ params: { slug: tenantSlug! } });
      if (response.status === 200) return response.body;
      throw new Error('Tenant not found');
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 15, // Cache 15 minutes
  });

  // Set API key when tenant loads
  useEffect(() => {
    if (tenant?.apiKeyPublic) {
      api.setTenantKey(tenant.apiKeyPublic);
      setApiKeySet(true);
    }
    return () => {
      api.setTenantKey(null); // Clear on unmount
      setApiKeySet(false);
    };
  }, [tenant?.apiKeyPublic]);

  // Apply branding CSS variables
  useEffect(() => {
    if (tenant?.branding) {
      const root = document.documentElement;
      const b = tenant.branding;
      if (b.primaryColor) root.style.setProperty('--color-primary', b.primaryColor);
      if (b.secondaryColor) root.style.setProperty('--color-secondary', b.secondaryColor);
      if (b.accentColor) root.style.setProperty('--color-accent', b.accentColor);
      if (b.backgroundColor) root.style.setProperty('--color-background', b.backgroundColor);
    }
    return () => {
      // Reset on unmount (could store defaults and restore)
    };
  }, [tenant?.branding]);

  if (isLoading) {
    return <Loading label="Loading storefront..." />;
  }

  if (error || !tenant) {
    return (
      <Container className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Storefront Not Found</h1>
        <p className="mt-2 text-gray-600">The business you're looking for doesn't exist or is no longer active.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          Return to MaconAI
        </Link>
      </Container>
    );
  }

  // Wait for API key to be set before rendering children
  if (!apiKeySet) {
    return <Loading label="Setting up..." />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal tenant header */}
      <header className="border-b border-gray-200 bg-white">
        <Container>
          <div className="flex items-center justify-between py-4">
            <Link to={`/t/${tenant.slug}`} className="text-xl font-semibold text-primary">
              {tenant.name}
            </Link>
          </div>
        </Container>
      </header>

      {/* Main content - existing storefront components */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Powered by footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <Container>
          <div className="py-6 text-center text-sm text-gray-500">
            <span>© {new Date().getFullYear()} {tenant.name}</span>
            <span className="mx-2">·</span>
            <a href="https://maconaisolutions.com" className="hover:text-primary">
              Powered by MaconAI
            </a>
          </div>
        </Container>
      </footer>
    </div>
  );
}
```

### 1.3 Frontend: Add Routes

**File:** `client/src/router.tsx` (add to existing)

```typescript
// Import at top
const TenantStorefrontLayout = lazy(() =>
  import("./app/TenantStorefrontLayout").then(m => ({ default: m.TenantStorefrontLayout }))
);

// Add new route group (before the AppShell routes)
{
  path: "t/:tenantSlug",
  element: <SuspenseWrapper><TenantStorefrontLayout /></SuspenseWrapper>,
  children: [
    { index: true, element: <SuspenseWrapper><StorefrontHome /></SuspenseWrapper> },
    { path: "s/:slug", element: <SuspenseWrapper><SegmentTiers /></SuspenseWrapper> },
    { path: "s/:slug/:tier", element: <SuspenseWrapper><SegmentTierDetail /></SuspenseWrapper> },
    { path: "tiers", element: <SuspenseWrapper><RootTiers /></SuspenseWrapper> },
    { path: "tiers/:tier", element: <SuspenseWrapper><RootTierDetail /></SuspenseWrapper> },
    { path: "book", element: <SuspenseWrapper><AppointmentBookingPage /></SuspenseWrapper> },
  ],
},
```

---

## Security Controls

> **Review Feedback:** Security reviewer identified critical gaps. Addressed below.

### 1. TenantPublicDto Field Allowlist (BLOCKING)

**NEVER expose in public endpoint:**

- `apiKeySecret` (sk*live*\*) - Would allow write operations
- `stripeAccountId` - Financial data
- `encryptedSecrets` - Internal secrets
- `email`, `adminEmail` - PII
- `commissionPercent` - Business sensitive

**SAFE to expose:**

- `id`, `slug`, `name` - Public identifiers
- `apiKeyPublic` (pk*live*\*) - Read-only API key
- `branding` - Visual customization only

### 2. Rate Limiting on Tenant Lookup

```typescript
// server/src/routes/index.ts
import rateLimit from 'express-rate-limit';

const publicTenantLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
});

app.use('/v1/public/tenants', publicTenantLookupLimiter);
```

### 3. Cache Key Isolation

```typescript
// Client-side query key includes tenant slug (already done above)
queryKey: ['tenant-public', tenantSlug],  // ✅ Isolated

// Server-side cache (if added later) must include tenant
const cacheKey = `public:tenant:${slug}`;  // ✅ Isolated
```

### 4. Audit Logging

```typescript
// Already included in route handler
logger.info({ tenantId: tenant.id, slug: tenant.slug }, 'Public tenant lookup');
```

### 5. DNS Rebinding Protection (Future - for custom domains)

When implementing custom domains:

- Validate Host header against allowlist
- Use strict CORS for API endpoints
- Validate domain ownership before allowing custom domain

---

## Acceptance Criteria

### MVP (Phase 1)

- [ ] Customer can access `/t/little-bit-farm` and see tenant's storefront
- [ ] Storefront shows tenant's segments (if any) or tier selector
- [ ] Clicking segment navigates to `/t/little-bit-farm/s/wellness-retreat`
- [ ] Clicking tier navigates to detail page with booking CTA
- [ ] Tenant branding (colors, logo) applied throughout
- [ ] "Powered by MaconAI" link in footer
- [ ] 404 page shown for invalid tenant slugs
- [ ] Rate limiting on tenant lookup endpoint

### Security Requirements

- [ ] TenantPublicDto contains ONLY allowlisted fields
- [ ] No cross-tenant data leakage
- [ ] Rate limiting active on public endpoint
- [ ] Audit logging for tenant lookups

---

## Files to Create/Modify

### New Files

| File                                        | Lines | Purpose                       |
| ------------------------------------------- | ----- | ----------------------------- |
| `client/src/app/TenantStorefrontLayout.tsx` | ~80   | Layout with tenant resolution |
| `server/src/routes/public.routes.ts`        | ~40   | Public tenant lookup endpoint |

### Modified Files

| File                               | Changes                                       |
| ---------------------------------- | --------------------------------------------- |
| `client/src/router.tsx`            | Add `/t/:tenantSlug/*` routes (~15 lines)     |
| `packages/contracts/src/api.v1.ts` | Add `getTenantPublic` contract (~10 lines)    |
| `packages/contracts/src/dto.ts`    | Add `TenantPublicDtoSchema` (~15 lines)       |
| `server/src/routes/index.ts`       | Mount public routes + rate limiter (~5 lines) |

**Total new code:** ~165 lines

---

## Deferred to Future

> These were in the original plan but should be separate tickets:

1. **Phase 3: Custom Domains** - DNS/Vercel routing, domain resolution middleware
2. **Phase 4: Landing Customization** - storefrontConfig field, admin UI, segment ordering
3. **Tenant header/footer customization** - Logo upload, nav links
4. **SEO meta tags** - Dynamic page titles, OpenGraph

---

## Testing Strategy

### Unit Tests

- `TenantStorefrontLayout` renders loading, error, and success states
- API key is set/cleared correctly on mount/unmount

### Integration Tests

- `GET /v1/public/tenants/:slug` returns correct fields
- Invalid slug returns 404
- Rate limiting blocks excessive requests

### E2E Tests

- Full journey: `/t/slug` → segment → tier → booking
- Invalid tenant slug shows error page
- Branding colors applied correctly

---

## Estimated Effort

| Task                        | Time         |
| --------------------------- | ------------ |
| Backend endpoint + contract | 30 min       |
| TenantStorefrontLayout      | 30 min       |
| Router updates              | 15 min       |
| Rate limiting               | 10 min       |
| Testing                     | 30 min       |
| **Total**                   | **~2 hours** |

---

## Review Feedback Summary

### DHH-style Reviewer

- ✅ Simplified from 11 hours to ~2 hours
- ✅ Removed unnecessary TenantStorefrontContext (useBranding pattern reused)
- ✅ Removed separate header/footer components (inline in layout)
- ✅ Deferred custom domains and landing customization

### Security Reviewer

- ✅ Explicit TenantPublicDto allowlist defined
- ✅ Rate limiting on public endpoint
- ✅ Cache key isolation documented
- ✅ Audit logging included
- ⏸️ DNS rebinding - deferred to custom domains phase

### Code Simplicity Reviewer

- ✅ Single new component (~80 lines)
- ✅ Reuses existing StorefrontHome, SegmentTiers, etc.
- ✅ No new context needed
- ✅ ~165 lines total vs ~400 in original plan

---

## References

### Internal

- `client/src/router.tsx` - Current routing structure
- `client/src/hooks/useBranding.ts` - Existing branding hook (pattern reference)
- `server/src/middleware/tenant.ts` - Existing tenant resolution
- `client/src/lib/api.ts` - API client with `setTenantKey()`

### External

- [React Router Nested Routes](https://reactrouter.com/en/main/start/tutorial#nested-routes)
