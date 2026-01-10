/**
 * usePreviewToken - TanStack Query hook for preview token management
 *
 * Fetches and manages preview tokens for draft content preview in iframes.
 * Tokens are short-lived (10 minutes) and automatically refreshed before expiry.
 *
 * SECURITY:
 * - Token generation requires authenticated tenant session
 * - Tokens are tenant-scoped (can only preview own tenant's draft)
 * - Tokens expire after 10 minutes
 * - No cache poisoning: preview requests bypass ISR cache
 * - Uses Next.js API proxy for secure auth (no direct backend calls)
 *
 * @see server/src/lib/preview-tokens.ts for token generation
 * @see server/src/routes/public-tenant.routes.ts for preview endpoint
 * @see docs/solutions/NEXTJS_CLIENT_API_QUICK_REFERENCE.md for proxy pattern
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { PreviewTokenResponse } from '@macon/contracts';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

interface UsePreviewTokenResult {
  /** Current preview token (null if not yet fetched or expired) */
  token: string | null;
  /** Expiration timestamp (ISO string) */
  expiresAt: string | null;
  /** Whether the token is currently being fetched */
  isLoading: boolean;
  /** Error during token fetch */
  error: Error | null;
  /** Force refresh the token */
  refreshToken: () => Promise<void>;
  /** Whether the token is expired or about to expire (within 1 minute) */
  isExpiringSoon: boolean;
}

// ============================================
// QUERY KEY
// ============================================

const PREVIEW_TOKEN_QUERY_KEY = ['preview-token'] as const;

// ============================================
// FETCH FUNCTION
// ============================================

async function fetchPreviewToken(): Promise<PreviewTokenResponse> {
  // Use Next.js API proxy route - handles auth securely on the server
  // The proxy reads the HTTP-only session cookie and adds Authorization header
  // See: apps/web/src/app/api/tenant-admin/[...path]/route.ts
  const response = await fetch('/api/tenant-admin/preview-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch preview token: ${errorBody}`);
  }

  return response.json();
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function usePreviewToken(): UsePreviewTokenResult {
  const queryClient = useQueryClient();

  // Fetch preview token
  const query = useQuery({
    queryKey: PREVIEW_TOKEN_QUERY_KEY,
    queryFn: async () => {
      logger.debug('[usePreviewToken] Fetching preview token');
      const data = await fetchPreviewToken();
      logger.debug('[usePreviewToken] Token received', { expiresAt: data.expiresAt });
      return data;
    },
    // Token is valid for 10 minutes, refetch at 8 minutes (2 minute buffer)
    staleTime: 8 * 60 * 1000, // 8 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    retry: 2, // Retry twice on failure
    refetchInterval: (query) => {
      // Auto-refresh token before it expires
      if (query.state.data?.expiresAt) {
        const expiresAt = new Date(query.state.data.expiresAt).getTime();
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;

        // If less than 2 minutes until expiry, refetch now
        if (timeUntilExpiry < 2 * 60 * 1000) {
          return 1000; // Refetch in 1 second
        }

        // Otherwise, refetch 2 minutes before expiry
        return Math.max(timeUntilExpiry - 2 * 60 * 1000, 60_000); // At least 1 minute
      }
      return false; // Don't auto-refetch if no data
    },
  });

  // Calculate if token is expiring soon (within 1 minute)
  const isExpiringSoon = useMemo(() => {
    if (!query.data?.expiresAt) return false;
    const expiresAt = new Date(query.data.expiresAt).getTime();
    return expiresAt - Date.now() < 60 * 1000;
  }, [query.data?.expiresAt]);

  // Force refresh token
  const refreshToken = useCallback(async () => {
    logger.debug('[usePreviewToken] Manually refreshing token');
    await queryClient.invalidateQueries({ queryKey: PREVIEW_TOKEN_QUERY_KEY });
    await query.refetch();
  }, [queryClient, query]);

  return {
    token: query.data?.token ?? null,
    expiresAt: query.data?.expiresAt ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refreshToken,
    isExpiringSoon,
  };
}

/**
 * Invalidate preview token from outside React
 * Call this when auth state changes
 */
export const invalidatePreviewToken = (queryClient: ReturnType<typeof useQueryClient>): void => {
  queryClient.invalidateQueries({ queryKey: PREVIEW_TOKEN_QUERY_KEY });
};
