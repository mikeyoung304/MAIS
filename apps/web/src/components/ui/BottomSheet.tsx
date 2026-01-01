'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSafeAreaInsets } from '@/hooks/useSafeArea';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePrefersReducedMotion } from '@/hooks/useBreakpoint';

/**
 * Snap point as a percentage of viewport height (0-1).
 */
export type SnapPoint = number;

export interface BottomSheetProps {
  /** Controlled open state */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Snap points as percentages of viewport height (default: [0.5, 1]) */
  snapPoints?: SnapPoint[];
  /** Sheet title for accessibility */
  title?: string;
  /** Optional description for accessibility */
  description?: string;
  /** Sheet content */
  children: React.ReactNode;
  /** Additional class name for the sheet content */
  className?: string;
}

/**
 * Mobile bottom sheet component with drag-to-dismiss and snap points.
 *
 * Built on Radix Dialog for accessibility:
 * - Focus trap when open
 * - Keyboard navigation (Escape to close)
 * - Screen reader announcements
 *
 * Drag behavior powered by Framer Motion:
 * - Drag down to dismiss
 * - Snaps to defined percentage heights
 * - Haptic feedback at snap points
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <Button onClick={() => setOpen(true)}>Open Sheet</Button>
 *
 * <BottomSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   snapPoints={[0.4, 0.75, 1]}
 *   title="Select Option"
 * >
 *   <div className="p-4">
 *     <p>Sheet content here</p>
 *   </div>
 * </BottomSheet>
 * ```
 */
export function BottomSheet({
  open,
  onOpenChange,
  snapPoints = [0.5, 1],
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  const safeArea = useSafeAreaInsets();
  const haptics = useHapticFeedback();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [currentSnapIndex, setCurrentSnapIndex] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  // Track y position for drag
  const y = useMotionValue(0);

  // Get viewport height on mount and resize
  React.useEffect(() => {
    const updateHeight = () => {
      setViewportHeight(window.innerHeight);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Sort snap points in ascending order
  const sortedSnapPoints = React.useMemo(
    () => [...snapPoints].sort((a, b) => a - b),
    [snapPoints]
  );

  // Calculate pixel heights from snap percentages
  const snapHeights = React.useMemo(
    () => sortedSnapPoints.map((point) => viewportHeight * point),
    [sortedSnapPoints, viewportHeight]
  );

  // Initial height is the first (smallest) snap point
  const initialHeight = snapHeights[currentSnapIndex] || snapHeights[0];

  // Transform y motion value to backdrop opacity
  const backdropOpacity = useTransform(
    y,
    [0, initialHeight],
    [0.6, 0]
  );

  // Handle drag end - snap to nearest point or dismiss
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { velocity, offset } = info;
    const currentHeight = initialHeight - offset.y;

    // Threshold for dismissing (30% of initial height or high velocity)
    const dismissThreshold = initialHeight * 0.3;
    const velocityThreshold = 500;

    // Check if should dismiss
    if (offset.y > dismissThreshold || velocity.y > velocityThreshold) {
      haptics.medium();
      onOpenChange(false);
      return;
    }

    // Find nearest snap point
    let nearestIndex = 0;
    let minDistance = Math.abs(snapHeights[0] - currentHeight);

    for (let i = 1; i < snapHeights.length; i++) {
      const distance = Math.abs(snapHeights[i] - currentHeight);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    // Apply velocity bias - if dragging up fast, snap to higher point
    if (velocity.y < -200 && nearestIndex < snapHeights.length - 1) {
      nearestIndex++;
    } else if (velocity.y > 200 && nearestIndex > 0) {
      nearestIndex--;
    }

    if (nearestIndex !== currentSnapIndex) {
      haptics.selection();
    }
    setCurrentSnapIndex(nearestIndex);
  };

  // Reset snap index when sheet opens
  React.useEffect(() => {
    if (open) {
      setCurrentSnapIndex(0);
      y.set(0);
    }
  }, [open, y]);

  const sheetHeight = snapHeights[currentSnapIndex] || snapHeights[0];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Backdrop with blur */}
            <DialogPrimitive.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={prefersReducedMotion ? { duration: 0.15 } : undefined}
                style={{ opacity: backdropOpacity }}
                onClick={() => onOpenChange(false)}
              />
            </DialogPrimitive.Overlay>

            {/* Sheet content */}
            <DialogPrimitive.Content asChild>
              <motion.div
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50',
                  'bg-white dark:bg-surface-alt',
                  'rounded-t-3xl shadow-elevation-4',
                  'flex flex-col',
                  'focus:outline-none',
                  className
                )}
                style={{
                  height: sheetHeight,
                  paddingBottom: safeArea.bottom,
                  y,
                }}
                initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
                animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.15 }
                    : {
                        type: 'spring',
                        damping: 30,
                        stiffness: 300,
                      }
                }
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                  <div
                    className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full"
                    aria-hidden="true"
                  />
                </div>

                {/* Header with title */}
                {(title || description) && (
                  <div className="px-6 pb-4 border-b border-neutral-100 dark:border-neutral-700">
                    {title && (
                      <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">
                        {title}
                      </DialogPrimitive.Title>
                    )}
                    {description && (
                      <DialogPrimitive.Description className="text-sm text-text-muted mt-1">
                        {description}
                      </DialogPrimitive.Description>
                    )}
                  </div>
                )}

                {/* Content area with scroll */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                  {children}
                </div>

                {/* Hidden close button for keyboard navigation */}
                <DialogPrimitive.Close className="sr-only">
                  Close
                </DialogPrimitive.Close>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

BottomSheet.displayName = 'BottomSheet';

/**
 * Convenience exports for common sheet patterns.
 */
export const BottomSheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-6 py-4', className)} {...props} />
);
BottomSheetHeader.displayName = 'BottomSheetHeader';

export const BottomSheetBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-6 py-4', className)} {...props} />
);
BottomSheetBody.displayName = 'BottomSheetBody';

export const BottomSheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'px-6 py-4 border-t border-neutral-100 dark:border-neutral-700 mt-auto',
      className
    )}
    style={{
      paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px))`,
    }}
    {...props}
  />
);
BottomSheetFooter.displayName = 'BottomSheetFooter';
