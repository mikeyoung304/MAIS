/**
 * Responsive Type System
 *
 * Branded types for media queries and breakpoints to prevent stringly-typed errors.
 * All breakpoints are aligned with Tailwind CSS defaults.
 *
 * @example
 * ```ts
 * import { MEDIA_QUERIES, createMediaQuery } from '@/types/responsive';
 *
 * // Use pre-defined queries
 * const isMobile = useMediaQuery(MEDIA_QUERIES.isMobile);
 *
 * // Create custom queries with type safety
 * const customQuery = createMediaQuery('min-width', 'lg');
 * ```
 */

// Brand symbol for nominal typing
declare const __brand: unique symbol;
type Brand<K, T> = K & { readonly [__brand]: T };

/**
 * Branded type for media query strings.
 * Prevents accidentally passing arbitrary strings to media query hooks.
 */
export type MediaQueryString = Brand<string, 'MediaQueryString'>;

/**
 * Tailwind-aligned breakpoint values in pixels.
 * These match the default Tailwind configuration.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;
export type BreakpointValue = (typeof BREAKPOINTS)[BreakpointKey];

/**
 * Creates a type-safe media query string.
 *
 * @param type - The comparison type ('min-width' or 'max-width')
 * @param breakpoint - Either a breakpoint key or a pixel value
 * @returns A branded MediaQueryString
 *
 * @example
 * ```ts
 * createMediaQuery('min-width', 'md'); // "(min-width: 768px)"
 * createMediaQuery('max-width', 600);   // "(max-width: 600px)"
 * ```
 */
export function createMediaQuery(
  type: 'min-width' | 'max-width',
  breakpoint: BreakpointKey | number
): MediaQueryString {
  const value =
    typeof breakpoint === 'string' ? BREAKPOINTS[breakpoint] : breakpoint;
  return `(${type}: ${value}px)` as MediaQueryString;
}

/**
 * Creates a raw media query string without type conversion.
 * Use for non-dimension queries like prefers-reduced-motion.
 */
export function createRawMediaQuery(query: string): MediaQueryString {
  return query as MediaQueryString;
}

/**
 * Pre-defined media queries for common use cases.
 * These are the recommended queries to use throughout the app.
 */
export const MEDIA_QUERIES = {
  /** Viewport width < 768px (mobile devices) */
  isMobile: createMediaQuery('max-width', 'md'),

  /** Viewport width >= 768px (tablet and up) */
  isTablet: createMediaQuery('min-width', 'md'),

  /** Viewport width >= 1024px (desktop) */
  isDesktop: createMediaQuery('min-width', 'lg'),

  /** Viewport width >= 1280px (large desktop) */
  isLargeDesktop: createMediaQuery('min-width', 'xl'),

  /** Small devices (< 640px) */
  isSmall: createMediaQuery('max-width', 'sm'),

  /** User prefers reduced motion */
  prefersReducedMotion: createRawMediaQuery(
    '(prefers-reduced-motion: reduce)'
  ),

  /** User prefers more contrast */
  prefersHighContrast: createRawMediaQuery(
    '(prefers-contrast: more)'
  ),

  /** Device supports hover (typically non-touch) */
  supportsHover: createRawMediaQuery('(hover: hover)'),

  /** Device has coarse pointer (touch) */
  supportsTouch: createRawMediaQuery('(pointer: coarse)'),

  /** Device is in portrait orientation */
  isPortrait: createRawMediaQuery('(orientation: portrait)'),

  /** Device is in landscape orientation */
  isLandscape: createRawMediaQuery('(orientation: landscape)'),

  /** Device has dark mode preference */
  prefersDark: createRawMediaQuery('(prefers-color-scheme: dark)'),

  /** Device has light mode preference */
  prefersLight: createRawMediaQuery('(prefers-color-scheme: light)'),
} as const;

/**
 * Type guard to check if a value is a valid breakpoint key.
 */
export function isBreakpointKey(value: unknown): value is BreakpointKey {
  return (
    typeof value === 'string' &&
    Object.keys(BREAKPOINTS).includes(value)
  );
}

/**
 * Get the pixel value for a breakpoint.
 */
export function getBreakpointValue(key: BreakpointKey): number {
  return BREAKPOINTS[key];
}

/**
 * Safe area inset CSS custom properties.
 * These correspond to iOS safe area insets.
 */
export const SAFE_AREA_INSETS = {
  top: 'env(safe-area-inset-top, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
} as const;

/**
 * Touch target minimum sizes per WCAG 2.2.
 * AAA requires 44x44px minimum.
 */
export const TOUCH_TARGET = {
  /** WCAG 2.2 Level AA minimum (24x24px) */
  aa: 24,
  /** WCAG 2.2 Level AAA minimum (44x44px) - Our target */
  aaa: 44,
} as const;

/**
 * Z-index scale for bottom-layer components.
 * Higher numbers appear above lower numbers.
 */
export const BOTTOM_LAYER_Z_INDEX = {
  /** Sticky CTA button */
  stickyCta: 40,
  /** Bottom navigation */
  bottomNav: 41,
  /** Chat widget bubble */
  chatBubble: 42,
  /** Chat widget expanded */
  chatExpanded: 43,
  /** Cookie/GDPR banner */
  cookieBanner: 44,
  /** Toasts/notifications */
  toast: 50,
} as const;

export type BottomLayerZIndex = keyof typeof BOTTOM_LAYER_Z_INDEX;
