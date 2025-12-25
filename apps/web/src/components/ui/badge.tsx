'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-macon-navy text-white shadow-sm hover:bg-macon-navy/80',
        secondary:
          'border-transparent bg-sage/10 text-sage-700 shadow-sm hover:bg-sage/20',
        destructive:
          'border-transparent bg-danger-500 text-white shadow-sm hover:bg-danger-500/80',
        outline: 'text-text-primary border-neutral-300',
        success:
          'border-transparent bg-success-100 text-success-800 shadow-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
