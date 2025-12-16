/**
 * Public Date Booking Routes
 * Customer-facing endpoint for booking DATE type packages (e.g., weddings)
 * Requires tenant context via X-Tenant-Key header
 *
 * These routes should be mounted at /v1/public to match the contract paths:
 * - POST /v1/public/bookings/date
 */

import { Router, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { TenantRequest } from '../middleware/tenant';
import type { CatalogRepository } from '../lib/ports';
import type { BookingService } from '../services/booking.service';
import type { AvailabilityService } from '../services/availability.service';
import { CreateDateBookingDtoSchema } from '@macon/contracts';
import { logger } from '../lib/core/logger';
import { NotFoundError, BookingConflictError } from '../lib/errors';
import { publicSchedulingLimiter } from '../middleware/rateLimiter';

/**
 * Create public date booking routes
 *
 * Mount at /v1/public to match contract paths
 *
 * @param catalogRepo - Catalog repository for package lookups
 * @param bookingService - Booking service for checkout session creation
 * @param availabilityService - Availability service for date validation
 * @returns Express router with public date booking endpoints
 */
export function createPublicDateBookingRoutes(
  catalogRepo: CatalogRepository,
  bookingService: BookingService,
  availabilityService: AvailabilityService
): Router {
  const router = Router();

  // Apply rate limiting to prevent abuse
  router.use(publicSchedulingLimiter);

  /**
   * POST /v1/public/bookings/date
   * Create checkout session for DATE booking type packages
   *
   * Validates:
   * - Package exists and belongs to tenant
   * - Package has bookingType = 'DATE'
   * - Date is available (not blackout, not already booked)
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

      // 1. Fetch package and validate it exists
      const pkg = await catalogRepo.getPackageById(tenantId, input.packageId);
      if (!pkg) {
        throw new NotFoundError(`Package not found: ${input.packageId}`);
      }

      // 2. Validate package is DATE type
      if (pkg.bookingType !== 'DATE') {
        res.status(400).json({
          error: 'Invalid package type',
          details: `Package "${pkg.title}" uses ${pkg.bookingType} booking type. Use the appropriate booking endpoint.`,
        });
        return;
      }

      // 3. Check date availability
      const availability = await availabilityService.checkAvailability(tenantId, input.date);
      if (!availability.available) {
        throw new BookingConflictError(
          input.date,
          availability.reason === 'blackout'
            ? 'This date is not available for booking'
            : availability.reason === 'booked'
              ? 'This date is already booked'
              : 'This date is not available'
        );
      }

      // 4. Create checkout session using existing booking service
      // The booking service expects packageId as slug, but we have the ID
      // Use the package slug for the createCheckout call
      const checkout = await bookingService.createCheckout(tenantId, {
        packageId: pkg.slug, // Use slug as expected by booking service
        eventDate: input.date,
        email: input.customerEmail,
        coupleName: input.customerName,
        addOnIds: input.addOnIds,
      });

      logger.info(
        {
          tenantId,
          packageId: pkg.id,
          packageSlug: pkg.slug,
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
      if (error instanceof BookingConflictError) {
        res.status(409).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
