/**
 * Public Date Booking Routes
 * Customer-facing endpoint for booking DATE type packages (e.g., weddings)
 * Requires tenant context via X-Tenant-Key header
 *
 * These routes should be mounted at /v1/public to match the contract paths:
 * - POST /v1/public/bookings/date
 *
 * Phase 2 Refactor (#305): Route handler simplified to delegate business logic
 * to BookingService.createDateBooking() for better testability.
 */

import { Router, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { TenantRequest } from '../middleware/tenant';
import type { BookingService } from '../services/booking.service';
import { CreateDateBookingDtoSchema } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import { NotFoundError, BookingConflictError, InvalidBookingTypeError } from '../lib/errors';
import { publicSchedulingLimiter } from '../middleware/rateLimiter';

/**
 * Create public date booking routes
 *
 * Mount at /v1/public to match contract paths
 *
 * Phase 2 Refactor: Simplified to only require BookingService, which now
 * handles package lookup, type validation, and availability checking internally.
 *
 * @param bookingService - Booking service for checkout session creation
 * @returns Express router with public date booking endpoints
 */
export function createPublicDateBookingRoutes(bookingService: BookingService): Router {
  const router = Router();

  // Apply rate limiting to prevent abuse
  router.use(publicSchedulingLimiter);

  /**
   * POST /v1/public/bookings/date
   * Create checkout session for DATE booking type packages
   *
   * Phase 2 Refactor: Business logic moved to BookingService.createDateBooking()
   *
   * @returns 200 - Checkout URL for Stripe payment
   * @returns 400 - Validation error (invalid input, wrong package type)
   * @returns 401 - Missing or invalid tenant key
   * @returns 404 - Package not found
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

      // Validate request body
      const input = CreateDateBookingDtoSchema.parse(req.body);

      // Delegate all business logic to service layer
      const checkout = await bookingService.createDateBooking(tenantId, {
        packageId: input.packageId,
        date: input.date,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        addOnIds: input.addOnIds,
      });

      logger.info(
        {
          tenantId,
          packageId: input.packageId,
          date: input.date,
          customerEmail: input.customerEmail,
        },
        'Date booking checkout session created'
      );

      res.status(200).json({
        checkoutUrl: checkout.checkoutUrl,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.issues,
        });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof InvalidBookingTypeError) {
        res.status(400).json({
          error: 'Invalid package type',
          details: error.message,
        });
        return;
      }
      if (error instanceof BookingConflictError) {
        res.status(409).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
