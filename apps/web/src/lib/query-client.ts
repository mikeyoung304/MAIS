'use client';

import { QueryClient } from '@tanstack/react-query';

/**
 * Create a React Query client for use in the app
 *
 * Following Next.js best practices:
 * - Create a new QueryClient instance per request on the server
 * - Use a singleton on the client (browser)
 */

let browserQueryClient: QueryClient | undefined = undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set staleTime to avoid refetching
        // immediately on the client
        staleTime: 60 * 1000, // 1 minute
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is important so that we don't re-make a new client if React
    // suspends during the initial render
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
  packages: {
    all: ['packages'] as const,
    bySlug: (slug: string) => ['packages', slug] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    byId: (id: string) => ['bookings', id] as const,
  },
  tenant: {
    public: (slug: string) => ['tenant', 'public', slug] as const,
    config: (slug: string) => ['tenant', 'config', slug] as const,
  },
  admin: {
    bookings: ['admin', 'bookings'] as const,
    blackouts: ['admin', 'blackouts'] as const,
  },
  tenantAdmin: {
    dashboard: ['tenant-admin', 'dashboard'] as const,
    depositSettings: ['tenant-admin', 'deposit', 'settings'] as const,
    packages: ['tenant-admin', 'packages'] as const,
    branding: ['tenant-admin', 'branding'] as const,
  },
} as const;

/**
 * Preset cache times for different data types
 */
export const queryOptions = {
  // Static content that changes rarely
  catalog: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  // Real-time data that should refresh frequently
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  },
  // User-specific data
  user: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
} as const;
