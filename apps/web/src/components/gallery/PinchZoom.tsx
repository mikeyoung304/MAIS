'use client';

import {
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { motion, useSpring, useMotionValue, animate } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/useBreakpoint';
import { triggerHaptic } from '@/hooks/useHapticFeedback';

export interface PinchZoomProps {
  /** Content to display with zoom capabilities */
  children: ReactNode;
  /** Maximum zoom scale (default: 4) */
  maxScale?: number;
  /** Minimum zoom scale (default: 1) */
  minScale?: number;
  /** Callback when zoom level changes */
  onZoomChange?: (scale: number) => void;
  /** Reset zoom when this key changes */
  resetKey?: string | number;
  /** Class name for the container */
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Gesture-controlled zoom component for images.
 *
 * Features:
 * - Pinch-to-zoom with touch gestures
 * - Double-tap to toggle zoom (1x / 2x)
 * - Pan when zoomed in
 * - Smooth spring animations
 * - Respects prefers-reduced-motion
 */
export function PinchZoom({
  children,
  maxScale = 4,
  minScale = 1,
  onZoomChange,
  resetKey,
  className = '',
}: PinchZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Motion values for smooth animations
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring configs for smooth animations
  const springConfig = prefersReducedMotion
    ? { duration: 0 }
    : { stiffness: 300, damping: 30, mass: 1 };

  const scaleSpring = useSpring(scale, springConfig);
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  // Track gesture state
  const gestureState = useRef({
    isPinching: false,
    isPanning: false,
    initialDistance: 0,
    initialScale: 1,
    lastTap: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  // Reset zoom when resetKey changes
  useEffect(() => {
    resetZoom();
  }, [resetKey]);

  // Notify parent of zoom changes
  useEffect(() => {
    const unsubscribe = scale.on('change', (value) => {
      onZoomChange?.(value);
    });
    return unsubscribe;
  }, [scale, onZoomChange]);

  /**
   * Reset zoom to default state
   */
  const resetZoom = useCallback(() => {
    animate(scale, 1, springConfig);
    animate(x, 0, springConfig);
    animate(y, 0, springConfig);
  }, [scale, x, y, springConfig]);

  /**
   * Calculate distance between two touch points
   */
  const getDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /**
   * Constrain pan position within bounds
   */
  const constrainPosition = useCallback(
    (posX: number, posY: number, currentScale: number): Point => {
      if (!containerRef.current || currentScale <= 1) {
        return { x: 0, y: 0 };
      }

      const container = containerRef.current.getBoundingClientRect();
      const maxX = (container.width * (currentScale - 1)) / 2;
      const maxY = (container.height * (currentScale - 1)) / 2;

      return {
        x: Math.max(-maxX, Math.min(maxX, posX)),
        y: Math.max(-maxY, Math.min(maxY, posY)),
      };
    },
    []
  );

  /**
   * Handle touch start
   */
  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const touches = e.touches;
      const state = gestureState.current;
      const currentScale = scale.get();

      if (touches.length === 2) {
        // Pinch gesture start
        state.isPinching = true;
        state.isPanning = false;
        state.initialDistance = getDistance(touches);
        state.initialScale = currentScale;
      } else if (touches.length === 1) {
        // Single touch - check for double tap or pan
        const now = Date.now();
        const touch = touches[0];

        if (now - state.lastTap < 300) {
          // Double tap detected
          e.preventDefault();
          triggerHaptic('selection');

          if (currentScale > 1.05) {
            // Zoomed in - reset
            resetZoom();
          } else {
            // Zoom to 2x at tap position
            const container = containerRef.current?.getBoundingClientRect();
            if (container) {
              const tapX = touch.clientX - container.left - container.width / 2;
              const tapY = touch.clientY - container.top - container.height / 2;
              const targetScale = 2;

              animate(scale, targetScale, springConfig);
              animate(x, (-tapX * (targetScale - 1)) / targetScale, springConfig);
              animate(y, (-tapY * (targetScale - 1)) / targetScale, springConfig);
            }
          }
          state.lastTap = 0; // Reset to prevent triple tap
        } else {
          state.lastTap = now;

          // Start pan if zoomed
          if (currentScale > 1.05) {
            state.isPanning = true;
            state.startX = touch.clientX;
            state.startY = touch.clientY;
            state.lastX = x.get();
            state.lastY = y.get();
          }
        }
      }
    },
    [scale, x, y, resetZoom, springConfig]
  );

  /**
   * Handle touch move
   */
  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const touches = e.touches;
      const state = gestureState.current;

      if (state.isPinching && touches.length === 2) {
        e.preventDefault();

        const currentDistance = getDistance(touches);
        const ratio = currentDistance / state.initialDistance;
        const newScale = Math.max(minScale, Math.min(maxScale, state.initialScale * ratio));

        scale.set(newScale);

        // Adjust position based on scale
        const constrained = constrainPosition(x.get(), y.get(), newScale);
        x.set(constrained.x);
        y.set(constrained.y);
      } else if (state.isPanning && touches.length === 1) {
        e.preventDefault();

        const touch = touches[0];
        const deltaX = touch.clientX - state.startX;
        const deltaY = touch.clientY - state.startY;

        const newX = state.lastX + deltaX;
        const newY = state.lastY + deltaY;

        const constrained = constrainPosition(newX, newY, scale.get());
        x.set(constrained.x);
        y.set(constrained.y);
      }
    },
    [scale, x, y, minScale, maxScale, constrainPosition]
  );

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback(
    (_e: ReactTouchEvent<HTMLDivElement>) => {
      const state = gestureState.current;
      const currentScale = scale.get();

      if (state.isPinching) {
        // Snap to bounds if needed
        if (currentScale < minScale) {
          animate(scale, minScale, springConfig);
          animate(x, 0, springConfig);
          animate(y, 0, springConfig);
        } else if (currentScale > maxScale) {
          animate(scale, maxScale, springConfig);
        } else if (currentScale < 1.1) {
          // Snap back to 1 if close
          resetZoom();
        }

        // Provide haptic feedback
        triggerHaptic('light');
      }

      if (state.isPanning) {
        // Apply momentum and constrain final position
        const constrained = constrainPosition(x.get(), y.get(), currentScale);
        animate(x, constrained.x, springConfig);
        animate(y, constrained.y, springConfig);
      }

      state.isPinching = false;
      state.isPanning = false;
    },
    [scale, x, y, minScale, maxScale, resetZoom, constrainPosition, springConfig]
  );

  /**
   * Handle mouse wheel zoom (for desktop)
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const currentScale = scale.get();
      const delta = e.deltaY * -0.01;
      const newScale = Math.max(minScale, Math.min(maxScale, currentScale + delta));

      animate(scale, newScale, springConfig);

      // Constrain position
      const constrained = constrainPosition(x.get(), y.get(), newScale);
      animate(x, constrained.x, springConfig);
      animate(y, constrained.y, springConfig);
    },
    [scale, x, y, minScale, maxScale, constrainPosition, springConfig]
  );

  /**
   * Handle double click (for desktop)
   */
  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const currentScale = scale.get();
      triggerHaptic('selection');

      if (currentScale > 1.05) {
        resetZoom();
      } else {
        const container = containerRef.current?.getBoundingClientRect();
        if (container) {
          const clickX = e.clientX - container.left - container.width / 2;
          const clickY = e.clientY - container.top - container.height / 2;
          const targetScale = 2;

          animate(scale, targetScale, springConfig);
          animate(x, (-clickX * (targetScale - 1)) / targetScale, springConfig);
          animate(y, (-clickY * (targetScale - 1)) / targetScale, springConfig);
        }
      }
    },
    [scale, x, y, resetZoom, springConfig]
  );

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden touch-none select-none ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <motion.div
        ref={contentRef}
        style={{
          scale: scaleSpring,
          x: xSpring,
          y: ySpring,
          transformOrigin: 'center center',
        }}
        className="w-full h-full will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
