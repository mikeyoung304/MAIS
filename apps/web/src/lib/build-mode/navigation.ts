/**
 * Build Mode Navigation Utilities
 *
 * Type-safe navigation and cache utilities for Build Mode.
 * Centralizes scroll target handling and cache invalidation delay.
 *
 * @see docs/solutions/react-performance/CACHE_INVALIDATION_RACE_CONDITION_PREVENTION.md
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { PageName } from '@macon/contracts';

/**
 * Discriminated union for navigation targets.
 * Makes caller intent explicit - no overloaded parameters.
 *
 * Usage:
 * ```ts
 * handleNavigation({ type: 'page', page: 'services' });
 * handleNavigation({ type: 'section', sectionId: 'home-hero-primary' });
 * ```
 */
export type ScrollTarget =
  | { type: 'page'; page: PageName }
  | { type: 'section'; sectionId: string };

/**
 * Cache invalidation delay in milliseconds.
 * Prevents race condition where refetch happens before DB write commits.
 *
 * @see CLAUDE.md Pitfall #30: Race condition on cache invalidation
 */
export const CACHE_INVALIDATION_DELAY_MS = 100;

/**
 * Encapsulates cache invalidation delay (Pitfall #30).
 * Document the delay in one place, not scattered throughout code.
 *
 * This utility waits 100ms before invalidating queries to ensure
 * the database transaction has committed before refetching.
 *
 * @param queryClient - TanStack Query client instance
 * @param queryKey - Query key to invalidate
 *
 * @example
 * ```ts
 * await invalidateWithCacheBuffer(queryClient, ['draftConfig']);
 * ```
 */
export async function invalidateWithCacheBuffer(
  queryClient: QueryClient,
  queryKey: QueryKey
): Promise<void> {
  // 100ms delay for cache consistency (see Pitfall #30)
  await new Promise((resolve) => setTimeout(resolve, CACHE_INVALIDATION_DELAY_MS));
  await queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
}

/**
 * Type guard to check if a scroll target is a section target.
 */
export function isSectionTarget(
  target: ScrollTarget
): target is { type: 'section'; sectionId: string } {
  return target.type === 'section';
}

/**
 * Type guard to check if a scroll target is a page target.
 */
export function isPageTarget(target: ScrollTarget): target is { type: 'page'; page: PageName } {
  return target.type === 'page';
}
