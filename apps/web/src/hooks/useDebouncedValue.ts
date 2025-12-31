'use client';

import { useState, useEffect } from 'react';

/**
 * Hook that debounces a value by a specified delay
 *
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 150ms)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebouncedValue(searchQuery, 150);
 *
 * // debouncedQuery updates 150ms after searchQuery stops changing
 * useEffect(() => {
 *   // Perform search with debouncedQuery
 * }, [debouncedQuery]);
 * ```
 */
export function useDebouncedValue<T>(value: T, delay: number = 150): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
