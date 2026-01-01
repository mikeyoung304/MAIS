'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type TouchEvent as ReactTouchEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Image from 'next/image';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/useBreakpoint';
import { triggerHaptic } from '@/hooks/useHapticFeedback';
import { PinchZoom } from './PinchZoom';
import { cn } from '@/lib/utils';

export interface LightboxImage {
  /** Image source URL */
  src: string;
  /** Image alt text for accessibility */
  alt: string;
}

export interface ImageLightboxProps {
  /** Array of images to display */
  images: LightboxImage[];
  /** Initial image index to display */
  initialIndex?: number;
  /** Whether the lightbox is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

// Swipe threshold in pixels
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const CLOSE_THRESHOLD = 100;

/**
 * Full-screen image lightbox with gestures.
 *
 * Features:
 * - Pinch-to-zoom (1-4x scale)
 * - Double-tap to zoom in/out
 * - Swipe between images with momentum
 * - Swipe up/down to close
 * - Image counter (3/12)
 * - Keyboard navigation (arrows, escape)
 * - Preloads adjacent images
 * - Spring-based animations
 * - Respects prefers-reduced-motion
 */
export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageLightboxProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [direction, setDirection] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(true);

  // Motion values for gestures
  const swipeX = useMotionValue(0);
  const swipeY = useMotionValue(0);
  const opacity = useMotionValue(1);

  // Touch tracking
  const touchState = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isHorizontal: null as boolean | null,
  });

  // Reset index when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setIsZoomed(false);
      setIsImageLoading(true);
    }
  }, [open, initialIndex]);

  // Preload adjacent images
  useEffect(() => {
    if (!open || images.length <= 1) return;

    const preloadIndexes = [
      (currentIndex - 1 + images.length) % images.length,
      (currentIndex + 1) % images.length,
    ];

    preloadIndexes.forEach((index) => {
      const img = new window.Image();
      img.src = images[index].src;
    });
  }, [open, currentIndex, images]);

  // Animation config
  const springConfig = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 300, damping: 30 };

  /**
   * Navigate to previous image
   */
  const goToPrevious = useCallback(() => {
    if (isZoomed || images.length <= 1) return;
    triggerHaptic('selection');
    setDirection(-1);
    setIsImageLoading(true);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [isZoomed, images.length]);

  /**
   * Navigate to next image
   */
  const goToNext = useCallback(() => {
    if (isZoomed || images.length <= 1) return;
    triggerHaptic('selection');
    setDirection(1);
    setIsImageLoading(true);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [isZoomed, images.length]);

  /**
   * Close the lightbox
   */
  const closeLightbox = useCallback(() => {
    triggerHaptic('light');
    onOpenChange(false);
  }, [onOpenChange]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'Escape':
          e.preventDefault();
          closeLightbox();
          break;
      }
    },
    [goToPrevious, goToNext, closeLightbox]
  );

  /**
   * Handle touch start
   */
  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (isZoomed) return;

      const touch = e.touches[0];
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isHorizontal: null,
      };
    },
    [isZoomed]
  );

  /**
   * Handle touch move
   */
  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (isZoomed) return;

      const touch = e.touches[0];
      const state = touchState.current;
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      // Determine swipe direction on first significant move
      if (state.isHorizontal === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          state.isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      if (state.isHorizontal === true) {
        // Horizontal swipe - navigate between images
        swipeX.set(deltaX);
        // Reduce opacity at edges
        const resistance = images.length > 1 ? 1 : 0.3;
        swipeX.set(deltaX * resistance);
      } else if (state.isHorizontal === false) {
        // Vertical swipe - close gesture
        swipeY.set(deltaY);
        // Fade out as we swipe
        const progress = Math.abs(deltaY) / CLOSE_THRESHOLD;
        opacity.set(Math.max(0.3, 1 - progress * 0.7));
      }
    },
    [isZoomed, swipeX, swipeY, opacity, images.length]
  );

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (isZoomed) return;

      const state = touchState.current;
      const endTime = Date.now();
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      const duration = endTime - state.startTime;
      const velocityX = Math.abs(deltaX) / duration;
      const velocityY = Math.abs(deltaY) / duration;

      if (state.isHorizontal === true) {
        // Horizontal swipe
        const shouldNavigate =
          Math.abs(deltaX) > SWIPE_THRESHOLD ||
          velocityX > SWIPE_VELOCITY_THRESHOLD;

        if (shouldNavigate && images.length > 1) {
          if (deltaX > 0) {
            goToPrevious();
          } else {
            goToNext();
          }
        }

        // Reset horizontal position
        animate(swipeX, 0, springConfig);
      } else if (state.isHorizontal === false) {
        // Vertical swipe
        const shouldClose =
          Math.abs(deltaY) > CLOSE_THRESHOLD ||
          velocityY > SWIPE_VELOCITY_THRESHOLD;

        if (shouldClose) {
          closeLightbox();
        } else {
          // Bounce back
          animate(swipeY, 0, springConfig);
          animate(opacity, 1, springConfig);
        }
      }

      // Reset touch state
      touchState.current.isHorizontal = null;
    },
    [
      isZoomed,
      images.length,
      swipeX,
      swipeY,
      opacity,
      goToPrevious,
      goToNext,
      closeLightbox,
      springConfig,
    ]
  );

  /**
   * Handle zoom state change from PinchZoom
   */
  const handleZoomChange = useCallback((scale: number) => {
    setIsZoomed(scale > 1.05);
  }, []);

  // Slide animation variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/95 backdrop-blur-sm',
            !prefersReducedMotion && 'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
          onKeyDown={handleKeyDown}
          aria-label={`Image ${currentIndex + 1} of ${images.length}`}
        >
          {/* Header with counter and close button */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
            {/* Image counter */}
            <span className="text-white/90 text-sm font-medium tabular-nums">
              {currentIndex + 1} / {images.length}
            </span>

            {/* Close button */}
            <DialogPrimitive.Close
              className="rounded-full p-2 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Close lightbox"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Navigation buttons (desktop) */}
          {images.length > 1 && !isZoomed && (
            <>
              <button
                onClick={goToPrevious}
                className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full p-3 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={goToNext}
                className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full p-3 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Image container with gestures */}
          <motion.div
            className="w-full h-full flex items-center justify-center"
            style={{
              x: swipeX,
              y: swipeY,
              opacity,
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={prefersReducedMotion ? undefined : slideVariants}
                initial={prefersReducedMotion ? undefined : 'enter'}
                animate="center"
                exit={prefersReducedMotion ? undefined : 'exit'}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 300, damping: 30 }
                }
                className="w-full h-full flex items-center justify-center p-4 md:p-8"
              >
                <PinchZoom
                  maxScale={4}
                  minScale={1}
                  onZoomChange={handleZoomChange}
                  resetKey={currentIndex}
                  className="w-full h-full flex items-center justify-center"
                >
                  <div className="relative w-full h-full max-w-5xl max-h-[85vh]">
                    {/* Loading skeleton */}
                    {isImageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}

                    <Image
                      src={currentImage.src}
                      alt={currentImage.alt}
                      fill
                      className={cn(
                        'object-contain transition-opacity duration-300',
                        isImageLoading ? 'opacity-0' : 'opacity-100'
                      )}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                      priority
                      onLoad={() => setIsImageLoading(false)}
                      draggable={false}
                    />
                  </div>
                </PinchZoom>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Pagination dots (mobile) */}
          {images.length > 1 && images.length <= 10 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-0 md:hidden">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (isZoomed) return;
                    triggerHaptic('selection');
                    setDirection(index > currentIndex ? 1 : -1);
                    setIsImageLoading(true);
                    setCurrentIndex(index);
                  }}
                  className="p-4 -m-2"
                  aria-label={`Go to image ${index + 1}`}
                  aria-current={index === currentIndex ? 'true' : undefined}
                >
                  <span
                    className={cn(
                      'block w-2 h-2 rounded-full transition-all',
                      index === currentIndex
                        ? 'bg-white w-4'
                        : 'bg-white/40 hover:bg-white/60'
                    )}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Hidden title for accessibility */}
          <DialogPrimitive.Title className="sr-only">
            {currentImage.alt}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Image {currentIndex + 1} of {images.length}. Use arrow keys to navigate,
            escape to close. Pinch to zoom on touch devices.
          </DialogPrimitive.Description>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
