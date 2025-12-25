# Multi-Tenant Routing: Implementation Examples

Practical, copy-paste ready code examples for implementing tenant-scoped routing in your MAIS application.

## 1. Complete Router Setup

```typescript
// client/src/router.tsx - Updated with tenant routes
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppShell } from './app/AppShell';
import { Loading } from './ui/Loading';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { tenantLoader, segmentLoader } from './loaders/tenantLoader';
import { TenantErrorBoundary } from './pages/TenantErrorBoundary';
import type { UserRole } from './contexts/AuthContext';

// Lazy load pages
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const TenantHome = lazy(() => import('./pages/tenant/TenantHome').then(m => ({ default: m.TenantHome })));
const TenantCatalog = lazy(() => import('./pages/tenant/TenantCatalog').then(m => ({ default: m.TenantCatalog })));
const SegmentLanding = lazy(() => import('./pages/SegmentLanding').then(m => ({ default: m.SegmentLanding })));
const PackageDetail = lazy(() => import('./pages/PackageDetail').then(m => ({ default: m.PackageDetail })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const PlatformAdminDashboard = lazy(() => import('./pages/admin/PlatformAdminDashboard').then(m => ({ default: m.PlatformAdminDashboard })));
const TenantAdminDashboard = lazy(() => import('./pages/tenant/TenantAdminDashboard').then(m => ({ default: m.TenantAdminDashboard })));

// Wrapper with Suspense
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading label="Loading page" />}>{children}</Suspense>
);

// Protected route wrapper
const ProtectedSuspenseWrapper = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}) => (
  <Suspense fallback={<Loading label="Loading page" />}>
    <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>
  </Suspense>
);

export const router = createBrowserRouter([
  // Main public shell with home page
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <SuspenseWrapper><Home /></SuspenseWrapper>,
      },
      {
        path: 'login',
        element: <SuspenseWrapper><Login /></SuspenseWrapper>,
      },
      // Legacy routes - redirect to tenant path
      {
        path: 'admin/login',
        element: <Navigate to="/login" replace />,
      },
    ],
  },

  // TENANT STOREFRONT ROUTES - New path-based routing
  {
    path: '/t/:tenantSlug',
    loader: tenantLoader,
    errorElement: <TenantErrorBoundary />,
    lazy: () =>
      import('./app/TenantLayout').then(m => ({
        Component: m.TenantLayout,
      })),
    children: [
      {
        index: true,
        element: <SuspenseWrapper><TenantHome /></SuspenseWrapper>,
      },
      {
        path: 'packages',
        element: <SuspenseWrapper><TenantCatalog /></SuspenseWrapper>,
      },
      {
        path: 's/:segmentSlug',
        loader: segmentLoader,
        element: <SuspenseWrapper><SegmentLanding /></SuspenseWrapper>,
        children: [
          {
            path: 'p/:packageSlug',
            element: <SuspenseWrapper><PackageDetail /></SuspenseWrapper>,
          },
        ],
      },
    ],
  },

  // ADMIN ROUTES
  {
    path: '/admin/dashboard',
    element: (
      <ProtectedSuspenseWrapper allowedRoles={['PLATFORM_ADMIN']}>
        <PlatformAdminDashboard />
      </ProtectedSuspenseWrapper>
    ),
  },

  // TENANT ADMIN ROUTES
  {
    path: '/tenant/dashboard',
    element: (
      <ProtectedSuspenseWrapper allowedRoles={['TENANT_ADMIN']}>
        <TenantAdminDashboard />
      </ProtectedSuspenseWrapper>
    ),
  },
]);
```

## 2. Route Loaders

```typescript
// client/src/loaders/tenantLoader.ts
import { redirect } from 'react-router-dom';
import { api } from '../lib/api';
import type { TenantConfig } from '../types/tenant';

export interface TenantLoadedData {
  config: TenantConfig;
  slug: string;
}

/**
 * Loader for tenant routes
 * Validates tenant exists before rendering
 */
export async function tenantLoader({ params }): Promise<TenantLoadedData> {
  const { tenantSlug } = params;

  if (!tenantSlug) {
    throw new Response('Invalid tenant slug', { status: 400 });
  }

  try {
    // Fetch tenant config
    const { status, body } = await api.public.getTenantConfig({
      params: { slug: tenantSlug },
    });

    if (status === 404) {
      throw new Response('Tenant not found', { status: 404 });
    }

    if (status !== 200 || !body) {
      throw new Error('Failed to load tenant');
    }

    return {
      config: body,
      slug: tenantSlug,
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    throw new Response('Error loading tenant', { status: 500 });
  }
}

/**
 * Loader for segment routes within tenant
 */
export async function segmentLoader({ params }) {
  const { tenantSlug, segmentSlug } = params;

  if (!tenantSlug || !segmentSlug) {
    throw new Response('Invalid parameters', { status: 400 });
  }

  try {
    const { status, body } = await api.public.getSegmentConfig({
      params: { tenantSlug, segmentSlug },
    });

    if (status === 404) {
      throw new Response('Segment not found', { status: 404 });
    }

    if (status !== 200 || !body) {
      throw new Error('Failed to load segment');
    }

    return {
      segment: body,
      tenantSlug,
      segmentSlug,
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    throw new Response('Error loading segment', { status: 500 });
  }
}
```

## 3. Tenant Layout Component

```typescript
// client/src/app/TenantLayout.tsx
import { Outlet, useLoaderData } from 'react-router-dom';
import { useEffect } from 'react';
import { TenantProvider } from '../contexts/TenantContext';
import { TenantBrandingProvider } from '../contexts/TenantBrandingContext';
import { TenantHeader } from '../components/tenant/TenantHeader';
import { TenantFooter } from '../components/tenant/TenantFooter';
import { api } from '../lib/api';
import type { TenantLoadedData } from '../loaders/tenantLoader';

export function TenantLayout() {
  const { config, slug } = useLoaderData() as TenantLoadedData;

  // Update API client with current tenant context
  useEffect(() => {
    setTenantSlug(slug);
    return () => setTenantSlug(null);
  }, [slug]);

  return (
    <TenantProvider config={config} slug={slug}>
      <TenantBrandingProvider>
        <div className="tenant-layout flex flex-col min-h-screen">
          <TenantHeader />
          <main className="flex-1">
            <Outlet />
          </main>
          <TenantFooter />
        </div>
      </TenantBrandingProvider>
    </TenantProvider>
  );
}

/**
 * Export setTenantSlug function to update API client
 */
export function setTenantSlug(slug: string | null) {
  // This is called from within the layout effect
  // In your API client, you'd use this to set tenant context
  if (slug) {
    api.setTenantSlug?.(slug);
  }
}
```

## 4. Tenant Context Provider

```typescript
// client/src/contexts/TenantContext.tsx
import { createContext, useContext, ReactNode } from 'react';
import type { TenantConfig } from '../types/tenant';

interface TenantContextType {
  config: TenantConfig;
  slug: string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  config: TenantConfig;
  slug: string;
  children: ReactNode;
}

export function TenantProvider({ config, slug, children }: TenantProviderProps) {
  return (
    <TenantContext.Provider value={{ config, slug }}>
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

export function useTenantSlug() {
  const { slug } = useTenant();
  return slug;
}

export function useTenantConfig() {
  const { config } = useTenant();
  return config;
}
```

## 5. Tenant Branding Context

```typescript
// client/src/contexts/TenantBrandingContext.tsx
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

    const root = document.documentElement;

    // Apply CSS variables from tenant config
    if (config.branding?.primaryColor) {
      root.style.setProperty('--color-primary', config.branding.primaryColor);
    }

    if (config.branding?.secondaryColor) {
      root.style.setProperty('--color-secondary', config.branding.secondaryColor);
    }

    if (config.branding?.accentColor) {
      root.style.setProperty('--color-accent', config.branding.accentColor);
    }

    // Update page title
    document.title = `${config.name} - MAIS`;

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', config.description || 'MAIS');
    }

    return () => {
      // Reset CSS variables on unmount
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-secondary');
      root.style.removeProperty('--color-accent');
    };
  }, [config]);

  const value: TenantBrandingContextType = {
    applyBranding: () => {
      // Already applied in effect above
    },
    clearBranding: () => {
      const root = document.documentElement;
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-secondary');
      root.style.removeProperty('--color-accent');
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

## 6. Enhanced API Client

```typescript
// client/src/lib/api.ts - Updated with tenant slug support
import { initClient } from '@ts-rest/core';
import { Contracts } from '@macon/contracts';

let currentTenantSlug: string | null = null;

export const api = initClient(Contracts, {
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  baseHeaders: {},
  api: async ({ path, method, headers, body }) => {
    const requestHeaders: Record<string, string> = { ...headers };

    // Inject tenant slug from route context
    if (currentTenantSlug) {
      requestHeaders['X-Tenant-Slug'] = currentTenantSlug;
    }

    // Inject auth tokens
    if (path.includes('/v1/admin')) {
      const token = localStorage.getItem('adminToken');
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    if (path.includes('/v1/tenant-admin')) {
      const isImpersonating = localStorage.getItem('impersonationTenantKey');
      const token = isImpersonating
        ? localStorage.getItem('adminToken')
        : localStorage.getItem('tenantToken');
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
});

/**
 * Set current tenant slug for request context
 * Called from TenantLayout effect when slug changes
 */
export function setTenantSlug(slug: string | null) {
  currentTenantSlug = slug;
}
```

## 7. Tenant-Scoped Query Hook

```typescript
// client/src/hooks/useTenantQuery.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useTenantSlug } from '../contexts/TenantContext';

/**
 * Wrapper around useQuery that automatically includes tenant slug in cache key
 * Prevents data mixing between tenants
 */
export function useTenantQuery<TData>(
  resourceType: string,
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
) {
  const tenantSlug = useTenantSlug();

  // Include tenant slug in cache key
  const tenantQueryKey = ['tenant', tenantSlug, resourceType, ...queryKey] as const;

  return useQuery({
    queryKey: tenantQueryKey,
    queryFn,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...options,
  });
}

// Usage example
export function TenantPackageList() {
  const { data: packages, isLoading } = useTenantQuery(
    'packages',
    ['list'],
    () => api.catalog.getPackages(),
  );

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {packages?.map(pkg => (
        <PackageCard key={pkg.id} package={pkg} />
      ))}
    </div>
  );
}
```

## 8. Type-Safe Navigation Utilities

```typescript
// client/src/lib/routes.ts
import { generatePath } from 'react-router-dom';

export const routes = {
  // Public
  home: () => '/',
  login: () => '/login',

  // Tenant storefront
  tenantHome: (tenantSlug: string) =>
    generatePath('/t/:tenantSlug', { tenantSlug }),

  tenantPackages: (tenantSlug: string) =>
    generatePath('/t/:tenantSlug/packages', { tenantSlug }),

  tenantSegment: (tenantSlug: string, segmentSlug: string) =>
    generatePath('/t/:tenantSlug/s/:segmentSlug', {
      tenantSlug,
      segmentSlug,
    }),

  tenantPackageDetail: (
    tenantSlug: string,
    segmentSlug: string,
    packageSlug: string
  ) =>
    generatePath('/t/:tenantSlug/s/:segmentSlug/p/:packageSlug', {
      tenantSlug,
      segmentSlug,
      packageSlug,
    }),

  // Admin
  adminDashboard: () => '/admin/dashboard',
  tenantAdminDashboard: () => '/tenant/dashboard',
} as const;

// Usage
import { Link, useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();

  return (
    <>
      <Link to={routes.tenantPackages(tenantSlug)}>
        View Packages
      </Link>
      <button onClick={() => navigate(routes.tenantHome(tenantSlug))}>
        Go Home
      </button>
    </>
  );
}
```

## 9. Error Boundary Component

```typescript
// client/src/pages/TenantErrorBoundary.tsx
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

export function TenantErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="w-20 h-20 mx-auto text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4v2m0 4v2M7 3h10a2 2 0 012 2v2h2a2 2 0 012 2v2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h2V5a2 2 0 012-2z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Tenant Not Found
            </h1>
            <p className="text-gray-600 mb-8">
              The tenant you're looking for doesn't exist or has been removed.
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      );
    }

    if (error.status === 500) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Server Error
            </h1>
            <p className="text-gray-600 mb-2">{error.data?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Something Went Wrong
        </h1>
        <button
          onClick={() => window.location.href = '/'}
          className="inline-block px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
```

## 10. Tenant Header Component Example

```typescript
// client/src/components/tenant/TenantHeader.tsx
import { Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { useTenantSlug } from '../../contexts/TenantContext';
import { routes } from '../../lib/routes';

export function TenantHeader() {
  const { config } = useTenant();
  const tenantSlug = useTenantSlug();

  return (
    <header className="border-b border-gray-200">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to={routes.tenantHome(tenantSlug)} className="flex items-center">
            {config.branding?.logoUrl ? (
              <img
                src={config.branding.logoUrl}
                alt={config.name}
                className="h-10"
              />
            ) : (
              <h1 className="text-2xl font-bold text-[var(--color-primary)]">
                {config.name}
              </h1>
            )}
          </Link>

          {/* Navigation */}
          <nav className="flex gap-6">
            <Link
              to={routes.tenantHome(tenantSlug)}
              className="text-gray-700 hover:text-[var(--color-primary)]"
            >
              Home
            </Link>
            <Link
              to={routes.tenantPackages(tenantSlug)}
              className="text-gray-700 hover:text-[var(--color-primary)]"
            >
              Services
            </Link>
          </nav>

          {/* CTA Button */}
          <button className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition">
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
}
```

## 11. Updated vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "npm ci --workspaces --include-workspace-root",
  "buildCommand": "npm run build --workspace=@macon/contracts && npm run build --workspace=@macon/shared && npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist",
  "rewrites": [
    {
      "source": "/t/:tenantSlug/:path(.*)",
      "destination": "/t/:tenantSlug/:path"
    },
    {
      "source": "/admin/:path(.*)",
      "destination": "/admin/:path"
    },
    {
      "source": "/tenant/:path(.*)",
      "destination": "/tenant/:path"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/t/:tenantSlug/:path(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, must-revalidate"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ]
}
```

## 12. Types Definition

```typescript
// client/src/types/tenant.ts
export interface TenantBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  logoUrl?: string;
  fontFamily?: string;
}

export interface TenantSettings {
  bookingEnabled: boolean;
  catalogPublic: boolean;
  requiresAuth: boolean;
}

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  description?: string;
  branding: TenantBranding;
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSegment {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string;
  heroImage?: string;
  order: number;
}
```

## Implementation Checklist

- [ ] Create `loaders/tenantLoader.ts` with tenant and segment loaders
- [ ] Update `router.tsx` with `/t/:tenantSlug` routes
- [ ] Create `TenantLayout` component in `app/TenantLayout.tsx`
- [ ] Create `TenantContext` in `contexts/TenantContext.tsx`
- [ ] Create `TenantBrandingContext` in `contexts/TenantBrandingContext.tsx`
- [ ] Update API client in `lib/api.ts` with `setTenantSlug()` function
- [ ] Create `useTenantQuery()` hook in `hooks/useTenantQuery.ts`
- [ ] Create route utilities in `lib/routes.ts`
- [ ] Create `TenantErrorBoundary` in `pages/TenantErrorBoundary.tsx`
- [ ] Create `TenantHeader` and `TenantFooter` components
- [ ] Update `vercel.json` with tenant path rewrites
- [ ] Add type definitions to `types/tenant.ts`
- [ ] Test locally at `http://localhost:5173/t/demo-tenant`
- [ ] Deploy to Vercel preview
- [ ] Test in production

## Testing Tenant Routing Locally

```bash
# Terminal 1: Start API server
ADAPTERS_PRESET=mock npm run dev:api

# Terminal 2: Start React dev server
npm run dev:client

# Visit: http://localhost:5173/t/demo-tenant
```

This implementation provides a solid foundation for multi-tenant routing in MAIS while maintaining type safety and performance.
