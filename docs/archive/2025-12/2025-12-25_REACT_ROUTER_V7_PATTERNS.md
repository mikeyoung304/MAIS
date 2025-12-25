# React Router v7 + Vercel: Complete Implementation Patterns

This document covers advanced patterns specific to React Router v7, which your project currently uses (`react-router-dom@^7.1.3`).

## Key React Router v7 Features

### Route Loaders for Data Fetching

React Router v7 introduces route loaders - functions that run before rendering a route and have access to route parameters.

```typescript
// loaders/tenantLoader.ts
import { redirect } from 'react-router-dom';
import { api } from '../lib/api';
import type { TenantConfig } from '../types/tenant';

export interface TenantLoadedData {
  config: TenantConfig;
  slug: string;
}

/**
 * Loader for tenant routes
 * Runs before component renders, validates tenant exists
 */
export async function tenantLoader({ params }): Promise<TenantLoadedData> {
  const { tenantSlug } = params;

  if (!tenantSlug) {
    throw new Response('Invalid tenant slug', { status: 400 });
  }

  try {
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
    throw new Response('Error loading tenant', { status: 500 });
  }
}

/**
 * Loader for nested segment routes
 */
export async function segmentLoader({ params }) {
  const { tenantSlug, segmentSlug } = params;

  // Reuse tenant loader data with ParentRouteData
  const { status, body } = await api.public.getSegmentConfig({
    params: { tenantSlug, segmentSlug },
  });

  if (status !== 200) {
    throw new Response('Segment not found', { status: 404 });
  }

  return {
    segment: body,
    tenantSlug,
    segmentSlug,
  };
}
```

#### Using Loaders in Routes

```typescript
// router.tsx - Updated with loaders
import { createBrowserRouter } from 'react-router-dom';
import { tenantLoader, segmentLoader } from './loaders/tenantLoader';
import { TenantLayout } from './app/TenantLayout';

export const router = createBrowserRouter([
  // Tenant storefront with loader
  {
    path: '/t/:tenantSlug',
    loader: tenantLoader,
    element: <TenantLayout />,
    errorElement: <TenantErrorBoundary />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/TenantHome').then(m => ({
          Component: m.TenantHome,
        })),
      },
      {
        path: 'packages',
        lazy: () => import('./pages/TenantCatalog').then(m => ({
          Component: m.TenantCatalog,
        })),
      },
      {
        path: 's/:segmentSlug',
        loader: segmentLoader,
        lazy: () => import('./pages/SegmentLanding').then(m => ({
          Component: m.SegmentLanding,
        })),
        children: [
          {
            path: 'p/:packageSlug',
            lazy: () => import('./pages/PackageDetail').then(m => ({
              Component: m.PackageDetail,
            })),
          },
        ],
      },
    ],
  },
]);
```

### Using Loader Data in Components

React Router v7 provides `useLoaderData()` hook to access data loaded by route loaders.

```typescript
// app/TenantLayout.tsx
import { Outlet, useLoaderData } from 'react-router-dom';
import { TenantProvider } from '../contexts/TenantContext';
import type { TenantLoadedData } from '../loaders/tenantLoader';

export function TenantLayout() {
  const { config, slug } = useLoaderData() as TenantLoadedData;

  // No loading state needed - data is pre-loaded before render
  return (
    <TenantProvider config={config} slug={slug}>
      <div className="tenant-layout">
        <TenantHeader />
        <Outlet />
        <TenantFooter />
      </div>
    </TenantProvider>
  );
}

// pages/TenantHome.tsx
import { useLoaderData } from 'react-router-dom';
import type { TenantLoadedData } from '../loaders/tenantLoader';

export function TenantHome() {
  const { config } = useLoaderData() as TenantLoadedData;

  return (
    <div>
      <h1>{config.name}</h1>
      <p>{config.description}</p>
      <TenantPackageGrid />
    </div>
  );
}
```

### Lazy Route Components

React Router v7 supports lazy loading entire routes, reducing initial bundle size.

```typescript
// router.tsx - Using lazy()
const router = createBrowserRouter([
  {
    path: '/t/:tenantSlug',
    loader: tenantLoader,
    lazy: async () => {
      const { TenantLayout } = await import('./app/TenantLayout');
      return { Component: TenantLayout };
    },
    children: [
      {
        index: true,
        lazy: () =>
          import('./pages/TenantHome').then((m) => ({
            Component: m.TenantHome,
          })),
      },
      {
        path: 'packages',
        lazy: () =>
          import('./pages/TenantCatalog').then((m) => ({
            Component: m.TenantCatalog,
          })),
      },
    ],
  },
]);
```

**Note:** Combine with Suspense for loading states:

```typescript
// router.tsx
import { Suspense } from 'react';
import { Loading } from './ui/Loading';

// Wrap lazy routes with Suspense
const SuspenseWrapper = ({ children }) => (
  <Suspense fallback={<Loading label="Loading page" />}>
    {children}
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: '/t/:tenantSlug',
    lazy: () =>
      import('./app/TenantLayout').then(m => ({
        Component: () => <SuspenseWrapper><m.TenantLayout /></SuspenseWrapper>,
      })),
    // ...
  },
]);
```

### Error Boundaries with ErrorElement

React Router v7 uses `errorElement` for route-level error handling.

```typescript
// pages/TenantErrorBoundary.tsx
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

export function TenantErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold">Tenant Not Found</h1>
            <p className="text-gray-600 mt-2">
              The tenant you're looking for doesn't exist.
            </p>
            <Link to="/" className="mt-4 text-blue-600">
              Return Home
            </Link>
          </div>
        </div>
      );
    }

    if (error.status === 500) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold">Error</h1>
            <p className="text-gray-600 mt-2">{error.data?.message}</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Something went wrong</h1>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}

// router.tsx
{
  path: '/t/:tenantSlug',
  errorElement: <TenantErrorBoundary />,
  // ...
}
```

## Context Integration with Loaders

### Pattern: Loader + Context Provider

Combine loader data with context for optimal data flow:

```typescript
// contexts/TenantContext.tsx - Refactored for loaders
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

/**
 * No loading state needed - data comes from loader
 * Much simpler than fetching inside provider
 */
export function TenantProvider({ config, slug, children }: TenantProviderProps) {
  const value: TenantContextType = { config, slug };

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

## TanStack Query + Route Loaders

When combining React Query with Route Loaders, avoid duplicate fetches:

```typescript
// loaders/tenantLoader.ts - Integration with React Query
import { queryClient } from '../lib/queryClient';

export async function tenantLoader({ params }) {
  const { tenantSlug } = params;

  // Check if data is already in cache
  const cached = queryClient.getQueryData(['tenant', tenantSlug]);
  if (cached) {
    return cached;
  }

  // Fetch and cache
  try {
    const { status, body } = await api.public.getTenantConfig({
      params: { slug: tenantSlug },
    });

    if (status !== 200) {
      throw new Response('Tenant not found', { status: 404 });
    }

    // Store in React Query cache
    queryClient.setQueryData(['tenant', tenantSlug], {
      config: body,
      slug: tenantSlug,
    });

    return {
      config: body,
      slug: tenantSlug,
    };
  } catch (error) {
    throw new Response('Error loading tenant', { status: 500 });
  }
}
```

## Navigation Patterns

### Type-Safe Route Navigation

Create type-safe navigation helpers:

```typescript
// lib/routes.ts
import { generatePath } from 'react-router-dom';

export const routes = {
  home: () => '/',

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

  tenantPackage: (
    tenantSlug: string,
    segmentSlug: string,
    packageSlug: string
  ) =>
    generatePath('/t/:tenantSlug/s/:segmentSlug/p/:packageSlug', {
      tenantSlug,
      segmentSlug,
      packageSlug,
    }),

  // Admin routes
  admin: () => '/admin/dashboard',
  tenantAdmin: () => '/tenant/dashboard',
} as const;

// Usage in components
import { useNavigate } from 'react-router-dom';

function PackageCard({ tenantSlug, segmentSlug, packageSlug }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() =>
        navigate(
          routes.tenantPackage(tenantSlug, segmentSlug, packageSlug)
        )
      }
    >
      View Details
    </button>
  );
}
```

### Link Components with Type Safety

```typescript
// components/TenantLink.tsx
import { Link } from 'react-router-dom';
import { routes } from '../lib/routes';

interface TenantLinkProps {
  tenantSlug: string;
  page: 'home' | 'packages' | 'segment' | 'package';
  segmentSlug?: string;
  packageSlug?: string;
  children: React.ReactNode;
  className?: string;
}

export function TenantLink({
  tenantSlug,
  page,
  segmentSlug,
  packageSlug,
  children,
  className,
}: TenantLinkProps) {
  let href = '';

  switch (page) {
    case 'home':
      href = routes.tenantHome(tenantSlug);
      break;
    case 'packages':
      href = routes.tenantPackages(tenantSlug);
      break;
    case 'segment':
      href = routes.tenantSegment(tenantSlug, segmentSlug!);
      break;
    case 'package':
      href = routes.tenantPackage(tenantSlug, segmentSlug!, packageSlug!);
      break;
  }

  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

// Usage
<TenantLink tenantSlug="acme" page="packages">
  View All Packages
</TenantLink>
```

## Performance Optimization with React Router v7

### Route Preloading

Prefetch route data before user navigates:

```typescript
// hooks/usePrefetchRoute.ts
import { useNavigate } from 'react-router-dom';
import { queryClient } from '../lib/queryClient';

export function usePrefetchRoute() {
  const navigate = useNavigate();

  const prefetchTenant = async (tenantSlug: string) => {
    // Start prefetch in background
    await queryClient.prefetchQuery({
      queryKey: ['tenant', tenantSlug],
      queryFn: async () => {
        const { status, body } = await api.public.getTenantConfig({
          params: { slug: tenantSlug },
        });
        return body;
      },
      staleTime: 15 * 60 * 1000,
    });
  };

  return { prefetchTenant, navigate };
}

// Usage - on hover
<Link
  to={`/t/${tenantSlug}`}
  onMouseEnter={() => prefetchTenant(tenantSlug)}
>
  {tenantName}
</Link>
```

### Code Splitting with Lazy Routes

```typescript
// router.tsx
const TenantLayout = lazy(() =>
  import('./app/TenantLayout').then((m) => ({
    Component: m.TenantLayout,
  }))
);

const router = createBrowserRouter([
  {
    path: '/t/:tenantSlug',
    loader: tenantLoader,
    Component: TenantLayout,
    children: [
      {
        index: true,
        lazy: () =>
          import('./pages/TenantHome').then((m) => ({
            Component: m.TenantHome,
          })),
      },
    ],
  },
]);
```

### Memoization for Nested Routes

```typescript
// pages/SegmentLanding.tsx
import { memo } from 'react';
import { useLoaderData } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';

export const SegmentLanding = memo(function SegmentLanding() {
  const { segment } = useLoaderData();
  const { config } = useTenant();

  return (
    <div>
      <h1>{segment.name}</h1>
      <PackageGrid tenantSlug={config.slug} segmentSlug={segment.slug} />
    </div>
  );
});
```

## Complete Example: Multi-Tenant Storefront

Here's a complete implementation combining all patterns:

```typescript
// router.tsx - Complete example
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loading } from './ui/Loading';
import { tenantLoader, segmentLoader } from './loaders/tenantLoader';
import { TenantErrorBoundary } from './pages/TenantErrorBoundary';

// Layout components
const AppShell = lazy(() =>
  import('./app/AppShell').then(m => ({ Component: m.AppShell }))
);
const TenantLayout = lazy(() =>
  import('./app/TenantLayout').then(m => ({ Component: m.TenantLayout }))
);
const AdminLayout = lazy(() =>
  import('./app/AdminLayout').then(m => ({ Component: m.AdminLayout }))
);

// Page components
const Home = lazy(() =>
  import('./pages/Home').then(m => ({ Component: m.Home }))
);
const TenantHome = lazy(() =>
  import('./pages/TenantHome').then(m => ({ Component: m.TenantHome }))
);
const TenantCatalog = lazy(() =>
  import('./pages/TenantCatalog').then(m => ({ Component: m.TenantCatalog }))
);
const SegmentLanding = lazy(() =>
  import('./pages/SegmentLanding').then(m => ({ Component: m.SegmentLanding }))
);
const PackageDetail = lazy(() =>
  import('./pages/PackageDetail').then(m => ({ Component: m.PackageDetail }))
);
const PlatformAdminDashboard = lazy(() =>
  import('./pages/admin/PlatformAdminDashboard').then(m => ({
    Component: m.PlatformAdminDashboard,
  }))
);

// Suspense wrapper
const SuspenseWrapper = ({ children }) => (
  <Suspense fallback={<Loading label="Loading page" />}>
    {children}
  </Suspense>
);

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/',
    Component: AppShell,
    children: [
      {
        index: true,
        Component: () => <SuspenseWrapper><Home /></SuspenseWrapper>,
      },
    ],
  },

  // Tenant storefront routes
  {
    path: '/t/:tenantSlug',
    loader: tenantLoader,
    errorElement: <TenantErrorBoundary />,
    Component: () => <SuspenseWrapper><TenantLayout /></SuspenseWrapper>,
    children: [
      {
        index: true,
        Component: () => <SuspenseWrapper><TenantHome /></SuspenseWrapper>,
      },
      {
        path: 'packages',
        Component: () => <SuspenseWrapper><TenantCatalog /></SuspenseWrapper>,
      },
      {
        path: 's/:segmentSlug',
        loader: segmentLoader,
        Component: () => <SuspenseWrapper><SegmentLanding /></SuspenseWrapper>,
        children: [
          {
            path: 'p/:packageSlug',
            Component: () => (
              <SuspenseWrapper><PackageDetail /></SuspenseWrapper>
            ),
          },
        ],
      },
    ],
  },

  // Admin routes
  {
    path: '/admin',
    Component: AdminLayout,
    children: [
      {
        path: 'dashboard',
        Component: () => (
          <SuspenseWrapper>
            <PlatformAdminDashboard />
          </SuspenseWrapper>
        ),
      },
    ],
  },
]);
```

## Migration from Current Router Setup

Your current router uses the standard `element` prop. To migrate to v7 patterns:

### Step 1: Add Loaders

Create loaders for data-dependent routes.

### Step 2: Update Routes to Use Loaders

Replace context-based data fetching with loaders.

### Step 3: Update Components to Use useLoaderData()

Replace `useQuery()` calls with `useLoaderData()` for loader data.

### Step 4: Add Lazy Loading

Wrap heavy components with `lazy()`.

### Step 5: Add Error Elements

Add `errorElement` to routes that have loaders.

## Vercel Deployment with React Router v7

```json
// vercel.json - v7 optimized
{
  "framework": "vite",
  "buildCommand": "npm run build --workspace=@macon/web",
  "outputDirectory": "client/dist",
  "rewrites": [
    {
      "source": "/t/:tenantSlug/:path(.*)",
      "destination": "/t/:tenantSlug/:path"
    },
    { "source": "/(.*)", "destination": "/index.html" }
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
        }
      ]
    }
  ]
}
```

## Summary

React Router v7 provides powerful features for multi-tenant routing:

- **Loaders**: Data fetching before render eliminates loading states
- **Error Boundaries**: Route-level error handling with `errorElement`
- **Lazy Routes**: Code splitting for better performance
- **Type Safety**: Integration with TypeScript for safe navigation

For a multi-tenant system, combine loaders with context providers for optimal data flow and performance.
