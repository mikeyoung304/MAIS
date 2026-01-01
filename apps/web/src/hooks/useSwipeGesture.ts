'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePrefersReducedMotion } from './useBreakpoint';

/**
 * Swipe direction enum.
 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Swipe event payload returned by the hook.
 */
export interface SwipeEvent {
  /** Direction of the swipe */
  readonly direction: SwipeDirection;
  /** Horizontal delta from start (positive = right) */
  readonly deltaX: number;
  /** Vertical delta from start (positive = down) */
  readonly deltaY: number;
  /** Velocity in pixels per millisecond */
  readonly velocity: number;
  /** Duration of the swipe in milliseconds */
  readonly duration: number;
}

/**
 * Options for swipe gesture detection.
 */
export interface SwipeGestureOptions {
  /** Minimum distance in pixels to trigger swipe (default: 50) */
  threshold?: number;
  /** Minimum velocity in px/ms to trigger swipe (default: 0.3) */
  velocityThreshold?: number;
  /** Callback fired when a valid swipe is detected */
  onSwipe?: (event: SwipeEvent) => void;
  /** Callback fired during swipe (for animations) */
  onSwipeMove?: (deltaX: number, deltaY: number) => void;
  /** Callback fired when swipe starts */
  onSwipeStart?: () => void;
  /** Callback fired when swipe ends (regardless of threshold) */
  onSwipeEnd?: () => void;
  /** Directions to detect (default: all) */
  directions?: SwipeDirection[];
  /** Whether gesture is enabled (default: true) */
  enabled?: boolean;
}

/**
 * State returned by the swipe gesture hook.
 */
export interface SwipeGestureState {
  /** Whether a swipe is currently in progress */
  readonly isSwiping: boolean;
  /** Current horizontal delta during swipe */
  readonly currentDeltaX: number;
  /** Current vertical delta during swipe */
  readonly currentDeltaY: number;
  /** Last detected swipe event (null if none) */
  readonly lastSwipe: SwipeEvent | null;
}

/**
 * Initial touch tracking state.
 */
interface TouchTrackingState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  lockedAxis: 'x' | 'y' | null;
}

/**
 * Physics-aware swipe gesture detection hook.
 *
 * Detects swipe gestures with velocity calculation, axis locking,
 * and configurable thresholds. Respects prefers-reduced-motion.
 * Uses passive event listeners for optimal scroll performance.
 *
 * @param ref - React ref to the element to track swipes on
 * @param options - Configuration options for swipe detection
 * @returns SwipeGestureState with current swipe info
 *
 * @example
 * ```tsx
 * function SwipeableCard() {
 *   const cardRef = useRef<HTMLDivElement>(null);
 *   const swipe = useSwipeGesture(cardRef, {
 *     threshold: 50,
 *     onSwipe: (event) => {
 *       if (event.direction === 'left') {
 *         dismissCard();
 *       }
 *     },
 *     onSwipeMove: (deltaX) => {
 *       // Animate card position during swipe
 *       cardRef.current?.style.transform = `translateX(${deltaX}px)`;
 *     },
 *     directions: ['left', 'right'],
 *   });
 *
 *   return (
 *     <div ref={cardRef} className={swipe.isSwiping ? 'swiping' : ''}>
 *       Swipe me
 *     </div>
 *   );
 * }
 * ```
 */
export function useSwipeGesture(
  ref: React.RefObject<HTMLElement | null>,
  options: SwipeGestureOptions = {}
): SwipeGestureState {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    onSwipe,
    onSwipeMove,
    onSwipeStart,
    onSwipeEnd,
    directions = ['left', 'right', 'up', 'down'],
    enabled = true,
  } = options;

  const prefersReducedMotion = usePrefersReducedMotion();
  const trackingRef = useRef<TouchTrackingState | null>(null);

  // RAF ref for throttling state updates to prevent 60+ re-renders per second
  const rafRef = useRef<number | null>(null);
  // Pending state to batch updates
  const pendingStateRef = useRef<{ deltaX: number; deltaY: number } | null>(null);

  const [state, setState] = useState<SwipeGestureState>({
    isSwiping: false,
    currentDeltaX: 0,
    currentDeltaY: 0,
    lastSwipe: null,
  });

  // Axis lock threshold (10px movement before locking)
  const AXIS_LOCK_THRESHOLD = 10;

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      trackingRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        currentX: touch.clientX,
        currentY: touch.clientY,
        lockedAxis: null,
      };

      setState((prev) => ({
        ...prev,
        isSwiping: true,
        currentDeltaX: 0,
        currentDeltaY: 0,
      }));

      onSwipeStart?.();
    },
    [enabled, onSwipeStart]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !trackingRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const tracking = trackingRef.current;
      tracking.currentX = touch.clientX;
      tracking.currentY = touch.clientY;

      const deltaX = tracking.currentX - tracking.startX;
      const deltaY = tracking.currentY - tracking.startY;

      // Determine axis lock if not already locked
      if (!tracking.lockedAxis) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (absX > AXIS_LOCK_THRESHOLD || absY > AXIS_LOCK_THRESHOLD) {
          tracking.lockedAxis = absX > absY ? 'x' : 'y';
        }
      }

      // Apply axis lock
      const lockedDeltaX = tracking.lockedAxis === 'y' ? 0 : deltaX;
      const lockedDeltaY = tracking.lockedAxis === 'x' ? 0 : deltaY;

      // Store pending state in ref (no re-render)
      pendingStateRef.current = { deltaX: lockedDeltaX, deltaY: lockedDeltaY };

      // Schedule RAF update if not already scheduled (throttles to ~60fps max)
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const pending = pendingStateRef.current;
          if (pending) {
            setState((prev) => ({
              ...prev,
              currentDeltaX: pending.deltaX,
              currentDeltaY: pending.deltaY,
            }));
          }
        });
      }

      // Callbacks are still called on every touchmove for smooth DOM manipulation
      onSwipeMove?.(lockedDeltaX, lockedDeltaY);
    },
    [enabled, onSwipeMove]
  );

  const handleTouchEnd = useCallback(
    (_e: TouchEvent) => {
      // Cancel any pending RAF update before updating final state
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingStateRef.current = null;

      if (!enabled || !trackingRef.current) return;

      const tracking = trackingRef.current;
      const duration = Date.now() - tracking.startTime;
      const deltaX = tracking.currentX - tracking.startX;
      const deltaY = tracking.currentY - tracking.startY;

      // Apply axis lock to final deltas
      const lockedDeltaX = tracking.lockedAxis === 'y' ? 0 : deltaX;
      const lockedDeltaY = tracking.lockedAxis === 'x' ? 0 : deltaY;

      const absX = Math.abs(lockedDeltaX);
      const absY = Math.abs(lockedDeltaY);
      const distance = Math.sqrt(lockedDeltaX ** 2 + lockedDeltaY ** 2);
      const velocity = duration > 0 ? distance / duration : 0;

      // Determine direction
      let direction: SwipeDirection | null = null;
      if (tracking.lockedAxis === 'x') {
        direction = lockedDeltaX > 0 ? 'right' : 'left';
      } else if (tracking.lockedAxis === 'y') {
        direction = lockedDeltaY > 0 ? 'down' : 'up';
      }

      // Check if swipe meets threshold and velocity requirements
      const meetsThreshold = absX >= threshold || absY >= threshold;
      const meetsVelocity = velocity >= velocityThreshold;
      const isValidDirection = direction && directions.includes(direction);
      const shouldNotReduce = !prefersReducedMotion;

      if (
        direction &&
        meetsThreshold &&
        meetsVelocity &&
        isValidDirection &&
        shouldNotReduce
      ) {
        const swipeEvent: SwipeEvent = {
          direction,
          deltaX: lockedDeltaX,
          deltaY: lockedDeltaY,
          velocity,
          duration,
        };

        setState((prev) => ({
          ...prev,
          isSwiping: false,
          currentDeltaX: 0,
          currentDeltaY: 0,
          lastSwipe: swipeEvent,
        }));

        onSwipe?.(swipeEvent);
      } else {
        setState((prev) => ({
          ...prev,
          isSwiping: false,
          currentDeltaX: 0,
          currentDeltaY: 0,
        }));
      }

      trackingRef.current = null;
      onSwipeEnd?.();
    },
    [
      enabled,
      threshold,
      velocityThreshold,
      directions,
      prefersReducedMotion,
      onSwipe,
      onSwipeEnd,
    ]
  );

  const handleTouchCancel = useCallback(() => {
    // Cancel any pending RAF update
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingStateRef.current = null;
    trackingRef.current = null;
    setState((prev) => ({
      ...prev,
      isSwiping: false,
      currentDeltaX: 0,
      currentDeltaY: 0,
    }));
    onSwipeEnd?.();
  }, [onSwipeEnd]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // Use passive listeners for better scroll performance
    const passiveOption = { passive: true };

    element.addEventListener('touchstart', handleTouchStart, passiveOption);
    element.addEventListener('touchmove', handleTouchMove, passiveOption);
    element.addEventListener('touchend', handleTouchEnd, passiveOption);
    element.addEventListener('touchcancel', handleTouchCancel, passiveOption);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    ref,
    enabled,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  ]);

  // Clean up any pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return state;
}

/**
 * Simple hook that just detects swipe direction.
 * Use when you don't need velocity or progress tracking.
 */
export function useSimpleSwipe(
  ref: React.RefObject<HTMLElement | null>,
  onSwipe: (direction: SwipeDirection) => void,
  directions: SwipeDirection[] = ['left', 'right', 'up', 'down']
): boolean {
  const { isSwiping } = useSwipeGesture(ref, {
    onSwipe: (event) => onSwipe(event.direction),
    directions,
  });
  return isSwiping;
}
