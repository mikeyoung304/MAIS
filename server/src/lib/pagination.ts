/**
 * Pagination utilities for API list endpoints.
 *
 * Provides in-memory pagination over arrays. For DB-level pagination
 * (LIMIT/OFFSET), pass skip/take directly to Prisma queries.
 */

/**
 * Wraps an array in the standard paginated response shape.
 * Used by route handlers to implement consistent pagination across all list endpoints.
 *
 * @param items - Full array of items (pre-fetched from DB)
 * @param skip - Number of items to skip (default 0)
 * @param take - Number of items to return (default 50, max 100)
 * @returns Paginated response with items, total count, and hasMore flag
 */
export function paginateArray<T>(
  items: T[],
  skip = 0,
  take = 50
): { items: T[]; total: number; hasMore: boolean } {
  const safeTake = Math.min(Math.max(take, 1), 100);
  const safeSkip = Math.max(skip, 0);
  const sliced = items.slice(safeSkip, safeSkip + safeTake);
  return {
    items: sliced,
    total: items.length,
    hasMore: safeSkip + safeTake < items.length,
  };
}
