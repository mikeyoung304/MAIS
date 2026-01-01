'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * SSR-safe localStorage hook using useSyncExternalStore.
 *
 * Provides persistent state that syncs across tabs and survives page reloads.
 * Returns the default value during SSR to prevent hydration mismatches.
 *
 * @param key - localStorage key
 * @param defaultValue - Value to use when key doesn't exist or during SSR
 * @returns Tuple of [value, setValue, removeValue]
 *
 * @example
 * ```tsx
 * function Sidebar() {
 *   const [collapsed, setCollapsed] = useLocalStorage('sidebar-collapsed', false);
 *
 *   return (
 *     <aside className={collapsed ? 'w-16' : 'w-64'}>
 *       <button onClick={() => setCollapsed(!collapsed)}>
 *         Toggle
 *       </button>
 *     </aside>
 *   );
 * }
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Subscribe to storage changes (cross-tab sync)
  const subscribe = useCallback(
    (callback: () => void) => {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key || e.key === null) {
          callback();
        }
      };

      // Listen for changes from other tabs
      window.addEventListener('storage', handleStorageChange);

      // Also listen for custom events from same tab
      const handleCustomEvent = () => callback();
      window.addEventListener(`localStorage:${key}`, handleCustomEvent);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener(`localStorage:${key}`, handleCustomEvent);
      };
    },
    [key]
  );

  // Get current value from localStorage
  const getSnapshot = useCallback((): T => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item) as T;
    } catch {
      // If parsing fails, return default
      console.warn(`Failed to parse localStorage key "${key}"`);
      return defaultValue;
    }
  }, [key, defaultValue]);

  // Server snapshot always returns default (SSR safety)
  const getServerSnapshot = useCallback((): T => {
    return defaultValue;
  }, [defaultValue]);

  // Use useSyncExternalStore for proper SSR hydration
  const storedValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Setter function that updates localStorage and notifies listeners
  const setValue = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      try {
        // Handle functional updates
        const newValue =
          typeof valueOrUpdater === 'function'
            ? (valueOrUpdater as (prev: T) => T)(getSnapshot())
            : valueOrUpdater;

        // Save to localStorage
        window.localStorage.setItem(key, JSON.stringify(newValue));

        // Dispatch custom event for same-tab listeners
        window.dispatchEvent(new CustomEvent(`localStorage:${key}`));
      } catch (error) {
        console.warn(`Failed to set localStorage key "${key}"`, error);
      }
    },
    [key, getSnapshot]
  );

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      window.dispatchEvent(new CustomEvent(`localStorage:${key}`));
    } catch (error) {
      console.warn(`Failed to remove localStorage key "${key}"`, error);
    }
  }, [key]);

  return [storedValue, setValue, removeValue];
}

/**
 * Simplified hook for boolean localStorage values.
 * Useful for toggles, collapsed states, etc.
 */
export function useLocalStorageBoolean(
  key: string,
  defaultValue = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useLocalStorage(key, defaultValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, [setValue]);

  return [value, toggle, setValue];
}
