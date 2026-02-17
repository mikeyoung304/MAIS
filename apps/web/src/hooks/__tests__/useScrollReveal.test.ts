/**
 * Unit tests for useScrollReveal hook
 *
 * Tests the IntersectionObserver-based scroll reveal animation hook:
 * - Progressive enhancement (SSR-safe → client hides → observer reveals)
 * - prefers-reduced-motion bypass
 * - Observer lifecycle (observe, unobserve on intersection, disconnect on cleanup)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollReveal } from '../useScrollReveal';

// Track IntersectionObserver calls — since setup.ts already mocks IntersectionObserver
// as non-configurable, we override it via direct assignment (writable: true).
let observerCallback: IntersectionObserverCallback;
let observerOptions: IntersectionObserverInit | undefined;
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

function setupIntersectionObserver() {
  const MockObserver = vi.fn(
    (callback: IntersectionObserverCallback, options?: IntersectionObserverInit) => {
      observerCallback = callback;
      observerOptions = options;
      return {
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
        root: null,
        rootMargin: '',
        thresholds: [],
        takeRecords: () => [],
      };
    }
  );
  // setup.ts defines IntersectionObserver as writable but not configurable,
  // so we assign directly instead of using vi.stubGlobal
  window.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver;
}

function setupMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reducedMotion && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  }));
}

describe('useScrollReveal', () => {
  beforeEach(() => {
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
    setupIntersectionObserver();
    setupMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return a callback ref function', () => {
    const { result } = renderHook(() => useScrollReveal());
    expect(typeof result.current).toBe('function');
  });

  it('should observe elements registered via the ref callback', () => {
    const { result } = renderHook(() => useScrollReveal());

    const el = document.createElement('div');
    act(() => {
      result.current(el);
    });

    expect(mockObserve).toHaveBeenCalledWith(el);
    expect(el.style.opacity).toBe('0');
  });

  it('should use default threshold of 0.15', () => {
    renderHook(() => useScrollReveal());
    expect(observerOptions?.threshold).toBe(0.15);
  });

  it('should accept custom threshold', () => {
    renderHook(() => useScrollReveal({ threshold: 0.5 }));
    expect(observerOptions?.threshold).toBe(0.5);
  });

  it('should use negative bottom rootMargin to trigger slightly before entering viewport', () => {
    renderHook(() => useScrollReveal());
    expect(observerOptions?.rootMargin).toBe('0px 0px -50px 0px');
  });

  it('should add reveal-visible class and unobserve when element intersects', () => {
    renderHook(() => useScrollReveal());

    const el = document.createElement('div');

    // Simulate intersection
    act(() => {
      observerCallback(
        [{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(el.classList.contains('reveal-visible')).toBe(true);
    expect(mockUnobserve).toHaveBeenCalledWith(el);
  });

  it('should NOT add reveal-visible class when element is not intersecting', () => {
    renderHook(() => useScrollReveal());

    const el = document.createElement('div');

    act(() => {
      observerCallback(
        [{ isIntersecting: false, target: el } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(el.classList.contains('reveal-visible')).toBe(false);
    expect(mockUnobserve).not.toHaveBeenCalled();
  });

  it('should disconnect observer on cleanup', () => {
    const { unmount } = renderHook(() => useScrollReveal());
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  describe('prefers-reduced-motion', () => {
    it('should skip observer setup when user prefers reduced motion', () => {
      setupMatchMedia(true);

      const { result } = renderHook(() => useScrollReveal());

      // When ref callback is called, it should NOT set opacity or observe
      const el = document.createElement('div');
      act(() => {
        result.current(el);
      });

      // Element should NOT have opacity set to 0
      expect(el.style.opacity).not.toBe('0');
    });
  });

  it('should handle null ref callback gracefully', () => {
    const { result } = renderHook(() => useScrollReveal());

    // Passing null should not throw
    expect(() => {
      result.current(null);
    }).not.toThrow();
  });
});
