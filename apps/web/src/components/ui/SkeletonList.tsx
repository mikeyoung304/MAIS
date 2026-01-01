'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

export interface SkeletonListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of skeleton list items to render */
  count?: number;
  /** Whether to animate the shimmer effect */
  animate?: boolean;
}

/**
 * List-shaped skeleton placeholder with avatar circles and text lines.
 * Ideal for loading states in list views.
 */
const SkeletonList = React.forwardRef<HTMLDivElement, SkeletonListProps>(
  ({ className, count = 3, animate = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('space-y-4', className)}
        aria-hidden="true"
        {...props}
      >
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            {/* Avatar circle */}
            <Skeleton
              rounded="full"
              animate={animate}
              className="h-10 w-10 flex-shrink-0"
            />

            {/* Text lines */}
            <div className="flex-1 space-y-2">
              <Skeleton
                rounded="default"
                animate={animate}
                className="h-4 w-3/4"
              />
              <Skeleton
                rounded="default"
                animate={animate}
                className="h-3 w-1/2"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
);
SkeletonList.displayName = 'SkeletonList';

export { SkeletonList };
