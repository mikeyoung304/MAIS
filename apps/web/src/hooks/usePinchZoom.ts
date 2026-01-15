'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePrefersReducedMotion } from './useBreakpoint';

/**
 * Options for pinch-to-zoom gesture.
 */
export interface PinchZoomOptions {
  /** Minimum scale factor (default: 1) */
  minScale?: number;
  /** Maximum scale factor (default: 4) */
  maxScale?: number;
  /** Callback fired when scale changes */
  onScaleChange?: (scale: number) => void;
  /** Callback fired when pinch starts */
  onPinchStart?: () => void;
  /** Callback fired when pinch ends */
  onPinchEnd?: (scale: number) => void;
  /** Whether gesture is enabled (default: true) */
  enabled?: boolean;
  /** Initial scale value (default: 1) */
  initialScale?: number;
}

/**
 * State returned by the pinch-zoom hook.
 */
export interface PinchZoomState {
  /** Current scale factor */
  readonly scale: number;
  /** Whether a pinch is currently in progress */
  readonly isPinching: boolean;
  /** Reset scale to initial value */
  readonly reset: () => void;
  /** Set scale programmatically */
  readonly setScale: (scale: number) => void;
  /** Center point of the pinch gesture (for transform-origin) */
  readonly pinchCenter: { x: number; y: number } | null;
}

/**
 * Internal touch tracking state.
 */
interface PinchTrackingState {
  initialDistance: number;
  initialScale: number;
  centerX: number;
  centerY: number;
}

/**
 * Calculate distance between two touch points.
 */
function getTouchDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch2.clientX - touch1.clientX;
  const dy = touch2.clientY - touch1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate center point between two touches.
 */
function getTouchCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

/**
 * Pinch-to-zoom gesture hook.
 *
 * Tracks two-finger touch for zoom gestures, calculating scale factor
 * from initial to current distance. Supports min/max constraints.
 * Respects prefers-reduced-motion (returns 1 for scale).
 *
 * @param ref - React ref to the element to track pinch on
 * @param options - Configuration options for pinch zoom
 * @returns PinchZoomState with current scale and helpers
 *
 * @example
 * ```tsx
 * function ZoomableImage() {
 *   const imageRef = useRef<HTMLDivElement>(null);
 *   const pinch = usePinchZoom(imageRef, {
 *     minScale: 0.5,
 *     maxScale: 4,
 *     onScaleChange: (scale) => {
 *       console.log('Scale:', scale);
 *     },
 *   });
 *
 *   return (
 *     <div ref={imageRef} className="touch-manipulation">
 *       <img
 *         src="/photo.jpg"
 *         style={{
 *           transform: `scale(${pinch.scale})`,
 *           transformOrigin: pinch.pinchCenter
 *             ? `${pinch.pinchCenter.x}px ${pinch.pinchCenter.y}px`
 *             : 'center center',
 *         }}
 *       />
 *       {pinch.scale !== 1 && (
 *         <button onClick={pinch.reset}>Reset Zoom</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePinchZoom(
  ref: React.RefObject<HTMLElement | null>,
  options: PinchZoomOptions = {}
): PinchZoomState {
  const {
    minScale = 1,
    maxScale = 4,
    onScaleChange,
    onPinchStart,
    onPinchEnd,
    enabled = true,
    initialScale = 1,
  } = options;

  const prefersReducedMotion = usePrefersReducedMotion();
  const trackingRef = useRef<PinchTrackingState | null>(null);

  // RAF ref for throttling state updates to prevent 60+ re-renders per second
  const rafRef = useRef<number | null>(null);
  // Pending state to batch updates
  const pendingStateRef = useRef<{ scale: number; pinchCenter: { x: number; y: number } } | null>(
    null
  );

  const [scale, setScaleInternal] = useState(initialScale);
  const [isPinching, setIsPinching] = useState(false);
  const [pinchCenter, setPinchCenter] = useState<{ x: number; y: number } | null>(null);

  // Ref to track current scale for event handlers without causing re-renders
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  /**
   * Clamp scale to min/max bounds.
   */
  const clampScale = useCallback(
    (value: number): number => {
      return Math.min(Math.max(value, minScale), maxScale);
    },
    [minScale, maxScale]
  );

  /**
   * Set scale with clamping and callback.
   */
  const setScale = useCallback(
    (newScale: number) => {
      const clamped = clampScale(newScale);
      setScaleInternal(clamped);
      onScaleChange?.(clamped);
    },
    [clampScale, onScaleChange]
  );

  /**
   * Reset scale to initial value.
   */
  const reset = useCallback(() => {
    setScaleInternal(initialScale);
    setPinchCenter(null);
    onScaleChange?.(initialScale);
  }, [initialScale, onScaleChange]);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || prefersReducedMotion) return;

      // Need exactly 2 touches for pinch
      if (e.touches.length !== 2) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const distance = getTouchDistance(touch1, touch2);
      const center = getTouchCenter(touch1, touch2);

      // Get element-relative center
      const element = ref.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        center.x -= rect.left;
        center.y -= rect.top;
      }

      trackingRef.current = {
        initialDistance: distance,
        initialScale: scaleRef.current, // Use ref to avoid stale closure
        centerX: center.x,
        centerY: center.y,
      };

      setIsPinching(true);
      setPinchCenter(center);
      onPinchStart?.();
    },
    [enabled, prefersReducedMotion, ref, onPinchStart] // Removed scale from deps
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !trackingRef.current || prefersReducedMotion) return;

      // Need exactly 2 touches
      if (e.touches.length !== 2) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const currentDistance = getTouchDistance(touch1, touch2);
      const tracking = trackingRef.current;

      // Calculate new scale based on distance ratio
      const scaleChange = currentDistance / tracking.initialDistance;
      const newScale = tracking.initialScale * scaleChange;
      const clampedScale = clampScale(newScale);

      // Update center point
      const center = getTouchCenter(touch1, touch2);
      const element = ref.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        center.x -= rect.left;
        center.y -= rect.top;
      }

      // Store pending state in ref (no re-render)
      pendingStateRef.current = { scale: clampedScale, pinchCenter: center };

      // Schedule RAF update if not already scheduled (throttles to ~60fps max)
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const pending = pendingStateRef.current;
          if (pending) {
            setScaleInternal(pending.scale);
            setPinchCenter(pending.pinchCenter);
          }
        });
      }

      // Callback is still called on every touchmove for smooth external updates
      onScaleChange?.(clampedScale);
    },
    [enabled, prefersReducedMotion, clampScale, onScaleChange, ref]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      // Cancel any pending RAF update before updating final state
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingStateRef.current = null;

      if (!enabled || !trackingRef.current) return;

      // Only end pinch when fewer than 2 touches remain
      if (e.touches.length >= 2) return;

      const finalScale = scaleRef.current; // Use ref to avoid stale closure
      trackingRef.current = null;
      setIsPinching(false);
      onPinchEnd?.(finalScale);
    },
    [enabled, onPinchEnd] // Removed scale from deps
  );

  const handleTouchCancel = useCallback(() => {
    // Cancel any pending RAF update
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingStateRef.current = null;
    trackingRef.current = null;
    setIsPinching(false);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // Prevent default to avoid browser zoom
    const preventDefaultHandler = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
      }
    };

    // Use passive: false to allow preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchmove', preventDefaultHandler, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchmove', preventDefaultHandler);
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

  // Return 1 for reduced motion preference
  if (prefersReducedMotion) {
    return {
      scale: initialScale,
      isPinching: false,
      reset: () => {},
      setScale: () => {},
      pinchCenter: null,
    };
  }

  return {
    scale,
    isPinching,
    reset,
    setScale,
    pinchCenter,
  };
}
