'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Options for scroll restoration behavior.
 */
export interface ScrollRestorationOptions {
  /** Storage key prefix (default: 'scroll-pos') */
  keyPrefix?: string;
  /** Whether to use sessionStorage (default) or localStorage */
  storage?: 'session' | 'local';
  /** Debounce delay for saving scroll position (default: 100ms) */
  debounceMs?: number;
  /** Whether restoration is enabled (default: true) */
  enabled?: boolean;
  /** Custom container element to track (default: window) */
  containerRef?: React.RefObject<HTMLElement>;
}

/**
 * State returned by the hook.
 */
export interface ScrollRestorationState {
  /** Manually save current scroll position */
  savePosition: () => void;
  /** Manually restore scroll position */
  restorePosition: () => void;
  /** Clear saved position for current route */
  clearPosition: () => void;
}

/**
 * useScrollRestoration - Persist and restore scroll position across navigation.
 *
 * Automatically saves scroll position when navigating away and restores it
 * when returning to the same route. Useful for list pages, feeds, and
 * any content where users expect to return to their previous position.
 *
 * @param options - Configuration options
 * @returns Control methods for manual scroll management
 *
 * @example
 * ```tsx
 * function PackagesList() {
 *   // Automatic scroll restoration for this route
 *   useScrollRestoration();
 *
 *   return (
 *     <div>
 *       {packages.map(pkg => <PackageCard key={pkg.id} pkg={pkg} />)}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * function ScrollableContainer() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *
 *   // Restore scroll for a specific container
 *   useScrollRestoration({
 *     containerRef,
 *     keyPrefix: 'packages-list',
 *   });
 *
 *   return (
 *     <div ref={containerRef} className="overflow-y-auto h-96">
 *       {items.map(item => <ListItem key={item.id} item={item} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollRestoration(options: ScrollRestorationOptions = {}): ScrollRestorationState {
  const {
    keyPrefix = 'scroll-pos',
    storage = 'session',
    debounceMs = 100,
    enabled = true,
    containerRef,
  } = options;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate storage key based on current route
  const getStorageKey = useCallback(() => {
    const params = searchParams?.toString();
    const fullPath = params ? `${pathname}?${params}` : pathname;
    return `${keyPrefix}:${fullPath}`;
  }, [keyPrefix, pathname, searchParams]);

  // Get storage instance
  const getStorage = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return storage === 'local' ? window.localStorage : window.sessionStorage;
  }, [storage]);

  // Get current scroll position
  const getScrollPosition = useCallback(() => {
    if (containerRef?.current) {
      return containerRef.current.scrollTop;
    }
    return window.scrollY;
  }, [containerRef]);

  // Set scroll position
  const setScrollPosition = useCallback(
    (position: number) => {
      if (containerRef?.current) {
        containerRef.current.scrollTop = position;
      } else {
        window.scrollTo(0, position);
      }
    },
    [containerRef]
  );

  // Save current scroll position
  const savePosition = useCallback(() => {
    if (!enabled) return;

    const storageInstance = getStorage();
    if (!storageInstance) return;

    const position = getScrollPosition();
    const key = getStorageKey();

    try {
      storageInstance.setItem(key, String(position));
    } catch {
      // Storage might be full or disabled
    }
  }, [enabled, getStorage, getScrollPosition, getStorageKey]);

  // Restore saved scroll position
  const restorePosition = useCallback(() => {
    if (!enabled) return;

    const storageInstance = getStorage();
    if (!storageInstance) return;

    const key = getStorageKey();

    try {
      const saved = storageInstance.getItem(key);
      if (saved !== null) {
        const position = parseInt(saved, 10);
        if (!isNaN(position)) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            setScrollPosition(position);
          });
        }
      }
    } catch {
      // Storage access failed
    }
  }, [enabled, getStorage, getStorageKey, setScrollPosition]);

  // Clear saved position
  const clearPosition = useCallback(() => {
    const storageInstance = getStorage();
    if (!storageInstance) return;

    const key = getStorageKey();

    try {
      storageInstance.removeItem(key);
    } catch {
      // Storage access failed
    }
  }, [getStorage, getStorageKey]);

  // Debounced save on scroll
  const handleScroll = useCallback(() => {
    if (!enabled) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      savePosition();
    }, debounceMs);
  }, [enabled, savePosition, debounceMs]);

  // Set up scroll listener and restore on mount
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const target = containerRef?.current ?? window;

    // Restore position on mount
    restorePosition();

    // Save position on scroll
    target.addEventListener('scroll', handleScroll, { passive: true });

    // Save position before navigating away
    const handleBeforeUnload = () => {
      savePosition();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      target.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Save position when unmounting (navigating away)
      savePosition();
    };
  }, [enabled, containerRef, handleScroll, restorePosition, savePosition]);

  return {
    savePosition,
    restorePosition,
    clearPosition,
  };
}

/**
 * Hook that just restores scroll without tracking.
 * Useful for scroll-to-top on new content.
 */
export function useScrollToTop(enabled = true): void {
  const pathname = usePathname();

  useEffect(() => {
    if (enabled && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, [pathname, enabled]);
}
