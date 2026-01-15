'use client';

import { useMemo } from 'react';
import { MEDIA_QUERIES, type BreakpointKey } from '@/types/responsive';
import { useMediaQuery } from './useMediaQuery';

/**
 * Breakpoint state with current breakpoint and comparison helpers.
 */
export interface BreakpointState {
  /** Current status: 'pending' during SSR, 'resolved' on client */
  readonly status: 'pending' | 'resolved';

  /** Current active breakpoint (smallest that matches) */
  readonly current: BreakpointKey | 'xs' | undefined;

  /** True if viewport is mobile (< md) */
  readonly isMobile: boolean | undefined;

  /** True if viewport is tablet or larger (>= md) */
  readonly isTablet: boolean | undefined;

  /** True if viewport is desktop or larger (>= lg) */
  readonly isDesktop: boolean | undefined;

  /** True if viewport is large desktop (>= xl) */
  readonly isLargeDesktop: boolean | undefined;

  /** Check if viewport is at least the given breakpoint */
  readonly isAtLeast: (breakpoint: BreakpointKey) => boolean | undefined;

  /** Check if viewport is below the given breakpoint */
  readonly isBelow: (breakpoint: BreakpointKey) => boolean | undefined;
}

/**
 * Comprehensive breakpoint hook aligned with Tailwind CSS.
 *
 * Provides the current breakpoint and convenient comparison methods.
 * All values are undefined during SSR to prevent hydration mismatches.
 *
 * @returns BreakpointState with current breakpoint and helpers
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const bp = useBreakpoint();
 *
 *   if (bp.status === 'pending') {
 *     return <Skeleton />;
 *   }
 *
 *   return (
 *     <div>
 *       Current breakpoint: {bp.current}
 *       {bp.isMobile && <MobileNav />}
 *       {bp.isDesktop && <DesktopSidebar />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBreakpoint(): BreakpointState {
  // Query each breakpoint
  const smState = useMediaQuery(MEDIA_QUERIES.isSmall);
  const mdState = useMediaQuery(MEDIA_QUERIES.isTablet);
  const lgState = useMediaQuery(MEDIA_QUERIES.isDesktop);
  const xlState = useMediaQuery(MEDIA_QUERIES.isLargeDesktop);

  return useMemo(() => {
    // Check if any query is still pending
    const isPending =
      smState.status === 'pending' ||
      mdState.status === 'pending' ||
      lgState.status === 'pending' ||
      xlState.status === 'pending';

    if (isPending) {
      return {
        status: 'pending' as const,
        current: undefined,
        isMobile: undefined,
        isTablet: undefined,
        isDesktop: undefined,
        isLargeDesktop: undefined,
        isAtLeast: () => undefined,
        isBelow: () => undefined,
      };
    }

    // All resolved - calculate current breakpoint
    const isXl = xlState.matches;
    const isLg = lgState.matches;
    const isMd = mdState.matches;
    const isSm = !smState.matches; // smState is max-width, so invert

    // Determine current breakpoint (largest that matches)
    let current: BreakpointKey | 'xs';
    if (isXl) {
      current = 'xl';
    } else if (isLg) {
      current = 'lg';
    } else if (isMd) {
      current = 'md';
    } else if (isSm) {
      current = 'sm';
    } else {
      current = 'xs';
    }

    const isAtLeast = (breakpoint: BreakpointKey): boolean => {
      switch (breakpoint) {
        case 'sm':
          return isSm || isMd || isLg || isXl;
        case 'md':
          return isMd || isLg || isXl;
        case 'lg':
          return isLg || isXl;
        case 'xl':
        case '2xl':
          return isXl;
        default:
          return false;
      }
    };

    const isBelow = (breakpoint: BreakpointKey): boolean => {
      return !isAtLeast(breakpoint);
    };

    return {
      status: 'resolved' as const,
      current,
      isMobile: !isMd,
      isTablet: isMd,
      isDesktop: isLg,
      isLargeDesktop: isXl,
      isAtLeast,
      isBelow,
    };
  }, [smState, mdState, lgState, xlState]);
}

/**
 * Simple hook that returns just the isMobile boolean.
 * More efficient if you only need mobile detection.
 */
export function useIsMobile(): boolean | undefined {
  const state = useMediaQuery(MEDIA_QUERIES.isMobile);
  return state.status === 'resolved' ? state.matches : undefined;
}

/**
 * Hook that returns true for tablet and up (>= md).
 */
export function useIsTablet(): boolean | undefined {
  const state = useMediaQuery(MEDIA_QUERIES.isTablet);
  return state.status === 'resolved' ? state.matches : undefined;
}

/**
 * Hook that returns true for desktop and up (>= lg).
 */
export function useIsDesktop(): boolean | undefined {
  const state = useMediaQuery(MEDIA_QUERIES.isDesktop);
  return state.status === 'resolved' ? state.matches : undefined;
}

/**
 * Hook that returns true if user prefers reduced motion.
 */
export function usePrefersReducedMotion(): boolean | undefined {
  const state = useMediaQuery(MEDIA_QUERIES.prefersReducedMotion);
  return state.status === 'resolved' ? state.matches : undefined;
}

/**
 * Hook that returns true if device supports hover (non-touch).
 */
export function useSupportsHover(): boolean | undefined {
  const state = useMediaQuery(MEDIA_QUERIES.supportsHover);
  return state.status === 'resolved' ? state.matches : undefined;
}

/**
 * Hook that returns true if device has coarse pointer (touch).
 */
export function useIsTouch(): boolean | undefined {
  const state = useMediaQuery(MEDIA_QUERIES.supportsTouch);
  return state.status === 'resolved' ? state.matches : undefined;
}
