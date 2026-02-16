/**
 * Public Date Booking Routes
 * Customer-facing endpoint for booking DATE type tiers (e.g., weddings)
 * Requires tenant context via X-Tenant-Key header
 *
 * These routes should be mounted at /v1/public to match the contract paths:
 * - POST /v1/public/bookings/date
 *
 * Phase 2 Refactor (#305): Route handler simplified to delegate business logic
 * to BookingService.createDateBooking() for better testability.
 *
 * TODO-329: Added request-level idempotency via X-Idempotency-Key header
 * to prevent duplicate checkout session creation from network retries.
 */

import type { Response, NextFunction } from 'express';
import { Router } from 'express';
import type { TenantRequest } from '../middleware/tenant';
import type { BookingService } from '../services/booking.service';
import type { CacheServicePort } from '../lib/ports';
import { CreateDateBookingDtoSchema } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import { publicSchedulingLimiter } from '../middleware/rateLimiter';

/** TTL for idempotency cache entries (1 hour in seconds) */
const IDEMPOTENCY_TTL_SECONDS = 3600;

/** Response type for cached idempotency results */
interface CachedCheckoutResponse {
  checkoutUrl: string;
}

/**
 * Build idempotency cache key
 * Includes tenantId for multi-tenant isolation
 */
function buildIdempotencyKey(tenantId: string, idempotencyKey: string): string {
  return `idempotency:date-booking:${tenantId}:${idempotencyKey}`;
}

/**
 * Create public date booking routes
 *
 * Mount at /v1/public to match contract paths
 *
 * Phase 2 Refactor: Simplified to only require BookingService, which now
 * handles package lookup, type validation, and availability checking internally.
 *
 * TODO-329: Added optional cacheService for request-level idempotency handling.
 * If cacheService is not provided, idempotency is disabled (graceful degradation).
 *
 * @param bookingService - Booking service for checkout session creation
 * @param cacheService - Optional cache service for idempotency (1-hour TTL)
 * @returns Express router with public date booking endpoints
 */
export function createPublicDateBookingRoutes(
  bookingService: BookingService,
  cacheService?: CacheServicePort
): Router {
  const router = Router();

  // Apply rate limiting to prevent abuse
  router.use(publicSchedulingLimiter);

  /**
   * POST /v1/public/bookings/date
   * Create checkout session for DATE booking type tiers
   *
   * Phase 2 Refactor: Business logic moved to BookingService.createDateBooking()
   *
   * TODO-329: Supports X-Idempotency-Key header for request deduplication.
   * If the same idempotency key is received within 1 hour, returns cached result.
   *
   * @header X-Idempotency-Key - Optional unique key for request deduplication
   * @returns 200 - Checkout URL for Stripe payment
   * @returns 400 - Validation error (invalid input, wrong tier type)
   * @returns 401 - Missing or invalid tenant key
   * @returns 404 - Tier not found
   * @returns 409 - Date already booked
   * @returns 500 - Internal server error
   */
  router.post('/bookings/date', async (req: TenantRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Tenant context required' });
        return;
      }

      // TODO-329: Check for idempotency key header
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      // If idempotency key provided and cache available, check for existing result
      if (idempotencyKey && cacheService) {
        const cacheKey = buildIdempotencyKey(tenantId, idempotencyKey);
        const cachedResult = await cacheService.get<CachedCheckoutResponse>(cacheKey);

        if (cachedResult) {
          logger.info(
            { tenantId, idempotencyKey },
            'Returning cached checkout result for idempotency key'
          );
          res.status(200).json(cachedResult);
          return;
        }
      }

      // Validate request body
      const input = CreateDateBookingDtoSchema.parse(req.body);

      // TODO-330: Honeypot bot protection
      // If honeypot field is filled, it's likely a bot - silently reject
      // Return 200 success to not alert the bot that it was detected
      if (input.website) {
        logger.warn(
          { tenantId, tierId: input.tierId },
          'Honeypot triggered - likely bot submission, silently rejecting'
        );
        res.status(200).json({ checkoutUrl: 'https://example.com/thank-you' });
        return;
      }

      logger.info(
        {
          tenantId,
          tierId: input.tierId,
          date: input.date,
          hasIdempotencyKey: !!idempotencyKey,
        },
        'Date booking checkout initiated'
      );

      // Delegate all business logic to service layer
      const checkout = await bookingService.createDateBooking(tenantId, {
        tierId: input.tierId,
        date: input.date,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        addOnIds: input.addOnIds,
        guestCount: input.guestCount,
      });

      const result: CachedCheckoutResponse = { checkoutUrl: checkout.checkoutUrl };

      // TODO-329: Cache result if idempotency key provided
      if (idempotencyKey && cacheService) {
        const cacheKey = buildIdempotencyKey(tenantId, idempotencyKey);
        await cacheService.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
        logger.debug({ tenantId, idempotencyKey }, 'Cached checkout result for idempotency key');
      }

      logger.info(
        {
          tenantId,
          tierId: input.tierId,
          date: input.date,
          customerEmail: input.customerEmail,
          addOnIds: input.addOnIds,
          addOnCount: input.addOnIds?.length || 0,
          clientIp: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.get('user-agent')?.substring(0, 200), // Truncate for safety
        },
        'Date booking checkout session created'
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
