'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether to show the image area at the top */
  showImage?: boolean;
  /** Whether to animate the shimmer effect */
  animate?: boolean;
}

/**
 * Card-shaped skeleton placeholder matching the app's card styling.
 * Includes image area, title line, and description lines.
 */
const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ className, showImage = true, animate = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-3xl bg-white border border-neutral-100 shadow-elevation-2 overflow-hidden',
          className
        )}
        aria-hidden="true"
        {...props}
      >
        {/* Image area */}
        {showImage && <Skeleton rounded="none" animate={animate} className="aspect-video w-full" />}

        {/* Content area */}
        <div className="p-6 space-y-4">
          {/* Title line */}
          <Skeleton rounded="default" animate={animate} className="h-6 w-3/4" />

          {/* Description lines */}
          <div className="space-y-2">
            <Skeleton rounded="default" animate={animate} className="h-4 w-full" />
            <Skeleton rounded="default" animate={animate} className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }
);
SkeletonCard.displayName = 'SkeletonCard';

export { SkeletonCard };
