'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Safe area insets in pixels.
 */
export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Discriminated union for safe area state.
 */
export type SafeAreaState =
  | { readonly status: 'pending'; readonly insets: undefined }
  | { readonly status: 'resolved'; readonly insets: SafeAreaInsets };

/**
 * Default insets when not available.
 */
const DEFAULT_INSETS: SafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/**
 * Hook to get programmatic access to CSS safe area insets.
 *
 * This is useful for JavaScript calculations that need safe area values,
 * like positioning elements or calculating available space.
 *
 * @returns SafeAreaState with current insets
 *
 * @example
 * ```tsx
 * function BottomSheet() {
 *   const safeArea = useSafeArea();
 *
 *   if (safeArea.status === 'pending') {
 *     return null;
 *   }
 *
 *   const bottomOffset = safeArea.insets.bottom + 16;
 *   return <div style={{ bottom: bottomOffset }}>...</div>;
 * }
 * ```
 */
export function useSafeArea(): SafeAreaState {
  const [insets, setInsets] = useState<SafeAreaInsets | undefined>(undefined);

  const updateInsets = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Create a temporary element to measure safe area insets
    const measurer = document.createElement('div');
    measurer.style.cssText = `
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      right: env(safe-area-inset-right, 0px);
      bottom: env(safe-area-inset-bottom, 0px);
      left: env(safe-area-inset-left, 0px);
      pointer-events: none;
      visibility: hidden;
    `;
    document.body.appendChild(measurer);

    // Read computed values
    const rect = measurer.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const newInsets: SafeAreaInsets = {
      top: rect.top,
      right: viewport.width - rect.right,
      bottom: viewport.height - rect.bottom,
      left: rect.left,
    };

    document.body.removeChild(measurer);
    setInsets(newInsets);
  }, []);

  useEffect(() => {
    updateInsets();

    // Re-measure on resize (orientation change, etc.)
    window.addEventListener('resize', updateInsets);

    // Also listen for orientation changes specifically
    window.addEventListener('orientationchange', updateInsets);

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, [updateInsets]);

  if (insets === undefined) {
    return { status: 'pending', insets: undefined };
  }

  return { status: 'resolved', insets };
}

/**
 * Simple hook that returns just the insets with fallback.
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const state = useSafeArea();
  return state.status === 'resolved' ? state.insets : DEFAULT_INSETS;
}

/**
 * Hook that returns just the bottom safe area inset.
 * Commonly used for bottom navigation and floating elements.
 */
export function useSafeAreaBottom(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom;
}
