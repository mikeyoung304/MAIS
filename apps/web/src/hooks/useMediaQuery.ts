'use client';

import { useSyncExternalStore, useCallback } from 'react';
import type { MediaQueryString } from '@/types/responsive';

/**
 * Discriminated union for media query state.
 * - 'pending': SSR or initial hydration (matches is undefined)
 * - 'resolved': Client-side with actual value
 */
export type MediaQueryState =
  | { readonly status: 'pending'; readonly matches: undefined }
  | { readonly status: 'resolved'; readonly matches: boolean };

/**
 * SSR-safe media query hook using useSyncExternalStore.
 *
 * This hook properly handles:
 * - Server-side rendering (returns pending state)
 * - Hydration (avoids mismatches)
 * - Client-side reactive updates
 * - Cleanup on unmount
 *
 * @param query - A branded MediaQueryString from @/types/responsive
 * @returns Discriminated union with status and matches
 *
 * @example
 * ```tsx
 * import { MEDIA_QUERIES } from '@/types/responsive';
 * import { useMediaQuery } from '@/hooks/useMediaQuery';
 *
 * function MyComponent() {
 *   const mobileState = useMediaQuery(MEDIA_QUERIES.isMobile);
 *
 *   if (mobileState.status === 'pending') {
 *     return <Skeleton />; // SSR/hydration
 *   }
 *
 *   return mobileState.matches ? <MobileView /> : <DesktopView />;
 * }
 * ```
 */
export function useMediaQuery(query: MediaQueryString): MediaQueryState {
  // Subscribe to media query changes
  const subscribe = useCallback(
    (callback: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', callback);
      return () => mediaQueryList.removeEventListener('change', callback);
    },
    [query]
  );

  // Get current value on client
  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches;
  }, [query]);

  // Server-side snapshot (always false to prevent hydration mismatch)
  const getServerSnapshot = useCallback(() => {
    return false;
  }, []);

  const matches = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Check if we're on the client by testing if window exists
  // This is safe because useSyncExternalStore handles SSR correctly
  const isClient = typeof window !== 'undefined';

  if (!isClient) {
    return { status: 'pending', matches: undefined };
  }

  return { status: 'resolved', matches };
}

/**
 * Simpler hook that just returns boolean (or undefined on server).
 * Use when you don't need the discriminated union pattern.
 *
 * @param query - A branded MediaQueryString
 * @returns boolean | undefined
 */
export function useMediaQueryValue(query: MediaQueryString): boolean | undefined {
  const state = useMediaQuery(query);
  return state.status === 'resolved' ? state.matches : undefined;
}

/**
 * Hook that returns boolean with a fallback for SSR.
 * Useful when you need a definite value immediately.
 *
 * @param query - A branded MediaQueryString
 * @param fallback - Value to use during SSR/hydration
 * @returns boolean
 */
export function useMediaQueryWithFallback(query: MediaQueryString, fallback: boolean): boolean {
  const state = useMediaQuery(query);
  return state.status === 'resolved' ? state.matches : fallback;
}
