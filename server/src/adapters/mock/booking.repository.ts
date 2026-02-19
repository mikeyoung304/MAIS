/**
 * Mock Booking Repository
 *
 * In-memory implementation of BookingRepository for testing and local development.
 */

import { toUtcMidnight } from '@macon/shared';
import type { Booking } from '../../lib/entities';
import type { BookingRepository, TimeslotBooking, AppointmentDto } from '../../lib/ports';
import { BookingConflictError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/core/logger';
import { QueryLimits } from '../../lib/core/query-limits';
import { bookings, bookingsByDate } from './state';

export class MockBookingRepository implements BookingRepository {
  async create(
    _tenantId: string,
    booking: Booking,
    paymentData?: {
      amount: number;
      processor: string;
      processorId: string;
    }
  ): Promise<Booking> {
    // Mock mode: Ignore tenantId and paymentData (no Payment table in mock)
    const dateKey = toUtcMidnight(booking.eventDate);

    // Enforce unique by date
    if (bookingsByDate.has(dateKey)) {
      throw new BookingConflictError(dateKey);
    }

    bookings.set(booking.id, booking);
    bookingsByDate.set(dateKey, booking.id);

    // P2 #037: In mock mode, we just log payment data
    // Real Prisma implementation creates Payment record atomically
    if (paymentData) {
      logger.debug(
        {
          bookingId: booking.id,
          amount: paymentData.amount / 100,
          processor: paymentData.processor,
          processorId: paymentData.processorId,
        },
        'Mock payment recorded for booking'
      );
    }

    return booking;
  }

  async findById(_tenantId: string, id: string): Promise<Booking | null> {
    return bookings.get(id) || null;
  }

  async findAll(
    _tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Booking[]> {
    const all = Array.from(bookings.values());
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return all.slice(offset, offset + limit);
  }

  async isDateBooked(_tenantId: string, date: string): Promise<boolean> {
    const dateKey = toUtcMidnight(date);
    return bookingsByDate.has(dateKey);
  }

  async getUnavailableDates(_tenantId: string, startDate: Date, endDate: Date): Promise<Date[]> {
    const unavailable: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const booking of bookings.values()) {
      const bookingDate = new Date(booking.eventDate);
      if (bookingDate >= start && bookingDate <= end && booking.status === 'PAID') {
        unavailable.push(bookingDate);
      }
    }

    return unavailable.sort((a, b) => a.getTime() - b.getTime());
  }

  async updateGoogleEventId(
    _tenantId: string,
    bookingId: string,
    googleEventId: string
  ): Promise<void> {
    const booking = bookings.get(bookingId);
    if (booking) {
      Object.assign(booking, { googleEventId });
      logger.debug({ bookingId, googleEventId }, 'Updated booking with Google event ID');
    }
  }

  async update(
    _tenantId: string,
    bookingId: string,
    data: {
      eventDate?: string;
      status?: 'CANCELED';
      cancelledAt?: Date;
      cancelledBy?: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM';
      cancellationReason?: string;
      refundStatus?: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
      refundAmount?: number;
      refundedAt?: Date;
      stripeRefundId?: string;
    }
  ): Promise<Booking> {
    const booking = bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (data.eventDate !== undefined) {
      const oldDateKey = toUtcMidnight(booking.eventDate);
      const newDateKey = toUtcMidnight(data.eventDate);
      bookingsByDate.delete(oldDateKey);
      bookingsByDate.set(newDateKey, bookingId);
      booking.eventDate = data.eventDate;
    }
    if (data.status !== undefined) {
      booking.status = data.status;
    }

    // Cancellation and refund fields are optional on the Booking entity.
    // Object.assign is type-safe for partial updates on the domain entity.
    const optionalUpdates: Partial<Booking> = {};
    if (data.cancelledAt !== undefined)
      optionalUpdates.cancelledAt = data.cancelledAt.toISOString();
    if (data.cancelledBy !== undefined) optionalUpdates.cancelledBy = data.cancelledBy;
    if (data.cancellationReason !== undefined)
      optionalUpdates.cancellationReason = data.cancellationReason;
    if (data.refundStatus !== undefined) optionalUpdates.refundStatus = data.refundStatus;
    if (data.refundAmount !== undefined) optionalUpdates.refundAmount = data.refundAmount;
    if (data.refundedAt !== undefined) optionalUpdates.refundedAt = data.refundedAt.toISOString();
    if (data.stripeRefundId !== undefined) optionalUpdates.stripeRefundId = data.stripeRefundId;
    Object.assign(booking, optionalUpdates);

    logger.debug({ bookingId, data }, 'Mock booking updated');
    return booking;
  }

  async reschedule(_tenantId: string, bookingId: string, newDate: string): Promise<Booking> {
    const booking = bookings.get(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    if (booking.status === 'CANCELED') {
      throw new Error(`Booking ${bookingId} is already cancelled`);
    }

    const newDateKey = toUtcMidnight(newDate);

    const existingId = bookingsByDate.get(newDateKey);
    if (existingId && existingId !== bookingId) {
      const existingBooking = bookings.get(existingId);
      if (existingBooking && existingBooking.status !== 'CANCELED') {
        throw new BookingConflictError(newDate);
      }
    }

    const oldDateKey = toUtcMidnight(booking.eventDate);
    bookingsByDate.delete(oldDateKey);
    bookingsByDate.set(newDateKey, bookingId);
    booking.eventDate = newDate;

    const eventDate = new Date(newDate + 'T00:00:00Z');
    const now = new Date();
    const daysUntilEvent = Math.floor(
      (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    Object.assign(booking, {
      reminderDueDate:
        daysUntilEvent > 7
          ? new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : undefined,
      reminderSentAt: undefined,
    });

    logger.debug({ bookingId, newDate }, 'Mock booking rescheduled');
    return booking;
  }

  async findTimeslotBookings(
    _tenantId: string,
    date: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]> {
    logger.debug(
      { date: date.toISOString(), serviceId: serviceId || 'all' },
      'findTimeslotBookings called'
    );
    return [];
  }

  async findTimeslotBookingsInRange(
    _tenantId: string,
    startDate: Date,
    endDate: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]> {
    logger.debug(
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        serviceId: serviceId || 'all',
      },
      'findTimeslotBookingsInRange called'
    );
    return [];
  }

  async countTimeslotBookingsForServiceOnDate(
    _tenantId: string,
    serviceId: string,
    date: Date
  ): Promise<number> {
    logger.debug(
      {
        serviceId,
        date: date.toISOString(),
      },
      'countTimeslotBookingsForServiceOnDate called'
    );
    return 0;
  }

  async findAppointments(
    tenantId: string,
    filters?: {
      status?: string;
      serviceId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AppointmentDto[]> {
    const DEFAULT_LIMIT = QueryLimits.MAX_PAGE_SIZE;

    const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, QueryLimits.BOOKINGS_MAX);
    const offset = Math.max(filters?.offset ?? 0, 0);

    logger.debug({ tenantId, filters, limit, offset }, 'findAppointments called');
    return [];
  }

  async findBookingsNeedingReminders(_tenantId: string, limit: number = 10): Promise<Booking[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: Booking[] = [];
    for (const booking of bookings.values()) {
      if (booking.status !== 'PAID') continue;

      const reminderDueDate = booking.reminderDueDate;
      const reminderSentAt = booking.reminderSentAt;

      if (reminderDueDate && !reminderSentAt) {
        const dueDate = new Date(reminderDueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate <= today) {
          result.push(booking);
          if (result.length >= limit) break;
        }
      }
    }

    logger.debug(
      { tenantId: _tenantId, count: result.length },
      'findBookingsNeedingReminders called'
    );
    return result;
  }

  async markReminderSent(_tenantId: string, bookingId: string): Promise<void> {
    const booking = bookings.get(bookingId);
    if (booking) {
      Object.assign(booking, { reminderSentAt: new Date().toISOString() });
      logger.debug({ bookingId }, 'Reminder marked as sent');
    }
  }

  /**
   * Complete balance payment atomically
   * P1-147 FIX: Mock implementation - in-memory is naturally atomic
   */
  async completeBalancePayment(
    _tenantId: string,
    bookingId: string,
    balanceAmountCents: number
  ): Promise<Booking | null> {
    const booking = bookings.get(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Idempotent: If balance already paid, return null
    if (booking.balancePaidAt) {
      return null;
    }

    // Update booking with balance paid
    Object.assign(booking, {
      balancePaidAmount: balanceAmountCents,
      balancePaidAt: new Date().toISOString(),
      status: 'PAID' as const,
    });

    return booking;
  }
}
