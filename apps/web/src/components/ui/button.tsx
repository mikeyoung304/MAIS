'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold touch-manipulation relative overflow-hidden isolate ' +
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-macon-navy/30 focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed ' +
    'transform-gpu',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-navy text-white shadow-elevation-2 ' +
          'hover:shadow-elevation-3 hover:scale-[1.02] ' +
          'active:scale-[0.98] active:shadow-inner ' +
          'transition-all duration-150 ease-spring ' +
          'before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/10 before:to-transparent before:opacity-0 ' +
          'hover:before:opacity-100 before:transition-opacity before:-z-10',
        destructive:
          'bg-gradient-to-br from-danger-500 to-danger-600 text-white shadow-elevation-2 ' +
          'hover:shadow-glow-urgent hover:scale-[1.02] ' +
          'active:scale-[0.98] active:shadow-inner ' +
          'transition-all duration-150 ease-spring',
        outline:
          'border-2 border-macon-navy/20 bg-transparent text-macon-navy ' +
          'hover:bg-gradient-to-br hover:from-macon-navy/5 hover:to-macon-navy/10 ' +
          'hover:border-macon-navy/30 hover:shadow-elevation-1 ' +
          'active:scale-[0.98] active:shadow-inner ' +
          'transition-all duration-150 ease-spring',
        secondary:
          'bg-gradient-orange text-white shadow-elevation-2 ' +
          'hover:shadow-glow-orange hover:scale-[1.02] ' +
          'active:scale-[0.98] active:shadow-inner ' +
          'transition-all duration-150 ease-spring ' +
          'before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/10 before:to-transparent before:opacity-0 ' +
          'hover:before:opacity-100 before:transition-opacity before:-z-10',
        ghost:
          'text-macon-navy hover:bg-gradient-to-br hover:from-macon-navy/5 hover:to-transparent ' +
          'hover:text-macon-navy-dark ' +
          'active:scale-[0.98] active:shadow-inner ' +
          'transition-all duration-150 ease-spring',
        link:
          'text-macon-orange underline-offset-4 hover:underline hover:text-macon-orange-dark ' +
          'active:scale-[0.98] ' +
          'transition-all duration-150 ease-spring',
        teal:
          'bg-gradient-teal text-white shadow-elevation-2 ' +
          'hover:shadow-glow-teal hover:scale-[1.05] ' +
          'active:scale-[0.95] active:shadow-inner ' +
          'transition-all duration-150 ease-spring ' +
          'before:absolute before:inset-0 before:bg-gradient-to-t before:from-white/10 before:to-transparent before:opacity-0 ' +
          'hover:before:opacity-100 before:transition-opacity before:-z-10',
        success:
          'bg-gradient-to-br from-success-500 to-success-600 text-white shadow-glow-success ' +
          'animate-bounce-in pointer-events-none',
        sage:
          'bg-sage hover:bg-sage-hover text-white rounded-full shadow-lg ' +
          'hover:shadow-xl hover:-translate-y-0.5 ' +
          'transition-all duration-300',
      },
      size: {
        default: 'h-11 px-6 py-2 min-w-[44px]',
        sm: 'min-h-11 rounded-lg px-4 min-w-[44px] text-sm',
        lg: 'h-12 rounded-lg px-8 min-w-[48px] text-base',
        xl: 'h-14 rounded-full px-10 py-4 text-lg',
        icon: 'h-11 w-11 min-w-[44px]',
        touch: 'h-12 w-12 min-w-[48px] text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'teal'
    | 'success'
    | 'sage';
  isLoading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loadingText,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
