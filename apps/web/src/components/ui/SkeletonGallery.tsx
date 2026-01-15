'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

const skeletonGalleryVariants = cva('grid gap-4', {
  variants: {
    columns: {
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    },
  },
  defaultVariants: {
    columns: 3,
  },
});

export interface SkeletonGalleryProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonGalleryVariants> {
  /** Number of skeleton items to render */
  count?: number;
  /** Whether to animate the shimmer effect */
  animate?: boolean;
}

/**
 * Gallery grid skeleton placeholder with responsive columns.
 * Square aspect-ratio items with rounded corners matching gallery styling.
 */
const SkeletonGallery = React.forwardRef<HTMLDivElement, SkeletonGalleryProps>(
  ({ className, columns, count = 6, animate = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonGalleryVariants({ columns }), className)}
        aria-hidden="true"
        {...props}
      >
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} rounded="xl" animate={animate} className="aspect-square w-full" />
        ))}
      </div>
    );
  }
);
SkeletonGallery.displayName = 'SkeletonGallery';

export { SkeletonGallery, skeletonGalleryVariants };
