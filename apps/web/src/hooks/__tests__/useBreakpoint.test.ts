/**
 * Unit tests for useBreakpoint hook
 *
 * Tests breakpoint detection, responsive helpers, and SSR-safe behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersReducedMotion,
  useSupportsHover,
  useIsTouch,
} from '../useBreakpoint';
import { BREAKPOINTS, MEDIA_QUERIES } from '@/types/responsive';

describe('useBreakpoint', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let mediaQueryStates: Map<string, boolean>;

  function setupMatchMedia(breakpointMatches: {
    sm?: boolean;
    md?: boolean;
    lg?: boolean;
    xl?: boolean;
  }) {
    const { sm = false, md = false, lg = false, xl = false } = breakpointMatches;

    // Map queries to their match states
    // Note: isSmall is max-width (inverted logic)
    mediaQueryStates = new Map([
      [MEDIA_QUERIES.isSmall as string, !sm && !md && !lg && !xl], // max-width:sm means we're below sm
      [MEDIA_QUERIES.isTablet as string, md || lg || xl],
      [MEDIA_QUERIES.isDesktop as string, lg || xl],
      [MEDIA_QUERIES.isLargeDesktop as string, xl],
      [MEDIA_QUERIES.isMobile as string, !md && !lg && !xl], // max-width:md
    ]);

    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: mediaQueryStates.get(query) ?? false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    }));

    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaMock,
      writable: true,
      configurable: true,
    });
  }

  beforeEach(() => {
    setupMatchMedia({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('breakpoint detection', () => {
    it('should detect xs breakpoint (smallest viewport)', () => {
      setupMatchMedia({}); // No breakpoints match = xs

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.status).toBe('resolved');
      expect(result.current.current).toBe('xs');
    });

    it('should detect sm breakpoint', () => {
      // sm: isSmall is false (we're above 640px), but md is false
      mediaQueryStates = new Map([
        [MEDIA_QUERIES.isSmall as string, false], // above sm
        [MEDIA_QUERIES.isTablet as string, false],
        [MEDIA_QUERIES.isDesktop as string, false],
        [MEDIA_QUERIES.isLargeDesktop as string, false],
      ]);

      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockImplementation((query: string) => ({
          matches: mediaQueryStates.get(query) ?? false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: () => false,
        })),
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.status).toBe('resolved');
      expect(result.current.current).toBe('sm');
    });

    it('should detect md breakpoint (tablet)', () => {
      setupMatchMedia({ md: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.status).toBe('resolved');
      expect(result.current.current).toBe('md');
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
    });

    it('should detect lg breakpoint (desktop)', () => {
      setupMatchMedia({ lg: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.status).toBe('resolved');
      expect(result.current.current).toBe('lg');
      expect(result.current.isDesktop).toBe(true);
    });

    it('should detect xl breakpoint (large desktop)', () => {
      setupMatchMedia({ xl: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.status).toBe('resolved');
      expect(result.current.current).toBe('xl');
      expect(result.current.isLargeDesktop).toBe(true);
    });
  });

  describe('boolean helpers', () => {
    it('should correctly identify mobile viewport', () => {
      setupMatchMedia({}); // No breakpoints = mobile

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should correctly identify tablet viewport', () => {
      setupMatchMedia({ md: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should correctly identify desktop viewport', () => {
      setupMatchMedia({ lg: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isDesktop).toBe(true);
    });
  });

  describe('isAtLeast helper', () => {
    it('should return true when viewport is at least the specified breakpoint', () => {
      setupMatchMedia({ lg: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isAtLeast('sm')).toBe(true);
      expect(result.current.isAtLeast('md')).toBe(true);
      expect(result.current.isAtLeast('lg')).toBe(true);
      expect(result.current.isAtLeast('xl')).toBe(false);
    });

    it('should return false when viewport is below the specified breakpoint', () => {
      setupMatchMedia({ md: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isAtLeast('lg')).toBe(false);
      expect(result.current.isAtLeast('xl')).toBe(false);
    });
  });

  describe('isBelow helper', () => {
    it('should return true when viewport is below the specified breakpoint', () => {
      setupMatchMedia({ md: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isBelow('lg')).toBe(true);
      expect(result.current.isBelow('xl')).toBe(true);
    });

    it('should return false when viewport is at or above the specified breakpoint', () => {
      setupMatchMedia({ lg: true });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isBelow('md')).toBe(false);
      expect(result.current.isBelow('lg')).toBe(false);
    });
  });
});

describe('useIsMobile', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true for mobile viewport', () => {
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('should return false for desktop viewport', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: !query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });
});

describe('useIsTablet', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when viewport is tablet size or larger', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('min-width: 768'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsTablet());

    expect(result.current).toBe(true);
  });
});

describe('useIsDesktop', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when viewport is desktop size or larger', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('min-width: 1024'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsDesktop());

    expect(result.current).toBe(true);
  });
});

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true when user prefers reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
  });

  it('should return false when user does not prefer reduced motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });
});

describe('useSupportsHover', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true for devices that support hover', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('hover: hover'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSupportsHover());

    expect(result.current).toBe(true);
  });
});

describe('useIsTouch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true for touch devices', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('pointer: coarse'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsTouch());

    expect(result.current).toBe(true);
  });

  it('should return false for non-touch devices', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: () => false,
      })),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useIsTouch());

    expect(result.current).toBe(false);
  });
});

describe('BREAKPOINTS constant', () => {
  it('should have correct Tailwind-aligned values', () => {
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS['2xl']).toBe(1536);
  });
});
