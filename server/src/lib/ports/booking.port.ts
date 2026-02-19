/**
 * Booking Repository Port — Booking persistence and scheduling
 */

import type { Booking } from '../entities';

/**
 * Time-slot booking for conflict detection
 */
export interface TimeslotBooking {
  id: string;
  tenantId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'FULFILLED';
}

/**
 * Update fields for booking modifications
 */
export interface BookingUpdateInput {
  // Reschedule fields
  eventDate?: string; // New date (YYYY-MM-DD format)

  // Status transitions
  status?:
    | 'PENDING'
    | 'DEPOSIT_PAID'
    | 'PAID'
    | 'CONFIRMED'
    | 'CANCELED'
    | 'REFUNDED'
    | 'FULFILLED';

  // Cancellation fields
  cancelledAt?: Date;
  cancelledBy?: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM';
  cancellationReason?: string;

  // Refund tracking
  refundStatus?: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  refundAmount?: number;
  refundedAt?: Date;
  stripeRefundId?: string;

  // Reminder tracking
  reminderSentAt?: Date;
  reminderDueDate?: Date;

  // Deposit tracking
  depositPaidAmount?: number;
  balanceDueDate?: Date;
  balancePaidAmount?: number;
  balancePaidAt?: Date;
}

/**
 * Booking Repository - Booking persistence
 */
export interface BookingRepository {
  create(
    tenantId: string,
    booking: Booking,
    paymentData?: {
      amount: number;
      processor: string;
      processorId: string;
    }
  ): Promise<Booking>;
  findById(tenantId: string, id: string): Promise<Booking | null>;
  findAll(tenantId: string, options?: { limit?: number; offset?: number }): Promise<Booking[]>;
  isDateBooked(tenantId: string, date: string): Promise<boolean>;
  getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<Date[]>;
  updateGoogleEventId(tenantId: string, bookingId: string, googleEventId: string): Promise<void>;

  /**
   * Update booking fields (reschedule, cancel, refund status, etc.)
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   * @param data - Fields to update
   * @returns Updated booking
   */
  update(tenantId: string, bookingId: string, data: BookingUpdateInput): Promise<Booking>;

  /**
   * Reschedule booking to a new date with advisory lock protection
   *
   * Uses PostgreSQL advisory locks (ADR-006) to prevent race conditions
   * when multiple reschedule requests target the same date.
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   * @param newDate - New event date (YYYY-MM-DD format)
   * @returns Updated booking
   * @throws {BookingConflictError} If new date is already booked
   * @throws {BookingAlreadyCancelledError} If booking is already cancelled
   */
  reschedule(tenantId: string, bookingId: string, newDate: string): Promise<Booking>;

  /**
   * Complete balance payment atomically with advisory lock protection
   *
   * P1-147 FIX: Uses PostgreSQL advisory locks to prevent race conditions
   * when concurrent balance payment webhooks arrive for the same booking.
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   * @param balanceAmountCents - Balance amount paid in cents
   * @returns Updated booking with balance paid, or null if already paid (idempotent)
   * @throws {NotFoundError} If booking doesn't exist
   */
  completeBalancePayment(
    tenantId: string,
    bookingId: string,
    balanceAmountCents: number
  ): Promise<Booking | null>;

  /**
   * Find all TIMESLOT bookings that overlap with a date range
   *
   * Used by SchedulingAvailabilityService for conflict detection.
   * Returns bookings where startTime overlaps with the given date's day.
   *
   * @param tenantId - Tenant ID for isolation
   * @param date - The date to check for time-slot bookings
   * @param serviceId - Optional service ID to filter by specific service
   * @returns Array of time-slot bookings for conflict detection
   */
  findTimeslotBookings(
    tenantId: string,
    date: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]>;

  /**
   * Find all TIMESLOT bookings within a date range (batch query)
   *
   * Used for batch availability checking to avoid N+1 query problem.
   * Returns all TIMESLOT bookings where startTime falls within the range.
   *
   * @param tenantId - Tenant ID for isolation
   * @param startDate - Start of date range (inclusive)
   * @param endDate - End of date range (inclusive)
   * @param serviceId - Optional service ID to filter by specific service
   * @returns Array of time-slot bookings for conflict detection
   */
  findTimeslotBookingsInRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]>;

  /**
   * Count TIMESLOT bookings for a specific service on a specific date
   *
   * Used for maxPerDay enforcement. Only counts active bookings (PENDING, CONFIRMED).
   *
   * @param tenantId - Tenant ID for isolation
   * @param serviceId - Service ID to count bookings for
   * @param date - The date to count bookings for
   * @returns Number of active bookings for this service on this date
   */
  countTimeslotBookingsForServiceOnDate(
    tenantId: string,
    serviceId: string,
    date: Date
  ): Promise<number>;

  /**
   * Find all appointments (TIMESLOT bookings) with optional filters
   *
   * Performs server-side filtering for efficient queries.
   * Used by admin dashboard to list appointments.
   *
   * PERFORMANCE: Implements pagination with reasonable limits to prevent DoS.
   * - Default limit: 100 appointments
   * - Maximum limit: 500 appointments
   * - Maximum date range: 90 days
   *
   * @param tenantId - Tenant ID for isolation
   * @param filters - Optional filters for status, serviceId, and date range
   * @param filters.status - Filter by booking status
   * @param filters.serviceId - Filter by service ID
   * @param filters.startDate - Filter by start date (inclusive, ISO string)
   * @param filters.endDate - Filter by end date (inclusive, ISO string)
   * @param filters.limit - Maximum number of results to return (default 100, max 500)
   * @param filters.offset - Number of results to skip for pagination (default 0)
   * @returns Array of appointments with full details
   */
  findAppointments(
    tenantId: string,
    filters?: {
      status?: string;
      serviceId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AppointmentDto[]>;

  /**
   * Find bookings that need reminders sent (lazy reminder evaluation)
   *
   * Returns bookings where:
   * - reminderDueDate <= today
   * - reminderSentAt is null
   * - status is PAID/CONFIRMED (not cancelled)
   *
   * @param tenantId - Tenant ID for isolation
   * @param limit - Maximum number of reminders to process (default 10)
   * @returns Array of bookings needing reminders
   */
  findBookingsNeedingReminders(tenantId: string, limit?: number): Promise<Booking[]>;

  /**
   * Mark a booking's reminder as sent
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   */
  markReminderSent(tenantId: string, bookingId: string): Promise<void>;
}

/**
 * Appointment DTO for admin dashboard
 */
export interface AppointmentDto {
  id: string;
  tenantId: string;
  customerId: string;
  serviceId: string | null;
  tierId: string | null; // Nullable for TIMESLOT bookings
  date: string; // YYYY-MM-DD
  startTime: string | null; // ISO datetime
  endTime: string | null; // ISO datetime
  clientTimezone: string | null;
  status: string;
  totalPrice: number;
  notes: string | null;
  createdAt: string;
}
