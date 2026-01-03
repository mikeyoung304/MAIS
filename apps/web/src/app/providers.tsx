'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';

/**
 * Client-side providers wrapper
 *
 * This component wraps the app with necessary client-side providers:
 * - SessionProvider for NextAuth.js authentication
 * - React Query for data fetching and caching
 * - (Future) Theme provider
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // NOTE: Using getQueryClient() here ensures we get the browser singleton
  // This is important for React 18 concurrent features
  const queryClient = getQueryClient();

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
