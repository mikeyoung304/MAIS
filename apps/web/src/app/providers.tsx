'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query-client';

/**
 * Client-side providers wrapper
 *
 * This component wraps the app with necessary client-side providers:
 * - React Query for data fetching and caching
 * - (Future) NextAuth SessionProvider
 * - (Future) Theme provider
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // NOTE: Using getQueryClient() here ensures we get the browser singleton
  // This is important for React 18 concurrent features
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
