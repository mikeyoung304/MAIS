# Multi-Tenant Routing Framework Documentation

Complete framework documentation for implementing tenant-scoped routing in React + Vite + Vercel for the MAIS platform.

## Overview

This documentation provides comprehensive guidance on implementing multi-tenant routing patterns for a React application using:

- **Frontend:** React 18 + React Router v7 + Vite
- **API:** Express backend with tenant isolation
- **Deployment:** Vercel with path-based, subdomain, or custom domain routing

## Document Structure

### 1. [TENANT_SCOPED_ROUTING.md](./TENANT_SCOPED_ROUTING.md) - Core Concepts

The foundation document covering:

- **React Router patterns** for nested routes with tenant params
- **Tenant Context Provider** pattern for component data sharing
- **API client configuration** with tenant header injection
- **Theme/Branding application** via CSS variables
- **Vercel configuration** for multi-tenant routing
- **Isolation patterns** to prevent data leakage
- **Performance optimizations** and code splitting strategies
- **Error handling** and fallback patterns

**Read this first** to understand the overall architecture and patterns.

### 2. [REACT_ROUTER_V7_PATTERNS.md](./REACT_ROUTER_V7_PATTERNS.md) - Framework-Specific Details

Advanced React Router v7 features:

- **Route Loaders** - Pre-load data before route renders
- **ErrorElement** - Route-level error boundaries
- **Lazy Routes** - Code splitting entire route trees
- **useLoaderData()** - Access pre-loaded data in components
- **Navigation utilities** - Type-safe routing helpers
- **Performance patterns** - Prefetching, memoization, optimization
- **Complete working example** of multi-tenant storefront router

**Read this** if you want to use React Router v7's powerful loader system to eliminate loading states and improve performance.

### 3. [VERCEL_MULTI_TENANT_DEPLOYMENT.md](./VERCEL_MULTI_TENANT_DEPLOYMENT.md) - Deployment Guide

Complete Vercel deployment strategies:

- **Path-based routing** (`/t/:slug`) - Simplest option
- **Subdomain routing** (`slug.app.com`) - Professional option
- **Custom domain routing** (`customer.com`) - White-label option
- **Hybrid strategy** - Support all three simultaneously
- **DNS configuration** examples (Route53, Cloudflare)
- **SSL/TLS** setup for custom domains
- **Security headers** and CORS configuration
- **Performance optimization** at CDN level
- **Troubleshooting** common issues
- **Monitoring** and analytics setup

**Read this** when preparing to deploy to Vercel, or if you need subdomain/custom domain support.

### 4. [IMPLEMENTATION_EXAMPLES.md](./IMPLEMENTATION_EXAMPLES.md) - Code Snippets

Production-ready code you can copy-paste:

- Complete `router.tsx` with tenant routes
- Route loaders for tenant data
- `TenantLayout` component
- Context providers (Tenant + Branding)
- Enhanced API client
- Tenant-scoped query hooks
- Navigation utilities
- Error boundary component
- Header/Footer components
- Type definitions
- Updated `vercel.json`

**Read this** when implementing features - copy-paste examples into your codebase.

## Quick Start

### Choose Your Routing Strategy

1. **Path-based (MVP):** `/t/:tenantSlug` routes
   - ✅ Works immediately, no DNS changes
   - ✅ Simplest to implement
   - ⚠️ Less white-label (shared domain)

2. **Subdomain (Recommended):** `slug.app.com`
   - ✅ Professional URLs, domain per tenant
   - ✅ Can support custom domains later
   - ⚠️ Requires DNS wildcard setup

3. **Custom domains (Enterprise):** `customer.com`
   - ✅ Full white-label experience
   - ✅ Tenant controls own domain
   - ⚠️ Most complex, requires domain management

### Implementation Path

**Phase 1: Local Development (2-3 hours)**

1. Read: `TENANT_SCOPED_ROUTING.md` (overview)
2. Read: `REACT_ROUTER_V7_PATTERNS.md` (implementation details)
3. Copy code from: `IMPLEMENTATION_EXAMPLES.md`
4. Create tenant routes locally
5. Test at: `http://localhost:5173/t/demo-tenant`

**Phase 2: Tenant Infrastructure (2-3 hours)**

1. Add tenant API endpoints (GET `/api/v1/public/tenant-config/:slug`)
2. Create `TenantContext` + providers
3. Update API client for tenant context injection
4. Test tenant data loading

**Phase 3: Branding & Theming (1-2 hours)**

1. Implement `TenantBrandingContext`
2. Add CSS variables to Tailwind
3. Apply tenant logos and colors dynamically
4. Test theme switching between tenants

**Phase 4: Deployment (1-2 hours)**

1. Read: `VERCEL_MULTI_TENANT_DEPLOYMENT.md`
2. Choose routing strategy
3. Update `vercel.json` with rewrites
4. Configure DNS (if subdomain/custom domain)
5. Deploy to Vercel preview
6. Test in production

**Total: ~6-10 hours from zero to production**

## Key Patterns

### Router Structure

```
/                           → Home page (AppShell)
/t/:tenantSlug              → Tenant storefront (TenantLayout)
/t/:tenantSlug/packages     → Package catalog
/t/:tenantSlug/s/:segment   → Segment view
/admin/*                    → Platform admin
/tenant/*                   → Tenant admin dashboard
```

### Data Flow

```
TenantLayout
├── useLoaderData() → TenantConfig (pre-loaded)
├── TenantProvider → useTenant()
├── TenantBrandingProvider → CSS variables
└── <Outlet /> → Nested routes
    ├── Component → useTenant()
    ├── Component → useTenantQuery()
    └── Component → routes.tenantPackages(slug)
```

### API Request Flow

```
Component
├── useNavigate(routes.tenantHome(slug))
├── useTenant() → tenantSlug
├── useQuery([tenant, slug, ...]) → cache key
└── api.packages.getList()
    ├── Headers include X-Tenant-Slug
    └── Response cached per tenant
```

## Cache Key Strategy

Always include tenant slug to prevent data mixing:

```typescript
// ✅ CORRECT
const key = ['tenant', tenantSlug, 'packages'] as const;

// ❌ WRONG - Data from all tenants mixed
const key = ['packages'] as const;
```

## TypeScript & Type Safety

All code examples include full TypeScript support:

```typescript
// Route params are typed
const { tenantSlug, segmentSlug } = useParams<{
  tenantSlug: string;
  segmentSlug?: string;
}>();

// Loader data is typed
const { config, slug } = useLoaderData() as TenantLoadedData;

// Routes are type-safe
navigate(routes.tenantPackages(tenantSlug));
```

## Security Checklist

- [ ] All API requests include `X-Tenant-Slug` header
- [ ] Cache keys include tenant slug
- [ ] Route loaders validate tenant exists (404 for invalid)
- [ ] CORS headers configured for tenant subdomains
- [ ] CSP headers prevent cross-tenant script injection
- [ ] Session cookies scoped to tenant domain
- [ ] Admin routes require JWT authentication
- [ ] Tenant data cleared when switching routes

## Performance Targets

- **Route load time:** <1s (with pre-loaded data from loader)
- **Tenant config fetch:** Cached 15 minutes, served from CDN
- **Bundle size:** <200KB JS (with code splitting)
- **Lighthouse score:** 90+ (with Vercel optimizations)

## Common Questions

**Q: Should I use loaders or useQuery?**
A: Use loaders for critical data (tenant config), useQuery for paginated/filtered data.

**Q: How do I handle auth across tenants?**
A: Store JWT in localStorage, include in Authorization header for admin routes.

**Q: Can I use subdomain + custom domain simultaneously?**
A: Yes! Implement hybrid strategy in `vercel.json` with multiple `has` conditions.

**Q: How do I prevent data leakage between tenants?**
A: (1) Always include tenantSlug in query cache keys, (2) Verify tenant in loaders, (3) Backend filters all queries by tenantId.

**Q: What's the SEO impact of path-based routing?**
A: Minimal - each tenant page has unique URL and can set meta tags via useEffect.

## Troubleshooting

### Routes Not Working

- Check `vercel.json` rewrites order (most specific first)
- Ensure catch-all rewrite goes last: `{ "source": "/(.*)", "destination": "/index.html" }`
- Verify React Router routes match Vercel rewrites

### Tenant Config Not Loading

- Check API endpoint: `/api/v1/public/tenant-config/:slug`
- Verify backend returns 404 for invalid slugs
- Check loader error boundary is catching errors

### Data Mixing Between Tenants

- Verify all useQuery/useQueries calls include tenant slug in key
- Check API client injects X-Tenant-Slug header
- Clear React Query cache when switching tenants

### CSS Variables Not Applying

- Check TenantBrandingContext effect is running
- Verify CSS uses `var(--color-primary)` syntax
- Check Tailwind config includes `extend.colors`

## Related Documentation

- **ARCHITECTURE.md** - System design and multi-tenant patterns
- **docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md** - Multi-tenant backend patterns
- **DECISIONS.md** - Architectural decision records

## Glossary

- **Tenant:** A business or organization using the platform (Acme Corp, Acme Corp's Admin Dashboard, etc.)
- **Tenant Slug:** URL-friendly identifier (e.g., `acme-corp`)
- **Tenant Config:** Branding, settings, and metadata for a tenant
- **Router Loader:** Function that runs before route renders to pre-load data
- **Route Parameters:** Values extracted from URL (`:tenantSlug`, `:segmentSlug`)
- **Context:** React Context API pattern for providing data to component tree
- **Query Key:** Array identifying cached data in React Query (includes tenant slug)
- **Rewrite:** Vercel configuration to map one URL path to another

## Examples

### Create Tenant Home Page

```bash
# 1. Create page file
touch client/src/pages/tenant/TenantHome.tsx

# 2. Import in router
const TenantHome = lazy(() =>
  import('./pages/tenant/TenantHome').then(m => ({ default: m.TenantHome }))
);

# 3. Add to routes
{
  path: '/t/:tenantSlug',
  element: <TenantLayout />,
  children: [
    { index: true, element: <TenantHome /> },
  ]
}

# 4. Access tenant data
import { useTenant } from '../contexts/TenantContext';
function TenantHome() {
  const { config } = useTenant();
  return <h1>{config.name}</h1>;
}
```

### Add Tenant Segment Page

```bash
# 1. Create loader and page
touch client/src/loaders/segmentLoader.ts
touch client/src/pages/tenant/SegmentLanding.tsx

# 2. Add route with loader
{
  path: 's/:segmentSlug',
  loader: segmentLoader,
  element: <SegmentLanding />
}

# 3. Access segment data
import { useLoaderData } from 'react-router-dom';
function SegmentLanding() {
  const { segment } = useLoaderData();
  return <h2>{segment.name}</h2>;
}
```

### Deploy with Subdomain Support

```bash
# 1. Update vercel.json with subdomain rule (see VERCEL_MULTI_TENANT_DEPLOYMENT.md)
# 2. Add DNS wildcard: *.app.com → Vercel
# 3. Deploy: git push origin main
# 4. Test: https://demo-tenant.app.com
```

## Support & Questions

For questions about implementing tenant routing:

1. Check **IMPLEMENTATION_EXAMPLES.md** for code samples
2. Review **REACT_ROUTER_V7_PATTERNS.md** for advanced patterns
3. Check **VERCEL_MULTI_TENANT_DEPLOYMENT.md** for deployment issues
4. Refer to **TENANT_SCOPED_ROUTING.md** for conceptual understanding

## License

These patterns and examples are part of the MAIS platform and follow the same license as the main repository.

---

**Last Updated:** November 29, 2025
**Framework Versions:** React Router 7.1.3, Vite 6.0.7, React 18.3.1
