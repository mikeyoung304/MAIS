/**
 * Advisory Lock Utilities
 *
 * PostgreSQL advisory locks provide explicit serialization for concurrent operations.
 * These locks are transaction-scoped (pg_advisory_xact_lock) and automatically released
 * when the transaction commits or aborts.
 *
 * Used for:
 * - Preventing double-booking race conditions (ADR-013)
 * - Serializing balance payment webhooks (P1-147)
 * - Any operation requiring tenant+resource locking
 */

/**
 * Generate deterministic lock ID from tenantId + date for PostgreSQL advisory locks.
 * Uses FNV-1a hash algorithm to convert string to 32-bit integer.
 *
 * Advisory locks provide explicit serialization without phantom read issues.
 *
 * @param tenantId - Tenant identifier for isolation
 * @param date - Date string (YYYY-MM-DD format)
 * @returns 32-bit signed integer suitable for PostgreSQL advisory lock
 *
 * @example
 * ```typescript
 * const lockId = hashTenantDate(tenantId, '2025-06-15');
 * await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
 * ```
 */
export function hashTenantDate(tenantId: string, date: string): number {
  const str = `${tenantId}:${date}`;
  let hash = 2166136261; // FNV-1a offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // Convert to 32-bit signed integer (PostgreSQL bigint range)
  return hash | 0;
}

/**
 * Generate deterministic lock ID from tenantId + bookingId for advisory locks.
 * Used for booking-specific locking (e.g., balance payment race prevention).
 *
 * P1-147 FIX: Provides booking-specific locking for balance payment race prevention.
 *
 * @param tenantId - Tenant identifier for isolation
 * @param bookingId - Booking identifier
 * @returns 32-bit signed integer suitable for PostgreSQL advisory lock
 *
 * @example
 * ```typescript
 * const lockId = hashTenantBooking(tenantId, bookingId);
 * await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
 * ```
 */
export function hashTenantBooking(tenantId: string, bookingId: string): number {
  const str = `${tenantId}:balance:${bookingId}`;
  let hash = 2166136261; // FNV-1a offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return hash | 0;
}

/**
 * Generate deterministic lock ID from tenantId for storefront edits.
 * Used for TOCTOU prevention on JSON field updates (landingPageConfigDraft).
 *
 * P1-659 FIX: Provides tenant-level locking for storefront draft edits to prevent
 * race conditions when concurrent section updates check for ID uniqueness.
 *
 * @param tenantId - Tenant identifier for isolation
 * @returns 32-bit signed integer suitable for PostgreSQL advisory lock
 *
 * @example
 * ```typescript
 * const lockId = hashTenantStorefront(tenantId);
 * await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
 * ```
 */
export function hashTenantStorefront(tenantId: string): number {
  const str = `${tenantId}:storefront:draft`;
  let hash = 2166136261; // FNV-1a offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return hash | 0;
}
