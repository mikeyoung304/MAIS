'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

/**
 * Button variants with built-in press feedback.
 */
const pressableButtonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium',
    'ring-offset-background transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    // Press feedback - scale down on active
    'active:scale-[0.97] active:shadow-inner',
    'motion-reduce:active:scale-100 motion-reduce:transition-none',
  ],
  {
    variants: {
      variant: {
        default: 'bg-sage text-white hover:bg-sage-dark active:bg-sage-dark',
        secondary: 'bg-surface-alt text-text-primary hover:bg-neutral-200',
        outline: 'border border-neutral-300 bg-transparent hover:bg-neutral-100',
        ghost: 'bg-transparent hover:bg-neutral-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        link: 'text-sage underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        default: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        xl: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface PressableButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof pressableButtonVariants> {
  /** Render as child component (for Link, etc.) */
  asChild?: boolean;
  /** Whether to trigger haptic feedback on press */
  haptic?: boolean;
  /** Haptic feedback intensity */
  hapticIntensity?: 'light' | 'medium' | 'heavy';
  /** Whether the button is in a loading state */
  isLoading?: boolean;
  /** Custom loading spinner */
  loadingSpinner?: React.ReactNode;
}

/**
 * PressableButton - Button with native-feeling press feedback.
 *
 * Features:
 * - Scale animation on press (active:scale-[0.97])
 * - Optional haptic feedback for supported devices
 * - Loading state with spinner
 * - Respects prefers-reduced-motion
 * - Full accessibility support
 *
 * @example
 * ```tsx
 * <PressableButton variant="default" haptic>
 *   Save Changes
 * </PressableButton>
 *
 * <PressableButton variant="outline" isLoading>
 *   Processing...
 * </PressableButton>
 * ```
 */
export const PressableButton = React.forwardRef<HTMLButtonElement, PressableButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      haptic = false,
      hapticIntensity = 'light',
      isLoading = false,
      loadingSpinner,
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { trigger } = useHapticFeedback();
    const Comp = asChild ? Slot : 'button';

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (haptic) {
        trigger(hapticIntensity);
      }
      onClick?.(e);
    };

    return (
      <Comp
        ref={ref}
        className={cn(pressableButtonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        onClick={handleClick}
        {...props}
      >
        {isLoading && (
          <>
            {loadingSpinner ?? (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
          </>
        )}
        {children}
      </Comp>
    );
  }
);

PressableButton.displayName = 'PressableButton';

export { pressableButtonVariants };
