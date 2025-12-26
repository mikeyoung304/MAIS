/**
 * Booking Lifecycle Service
 *
 * Handles booking lifecycle operations: reschedule, cancel, and payment failure.
 * All methods enforce multi-tenant isolation by requiring tenantId parameter.
 */

import type { BookingRepository } from '../lib/ports';
import type { Booking } from '../lib/entities';
import type { EventEmitter } from '../lib/core/events';
import { BookingEvents } from '../lib/core/events';
import {
  NotFoundError,
  BookingAlreadyCancelledError,
  BookingCannotBeRescheduledError,
} from '../lib/errors';
import { logger } from '../lib/core/logger';

export interface BookingLifecycleServiceOptions {
  bookingRepo: BookingRepository;
  eventEmitter: EventEmitter;
}

/**
 * Service handling booking lifecycle state transitions
 */
export class BookingLifecycleService {
  private readonly bookingRepo: BookingRepository;
  private readonly eventEmitter: EventEmitter;

  constructor(options: BookingLifecycleServiceOptions) {
    this.bookingRepo = options.bookingRepo;
    this.eventEmitter = options.eventEmitter;
  }

  /**
   * Reschedule a booking to a new date
   *
   * Uses advisory locks (ADR-006) to prevent race conditions.
   * MULTI-TENANT: Requires tenantId for data isolation.
   *
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {BookingAlreadyCancelledError} If booking is already cancelled
   * @throws {BookingCannotBeRescheduledError} If trying to reschedule to same date
   * @throws {BookingConflictError} If new date is already booked
   */
  async rescheduleBooking(tenantId: string, bookingId: string, newDate: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    if (booking.status === 'CANCELED') {
      throw new BookingAlreadyCancelledError(bookingId);
    }

    if (booking.eventDate === newDate) {
      throw new BookingCannotBeRescheduledError(bookingId, 'New date is the same as current date');
    }

    const updated = await this.bookingRepo.reschedule(tenantId, bookingId, newDate);

    await this.eventEmitter.emit(BookingEvents.RESCHEDULED, {
      bookingId: updated.id,
      tenantId,
      email: updated.email,
      coupleName: updated.coupleName,
      oldDate: booking.eventDate,
      newDate: updated.eventDate,
    });

    return updated;
  }

  /**
   * Cancel a booking with 3-phase pattern
   *
   * Phase 1: Mark booking as CANCELED
   * Phase 2: Record cancellation details
   * Phase 3: Initiate refund (if paid) - async via event
   *
   * MULTI-TENANT: Requires tenantId for data isolation.
   *
   * @throws {NotFoundError} If booking doesn't exist
   * @throws {BookingAlreadyCancelledError} If booking is already cancelled
   */
  async cancelBooking(
    tenantId: string,
    bookingId: string,
    cancelledBy: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM',
    reason?: string
  ): Promise<Booking> {
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    if (booking.status === 'CANCELED') {
      throw new BookingAlreadyCancelledError(bookingId);
    }

    const cancelled = await this.bookingRepo.update(tenantId, bookingId, {
      status: 'CANCELED',
      cancelledAt: new Date(),
      cancelledBy,
      cancellationReason: reason,
      refundStatus: booking.status === 'PAID' ? 'PENDING' : 'NONE',
    });

    await this.eventEmitter.emit(BookingEvents.CANCELLED, {
      bookingId: cancelled.id,
      tenantId,
      email: cancelled.email,
      coupleName: cancelled.coupleName,
      eventDate: cancelled.eventDate,
      totalCents: cancelled.totalCents,
      cancelledBy,
      reason,
      needsRefund: booking.status === 'PAID',
      googleEventId: cancelled.googleEventId ?? undefined,
    });

    return cancelled;
  }

  /**
   * Mark a booking's payment as failed
   *
   * Called by Stripe webhook when payment_intent.payment_failed is received.
   * Does not modify booking state (customer can retry payment).
   *
   * MULTI-TENANT: Requires tenantId for data isolation.
   *
   * @throws {NotFoundError} If booking doesn't exist
   */
  async markPaymentFailed(
    tenantId: string,
    bookingId: string,
    failureDetails: {
      reason: string;
      code: string;
      paymentIntentId: string;
    }
  ): Promise<Booking> {
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    logger.warn(
      {
        bookingId,
        tenantId,
        paymentIntentId: failureDetails.paymentIntentId,
        failureCode: failureDetails.code,
        failureReason: failureDetails.reason,
      },
      'Payment failure marked for booking'
    );

    await this.eventEmitter.emit(BookingEvents.PAYMENT_FAILED, {
      bookingId: booking.id,
      tenantId,
      email: booking.email,
      coupleName: booking.coupleName,
      eventDate: booking.eventDate,
      failureReason: failureDetails.reason,
      failureCode: failureDetails.code,
      paymentIntentId: failureDetails.paymentIntentId,
    });

    return booking;
  }
}
