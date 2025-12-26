/**
 * Refund Processing Service
 *
 * Handles refund processing for cancelled bookings. Extracted from BookingService
 * to provide focused, testable refund logic with proper multi-tenant isolation.
 *
 * Key Features:
 * - Cumulative refund tracking (prevents over-refunds)
 * - Partial refund support
 * - Multi-tenant data isolation (all queries filter by tenantId)
 * - Event emission for notifications
 *
 * @module refund-processing.service
 */

import type { BookingRepository, PaymentProvider } from '../lib/ports';
import type { EventEmitter } from '../lib/core/events';
import { BookingEvents } from '../lib/core/events';
import { NotFoundError } from '../lib/errors';
import type { Booking } from '../lib/entities';

/**
 * Service for processing booking refunds
 *
 * Handles the refund workflow including:
 * - Validation of refund eligibility
 * - Calculation of refundable amounts
 * - Stripe refund processing
 * - Status updates and event emission
 */
export class RefundProcessingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly paymentProvider: PaymentProvider,
    private readonly eventEmitter: EventEmitter
  ) {}

  /**
   * Process refund for a cancelled booking
   *
   * Called after cancellation to initiate the refund with Stripe.
   * Updates refund status and stores Stripe refund ID.
   *
   * P1-150 FIX: Implements cumulative refund tracking to:
   * - Calculate total paid = deposit + balance (or fallback to totalCents)
   * - Track previous refunds to prevent over-refunds
   * - Support partial refunds with proper status tracking
   *
   * @param tenantId - Tenant ID for data isolation (CRITICAL: multi-tenant security)
   * @param bookingId - Booking identifier
   * @param paymentIntentId - Stripe PaymentIntent ID for refund
   * @param amountCents - Optional amount for partial refund (full refund if omitted)
   *
   * @returns Updated booking with refund status
   *
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {Error} If booking is not cancelled or doesn't need refund
   * @throws {Error} If refund amount exceeds refundable amount
   *
   * @example
   * ```typescript
   * // Full refund
   * const refunded = await refundService.processRefund(
   *   'tenant_123',
   *   'booking_abc',
   *   'pi_stripe_123'
   * );
   *
   * // Partial refund (50% = 5000 cents)
   * const partialRefund = await refundService.processRefund(
   *   'tenant_123',
   *   'booking_abc',
   *   'pi_stripe_123',
   *   5000
   * );
   * ```
   */
  async processRefund(
    tenantId: string,
    bookingId: string,
    paymentIntentId: string,
    amountCents?: number
  ): Promise<Booking> {
    // Validate booking exists (tenant-scoped query)
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Only refund cancelled bookings with pending refund status
    if (booking.status !== 'CANCELED' || booking.refundStatus !== 'PENDING') {
      throw new Error(`Booking ${bookingId} does not need a refund`);
    }

    // P1-150 FIX: Calculate total paid and validate refund amount
    // Total paid = deposit + balance (if applicable), falling back to totalCents for legacy bookings
    const totalPaid =
      (booking.depositPaidAmount ?? 0) + (booking.balancePaidAmount ?? 0) || booking.totalCents;

    // Track cumulative refunds to prevent over-refunds
    const previousRefunds = booking.refundAmount ?? 0;
    const maxRefundable = totalPaid - previousRefunds;

    // Determine refund amount (requested or remaining amount)
    const refundAmount = amountCents ?? maxRefundable;

    // Validate refund doesn't exceed what's available
    if (refundAmount <= 0) {
      throw new Error(`No refundable amount remaining for booking ${bookingId}`);
    }
    if (refundAmount > maxRefundable) {
      throw new Error(
        `Refund amount ${refundAmount} cents exceeds remaining refundable amount ${maxRefundable} cents`
      );
    }

    // Mark as processing (tenant-scoped update)
    await this.bookingRepo.update(tenantId, bookingId, {
      refundStatus: 'PROCESSING',
    });

    try {
      // Process refund via Stripe
      const refundResult = await this.paymentProvider.refund({
        paymentIntentId,
        amountCents: refundAmount,
        reason: 'Customer cancelled booking',
      });

      // P1-150 FIX: Track cumulative refunds and determine if partial vs complete
      const cumulativeRefund = previousRefunds + refundResult.amountCents;
      const isPartial = cumulativeRefund < totalPaid;

      // Update with refund details (tenant-scoped update)
      const refunded = await this.bookingRepo.update(tenantId, bookingId, {
        refundStatus: isPartial ? 'PARTIAL' : 'COMPLETED',
        refundAmount: cumulativeRefund, // P1-150 FIX: Use cumulative, not just latest
        refundedAt: new Date(),
        stripeRefundId: refundResult.refundId,
        status: isPartial ? 'CANCELED' : 'REFUNDED', // Mark as REFUNDED only if fully refunded
      });

      // Emit event for notifications
      await this.eventEmitter.emit(BookingEvents.REFUNDED, {
        bookingId: refunded.id,
        tenantId,
        email: refunded.email,
        coupleName: refunded.coupleName,
        refundAmount: refundResult.amountCents,
        isPartial,
      });

      return refunded;
    } catch (error) {
      // Mark refund as failed (tenant-scoped update)
      await this.bookingRepo.update(tenantId, bookingId, {
        refundStatus: 'FAILED',
      });
      throw error;
    }
  }
}
