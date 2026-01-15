'use client';

import { useCallback, useMemo } from 'react';
import { usePrefersReducedMotion } from './useBreakpoint';

/**
 * Haptic feedback intensity levels.
 */
export type HapticIntensity = 'light' | 'medium' | 'heavy';

/**
 * Haptic feedback pattern types.
 */
export type HapticPattern = HapticIntensity | 'success' | 'error' | 'warning' | 'selection';

/**
 * Vibration patterns in milliseconds.
 * Single number = vibrate for that duration.
 * Array = [vibrate, pause, vibrate, pause, ...] pattern.
 */
const VIBRATION_PATTERNS: Record<HapticPattern, number | number[]> = {
  /** Light tap - subtle confirmation (10ms) */
  light: 10,
  /** Medium tap - standard interaction (20ms) */
  medium: 20,
  /** Heavy tap - strong feedback (30-10-30 pattern) */
  heavy: [30, 10, 30],
  /** Success - positive confirmation (10-50-10 pattern) */
  success: [10, 50, 10],
  /** Error - negative feedback (50-30-50-30-50 pattern) */
  error: [50, 30, 50, 30, 50],
  /** Warning - attention needed (30-20-30 pattern) */
  warning: [30, 20, 30],
  /** Selection - item selected (15ms) */
  selection: 15,
} as const;

/**
 * Check if the Vibration API is supported.
 */
function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Haptic feedback hook result.
 */
export interface HapticFeedback {
  /** Trigger a light vibration (10ms) */
  readonly light: () => void;
  /** Trigger a medium vibration (20ms) */
  readonly medium: () => void;
  /** Trigger a heavy vibration pattern ([30, 10, 30]) */
  readonly heavy: () => void;
  /** Trigger a success pattern ([10, 50, 10]) */
  readonly success: () => void;
  /** Trigger an error pattern ([50, 30, 50, 30, 50]) */
  readonly error: () => void;
  /** Trigger a warning pattern ([30, 20, 30]) */
  readonly warning: () => void;
  /** Trigger a selection vibration (15ms) */
  readonly selection: () => void;
  /** Trigger a custom pattern */
  readonly vibrate: (pattern: HapticPattern | number | number[]) => void;
  /** Trigger with pattern name (legacy API) */
  readonly trigger: (pattern: HapticPattern) => void;
  /** Stop any ongoing vibration */
  readonly stop: () => void;
  /** Whether haptic feedback is supported on this device */
  readonly isSupported: boolean;
}

/**
 * Haptic feedback hook for vibration patterns.
 *
 * Provides typed vibration patterns for different interaction types.
 * Falls back to no-op when:
 * - Vibration API is not supported
 * - User prefers reduced motion
 * - Running on server (SSR)
 *
 * @returns HapticFeedback object with vibration methods
 *
 * @example
 * ```tsx
 * function LikeButton() {
 *   const haptic = useHapticFeedback();
 *
 *   const handleLike = () => {
 *     setLiked(true);
 *     haptic.success(); // Positive feedback
 *   };
 *
 *   return (
 *     <button onClick={handleLike}>
 *       <HeartIcon />
 *     </button>
 *   );
 * }
 *
 * function DeleteButton() {
 *   const haptic = useHapticFeedback();
 *
 *   const handleDelete = () => {
 *     if (confirm('Delete?')) {
 *       haptic.heavy(); // Significant action
 *       deleteItem();
 *     }
 *   };
 *
 *   return <button onClick={handleDelete}>Delete</button>;
 * }
 *
 * function TabBar() {
 *   const haptic = useHapticFeedback();
 *
 *   return (
 *     <nav>
 *       {tabs.map(tab => (
 *         <button
 *           key={tab.id}
 *           onClick={() => {
 *             haptic.light(); // Subtle tab feedback
 *             setActiveTab(tab.id);
 *           }}
 *         >
 *           {tab.label}
 *         </button>
 *       ))}
 *     </nav>
 *   );
 * }
 * ```
 */
export function useHapticFeedback(): HapticFeedback {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Check support once
  const isSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isVibrationSupported();
  }, []);

  /**
   * Core vibration function.
   * No-ops if unsupported, SSR, or reduced motion preferred.
   */
  const vibrate = useCallback(
    (pattern: HapticPattern | number | number[]) => {
      // Skip if SSR, unsupported, or reduced motion
      if (typeof window === 'undefined') return;
      if (!isSupported) return;
      if (prefersReducedMotion) return;

      // Get pattern value
      const patternValue = typeof pattern === 'string' ? VIBRATION_PATTERNS[pattern] : pattern;

      try {
        navigator.vibrate(patternValue);
      } catch {
        // Silently fail - some browsers may throw
      }
    },
    [isSupported, prefersReducedMotion]
  );

  /**
   * Stop any ongoing vibration.
   */
  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!isSupported) return;

    try {
      navigator.vibrate(0);
    } catch {
      // Silently fail
    }
  }, [isSupported]);

  // Pre-bound pattern functions for convenience
  const light = useCallback(() => vibrate('light'), [vibrate]);
  const medium = useCallback(() => vibrate('medium'), [vibrate]);
  const heavy = useCallback(() => vibrate('heavy'), [vibrate]);
  const success = useCallback(() => vibrate('success'), [vibrate]);
  const error = useCallback(() => vibrate('error'), [vibrate]);
  const warning = useCallback(() => vibrate('warning'), [vibrate]);
  const selection = useCallback(() => vibrate('selection'), [vibrate]);

  // Legacy trigger API for backwards compatibility
  const trigger = useCallback((pattern: HapticPattern) => vibrate(pattern), [vibrate]);

  return useMemo(
    () => ({
      light,
      medium,
      heavy,
      success,
      error,
      warning,
      selection,
      vibrate,
      trigger,
      stop,
      isSupported,
    }),
    [light, medium, heavy, success, error, warning, selection, vibrate, trigger, stop, isSupported]
  );
}

/**
 * Simple function to trigger haptic feedback without a hook.
 * Useful for event handlers outside React components.
 */
export function triggerHaptic(intensity: HapticPattern = 'selection'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  if (typeof window !== 'undefined') {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return;
    }
  }

  const pattern = VIBRATION_PATTERNS[intensity];
  navigator.vibrate(pattern);
}

/**
 * Simple hook that returns just a vibrate function.
 * Use when you only need basic vibration without patterns.
 */
export function useVibrate(): (duration?: number) => void {
  const haptic = useHapticFeedback();

  return useCallback(
    (duration = 20) => {
      haptic.vibrate(duration);
    },
    [haptic]
  );
}

/**
 * Hook that wraps a callback with haptic feedback.
 * Useful for adding feedback to existing handlers.
 *
 * @param callback - The callback to wrap
 * @param pattern - The haptic pattern to trigger
 * @returns Wrapped callback that triggers haptic feedback
 *
 * @example
 * ```tsx
 * const handleClick = useWithHaptic(() => {
 *   doSomething();
 * }, 'light');
 *
 * return <button onClick={handleClick}>Click me</button>;
 * ```
 */
export function useWithHaptic<T extends (...args: unknown[]) => unknown>(
  callback: T,
  pattern: HapticPattern = 'light'
): T {
  const haptic = useHapticFeedback();

  return useCallback(
    ((...args: unknown[]) => {
      haptic.vibrate(pattern);
      return callback(...args);
    }) as T,
    [callback, haptic, pattern]
  );
}
