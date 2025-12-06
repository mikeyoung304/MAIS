/**
 * Public Booking Management Routes (MVP Gaps Phase 1)
 *
 * Customer self-service endpoints for managing bookings.
 * Uses JWT tokens in query params for authentication (no login required).
 *
 * @see plans/mvp-gaps-phased-implementation.md
 */

import { Router } from 'express';
import type { BookingService } from '../services/booking.service';
import type { CatalogService } from '../services/catalog.service';
import type { BookingRepository } from '../lib/ports';
import { validateBookingToken, type BookingTokenPayload } from '../lib/booking-tokens';
import { logger } from '../lib/core/logger';
import { handlePublicRouteError } from '../lib/public-route-error-handler';

/**
 * Public Booking Management Controller
 *
 * Handles customer-facing booking management operations:
 * - View booking details
 * - Reschedule to a new date
 * - Cancel booking
 */
export class PublicBookingManagementController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly catalogService: CatalogService,
    private readonly bookingRepo: BookingRepository
  ) {}

  /**
   * Get booking details for management page
   *
   * GET /v1/public/bookings/manage?token=xxx
   */
  async getBookingDetails(token: string): Promise<{
    booking: any;
    canReschedule: boolean;
    canCancel: boolean;
    packageTitle: string;
    addOnTitles: string[];
  }> {
    // Validate token with state validation
    const result = await validateBookingToken(token, 'manage', this.bookingRepo);
    if (!result.valid) {
      throw new Error(`Token validation failed: ${result.message}`);
    }

    const { tenantId, bookingId } = result.payload;

    // Fetch booking
    const booking = await this.bookingService.getBookingById(tenantId, bookingId);

    // Fetch package details with add-ons
    const packages = await this.catalogService.getAllPackages(tenantId);
    const pkg = packages.find((p) => p.id === booking.packageId);
    const packageTitle = pkg?.title || 'Unknown Package';

    // Get add-on titles from the package
    let addOnTitles: string[] = [];
    if (booking.addOnIds && booking.addOnIds.length > 0 && pkg?.addOns) {
      addOnTitles = pkg.addOns.filter((a) => booking.addOnIds?.includes(a.id)).map((a) => a.title);
    }

    // Determine if booking can be modified
    const canReschedule = booking.status === 'PAID';
    const canCancel = booking.status === 'PAID';

    return {
      booking: {
        ...booking,
        // Include extended fields if available
        cancelledBy: (booking as any).cancelledBy,
        cancellationReason: (booking as any).cancellationReason,
        refundStatus: (booking as any).refundStatus || 'NONE',
        refundAmount: (booking as any).refundAmount,
        refundedAt: (booking as any).refundedAt,
      },
      canReschedule,
      canCancel,
      packageTitle,
      addOnTitles,
    };
  }

  /**
   * Reschedule booking to a new date
   *
   * POST /v1/public/bookings/reschedule?token=xxx
   */
  async rescheduleBooking(token: string, newDate: string): Promise<any> {
    // Validate token with state validation (allow 'manage' or 'reschedule' action)
    const result = await validateBookingToken(token, 'reschedule', this.bookingRepo);
    if (!result.valid) {
      throw new Error(`Token validation failed: ${result.message}`);
    }

    const { tenantId, bookingId } = result.payload;

    // Reschedule via service
    const updated = await this.bookingService.rescheduleBooking(tenantId, bookingId, newDate);

    logger.info({ tenantId, bookingId, newDate }, 'Booking rescheduled via public API');

    return {
      ...updated,
      refundStatus: (updated as any).refundStatus || 'NONE',
    };
  }

  /**
   * Cancel booking
   *
   * POST /v1/public/bookings/cancel?token=xxx
   */
  async cancelBooking(token: string, reason?: string): Promise<any> {
    // Validate token with state validation (allow 'manage' or 'cancel' action)
    const result = await validateBookingToken(token, 'cancel', this.bookingRepo);
    if (!result.valid) {
      throw new Error(`Token validation failed: ${result.message}`);
    }

    const { tenantId, bookingId } = result.payload;

    // Cancel via service
    const cancelled = await this.bookingService.cancelBooking(
      tenantId,
      bookingId,
      'CUSTOMER', // Self-service cancellation
      reason
    );

    logger.info({ tenantId, bookingId, reason }, 'Booking cancelled via public API');

    return {
      ...cancelled,
      cancelledBy: 'CUSTOMER',
      cancellationReason: reason,
      refundStatus: (cancelled as any).refundStatus || 'NONE',
    };
  }
}

/**
 * Create Express router for public booking management
 */
export function createPublicBookingManagementRouter(
  controller: PublicBookingManagementController
): Router {
  const router = Router();

  /**
   * GET /v1/public/bookings/manage
   * Get booking details for management page
   */
  router.get('/manage', async (req, res) => {
    try {
      const token = req.query.token as string;

      if (!token) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Token is required',
        });
      }

      const result = await controller.getBookingDetails(token);

      return res.status(200).json(result);
    } catch (error: any) {
      return handlePublicRouteError(error, res, 'get booking details');
    }
  });

  /**
   * POST /v1/public/bookings/reschedule
   * Reschedule booking to a new date
   */
  router.post('/reschedule', async (req, res) => {
    try {
      const token = req.query.token as string;
      const { newDate } = req.body;

      if (!token) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Token is required',
        });
      }

      if (!newDate) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'New date is required',
        });
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Date must be in YYYY-MM-DD format',
        });
      }

      const result = await controller.rescheduleBooking(token, newDate);

      return res.status(200).json(result);
    } catch (error: any) {
      return handlePublicRouteError(error, res, 'reschedule booking');
    }
  });

  /**
   * POST /v1/public/bookings/cancel
   * Cancel a booking
   */
  router.post('/cancel', async (req, res) => {
    try {
      const token = req.query.token as string;
      const { reason } = req.body;

      if (!token) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Token is required',
        });
      }

      // Validate reason length if provided
      if (reason && reason.length > 500) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          error: 'BAD_REQUEST',
          message: 'Reason must be 500 characters or less',
        });
      }

      const result = await controller.cancelBooking(token, reason);

      return res.status(200).json(result);
    } catch (error: any) {
      return handlePublicRouteError(error, res, 'cancel booking');
    }
  });

  return router;
}
