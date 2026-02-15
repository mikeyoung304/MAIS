/**
 * Idempotency Service for Stripe Operations
 *
 * Prevents duplicate charges, refunds, and transfers by tracking unique operation keys.
 * Uses database storage for idempotency key tracking with automatic expiration.
 *
 * ARCHITECTURE:
 * - Keys are stored in IdempotencyKey table
 * - Each key has a 24-hour TTL
 * - Responses can be cached and returned for duplicate requests
 * - Automatic cleanup of expired keys via expiration index
 *
 * USAGE:
 * ```typescript
 * const key = idempotencyService.generateKey('checkout', tenantId, sessionId);
 * const isNew = await idempotencyService.checkAndStore(key);
 * if (!isNew) {
 *   // Return cached response
 *   return idempotencyService.getStoredResponse(key);
 * }
 * // Proceed with Stripe operation
 * ```
 */

import type { PrismaClient } from '../generated/prisma/client';
import { logger } from '../lib/core/logger';
import { createHash } from 'crypto';

/**
 * Generic idempotency response wrapper
 * Data can be any JSON-serializable value from Stripe operations
 */
export interface IdempotencyResponse<T = unknown> {
  data: T;
  timestamp: string;
}

export class IdempotencyService {
  private readonly keyTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly cleanupDelayMs = 30000; // 30 seconds - wait for server initialization
  private readonly advisoryLockId = 42424242; // Unique lock ID for idempotency cleanup
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isCleanupRunning = false;
  private cleanupPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaClient) {
    logger.info('IdempotencyService initialized');
  }

  /**
   * Start scheduled cleanup of expired idempotency keys
   *
   * Runs cleanup every 24 hours and once at startup (after 30 second delay).
   * Uses advisory locks to prevent concurrent cleanup across multiple instances.
   * Call this after service initialization to prevent accumulation of expired keys.
   *
   * @example
   * ```typescript
   * const idempotencyService = new IdempotencyService(prisma);
   * idempotencyService.startCleanupScheduler();
   * ```
   */
  public startCleanupScheduler(): void {
    // Prevent multiple schedulers
    if (this.cleanupInterval) {
      logger.warn('Cleanup scheduler already running');
      return;
    }

    // Run cleanup every 24 hours (86400000 ms)
    this.cleanupInterval = setInterval(
      () => {
        void this.runCleanupWithLock();
      },
      24 * 60 * 60 * 1000
    );

    // Also run once at startup after delay to ensure server is fully initialized
    setTimeout(() => {
      void this.runCleanupWithLock();
    }, this.cleanupDelayMs);

    logger.info(
      { delayMs: this.cleanupDelayMs },
      'Idempotency key cleanup scheduler started (runs every 24 hours)'
    );
  }

  /**
   * Stop the cleanup scheduler
   *
   * Waits for any in-progress cleanup to complete before stopping.
   * Call this during application shutdown to prevent memory leaks and ensure graceful cleanup.
   */
  public async stopCleanupScheduler(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Wait for in-progress cleanup to complete
    if (this.cleanupPromise) {
      logger.info('Waiting for in-progress cleanup to complete before stopping...');
      await this.cleanupPromise;
    }

    logger.info('Idempotency key cleanup scheduler stopped');
  }

  /**
   * Run cleanup with PostgreSQL advisory lock
   *
   * Prevents concurrent cleanup execution across multiple server instances.
   * Skips if cleanup is already running. Uses advisory lock to coordinate
   * between processes.
   *
   * @private
   */
  private async runCleanupWithLock(): Promise<void> {
    // Skip if already running
    if (this.isCleanupRunning) {
      logger.debug('Cleanup already in progress, skipping');
      return;
    }

    this.isCleanupRunning = true;
    this.cleanupPromise = (async () => {
      try {
        // Try to acquire advisory lock (non-blocking)
        // Returns true if lock acquired, false if already held by another process
        const lockResult = await this.prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
          SELECT pg_try_advisory_lock(${this.advisoryLockId})
        `;

        const lockAcquired = lockResult[0]?.pg_try_advisory_lock;

        if (!lockAcquired) {
          logger.info('Another instance is running cleanup, skipping');
          return;
        }

        try {
          // Perform cleanup
          const count = await this.cleanupExpired();
          logger.info({ count }, 'Idempotency cleanup completed successfully');
        } finally {
          // Always release lock
          await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${this.advisoryLockId})`;
        }
      } catch (error) {
        logger.error({ err: error }, 'Failed to run idempotency cleanup with lock');
      } finally {
        this.isCleanupRunning = false;
        this.cleanupPromise = null;
      }
    })();

    await this.cleanupPromise;
  }

  /**
   * Generate a deterministic idempotency key
   *
   * Creates a SHA-256 hash of the input parts to ensure consistent key generation
   * for the same operation parameters.
   *
   * @param prefix - Operation type (e.g., 'checkout', 'refund', 'transfer')
   * @param parts - Variable number of strings to include in key generation
   * @returns Idempotency key in format: prefix_hash
   *
   * @example
   * ```typescript
   * const key = generateKey('checkout', tenantId, sessionId, timestamp);
   * // Returns: "checkout_a3b2c1d4e5f6..."
   * ```
   */
  generateKey(prefix: string, ...parts: string[]): string {
    // Combine all parts with separator
    const combined = parts.join('|');

    // Create deterministic hash
    const hash = createHash('sha256').update(combined).digest('hex').substring(0, 32); // Use first 32 chars for readability

    return `${prefix}_${hash}`;
  }

  /**
   * Check if idempotency key exists and store if new
   *
   * This is an atomic operation that either:
   * 1. Returns false if key exists (duplicate request)
   * 2. Stores the key and returns true if new (first request)
   *
   * Uses database unique constraint to ensure atomicity.
   *
   * @param key - Idempotency key to check
   * @param response - Optional response data to cache for duplicate requests
   * @returns true if key was new and stored, false if key already existed
   *
   * @example
   * ```typescript
   * const isNew = await checkAndStore('checkout_abc123', { sessionId: 'cs_123' });
   * if (!isNew) {
   *   throw new Error('Duplicate request detected');
   * }
   * ```
   */
  async checkAndStore(key: string, response?: IdempotencyResponse): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + this.keyTTL);

      await this.prisma.idempotencyKey.create({
        data: {
          key,
          response: response ? JSON.stringify(response) : null,
          expiresAt,
        },
      });

      logger.info({ key }, 'Stored new idempotency key');
      return true;
    } catch (error) {
      // Check if error is unique constraint violation (key already exists)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002' &&
        'meta' in error &&
        error.meta &&
        typeof error.meta === 'object' &&
        'target' in error.meta &&
        Array.isArray(error.meta.target) &&
        error.meta.target.includes('key')
      ) {
        logger.warn({ key }, 'Idempotency key already exists (duplicate request)');
        return false;
      }

      // Re-throw unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ key, error: errorMessage }, 'Failed to store idempotency key');
      throw error;
    }
  }

  /**
   * Retrieve stored response for an idempotency key
   *
   * Returns the cached response if it exists and hasn't expired.
   * Automatically deletes expired keys.
   *
   * @param key - Idempotency key to look up
   * @returns Stored response or null if not found/expired
   *
   * @example
   * ```typescript
   * const cached = await getStoredResponse('checkout_abc123');
   * if (cached) {
   *   return cached.data; // Return cached checkout session
   * }
   * ```
   */
  async getStoredResponse(key: string): Promise<IdempotencyResponse | null> {
    const record = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!record) {
      logger.debug({ key }, 'No stored response found for key');
      return null;
    }

    // Check if expired
    if (new Date() > record.expiresAt) {
      logger.info({ key }, 'Idempotency key expired, deleting');
      await this.prisma.idempotencyKey.delete({ where: { key } });
      return null;
    }

    // Parse and return response
    if (!record.response) {
      logger.debug({ key }, 'Idempotency key found but no response cached');
      return null;
    }

    const response = JSON.parse(record.response as string) as IdempotencyResponse;
    logger.info({ key }, 'Retrieved cached response for idempotency key');
    return response;
  }

  /**
   * Update stored response for an existing idempotency key
   *
   * Used to cache the response after a successful operation.
   *
   * @param key - Idempotency key
   * @param response - Response data to cache
   *
   * @example
   * ```typescript
   * // After successful Stripe operation
   * await updateResponse('checkout_abc123', {
   *   data: { sessionId: 'cs_123', url: 'https://...' },
   *   timestamp: new Date().toISOString()
   * });
   * ```
   */
  async updateResponse(key: string, response: IdempotencyResponse): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        response: JSON.stringify(response),
      },
    });

    logger.info({ key }, 'Updated cached response for idempotency key');
  }

  /**
   * Delete an idempotency key (manual cleanup)
   *
   * @param key - Idempotency key to delete
   */
  async deleteKey(key: string): Promise<void> {
    await this.prisma.idempotencyKey.delete({
      where: { key },
    });

    logger.info({ key }, 'Deleted idempotency key');
  }

  /**
   * Clean up expired idempotency keys
   *
   * This should be run periodically (e.g., via cron job) to remove
   * expired keys from the database.
   *
   * @returns Number of keys deleted
   *
   * @example
   * ```typescript
   * // In a scheduled job
   * const deleted = await idempotencyService.cleanupExpired();
   * logger.info({ deleted }, 'Cleaned up expired idempotency keys');
   * ```
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info({ count: result.count }, 'Cleaned up expired idempotency keys');
    return result.count;
  }

  /**
   * Generate checkout session idempotency key
   *
   * Creates a deterministic key for checkout session creation.
   * Key is based ONLY on booking identity (tenant + email + tier + date),
   * NOT on request timing. This prevents double-charges when requests
   * straddle time boundaries.
   *
   * SECURITY: Removing timestamp means the same booking attempt always gets
   * the same checkout session. This is the correct behavior - customers
   * should not be able to create multiple checkout sessions for the same
   * booking by retrying quickly.
   *
   * @param tenantId - Tenant ID
   * @param email - Customer email
   * @param tierId - Tier ID
   * @param eventDate - Event date
   * @param _timestamp - DEPRECATED: Ignored for safety (kept for API compatibility)
   * @returns Idempotency key
   */
  generateCheckoutKey(
    tenantId: string,
    email: string,
    tierId: string,
    eventDate: string,
    _timestamp?: number
  ): string {
    // CRITICAL: Do NOT include timestamp in idempotency key.
    // Including timestamp causes double-charge risk when requests straddle
    // time bucket boundaries (e.g., T=9.9s vs T=10.1s get different keys).
    // The key should be deterministic based on the BOOKING IDENTITY only.
    return this.generateKey('checkout', tenantId, email, tierId, eventDate);
  }

  /**
   * Generate refund idempotency key
   *
   * Key is deterministic based on refund identity (payment intent + amount).
   * This prevents duplicate refunds when requests straddle time boundaries.
   *
   * @param paymentIntentId - Stripe PaymentIntent ID
   * @param amountCents - Refund amount (optional for full refund)
   * @param _timestamp - DEPRECATED: Ignored for safety (kept for API compatibility)
   * @returns Idempotency key
   */
  generateRefundKey(
    paymentIntentId: string,
    amountCents: number | undefined,
    _timestamp?: number
  ): string {
    // Do NOT include timestamp - key should be deterministic for same refund attempt
    const amount = amountCents ? String(amountCents) : 'full';
    return this.generateKey('refund', paymentIntentId, amount);
  }

  /**
   * Generate transfer idempotency key
   *
   * Key is deterministic based on transfer identity (tenant + amount + destination).
   * This prevents duplicate transfers when requests straddle time boundaries.
   *
   * @param tenantId - Tenant ID
   * @param amountCents - Transfer amount
   * @param destination - Destination account ID
   * @param _timestamp - DEPRECATED: Ignored for safety (kept for API compatibility)
   * @returns Idempotency key
   */
  generateTransferKey(
    tenantId: string,
    amountCents: number,
    destination: string,
    _timestamp?: number
  ): string {
    // Do NOT include timestamp - key should be deterministic for same transfer attempt
    return this.generateKey('transfer', tenantId, String(amountCents), destination);
  }
}
