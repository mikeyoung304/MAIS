'use client';

import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Animation type presets.
 */
export type AnimationType = 'scale' | 'bounce' | 'shake' | 'fade' | 'pulse' | 'float';

/**
 * Trigger type for the animation.
 */
export type AnimationTrigger = 'hover' | 'tap' | 'mount' | 'none';

export interface MicroInteractionProps {
  /** Type of animation to apply */
  type: AnimationType;
  /** What triggers the animation */
  trigger: AnimationTrigger;
  /** Content to wrap with the animation */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
  /** Duration multiplier (default: 1) */
  duration?: number;
  /** Delay before animation starts in seconds (default: 0) */
  delay?: number;
  /** Number of times to repeat animation (default: 1, -1 for infinite) */
  repeat?: number;
  /** Whether the component is interactive (enables focus states) */
  interactive?: boolean;
  /** HTML tag to use for the wrapper (default: 'div') */
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Animation variants for each type.
 */
const ANIMATION_VARIANTS: Record<AnimationType, Variants> = {
  scale: {
    initial: { scale: 1 },
    animate: { scale: [1, 1.05, 1] },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  },
  bounce: {
    initial: { y: 0 },
    animate: { y: [0, -8, 0] },
    hover: { y: -4 },
    tap: { y: 2 },
  },
  shake: {
    initial: { x: 0 },
    animate: { x: [0, -4, 4, -4, 4, 0] },
    hover: { x: [0, -2, 2, -2, 2, 0] },
    tap: { x: [0, -4, 4, -4, 4, 0] },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    hover: { opacity: 0.8 },
    tap: { opacity: 0.6 },
  },
  pulse: {
    initial: { scale: 1, opacity: 1 },
    animate: { scale: [1, 1.02, 1], opacity: [1, 0.8, 1] },
    hover: { scale: 1.02 },
    tap: { scale: 0.98 },
  },
  float: {
    initial: { y: 0 },
    animate: { y: [0, -4, 0] },
    hover: { y: -2 },
    tap: { y: 0 },
  },
};

/**
 * Base transition settings for each animation type.
 */
const ANIMATION_TRANSITIONS: Record<AnimationType, object> = {
  scale: {
    type: 'spring',
    stiffness: 400,
    damping: 25,
  },
  bounce: {
    type: 'spring',
    stiffness: 500,
    damping: 30,
  },
  shake: {
    duration: 0.4,
    ease: 'easeInOut',
  },
  fade: {
    duration: 0.3,
    ease: 'easeOut',
  },
  pulse: {
    duration: 0.6,
    ease: 'easeInOut',
  },
  float: {
    duration: 2,
    ease: 'easeInOut',
    repeat: Infinity,
    repeatType: 'reverse' as const,
  },
};

/**
 * Wrapper component for common micro-interactions and animations.
 *
 * Respects prefers-reduced-motion for accessibility.
 *
 * @example
 * ```tsx
 * // Scale on hover
 * <MicroInteraction type="scale" trigger="hover">
 *   <Card>Hoverable card</Card>
 * </MicroInteraction>
 *
 * // Bounce on tap
 * <MicroInteraction type="bounce" trigger="tap">
 *   <Button>Click me</Button>
 * </MicroInteraction>
 *
 * // Fade in on mount
 * <MicroInteraction type="fade" trigger="mount" delay={0.2}>
 *   <p>Fading paragraph</p>
 * </MicroInteraction>
 *
 * // Continuous floating animation
 * <MicroInteraction type="float" trigger="mount">
 *   <Icon />
 * </MicroInteraction>
 * ```
 */
export function MicroInteraction({
  type,
  trigger,
  children,
  className,
  duration = 1,
  delay = 0,
  repeat = 1,
  interactive = false,
  as = 'div',
}: MicroInteractionProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  // Check for reduced motion preference
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const variants = ANIMATION_VARIANTS[type];
  const baseTransition = ANIMATION_TRANSITIONS[type];

  // Build transition with duration and delay modifiers
  const transition = React.useMemo(() => {
    const base = { ...baseTransition };

    // Apply duration multiplier
    if ('duration' in base && typeof base.duration === 'number') {
      (base as { duration: number }).duration *= duration;
    }
    if ('stiffness' in base && typeof base.stiffness === 'number') {
      // For spring animations, adjust stiffness inversely with duration
      (base as { stiffness: number }).stiffness /= duration;
    }

    // Apply repeat
    if (repeat !== 1 && type !== 'float') {
      (base as { repeat?: number }).repeat = repeat === -1 ? Infinity : repeat;
    }

    return {
      ...base,
      delay,
    };
  }, [baseTransition, duration, delay, repeat, type]);

  // If reduced motion is preferred, render without animation
  if (prefersReducedMotion) {
    const Component = as as React.ElementType;
    return <Component className={className}>{children}</Component>;
  }

  // Build animation props based on trigger
  const animationProps: Record<string, unknown> = {
    initial: trigger === 'mount' ? variants.initial : false,
    variants,
    transition,
  };

  switch (trigger) {
    case 'hover':
      animationProps.whileHover = 'hover';
      break;
    case 'tap':
      animationProps.whileTap = 'tap';
      break;
    case 'mount':
      animationProps.animate = 'animate';
      break;
    case 'none':
      // No animation trigger - useful for parent-controlled animations
      break;
  }

  // Create motion component for the specified element type
  const MotionComponent = motion[as as keyof typeof motion] as React.ComponentType<
    React.ComponentProps<typeof motion.div>
  >;

  if (!MotionComponent) {
    // Fallback to motion.div if the element type is not supported
    return (
      <motion.div
        className={cn(
          interactive &&
            'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sage',
          className
        )}
        tabIndex={interactive ? 0 : undefined}
        {...animationProps}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <MotionComponent
      className={cn(
        interactive &&
          'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sage',
        className
      )}
      tabIndex={interactive ? 0 : undefined}
      {...animationProps}
    >
      {children}
    </MotionComponent>
  );
}

MicroInteraction.displayName = 'MicroInteraction';

/**
 * Preset components for common animations.
 */

export function ScaleOnHover({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MicroInteraction type="scale" trigger="hover" className={className}>
      {children}
    </MicroInteraction>
  );
}

export function BounceOnTap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MicroInteraction type="bounce" trigger="tap" className={className}>
      {children}
    </MicroInteraction>
  );
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <MicroInteraction type="fade" trigger="mount" delay={delay} className={className}>
      {children}
    </MicroInteraction>
  );
}

export function FloatingElement({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MicroInteraction type="float" trigger="mount" className={className}>
      {children}
    </MicroInteraction>
  );
}

export function PulseAnimation({
  children,
  className,
  repeat = -1,
}: {
  children: React.ReactNode;
  className?: string;
  repeat?: number;
}) {
  return (
    <MicroInteraction type="pulse" trigger="mount" repeat={repeat} className={className}>
      {children}
    </MicroInteraction>
  );
}
