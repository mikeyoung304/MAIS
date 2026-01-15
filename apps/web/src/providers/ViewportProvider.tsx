'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  useBreakpoint,
  usePrefersReducedMotion,
  useIsTouch,
  type BreakpointState,
} from '@/hooks/useBreakpoint';
import { useSafeAreaInsets, type SafeAreaInsets } from '@/hooks/useSafeArea';
import { useKeyboardHeight, type KeyboardState } from '@/hooks/useKeyboardHeight';
import { useNetworkStatus, type NetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Complete viewport context with all responsive information.
 */
export interface ViewportContextValue {
  /** Breakpoint information */
  readonly breakpoint: BreakpointState;

  /** Safe area insets for notched devices */
  readonly safeArea: SafeAreaInsets;

  /** Virtual keyboard state */
  readonly keyboard: KeyboardState;

  /** Network status */
  readonly network: NetworkStatus;

  /** True if user prefers reduced motion */
  readonly prefersReducedMotion: boolean;

  /** True if device uses touch (coarse pointer) */
  readonly isTouch: boolean;

  /** True if all viewport information has resolved */
  readonly isReady: boolean;
}

const ViewportContext = createContext<ViewportContextValue | null>(null);

/**
 * Provider that aggregates all viewport-related information.
 *
 * This provides a single source of truth for:
 * - Breakpoints (mobile/tablet/desktop)
 * - Safe area insets
 * - Virtual keyboard state
 * - Network status
 * - Motion preferences
 * - Touch capability
 *
 * @example
 * ```tsx
 * // In app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <ViewportProvider>
 *       {children}
 *     </ViewportProvider>
 *   );
 * }
 *
 * // In a component
 * function MyComponent() {
 *   const { breakpoint, isReady } = useViewport();
 *
 *   if (!isReady) return <Skeleton />;
 *
 *   return breakpoint.isMobile ? <MobileView /> : <DesktopView />;
 * }
 * ```
 */
export function ViewportProvider({ children }: { children: ReactNode }) {
  const breakpoint = useBreakpoint();
  const safeArea = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const network = useNetworkStatus();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isTouch = useIsTouch();

  const value = useMemo<ViewportContextValue>(
    () => ({
      breakpoint,
      safeArea,
      keyboard,
      network,
      prefersReducedMotion: prefersReducedMotion ?? false,
      isTouch: isTouch ?? false,
      isReady: breakpoint.status === 'resolved',
    }),
    [breakpoint, safeArea, keyboard, network, prefersReducedMotion, isTouch]
  );

  return <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>;
}

/**
 * Hook to access viewport context.
 *
 * @throws Error if used outside ViewportProvider
 */
export function useViewport(): ViewportContextValue {
  const context = useContext(ViewportContext);

  if (context === null) {
    throw new Error('useViewport must be used within a ViewportProvider');
  }

  return context;
}

/**
 * Optional hook that returns undefined if outside provider.
 * Use when the component might render outside the provider.
 */
export function useViewportOptional(): ViewportContextValue | null {
  return useContext(ViewportContext);
}
