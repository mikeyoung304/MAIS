'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const skeletonVariants = cva('bg-neutral-200 relative overflow-hidden', {
  variants: {
    rounded: {
      none: 'rounded-none',
      default: 'rounded-lg',
      full: 'rounded-full',
      '3xl': 'rounded-3xl',
      xl: 'rounded-xl',
    },
    animate: {
      true: 'after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent after:animate-shimmer motion-reduce:after:animate-none',
      false: '',
    },
  },
  defaultVariants: {
    rounded: 'default',
    animate: true,
  },
});

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: string | number;
  height?: string | number;
}

/**
 * Base skeleton loading placeholder component.
 * Respects prefers-reduced-motion via Tailwind's motion-reduce utility.
 */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, rounded, animate, width, height, style, ...props }, ref) => {
    const inlineStyles: React.CSSProperties = {
      ...style,
      ...(width !== undefined && { width: typeof width === 'number' ? `${width}px` : width }),
      ...(height !== undefined && { height: typeof height === 'number' ? `${height}px` : height }),
    };

    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ rounded, animate }), className)}
        style={inlineStyles}
        aria-hidden="true"
        {...props}
      />
    );
  }
);
Skeleton.displayName = 'Skeleton';

export { Skeleton, skeletonVariants };
