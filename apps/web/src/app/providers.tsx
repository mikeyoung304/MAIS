'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query-client';
import { AuthProvider } from '@/contexts/AuthContext';

/**
 * Client-side providers wrapper
 *
 * This component wraps the app with necessary client-side providers:
 * - AuthProvider for authentication state
 * - React Query for data fetching and caching
 * - (Future) Theme provider
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // NOTE: Using getQueryClient() here ensures we get the browser singleton
  // This is important for React 18 concurrent features
  const queryClient = getQueryClient();

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </AuthProvider>
  );
}
