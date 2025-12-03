/**
 * Animation Constants
 *
 * Centralized animation timing values for consistent UI behavior.
 * Use these constants instead of magic numbers in Tailwind classes.
 *
 * Usage:
 * ```tsx
 * import { ANIMATION_DURATION } from '@/lib/animation-constants';
 *
 * // In Tailwind classes
 * className={`transition-all ${ANIMATION_DURATION.NORMAL}`}
 * ```
 */

/**
 * Standard transition durations for Tailwind classes
 * Maps to Tailwind's duration-* utilities
 */
export const ANIMATION_DURATION = {
  /** 150ms - Fast micro-interactions (hover states, focus rings) */
  FAST: 'duration-150',
  /** 200ms - Standard quick transitions (button states, simple animations) */
  QUICK: 'duration-200',
  /** 300ms - Normal UI animations (cards, dropdowns, modals) */
  NORMAL: 'duration-300',
  /** 500ms - Slower animations (page transitions, large elements) */
  SLOW: 'duration-500',
  /** 700ms - Very slow animations (special effects) */
  VERY_SLOW: 'duration-700',
} as const;

/**
 * Standard transition delays for Tailwind classes
 * Maps to Tailwind's delay-* utilities
 */
export const ANIMATION_DELAY = {
  /** 75ms - Minimal delay */
  MINIMAL: 'delay-75',
  /** 150ms - Short delay */
  SHORT: 'delay-150',
  /** 300ms - Standard delay */
  NORMAL: 'delay-300',
  /** 500ms - Long delay */
  LONG: 'delay-500',
} as const;

/**
 * Common transition combinations for Tailwind classes
 */
export const ANIMATION_TRANSITION = {
  /** All properties with normal duration */
  ALL: 'transition-all',
  /** Colors only */
  COLORS: 'transition-colors',
  /** Opacity only */
  OPACITY: 'transition-opacity',
  /** Transform only (scale, rotate, translate) */
  TRANSFORM: 'transition-transform',
  /** Default smooth transition (all properties, 200ms) */
  DEFAULT: `transition-all ${ANIMATION_DURATION.QUICK}`,
  /** Smooth color transition (200ms) */
  COLOR_DEFAULT: `transition-colors ${ANIMATION_DURATION.QUICK}`,
  /** Smooth hover effect (all properties, 300ms) */
  HOVER: `transition-all ${ANIMATION_DURATION.NORMAL}`,
} as const;

/**
 * Numeric duration values (in milliseconds) for JavaScript animations
 * Use these with setTimeout, setInterval, or animation libraries
 */
export const ANIMATION_DURATION_MS = {
  /** 150ms */
  FAST: 150,
  /** 200ms */
  QUICK: 200,
  /** 300ms */
  NORMAL: 300,
  /** 500ms */
  SLOW: 500,
  /** 700ms */
  VERY_SLOW: 700,
} as const;

/**
 * Numeric delay values (in milliseconds) for JavaScript animations
 */
export const ANIMATION_DELAY_MS = {
  /** 75ms */
  MINIMAL: 75,
  /** 150ms */
  SHORT: 150,
  /** 300ms */
  NORMAL: 300,
  /** 500ms */
  LONG: 500,
} as const;
