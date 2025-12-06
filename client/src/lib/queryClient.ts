/**
 * React Query client configuration with optimized caching strategy
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime in v4)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Query keys for organized cache management
 */
export const queryKeys = {
  // Catalog queries (rarely change, longer stale time)
  packages: {
    all: ['packages'] as const,
    bySlug: (slug: string) => ['packages', slug] as const,
  },
  // Bookings queries (frequently updated, shorter stale time)
  bookings: {
    all: ['bookings'] as const,
    byId: (id: string) => ['bookings', id] as const,
  },
  // Admin queries (frequently updated, shorter stale time)
  admin: {
    bookings: ['admin', 'bookings'] as const,
    blackouts: ['admin', 'blackouts'] as const,
    packages: ['admin', 'packages'] as const,
  },
  // Availability queries (dynamic, batch fetch)
  availability: {
    dateRange: (startDate: string, endDate: string) =>
      ['availability', 'range', startDate, endDate] as const,
    singleDate: (date: string) => ['availability', 'date', date] as const,
  },
  // Tenant admin dashboard queries
  tenantAdmin: {
    calendarStatus: ['tenant-admin', 'calendar', 'status'] as const,
    depositSettings: ['tenant-admin', 'deposit', 'settings'] as const,
    reminderStatus: ['tenant-admin', 'reminder', 'status'] as const,
  },
} as const;

/**
 * Query options presets for different data types
 */
export const queryOptions = {
  // Catalog data (packages) - changes infrequently
  catalog: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  },
  // Real-time data (bookings, admin dashboard)
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes (formerly cacheTime)
  },
  // Availability data (batch fetched)
  availability: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  },
} as const;
