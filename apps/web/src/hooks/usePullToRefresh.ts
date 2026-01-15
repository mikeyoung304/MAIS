'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePrefersReducedMotion } from './useBreakpoint';

/**
 * Pull-to-refresh state machine states.
 */
export type PullToRefreshStatus = 'idle' | 'pulling' | 'refreshing' | 'complete';

/**
 * Options for pull-to-refresh gesture.
 */
export interface PullToRefreshOptions {
  /** Distance in pixels to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance for visual feedback (default: 150) */
  maxPull?: number;
  /** Callback fired when refresh is triggered - should return a Promise */
  onRefresh: () => Promise<void>;
  /** Delay in ms before returning to idle after complete (default: 500) */
  completeDelay?: number;
  /** Whether gesture is enabled (default: true) */
  enabled?: boolean;
  /** Custom scroll container (defaults to element itself) */
  scrollContainer?: React.RefObject<HTMLElement | null>;
}

/**
 * State returned by the pull-to-refresh hook.
 */
export interface PullToRefreshState {
  /** Current state of the pull-to-refresh */
  readonly status: PullToRefreshStatus;
  /** Progress from 0 to 1 based on threshold */
  readonly progress: number;
  /** Current pull distance in pixels */
  readonly pullDistance: number;
  /** Manually trigger refresh */
  readonly refresh: () => Promise<void>;
  /** Reset to idle state */
  readonly reset: () => void;
}

/**
 * Internal touch tracking state.
 */
interface TouchTrackingState {
  startY: number;
  currentY: number;
  startScrollTop: number;
}

/**
 * Pull-to-refresh gesture hook.
 *
 * Detects pull-down gesture at the top of a scrollable container
 * and triggers a refresh callback. Provides visual feedback during pull.
 * Respects prefers-reduced-motion.
 *
 * @param ref - React ref to the element to track pull on
 * @param options - Configuration options for pull-to-refresh
 * @returns PullToRefreshState with current status and progress
 *
 * @example
 * ```tsx
 * function RefreshableList() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const ptr = usePullToRefresh(containerRef, {
 *     threshold: 80,
 *     onRefresh: async () => {
 *       await fetchNewData();
 *     },
 *   });
 *
 *   return (
 *     <div ref={containerRef} className="overflow-auto h-screen">
 *       {ptr.status === 'pulling' && (
 *         <div
 *           className="flex items-center justify-center"
 *           style={{ height: ptr.pullDistance }}
 *         >
 *           <RefreshIcon style={{ transform: `rotate(${ptr.progress * 360}deg)` }} />
 *         </div>
 *       )}
 *       {ptr.status === 'refreshing' && <Spinner />}
 *       <ItemList />
 *     </div>
 *   );
 * }
 * ```
 */
export function usePullToRefresh(
  ref: React.RefObject<HTMLElement | null>,
  options: PullToRefreshOptions
): PullToRefreshState {
  const {
    threshold = 80,
    maxPull = 150,
    onRefresh,
    completeDelay = 500,
    enabled = true,
    scrollContainer,
  } = options;

  const prefersReducedMotion = usePrefersReducedMotion();
  const trackingRef = useRef<TouchTrackingState | null>(null);
  const isRefreshingRef = useRef(false);

  // RAF ref for throttling state updates to prevent 60+ re-renders per second
  const rafRef = useRef<number | null>(null);
  // Pending state to batch updates
  const pendingStateRef = useRef<{ pullDistance: number; status: PullToRefreshStatus } | null>(
    null
  );

  const [status, setStatus] = useState<PullToRefreshStatus>('idle');
  const [pullDistance, setPullDistance] = useState(0);

  // Calculate progress (0 to 1) based on threshold
  const progress = Math.min(pullDistance / threshold, 1);

  /**
   * Get the scroll top of the relevant container.
   */
  const getScrollTop = useCallback((): number => {
    const scrollEl = scrollContainer?.current ?? ref.current;
    if (!scrollEl) return 0;
    return scrollEl.scrollTop;
  }, [ref, scrollContainer]);

  /**
   * Trigger refresh programmatically.
   */
  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setStatus('refreshing');
    setPullDistance(threshold);

    try {
      await onRefresh();
    } finally {
      setStatus('complete');

      // Return to idle after delay
      setTimeout(() => {
        setStatus('idle');
        setPullDistance(0);
        isRefreshingRef.current = false;
      }, completeDelay);
    }
  }, [onRefresh, threshold, completeDelay]);

  /**
   * Reset to idle state.
   */
  const reset = useCallback(() => {
    trackingRef.current = null;
    setStatus('idle');
    setPullDistance(0);
    isRefreshingRef.current = false;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || isRefreshingRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const scrollTop = getScrollTop();

      // Only track if at top of scroll container
      if (scrollTop > 0) return;

      trackingRef.current = {
        startY: touch.clientY,
        currentY: touch.clientY,
        startScrollTop: scrollTop,
      };
    },
    [enabled, getScrollTop]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !trackingRef.current || isRefreshingRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const tracking = trackingRef.current;
      tracking.currentY = touch.clientY;

      const scrollTop = getScrollTop();
      const deltaY = tracking.currentY - tracking.startY;

      // Only show pull indicator if:
      // 1. User is pulling down (positive delta)
      // 2. Container is at the top
      if (deltaY > 0 && scrollTop <= 0) {
        // Apply resistance curve for natural feel
        const resistedDelta = applyResistance(deltaY, maxPull);

        // Store pending state in ref (no re-render)
        pendingStateRef.current = { pullDistance: resistedDelta, status: 'pulling' };

        // Schedule RAF update if not already scheduled (throttles to ~60fps max)
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const pending = pendingStateRef.current;
            if (pending) {
              setPullDistance(pending.pullDistance);
              setStatus(pending.status);
            }
          });
        }
      } else {
        // Store pending state in ref (no re-render)
        pendingStateRef.current = { pullDistance: 0, status: 'idle' };

        // Schedule RAF update if not already scheduled
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const pending = pendingStateRef.current;
            if (pending) {
              setPullDistance(pending.pullDistance);
              setStatus(pending.status);
            }
          });
        }
      }
    },
    [enabled, getScrollTop, maxPull]
  );

  const handleTouchEnd = useCallback(
    async (_e: TouchEvent) => {
      // Cancel any pending RAF update before updating final state
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingStateRef.current = null;

      if (!enabled || !trackingRef.current || isRefreshingRef.current) return;

      const shouldTrigger = pullDistance >= threshold && !prefersReducedMotion;
      trackingRef.current = null;

      if (shouldTrigger) {
        await refresh();
      } else {
        // Animate back to idle
        setPullDistance(0);
        setStatus('idle');
      }
    },
    [enabled, pullDistance, threshold, prefersReducedMotion, refresh]
  );

  const handleTouchCancel = useCallback(() => {
    // Cancel any pending RAF update
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingStateRef.current = null;
    trackingRef.current = null;
    setPullDistance(0);
    setStatus('idle');
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // Use passive: false for touchmove to allow preventDefault if needed
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [ref, enabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  // Clean up any pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return {
    status,
    progress,
    pullDistance,
    refresh,
    reset,
  };
}

/**
 * Apply resistance curve to create natural rubber-band feel.
 * The further you pull, the more resistance.
 *
 * @param distance - Raw pull distance
 * @param maxDistance - Maximum distance for resistance calculation
 * @returns Resisted distance
 */
function applyResistance(distance: number, maxDistance: number): number {
  // Use a diminishing returns curve
  // At 0, factor is 1 (no resistance)
  // At maxDistance, factor approaches 0.3
  const factor = 1 - Math.min(distance / maxDistance, 1) * 0.7;
  return distance * factor;
}
