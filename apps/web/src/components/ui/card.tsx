'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-3xl transition-all duration-300 ease-smooth relative overflow-hidden',
  {
    variants: {
      colorScheme: {
        default: [
          'bg-white text-neutral-900',
          'shadow-elevation-2 hover:shadow-elevation-3',
          'border border-neutral-100/30',
          'backdrop-blur-xs',
          'before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/80 before:to-transparent before:pointer-events-none',
          'hover:-translate-y-0.5',
        ],
        navy: [
          'bg-gradient-navy text-white',
          'shadow-elevation-2 hover:shadow-elevation-3',
          'border border-macon-navy-dark',
          'hover:-translate-y-0.5',
        ],
        orange: [
          'bg-gradient-orange text-white',
          'shadow-elevation-2 hover:shadow-elevation-3',
          'border border-macon-orange-dark',
          'hover:-translate-y-0.5',
        ],
        teal: [
          'bg-gradient-teal text-white',
          'shadow-elevation-2 hover:shadow-elevation-3',
          'border border-macon-teal-dark',
          'hover:-translate-y-0.5',
        ],
        purple: [
          'bg-gradient-to-br from-macon-navy to-macon-navy-dark text-white',
          'shadow-elevation-2 hover:shadow-elevation-3',
          'border border-macon-navy-dark',
          'hover:-translate-y-0.5',
        ],
        sage: [
          'bg-gradient-to-br from-macon-teal to-macon-teal-dark text-white',
          'shadow-elevation-2 hover:shadow-elevation-3',
          'border border-macon-teal-dark',
          'hover:-translate-y-0.5',
        ],
      },
    },
    defaultVariants: {
      colorScheme: 'default',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, colorScheme, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ colorScheme }), className)} {...props} />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-2 p-6 pb-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm opacity-90', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-4 border-t border-neutral-100/50', className)}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
