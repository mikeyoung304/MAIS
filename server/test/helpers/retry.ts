/**
 * Test Retry Utility
 *
 * Provides retry logic with exponential backoff for flaky integration tests.
 * Use when tests are sensitive to timing, concurrency, or external dependencies.
 *
 * @module test/helpers/retry
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay between retries in milliseconds (default: 100) */
  delayMs?: number;
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Callback invoked on each retry attempt */
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 100,
  backoffMultiplier: 2,
  onRetry: () => {},
};

/**
 * Retry a test operation with exponential backoff
 *
 * Useful for tests that may fail due to timing issues, race conditions,
 * or transient database conflicts. Automatically retries on failure up to
 * maxAttempts times with exponentially increasing delays.
 *
 * @example
 * ```typescript
 * test('should handle race condition', async () => {
 *   await withRetry(async () => {
 *     // Test logic that might be flaky due to timing
 *     const result = await createBooking(...);
 *     expect(result).toBeDefined();
 *   }, { maxAttempts: 3, delayMs: 100 });
 * });
 * ```
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to the function's return value
 * @throws The last error encountered if all retries fail
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < opts.maxAttempts) {
        const delay = opts.delayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
        opts.onRetry(attempt, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Retry wrapper specifically for database operations
 *
 * Handles Prisma-specific errors like serialization failures, write conflicts,
 * and deadlocks. Uses more retry attempts (5) with shorter delays (50ms base)
 * to handle transient database contention.
 *
 * @example
 * ```typescript
 * test('should handle concurrent booking creation', async () => {
 *   await withDatabaseRetry(async () => {
 *     const results = await Promise.allSettled([
 *       bookingRepo.create(tenant, booking1),
 *       bookingRepo.create(tenant, booking2),
 *     ]);
 *     expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
 *   });
 * });
 * ```
 *
 * @param fn - Database operation to retry
 * @returns Promise resolving to the function's return value
 */
export async function withDatabaseRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 5,
    delayMs: 50,
    onRetry: (attempt, error) => {
      const isPrismaConflict =
        error?.code === 'P2034' || // Prisma transaction conflict
        error?.message?.includes('deadlock') ||
        error?.message?.includes('write conflict') ||
        error?.message?.includes('serialization failure');

      if (isPrismaConflict) {
        console.log(`[Retry] Database conflict on attempt ${attempt}, retrying...`);
      }
    },
  });
}

/**
 * Retry wrapper for concurrent test scenarios
 *
 * Uses longer delays (200ms base) to allow time for concurrent operations
 * to complete and for locks to be released. Ideal for testing race conditions
 * and parallel execution scenarios.
 *
 * @example
 * ```typescript
 * test('should allow concurrent bookings for different dates', async () => {
 *   await withConcurrencyRetry(async () => {
 *     const bookings = Array.from({ length: 5 }, (_, i) => ({
 *       eventDate: `2025-07-${String(i + 1).padStart(2, '0')}`,
 *       // ... other booking data
 *     }));
 *
 *     const results = await Promise.allSettled(
 *       bookings.map(b => bookingRepo.create(tenantId, b))
 *     );
 *
 *     expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(5);
 *   });
 * });
 * ```
 *
 * @param fn - Concurrent operation to retry
 * @returns Promise resolving to the function's return value
 */
export async function withConcurrencyRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 3,
    delayMs: 200,
    backoffMultiplier: 2,
    onRetry: (attempt, error) => {
      console.log(`[Retry] Concurrency conflict on attempt ${attempt}, retrying...`);
    },
  });
}

/**
 * Retry wrapper for timing-sensitive assertions
 *
 * Some tests make assertions about timing (e.g., operation completes < 1000ms).
 * These tests are inherently flaky under load. This wrapper uses minimal retries
 * with longer delays to reduce false positives from system load.
 *
 * @example
 * ```typescript
 * test('should fail quickly with NOWAIT', async () => {
 *   await withTimingRetry(async () => {
 *     const startTime = Date.now();
 *     await expect(operation()).rejects.toThrow();
 *     const duration = Date.now() - startTime;
 *     expect(duration).toBeLessThan(1000);
 *   });
 * });
 * ```
 *
 * @param fn - Timing-sensitive operation to retry
 * @returns Promise resolving to the function's return value
 */
export async function withTimingRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 2, // Fewer retries for timing tests
    delayMs: 500, // Longer delay to let system settle
    backoffMultiplier: 1, // No exponential backoff
    onRetry: (attempt, error) => {
      console.log(`[Retry] Timing assertion failed on attempt ${attempt}, retrying...`);
    },
  });
}

/**
 * Helper to check if an error is a retryable Prisma error
 *
 * @param error - Error object to check
 * @returns true if error is a known retryable Prisma error
 */
export function isPrismaRetryableError(error: any): boolean {
  return (
    error?.code === 'P2034' || // Transaction conflict
    error?.code === 'P2002' || // Unique constraint violation (for double-booking tests)
    error?.message?.includes('deadlock') ||
    error?.message?.includes('write conflict') ||
    error?.message?.includes('serialization failure')
  );
}

/**
 * Helper to check if an error is a booking conflict error
 *
 * @param error - Error object to check
 * @returns true if error is a BookingConflictError or BookingLockTimeoutError
 */
export function isBookingConflictError(error: any): boolean {
  const errorName = error?.constructor?.name || '';
  return (
    errorName === 'BookingConflictError' ||
    errorName === 'BookingLockTimeoutError' ||
    error?.message?.includes('already booked') ||
    error?.message?.includes('lock timeout')
  );
}
