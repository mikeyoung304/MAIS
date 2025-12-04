# Tenant-Scoped Routing Framework Documentation

## Overview

This guide covers implementing tenant-scoped routing in a React + Vite + Vercel stack with a modular monolith architecture. The system provides complete tenant isolation at the URL level while maintaining type-safe API communication.

## Architecture Patterns

### 1. React Router with Dynamic Route Parameters

#### Pattern: Nested Routes with Tenant Context

```typescript
// router.tsx - Example implementation
import { createBrowserRouter } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

/**
 * Tenant-scoped routes structure:
 * /t/:tenantSlug/* - All tenant-specific routes
 * /s/:segmentSlug/* - Segment storefront routes (if cross-tenant)
 * /book/:tenantSlug - Tenant booking page
 * /admin/* - Platform admin (no tenant context)
 * /tenant/* - Tenant admin dashboard (JWT authenticated)
 */

// Layout component that provides tenant context to children
function TenantLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenantConfig, isLoading } = useTenantConfig(tenantSlug);

  return (
    <TenantProvider config={tenantConfig}>
      <Outlet />
    </TenantProvider>
  );
}

export const router = createBrowserRouter([
  // Tenant storefront routes - most specific paths first
  {
    path: '/t/:tenantSlug',
    element: <TenantLayout />,
    children: [
      {
        index: true,
        element: <TenantHome />,
      },
      {
        path: 'packages',
        element: <TenantPackageCatalog />,
      },
      {
        path: 'book/:packageSlug',
        element: <BookingFlow />,
      },
      {
        path: 's/:segmentSlug',
        element: <SegmentLanding />,
      },
      {
        path: 's/:segmentSlug/p/:packageSlug',
        element: <PackageDetail />,
      },
    ],
  },

  // Segment storefront (cross-tenant)
  {
    path: '/s/:segmentSlug',
    element: <SegmentLayout />,
    children: [
      {
        index: true,
        element: <SegmentHome />,
      },
      {
        path: 'tiers',
        element: <SegmentTiers />,
      },
    ],
  },

  // Public booking (without tenant context)
  {
    path: '/book',
    element: <PublicBookingPage />,
  },

  // Platform admin routes (JWT only, no tenant context)
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        path: 'dashboard',
        element: <PlatformAdminDashboard />,
      },
    ],
  },

  // Tenant admin dashboard (JWT authenticated)
  {
    path: '/tenant',
    element: <TenantAdminLayout />,
    children: [
      {
        path: 'dashboard',
        element: <TenantAdminDashboard />,
      },
    ],
  },

  // Legacy public routes
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'login',
        element: <Login />,
      },
    ],
  },
]);
```

#### Hook: Access Route Parameters

```typescript
// hooks/useTenantFromRoute.ts
import { useParams } from 'react-router-dom';

export function useTenantFromRoute() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!tenantSlug) {
    throw new Error('tenantSlug param is required for this route');
  }

  return tenantSlug;
}

// Usage in component
function MyComponent() {
  const tenantSlug = useTenantFromRoute();
  return <div>Tenant: {tenantSlug}</div>;
}
```

### 2. Tenant Context Provider Pattern

#### Pattern: Provide Tenant Data to Component Tree

```typescript
// contexts/TenantContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { TenantConfig } from '../types/tenant';

interface TenantContextType {
  config: TenantConfig | null;
  slug: string;
  isLoading: boolean;
  error: Error | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  slug: string;
  children: ReactNode;
}

export function TenantProvider({ slug, children }: TenantProviderProps) {
  // Fetch tenant config by slug
  const { data, isLoading, error } = useQuery({
    queryKey: ['tenant', slug],
    queryFn: async () => {
      const { status, body } = await api.public.getTenantConfig({
        params: { slug },
      });
      if (status !== 200) throw new Error('Failed to load tenant');
      return body;
    },
    staleTime: 15 * 60 * 1000, // Cache for 15 minutes
  });

  const value: TenantContextType = {
    config: data || null,
    slug,
    isLoading,
    error: error instanceof Error ? error : null,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}
```

#### Layout Component: Set API Context

```typescript
// app/TenantLayout.tsx
import { useParams, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { TenantProvider } from '../contexts/TenantContext';
import { Loading } from '../ui/Loading';

export function TenantLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!tenantSlug) {
    return <div>Invalid tenant URL</div>;
  }

  return (
    <TenantProvider slug={tenantSlug}>
      <TenantLayoutContent />
    </TenantProvider>
  );
}

function TenantLayoutContent() {
  const { config, slug, isLoading, error } = useTenant();

  if (isLoading) {
    return <Loading label="Loading tenant config" />;
  }

  if (error) {
    return <div>Error loading tenant: {error.message}</div>;
  }

  if (!config) {
    return <div>Tenant not found</div>;
  }

  return <Outlet />;
}
```

### 3. Tenant-Aware API Client Configuration

#### Pattern: Route-Based Tenant Header Injection

The existing API client in `/client/src/lib/api.ts` uses a global pattern. For tenant-scoped routing, enhance it:

```typescript
// lib/api.ts - Enhanced for tenant-scoped routing
import { initClient } from '@ts-rest/core';
import { Contracts } from '@macon/contracts';

let currentTenantSlug: string | null = null;

export const api = initClient(Contracts, {
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  api: async ({ path, method, headers, body }) => {
    const requestHeaders: Record<string, string> = { ...headers };

    // Inject tenant context from route
    if (currentTenantSlug) {
      requestHeaders['X-Tenant-Slug'] = currentTenantSlug;
    }

    // Inject auth tokens (existing pattern)
    if (path.includes('/v1/admin')) {
      const token = localStorage.getItem('adminToken');
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(path, {
      method,
      headers: requestHeaders,
      body,
    });

    return {
      status: response.status,
      body: await response.json().catch(() => null),
      headers: response.headers,
    };
  },
}) as ExtendedApiClient;

/**
 * Set the current tenant slug for route context
 * Call this in TenantLayout effect when slug changes
 */
export function setTenantSlug(slug: string | null) {
  currentTenantSlug = slug;
}
```

#### Hook: Use Tenant-Scoped Queries

```typescript
// hooks/useTenantQuery.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useTenant } from '../contexts/TenantContext';

/**
 * Wrapper around useQuery that automatically includes tenant slug in cache key
 */
export function useTenantQuery<TData>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
) {
  const { slug } = useTenant();

  // Include tenant slug in cache key to prevent data mixing
  const tenantQueryKey = ['tenant', slug, ...queryKey] as const;

  return useQuery({
    queryKey: tenantQueryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes default
    ...options,
  });
}

// Usage
function TenantPackageList() {
  const { config } = useTenant();

  const { data: packages } = useTenantQuery(
    ['packages'],
    () => api.catalog.getPackages(),
    { enabled: !!config }
  );

  return <PackageGrid packages={packages} />;
}
```

### 4. Theme/Branding Application

#### Pattern: Dynamic CSS Variables

```typescript
// contexts/TenantBrandingContext.tsx
import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useTenant } from './TenantContext';

interface TenantBrandingContextType {
  applyBranding: () => void;
  clearBranding: () => void;
}

const BrandingContext = createContext<TenantBrandingContextType | undefined>(undefined);

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const { config } = useTenant();

  useEffect(() => {
    if (!config) return;

    // Apply tenant-specific CSS variables
    const root = document.documentElement;

    // Brand colors
    if (config.branding?.primaryColor) {
      root.style.setProperty('--color-primary', config.branding.primaryColor);
    }

    if (config.branding?.secondaryColor) {
      root.style.setProperty('--color-secondary', config.branding.secondaryColor);
    }

    // Font family
    if (config.branding?.fontFamily) {
      root.style.setProperty('--font-family', config.branding.fontFamily);
    }

    // Logo URL
    if (config.branding?.logoUrl) {
      root.style.setProperty('--logo-url', `url(${config.branding.logoUrl})`);
    }

    return () => {
      // Reset on unmount
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-secondary');
      root.style.removeProperty('--font-family');
      root.style.removeProperty('--logo-url');
    };
  }, [config]);

  const value: TenantBrandingContextType = {
    applyBranding: () => {
      // Manual apply if needed
    },
    clearBranding: () => {
      document.documentElement.style.removeProperty('--color-primary');
      document.documentElement.style.removeProperty('--color-secondary');
    },
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useTenantBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useTenantBranding must be used within TenantBrandingProvider');
  }
  return context;
}
```

#### Tailwind Configuration with CSS Variables

```css
/* index.css */
:root {
  --color-primary: #1a365d; /* Navy - default */
  --color-secondary: #d97706; /* Orange */
  --color-accent: #0d9488; /* Teal */
  --font-family: 'Inter', sans-serif;
}

/* Tailwind can use CSS variables */
@layer components {
  .btn-primary {
    @apply px-4 py-2 rounded bg-[var(--color-primary)] text-white;
  }

  .btn-secondary {
    @apply px-4 py-2 rounded bg-[var(--color-secondary)] text-white;
  }
}
```

#### Tailwind Config with Dynamic Colors

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
      },
      fontFamily: {
        sans: 'var(--font-family)',
      },
    },
  },
};
```

### 5. Vercel Configuration for Multi-Tenant Routing

#### Rewrites for Subdomain/Path-Based Routing

```json
// vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist",
  "rewrites": [
    // Tenant storefront - subdomain or path-based
    // Option 1: Subdomain routing
    // { "source": "/:path((?!api|admin|widget).*)", "destination": "/t/:path" }

    // Option 2: Path-based routing (simpler for MVP)
    { "source": "/t/:tenantSlug/:path(.*)", "destination": "/t/:tenantSlug/:path" },
    { "source": "/s/:segmentSlug/:path(.*)", "destination": "/s/:segmentSlug/:path" },

    // Catch-all for SPA routing
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/t/:tenantSlug/:path(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, must-revalidate" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

#### Subdomain Routing Alternative

For subdomain-based tenants (`tenant-slug.app.com`):

```json
{
  "rewrites": [
    {
      "source": "/:path(.*)",
      "destination": "/t/:tenantSlug/:path",
      "has": [
        {
          "type": "host",
          "value": "(?<tenantSlug>[^.]+)\\.app\\.com"
        }
      ]
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Note:** Subdomain routing requires DNS wildcard configuration (`*.app.com`).

## Implementation Guide

### Phase 1: Add Route Structure

1. Update router to include tenant-scoped paths:

```typescript
{
  path: '/t/:tenantSlug',
  element: <TenantLayout />,
  children: [ /* tenant routes */ ]
}
```

2. Create `TenantLayout` component that extracts `tenantSlug` param
3. Add URL navigation utilities

### Phase 2: Create Tenant Context

1. Create `TenantContext` and `TenantProvider`
2. Implement `getTenantConfig` endpoint on backend
3. Add `useTenant()` hook for component access

### Phase 3: Update API Client

1. Add `setTenantSlug()` function to API client
2. Update request headers to inject tenant context
3. Update query key patterns to include tenant

### Phase 4: Apply Branding

1. Create `TenantBrandingContext`
2. Inject CSS variables from tenant config
3. Update Tailwind to use variables

### Phase 5: Deploy to Vercel

1. Update `vercel.json` with rewrites
2. Test path-based routing in preview deployment
3. Configure custom domains if needed

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
    accentColor: string;
    logoUrl?: string;
    fontFamily: string;
  };
  settings: {
    bookingEnabled: boolean;
    catalogPublic: boolean;
    requiresAuth: boolean;
  };
}

export interface TenantSegment {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string;
  heroImage?: string;
}

export interface TenantRouteParams {
  tenantSlug: string;
  segmentSlug?: string;
  packageSlug?: string;
}
```

## Isolation Patterns

### Cache Key Strategy

```typescript
// Always include tenant slug in cache keys
const cacheKey = ['tenant', tenantSlug, 'packages'] as const;
const segmentKey = ['tenant', tenantSlug, 'segment', segmentSlug] as const;
```

### Query Invalidation on Route Change

```typescript
// hooks/useTenantRouteEffect.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../contexts/TenantContext';

export function useTenantRouteEffect() {
  const queryClient = useQueryClient();
  const { slug } = useTenant();

  useEffect(() => {
    // Clear all queries for previous tenant to prevent data mixing
    return () => {
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key === 'tenant';
        },
      });
    };
  }, [slug, queryClient]);
}
```

### API Error Handling

```typescript
// Ensure 404 errors for invalid tenant slugs
if (tenantNotFound) {
  return <TenantNotFound />;
}
```

## SEO Considerations

### Meta Tags for Tenant Pages

```typescript
// hooks/useTenantMeta.ts
import { useEffect } from 'react';
import { useTenant } from '../contexts/TenantContext';

export function useTenantMeta() {
  const { config } = useTenant();

  useEffect(() => {
    if (!config) return;

    document.title = `${config.name} - MAIS`;

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', config.description || '');
    }
  }, [config]);
}
```

## Performance Optimizations

### 1. Route-Based Code Splitting

```typescript
const TenantHome = lazy(() =>
  import('../pages/tenant/TenantHome').then((m) => ({
    default: m.TenantHome,
  }))
);
```

### 2. Prefetch Tenant Config

```typescript
// Preload tenant config before route transition
export function usePrefetchTenant(slug: string) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['tenant', slug],
      queryFn: () => api.public.getTenantConfig({ params: { slug } }),
    });
  }, [slug, queryClient]);
}
```

### 3. Image Optimization for Tenant Branding

```typescript
// components/TenantLogo.tsx
import { useTenant } from '../contexts/TenantContext';

export function TenantLogo() {
  const { config } = useTenant();

  return (
    <img
      src={config?.branding.logoUrl}
      alt={config?.name}
      loading="lazy"
      width={200}
      height={60}
    />
  );
}
```

## Error Handling

### Tenant Not Found

```typescript
// pages/TenantNotFound.tsx
export function TenantNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Tenant Not Found</h1>
      <p className="text-gray-600 mt-2">The requested tenant does not exist.</p>
      <Link to="/" className="mt-4 text-blue-600">
        Return Home
      </Link>
    </div>
  );
}
```

### Fallback Branding

```typescript
// Provide sensible defaults if tenant config fails to load
const defaultBranding = {
  primaryColor: '#1a365d',
  secondaryColor: '#d97706',
  accentColor: '#0d9488',
  fontFamily: 'Inter, sans-serif',
};
```

## Testing

### Unit Tests for Route Parameters

```typescript
// __tests__/useTenantFromRoute.test.ts
import { renderHook } from '@testing-library/react';
import { useTenantFromRoute } from '../hooks/useTenantFromRoute';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

test('should extract tenant slug from route params', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <BrowserRouter>
      <Routes>
        <Route path="/t/:tenantSlug" element={children} />
      </Routes>
    </BrowserRouter>
  );

  const { result } = renderHook(() => useTenantFromRoute(), { wrapper });
  expect(result.current).toBe('demo-tenant');
});
```

### E2E Tests for Tenant Routing

```typescript
// e2e/tenant-routing.spec.ts
import { test, expect } from '@playwright/test';

test('should load tenant-specific branding', async ({ page }) => {
  await page.goto('http://localhost:5173/t/demo-tenant');

  // Check tenant name in DOM
  const heading = page.locator('h1');
  expect(heading).toContainText('Demo Tenant');

  // Check custom CSS variable
  const logo = page.locator('[data-testid="tenant-logo"]');
  const bgColor = await logo.evaluate((el) =>
    getComputedStyle(el).getPropertyValue('--color-primary')
  );
  expect(bgColor).toBeTruthy();
});
```

## Migration Path

### From Global Tenant Key to Route-Based

**Current system:**

- Single tenant per session via `api.setTenantKey()`
- Widget embedding pattern

**New system:**

- Multiple tenants accessible via URL
- Full storefront per tenant
- Maintain backward compatibility with widget mode

**Migration steps:**

1. Keep existing `api.setTenantKey()` for widget/public mode
2. Add new route-based system for storefront
3. Both can coexist during transition
4. Eventually deprecate global tenant key approach

```typescript
// Both modes supported
export const api = {
  // Legacy: global tenant key for widgets
  setTenantKey: (key: string | null) => {
    /* ... */
  },

  // New: route-based tenant slug
  setTenantSlug: (slug: string | null) => {
    /* ... */
  },
};
```

## Summary

This framework provides:

- **Flexible routing**: Support for path-based (`/t/:slug`) or subdomain-based (`slug.app.com`) tenants
- **Type safety**: Full TypeScript support with custom hooks
- **Performance**: Code splitting, query caching with tenant isolation
- **Branding**: Dynamic theme application via CSS variables
- **Isolation**: Query keys and cache strategies prevent data leakage
- **Scalability**: Pattern works from MVP (few tenants) to scale (thousands)

Choose the routing strategy that fits your deployment model, then implement providers and hooks in order.
