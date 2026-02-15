/**
 * Tenant Admin Booking Routes
 * GET /bookings, GET /bookings/:id, POST /bookings/:id/cancel, GET /dashboard
 */

import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';
import { logger } from '../lib/core/logger';
import { bookingQuerySchema } from '../validation/tenant-admin.schemas';
import { getTenantId } from './tenant-admin-shared';
import type { TenantAdminDeps } from './tenant-admin-shared';

export function registerBookingRoutes(router: Router, deps: TenantAdminDeps): void {
  const { tenantRepository, catalogService, bookingService } = deps;

  // ============================================================================
  // Booking View Endpoint (Read-Only)
  // ============================================================================

  /**
   * GET /v1/tenant-admin/bookings
   * List all bookings for authenticated tenant
   * Query params: ?status=PAID&startDate=2025-01-01&endDate=2025-12-31
   */
  router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      const query = bookingQuerySchema.parse(req.query);
      let bookings = await bookingService.getAllBookings(tenantId);

      // Apply filters
      if (query.status) {
        bookings = bookings.filter((b) => b.status === query.status);
      }

      if (query.startDate) {
        bookings = bookings.filter((b) => b.eventDate >= query.startDate!);
      }

      if (query.endDate) {
        bookings = bookings.filter((b) => b.eventDate <= query.endDate!);
      }

      // Map to DTO
      const bookingsDto = bookings.map((booking) => ({
        id: booking.id,
        tierId: booking.tierId,
        coupleName: booking.coupleName,
        email: booking.email,
        phone: booking.phone,
        eventDate: booking.eventDate,
        addOnIds: booking.addOnIds,
        totalCents: booking.totalCents,
        status: booking.status,
        createdAt: booking.createdAt,
      }));

      res.json(bookingsDto);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/tenant-admin/dashboard
   * Get aggregated business stats for agent context
   *
   * Returns:
   * - Package count
   * - Booking counts (total, upcoming, by status)
   * - Revenue stats (this month, total)
   * - Recent activity
   */
  router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      // Get basic stats
      const stats = await tenantRepository.getStats(tenantId);

      // Get all bookings for detailed stats
      const allBookings = await bookingService.getAllBookings(tenantId);

      // Calculate booking breakdown
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const bookingsByStatus = {
        pending: 0,
        depositPaid: 0,
        paid: 0,
        confirmed: 0,
        canceled: 0,
        refunded: 0,
        fulfilled: 0,
      };

      let upcomingCount = 0;
      let revenueThisMonth = 0;
      let totalRevenue = 0;

      for (const booking of allBookings) {
        // Count by status - normalize to lowercase without underscores
        const normalizedStatus = booking.status.toLowerCase().replace('_', '');
        if (normalizedStatus === 'depositpaid') {
          bookingsByStatus.depositPaid++;
        } else if (normalizedStatus in bookingsByStatus) {
          const statusKey = normalizedStatus as keyof typeof bookingsByStatus;
          bookingsByStatus[statusKey]++;
        }

        // Count upcoming (next 30 days, not canceled/refunded)
        const eventDate = new Date(booking.eventDate);
        if (
          eventDate >= now &&
          eventDate <= next30Days &&
          !['CANCELED', 'REFUNDED'].includes(booking.status)
        ) {
          upcomingCount++;
        }

        // Calculate revenue (only PAID, CONFIRMED, FULFILLED)
        if (['PAID', 'CONFIRMED', 'FULFILLED'].includes(booking.status)) {
          totalRevenue += booking.totalCents;
          const bookingDate = new Date(booking.createdAt);
          if (bookingDate >= thisMonth) {
            revenueThisMonth += booking.totalCents;
          }
        }
      }

      const dashboard = {
        packages: stats.packageCount,
        addOns: stats.addOnCount,
        bookings: {
          total: stats.bookingCount,
          upcoming: upcomingCount,
          byStatus: bookingsByStatus,
        },
        revenue: {
          thisMonthCents: revenueThisMonth,
          totalCents: totalRevenue,
        },
      };

      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /v1/tenant-admin/bookings/:id
   * Get single booking with full details
   *
   * Returns complete booking information including customer details
   */
  router.get('/bookings/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { id } = req.params;
      const booking = await bookingService.getBookingById(tenantId, id);

      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      // Get tier details for context (only for DATE bookings with tierId)
      const tier = booking.tierId
        ? await catalogService.getTierById(tenantId, booking.tierId)
        : null;

      const bookingDto = {
        id: booking.id,
        tierId: booking.tierId,
        tierTitle: tier?.title || 'Unknown Tier',
        coupleName: booking.coupleName,
        email: booking.email,
        phone: booking.phone,
        eventDate: booking.eventDate,
        addOnIds: booking.addOnIds,
        totalCents: booking.totalCents,
        status: booking.status,
        // Deposit/balance fields
        depositPaidAmount: booking.depositPaidAmount,
        balanceDueDate: booking.balanceDueDate,
        balancePaidAmount: booking.balancePaidAmount,
        balancePaidAt: booking.balancePaidAt,
        // Timestamps
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        confirmedAt: booking.confirmedAt,
        cancelledAt: booking.cancelledAt,
        // Cancellation details
        cancelledBy: booking.cancelledBy,
        cancellationReason: booking.cancellationReason,
        // Refund details
        refundStatus: booking.refundStatus,
        refundAmount: booking.refundAmount,
        refundedAt: booking.refundedAt,
      };

      res.json(bookingDto);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/bookings/:id/cancel
   * Cancel a booking with optional refund
   *
   * This is a T3 (hard confirm) operation for the agent.
   * Requires explicit user confirmation before calling.
   *
   * @body reason - Optional cancellation reason
   * @returns Cancelled booking with refund status
   */
  router.post('/bookings/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const { id } = req.params;
      const { reason } = req.body || {};

      // Get booking first to verify ownership
      const booking = await bookingService.getBookingById(tenantId, id);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      // Check if already cancelled
      if (booking.status === 'CANCELED' || booking.status === 'REFUNDED') {
        res.status(409).json({ error: 'Booking is already cancelled or refunded' });
        return;
      }

      // Cancel the booking (will handle refund if applicable)
      const cancelledBooking = await bookingService.cancelBooking(
        tenantId,
        id,
        'TENANT',
        reason || 'Cancelled by tenant'
      );

      logger.info({ tenantId, bookingId: id }, 'Booking cancelled via tenant-admin API');

      res.json({
        id: cancelledBooking.id,
        status: cancelledBooking.status,
        cancelledAt: cancelledBooking.cancelledAt,
        cancelledBy: cancelledBooking.cancelledBy,
        cancellationReason: cancelledBooking.cancellationReason,
        refundStatus: cancelledBooking.refundStatus,
        refundAmount: cancelledBooking.refundAmount,
      });
    } catch (error) {
      next(error);
    }
  });
}
