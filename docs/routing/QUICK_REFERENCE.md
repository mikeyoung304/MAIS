# Multi-Tenant Routing: Quick Reference Cheat Sheet

One-page reference for the most common patterns and code snippets.

## Router Structure

```typescript
// Path-based routing pattern
/t/:tenantSlug                    → TenantLayout
  /                               → TenantHome
  /packages                       → TenantCatalog
  /s/:segmentSlug                 → SegmentLanding
  /s/:segmentSlug/p/:packageSlug  → PackageDetail
```

## Route Definition

```typescript
import { createBrowserRouter } from 'react-router-dom';
import { tenantLoader } from './loaders/tenantLoader';
import { TenantLayout } from './app/TenantLayout';

export const router = createBrowserRouter([
  {
    path: '/t/:tenantSlug',
    loader: tenantLoader,
    element: <TenantLayout />,
    errorElement: <TenantErrorBoundary />,
    children: [
      {
        index: true,
        element: <TenantHome />,
      },
      // More routes here
    ],
  },
]);
```

## Access Tenant Slug

```typescript
// In components
import { useParams } from 'react-router-dom';
const { tenantSlug } = useParams<{ tenantSlug: string }>();

// Or use context
import { useTenantSlug } from '../contexts/TenantContext';
const tenantSlug = useTenantSlug();
```

## Get Pre-Loaded Data

```typescript
import { useLoaderData } from 'react-router-dom';
import type { TenantLoadedData } from '../loaders/tenantLoader';

function MyComponent() {
  const { config, slug } = useLoaderData() as TenantLoadedData;
  return <h1>{config.name}</h1>;
}
```

## Context: Access Tenant Data

```typescript
import { useTenant } from '../contexts/TenantContext';

function MyComponent() {
  const { config, slug } = useTenant();
  return <h1>{config.name}</h1>;
}
```

## Query with Tenant Isolation

```typescript
import { useTenantQuery } from '../hooks/useTenantQuery';

function MyComponent() {
  const { data: packages } = useTenantQuery(
    'packages',
    ['list'],
    () => api.catalog.getPackages()
  );

  return <PackageList packages={packages} />;
}
```

## Navigate Type-Safely

```typescript
import { useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';

function MyComponent() {
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();

  return (
    <button onClick={() => navigate(routes.tenantPackages(tenantSlug))}>
      View Packages
    </button>
  );
}
```

## Create a Loader

```typescript
// loaders/tenantLoader.ts
export async function tenantLoader({ params }) {
  const { tenantSlug } = params;

  if (!tenantSlug) {
    throw new Response('Invalid tenant slug', { status: 400 });
  }

  const { status, body } = await api.public.getTenantConfig({
    params: { slug: tenantSlug },
  });

  if (status === 404) {
    throw new Response('Tenant not found', { status: 404 });
  }

  return { config: body, slug: tenantSlug };
}
```

## Create Context Provider

```typescript
import { createContext, useContext } from 'react';

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ config, slug, children }) {
  return (
    <TenantContext.Provider value={{ config, slug }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be inside provider');
  return context;
}
```

## Apply Dynamic Branding

```typescript
import { useTenant } from '../contexts/TenantContext';

export function TenantBrandingProvider({ children }) {
  const { config } = useTenant();

  useEffect(() => {
    const root = document.documentElement;
    if (config?.branding?.primaryColor) {
      root.style.setProperty('--color-primary', config.branding.primaryColor);
    }
    document.title = `${config?.name} - MAIS`;
  }, [config]);

  return children;
}
```

## Use CSS Variables in Tailwind

```css
/* index.css */
:root {
  --color-primary: #1a365d;
  --color-secondary: #d97706;
}

/* Tailwind automatically supports */
/* Use: className="bg-[var(--color-primary)]" */
```

## Deploy to Vercel

```json
// vercel.json
{
  "rewrites": [
    { "source": "/t/:tenantSlug/:path(.*)", "destination": "/t/:tenantSlug/:path" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Handle Errors

```typescript
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

export function TenantErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <div>Tenant not found</div>;
    }
  }

  return <div>Error loading page</div>;
}
```

## Type Definitions

```typescript
// types/tenant.ts
export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  description?: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
  };
}

export interface TenantLoadedData {
  config: TenantConfig;
  slug: string;
}
```

## Common Cache Keys

```typescript
// Always include tenant slug
['tenant', tenantSlug, 'packages'][('tenant', tenantSlug, 'segment', segmentSlug)][
  ('tenant', tenantSlug, 'availability', startDate, endDate)
];

// NOT: ['packages'] or ['segment', slug]
```

## Update API Client

```typescript
// lib/api.ts
let currentTenantSlug: string | null = null;

export const api = initClient(Contracts, {
  api: async ({ path, method, headers, body }) => {
    const requestHeaders = { ...headers };

    if (currentTenantSlug) {
      requestHeaders['X-Tenant-Slug'] = currentTenantSlug;
    }

    return fetch(path, { method, headers: requestHeaders, body });
  },
});

export function setTenantSlug(slug: string | null) {
  currentTenantSlug = slug;
}
```

## Set Tenant in Layout

```typescript
// app/TenantLayout.tsx
import { useLoaderData, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { setTenantSlug } from '../lib/api';

export function TenantLayout() {
  const { config, slug } = useLoaderData();

  useEffect(() => {
    setTenantSlug(slug);
    return () => setTenantSlug(null);
  }, [slug]);

  return (
    <TenantProvider config={config} slug={slug}>
      <Outlet />
    </TenantProvider>
  );
}
```

## Navigation Utilities

```typescript
// lib/routes.ts
export const routes = {
  tenantHome: (slug) => `/t/${slug}`,
  tenantPackages: (slug) => `/t/${slug}/packages`,
  tenantSegment: (slug, segment) => `/t/${slug}/s/${segment}`,
  tenantPackageDetail: (slug, segment, pkg) => `/t/${slug}/s/${segment}/p/${pkg}`,
} as const;

// Usage
navigate(routes.tenantPackages(tenantSlug));
```

## Common Mistakes

```typescript
// ❌ WRONG: Query key without tenant
useQuery(['packages'], fetchFn);

// ✅ RIGHT: Tenant in key
useQuery(['tenant', tenantSlug, 'packages'], fetchFn);

// ❌ WRONG: No tenant header
fetch(`/api/packages`);

// ✅ RIGHT: Include tenant header
fetch(`/api/packages`, {
  headers: { 'X-Tenant-Slug': tenantSlug },
});

// ❌ WRONG: Global cache without isolation
const cache = { packages: [...] };

// ✅ RIGHT: Tenant-scoped cache
const cache = { [tenantSlug]: { packages: [...] } };
```

## Vercel Subdomain Setup (Optional)

```bash
# Add DNS wildcard record pointing to Vercel
# In Route53 or Cloudflare:
# *.app.com → vercel nameservers

# Update vercel.json
{
  "rewrites": [
    {
      "source": "/:path(.*)",
      "destination": "/t/:tenantSlug/:path",
      "has": [
        { "type": "host", "value": "(?<tenantSlug>[^.]+)\\.app\\.com" }
      ]
    }
  ]
}
```

## Implementation Checklist

- [ ] Add `/t/:tenantSlug` routes to router
- [ ] Create `tenantLoader` function
- [ ] Create `TenantLayout` component
- [ ] Create `TenantContext` and provider
- [ ] Update API client with tenant slug injection
- [ ] Create `useTenantQuery` hook
- [ ] Create navigation utilities in `routes.ts`
- [ ] Add error boundary for tenant routes
- [ ] Update `vercel.json` with rewrites
- [ ] Test locally at `/t/demo-tenant`
- [ ] Deploy to Vercel
- [ ] Test in production

## Testing URL Patterns

```
Development:
  http://localhost:5173/t/demo-tenant
  http://localhost:5173/t/demo-tenant/packages

Vercel Preview:
  https://project.vercel.app/t/demo-tenant

Vercel Production (path):
  https://app.com/t/demo-tenant

Vercel Production (subdomain):
  https://demo-tenant.app.com
```

## Performance Tips

1. Use loaders for critical data
2. Cache tenant config 15 minutes
3. Include tenantSlug in all query keys
4. Lazy load route components
5. Memoize expensive components
6. Prefetch routes on hover
7. Use Vercel image optimization for logos

## Debugging

```typescript
// Log current tenant
console.log('Current tenant:', tenantSlug);

// Log loader data
const data = useLoaderData();
console.log('Loader data:', data);

// Check context
const { config } = useTenant();
console.log('Tenant config:', config);

// Verify API headers
// Open DevTools Network tab, check request headers for X-Tenant-Slug
```

---

For detailed explanations, see the full documentation in the `routing/` directory.
