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
import {
  validateBookingToken,
  type BookingTokenPayload,
} from '../lib/booking-tokens';
import { logger } from '../lib/core/logger';
import {
  BookingConflictError,
  BookingAlreadyCancelledError,
  BookingCannotBeRescheduledError,
  NotFoundError,
} from '../lib/errors';

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
    private readonly catalogService: CatalogService
  ) {}

  /**
   * Get booking details for management page
   *
   * GET /v1/public/bookings/manage?token=xxx
   */
  async getBookingDetails(
    token: string
  ): Promise<{
    booking: any;
    canReschedule: boolean;
    canCancel: boolean;
    packageTitle: string;
    addOnTitles: string[];
  }> {
    // Validate token
    const result = validateBookingToken(token, 'manage');
    if (!result.valid) {
      throw new Error(`Token validation failed: ${result.message}`);
    }

    const { tenantId, bookingId } = result.payload;

    // Fetch booking
    const booking = await this.bookingService.getBookingById(tenantId, bookingId);

    // Fetch package details with add-ons
    const packages = await this.catalogService.getAllPackages(tenantId);
    const pkg = packages.find(p => p.id === booking.packageId);
    const packageTitle = pkg?.title || 'Unknown Package';

    // Get add-on titles from the package
    let addOnTitles: string[] = [];
    if (booking.addOnIds && booking.addOnIds.length > 0 && pkg?.addOns) {
      addOnTitles = pkg.addOns
        .filter((a) => booking.addOnIds?.includes(a.id))
        .map((a) => a.title);
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
  async rescheduleBooking(
    token: string,
    newDate: string
  ): Promise<any> {
    // Validate token (allow 'manage' or 'reschedule' action)
    const result = validateBookingToken(token, 'reschedule');
    if (!result.valid) {
      throw new Error(`Token validation failed: ${result.message}`);
    }

    const { tenantId, bookingId } = result.payload;

    // Reschedule via service
    const updated = await this.bookingService.rescheduleBooking(
      tenantId,
      bookingId,
      newDate
    );

    logger.info(
      { tenantId, bookingId, newDate },
      'Booking rescheduled via public API'
    );

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
  async cancelBooking(
    token: string,
    reason?: string
  ): Promise<any> {
    // Validate token (allow 'manage' or 'cancel' action)
    const result = validateBookingToken(token, 'cancel');
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

    logger.info(
      { tenantId, bookingId, reason },
      'Booking cancelled via public API'
    );

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
      logger.error({ error: error.message }, 'Failed to get booking details');

      if (error.message.includes('Token validation failed')) {
        if (error.message.includes('expired')) {
          return res.status(401).json({
            status: 'error',
            statusCode: 401,
            error: 'TOKEN_EXPIRED',
            message: 'Your link has expired. Please request a new one.',
          });
        }
        return res.status(401).json({
          status: 'error',
          statusCode: 401,
          error: 'INVALID_TOKEN',
          message: 'Invalid access link. Please request a new one.',
        });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          status: 'error',
          statusCode: 404,
          error: 'NOT_FOUND',
          message: error.message,
        });
      }

      return res.status(500).json({
        status: 'error',
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve booking details',
      });
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
      logger.error({ error: error.message }, 'Failed to reschedule booking');

      if (error.message.includes('Token validation failed')) {
        if (error.message.includes('expired')) {
          return res.status(401).json({
            status: 'error',
            statusCode: 401,
            error: 'TOKEN_EXPIRED',
            message: 'Your link has expired. Please request a new one.',
          });
        }
        return res.status(401).json({
          status: 'error',
          statusCode: 401,
          error: 'INVALID_TOKEN',
          message: 'Invalid access link. Please request a new one.',
        });
      }

      if (error instanceof BookingConflictError) {
        return res.status(409).json({
          status: 'error',
          statusCode: 409,
          error: 'BOOKING_CONFLICT',
          message: error.message,
        });
      }

      if (error instanceof BookingAlreadyCancelledError) {
        return res.status(422).json({
          status: 'error',
          statusCode: 422,
          error: 'BOOKING_ALREADY_CANCELLED',
          message: error.message,
        });
      }

      if (error instanceof BookingCannotBeRescheduledError) {
        return res.status(422).json({
          status: 'error',
          statusCode: 422,
          error: 'BOOKING_CANNOT_BE_RESCHEDULED',
          message: error.message,
        });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          status: 'error',
          statusCode: 404,
          error: 'NOT_FOUND',
          message: error.message,
        });
      }

      return res.status(500).json({
        status: 'error',
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reschedule booking',
      });
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
      logger.error({ error: error.message }, 'Failed to cancel booking');

      if (error.message.includes('Token validation failed')) {
        if (error.message.includes('expired')) {
          return res.status(401).json({
            status: 'error',
            statusCode: 401,
            error: 'TOKEN_EXPIRED',
            message: 'Your link has expired. Please request a new one.',
          });
        }
        return res.status(401).json({
          status: 'error',
          statusCode: 401,
          error: 'INVALID_TOKEN',
          message: 'Invalid access link. Please request a new one.',
        });
      }

      if (error instanceof BookingAlreadyCancelledError) {
        return res.status(422).json({
          status: 'error',
          statusCode: 422,
          error: 'BOOKING_ALREADY_CANCELLED',
          message: error.message,
        });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          status: 'error',
          statusCode: 404,
          error: 'NOT_FOUND',
          message: error.message,
        });
      }

      return res.status(500).json({
        status: 'error',
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to cancel booking',
      });
    }
  });

  return router;
}
