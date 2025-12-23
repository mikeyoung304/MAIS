/**
 * Prisma Booking Repository Adapter
 */

import { PrismaClientKnownRequestError, Decimal } from '@prisma/client/runtime/library';
import type { PrismaClient } from '../../generated/prisma';
import type { BookingRepository, TimeslotBooking, AppointmentDto } from '../lib/ports';
import type { Booking } from '../lib/entities';
import { BookingConflictError, BookingLockTimeoutError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/core/logger';
import { toISODate } from '../lib/date-utils';

// Transaction configuration for booking creation
const BOOKING_TRANSACTION_TIMEOUT_MS = 5000; // 5 seconds
const BOOKING_ISOLATION_LEVEL = 'ReadCommitted' as const;
const MAX_TRANSACTION_RETRIES = 3; // Retry up to 3 times on deadlock
const RETRY_DELAY_MS = 100; // Base delay between retries

/**
 * Generate deterministic lock ID from tenantId + date for PostgreSQL advisory locks
 * Uses FNV-1a hash algorithm to convert string to 32-bit integer
 * Advisory locks provide explicit serialization without phantom read issues
 */
function hashTenantDate(tenantId: string, date: string): number {
  const str = `${tenantId}:${date}`;
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // Convert to 32-bit signed integer (PostgreSQL bigint range)
  return hash | 0;
}

/**
 * Generate deterministic lock ID from tenantId + bookingId for advisory locks
 * P1-147 FIX: Provides booking-specific locking for balance payment race prevention
 */
function hashTenantBooking(tenantId: string, bookingId: string): number {
  const str = `${tenantId}:balance:${bookingId}`;
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return hash | 0;
}

export interface BookingRepositoryConfig {
  isolationLevel?: 'Serializable' | 'ReadCommitted';
}

export class PrismaBookingRepository implements BookingRepository {
  private readonly isolationLevel: 'Serializable' | 'ReadCommitted';

  constructor(
    private readonly prisma: PrismaClient,
    config?: BookingRepositoryConfig
  ) {
    this.isolationLevel = config?.isolationLevel ?? BOOKING_ISOLATION_LEVEL;
  }

  /**
   * Helper: Retry transaction on serialization failures (deadlocks/write conflicts)
   * Implements exponential backoff for concurrent transaction conflicts
   */
  private async retryTransaction<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if this is a retryable serialization failure
        const isRetryable =
          error instanceof PrismaClientKnownRequestError &&
          (error.code === 'P2034' || // Transaction conflict
            error.message.includes('write conflict') ||
            error.message.includes('deadlock'));

        // If not retryable or last attempt, throw immediately
        if (!isRetryable || attempt === MAX_TRANSACTION_RETRIES) {
          throw error;
        }

        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(
          {
            context,
            attempt,
            maxRetries: MAX_TRANSACTION_RETRIES,
            delayMs: delay,
            error: error.message,
          },
          'Transaction conflict, retrying...'
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError;
  }

  /**
   * Creates a new booking with advanced race condition protection
   *
   * Implements multi-layered concurrency control to prevent double-bookings:
   * 1. PostgreSQL advisory lock (explicit serialization per tenant+date)
   * 2. READ COMMITTED transaction isolation level (balanced consistency)
   * 3. Explicit date availability check after lock acquisition
   * 4. Unique constraint enforcement at database level
   *
   * CRITICAL FIX (P2 #037): Atomically creates both Booking and Payment records
   * in a single transaction to prevent financial reconciliation issues. If either
   * creation fails, both operations are rolled back to maintain data integrity.
   *
   * Transaction configuration:
   * - Timeout: 5 seconds (BOOKING_TRANSACTION_TIMEOUT_MS)
   * - Isolation: READ COMMITTED (avoids phantom read issues with SERIALIZABLE)
   *
   * Lock acquisition strategy:
   * - Uses pg_advisory_xact_lock (transaction-scoped advisory lock)
   * - Lock is automatically released when transaction commits/aborts
   * - Waits for lock if another transaction holds it (queue buildup prevention via retry logic)
   * - Lock ID is deterministic hash of tenantId:eventDate
   *
   * @param tenantId - Tenant ID for data isolation
   * @param booking - Domain booking entity to persist
   * @param paymentData - Optional payment data to create alongside booking (for webhook flows)
   *
   * @returns Created booking with generated timestamps
   *
   * @throws {BookingConflictError} If date is already booked (P2002 unique constraint)
   *
   * @example
   * ```typescript
   * try {
   *   const booking = await repository.create('tenant_123', {
   *     id: 'booking_123',
   *     packageId: 'pkg_abc',
   *     eventDate: '2025-06-15',
   *     coupleName: 'Jane & John',
   *     email: 'couple@example.com',
   *     addOnIds: ['addon_1'],
   *     totalCents: 150000,
   *     status: 'PAID',
   *     createdAt: new Date().toISOString()
   *   }, {
   *     amount: 150000,
   *     processor: 'stripe',
   *     processorId: 'cs_test_123'
   *   });
   * } catch (error) {
   *   if (error instanceof BookingConflictError) {
   *     // Date already booked - show user alternative dates
   *   }
   * }
   * ```
   */
  async create(
    tenantId: string,
    booking: Booking,
    paymentData?: {
      amount: number;
      processor: string;
      processorId: string;
    }
  ): Promise<Booking> {
    return this.retryTransaction(async () => {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Acquire advisory lock for this specific tenant+date combination
            // Lock is automatically released when transaction ends
            const lockId = hashTenantDate(tenantId, booking.eventDate);
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

            // Check if date is already booked for this tenant and booking type
            // DATE bookings are exclusive per day, TIMESLOT bookings allow multiple per day
            const existing = await tx.booking.findFirst({
              where: {
                tenantId,
                date: new Date(booking.eventDate),
                bookingType: booking.bookingType || 'DATE',
              },
            });

            if (existing) {
              throw new BookingConflictError(booking.eventDate);
            }

            // Create or find the customer (tenant-scoped)
            // Normalize email to lowercase for case-insensitive matching
            const normalizedEmail = booking.email.toLowerCase().trim();
            const customer = await tx.customer.upsert({
              where: {
                tenantId_email: {
                  tenantId,
                  email: normalizedEmail,
                },
              },
              update: {
                name: booking.coupleName,
                phone: booking.phone,
              },
              create: {
                tenantId,
                email: normalizedEmail,
                name: booking.coupleName,
                phone: booking.phone,
              },
            });

            // Fetch actual add-on prices for accurate financial records
            const addOnPrices = new Map<string, number>();
            if (booking.addOnIds.length > 0) {
              const addOns = await tx.addOn.findMany({
                where: {
                  tenantId,
                  id: { in: booking.addOnIds },
                },
                select: { id: true, price: true },
              });
              addOns.forEach((a) => addOnPrices.set(a.id, a.price));
            }

            // Create booking with tenant isolation
            const created = await tx.booking.create({
              data: {
                id: booking.id,
                tenantId,
                customerId: customer.id,
                packageId: booking.packageId,
                date: new Date(booking.eventDate),
                totalPrice: booking.totalCents,
                status: this.mapToPrismaStatus(booking.status),
                // P1-310 FIX: Explicit bookingType field to ensure consistency with domain entity
                // Defaults to 'DATE' for backward compatibility with existing booking flows
                bookingType: booking.bookingType || 'DATE',
                commissionAmount: booking.commissionAmount ?? 0,
                commissionPercent: booking.commissionPercent ?? 0,
                // Reminder fields
                reminderDueDate: booking.reminderDueDate ? new Date(booking.reminderDueDate) : null,
                // Cancellation and refund fields (optional on create)
                cancelledBy: booking.cancelledBy ?? null,
                cancellationReason: booking.cancellationReason ?? null,
                refundStatus: booking.refundStatus ?? undefined,
                refundAmount: booking.refundAmount ?? null,
                refundedAt: booking.refundedAt ? new Date(booking.refundedAt) : null,
                stripeRefundId: booking.stripeRefundId ?? null,
                // Deposit fields (optional on create)
                depositPaidAmount: booking.depositPaidAmount ?? null,
                balanceDueDate: booking.balanceDueDate ? new Date(booking.balanceDueDate) : null,
                balancePaidAmount: booking.balancePaidAmount ?? null,
                balancePaidAt: booking.balancePaidAt ? new Date(booking.balancePaidAt) : null,
                addOns: {
                  create: booking.addOnIds.map((addOnId) => ({
                    addOnId,
                    quantity: 1,
                    unitPrice: addOnPrices.get(addOnId) || 0,
                  })),
                },
              },
              include: {
                customer: true,
                addOns: {
                  select: {
                    addOnId: true,
                  },
                },
              },
            });

            // P2 #037 FIX: Create Payment record atomically with Booking
            // This ensures financial reconciliation integrity - if booking succeeds
            // but payment record creation fails, the entire transaction rolls back
            if (paymentData) {
              await tx.payment.create({
                data: {
                  tenantId,
                  bookingId: created.id,
                  amount: paymentData.amount,
                  currency: 'USD',
                  status: 'CAPTURED', // Payment already completed via Stripe
                  processor: paymentData.processor,
                  processorId: paymentData.processorId,
                },
              });
            }

            return this.toDomainBooking(created);
          },
          {
            timeout: BOOKING_TRANSACTION_TIMEOUT_MS,
            isolationLevel: this.isolationLevel as any,
          }
        );
      } catch (error) {
        // Handle unique constraint violation on eventDate
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new BookingConflictError(booking.eventDate);
        }
        // Re-throw BookingConflictError (from explicit check)
        if (error instanceof BookingConflictError) {
          throw error;
        }
        throw error;
      }
    }, `create-booking-${tenantId}-${booking.eventDate}`);
  }

  /**
   * Retrieves a single booking by ID with related customer and add-on data
   *
   * @param id - Booking identifier
   *
   * @returns Domain booking entity or null if not found
   *
   * @example
   * ```typescript
   * const booking = await repository.findById('booking_123');
   * if (booking) {
   *   console.log(`Booking for ${booking.coupleName} on ${booking.eventDate}`);
   * }
   * ```
   */
  async findById(tenantId: string, id: string): Promise<Booking | null> {
    const booking = await this.prisma.booking.findFirst({
      where: { tenantId, id },
      include: {
        customer: true,
        addOns: {
          select: {
            addOnId: true,
          },
        },
      },
    });

    return booking ? this.toDomainBooking(booking) : null;
  }

  /**
   * Retrieves all bookings ordered by creation date (most recent first)
   *
   * Includes full customer and add-on relationship data for each booking.
   *
   * @returns Array of domain booking entities
   *
   * @example
   * ```typescript
   * const bookings = await repository.findAll();
   * console.log(`Total bookings: ${bookings.length}`);
   * ```
   */
  async findAll(tenantId: string): Promise<Booking[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        addOns: {
          select: {
            addOnId: true,
          },
        },
      },
    });

    return bookings.map((b) => this.toDomainBooking(b));
  }

  /**
   * Checks if a specific date already has a booking
   *
   * Used for availability checks in the date picker and availability service.
   *
   * @param date - Date string in YYYY-MM-DD format
   *
   * @returns True if date is booked, false if available
   *
   * @example
   * ```typescript
   * const isBooked = await repository.isDateBooked('2025-06-15');
   * if (isBooked) {
   *   console.log('Date unavailable - already booked');
   * }
   * ```
   */
  async isDateBooked(tenantId: string, date: string): Promise<boolean> {
    const booking = await this.prisma.booking.findFirst({
      where: { tenantId, date: new Date(date) },
    });

    return booking !== null;
  }

  /**
   * Retrieves all unavailable booking dates within a date range
   *
   * Performs batch query to fetch booked dates efficiently (avoids N queries).
   * Only returns dates with CONFIRMED or PENDING status (excludes CANCELED/FULFILLED).
   *
   * @param startDate - Start of date range (inclusive)
   * @param endDate - End of date range (inclusive)
   *
   * @returns Array of booked Date objects
   *
   * @example
   * ```typescript
   * const unavailable = await repository.getUnavailableDates(
   *   new Date('2025-06-01'),
   *   new Date('2025-06-30')
   * );
   * // Returns: [Date('2025-06-15'), Date('2025-06-22'), ...]
   * ```
   */
  async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<Date[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['CONFIRMED', 'PENDING'], // Exclude CANCELED and FULFILLED
        },
      },
      select: {
        date: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    return bookings.map((b) => b.date);
  }

  /**
   * Update Google Calendar event ID for a booking
   *
   * Stores the Google Calendar event ID after successful calendar sync.
   * This allows future cancellation of the calendar event.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param bookingId - Booking identifier
   * @param googleEventId - Google Calendar event ID
   *
   * @example
   * ```typescript
   * await repository.updateGoogleEventId('tenant_123', 'booking_abc', 'google_event_xyz');
   * ```
   */
  async updateGoogleEventId(
    tenantId: string,
    bookingId: string,
    googleEventId: string
  ): Promise<void> {
    await this.prisma.booking.updateMany({
      where: {
        tenantId,
        id: bookingId,
      },
      data: {
        googleEventId,
      },
    });
  }

  /**
   * Find all TIMESLOT bookings for a specific date
   *
   * Used by SchedulingAvailabilityService for conflict detection.
   * Only returns TIMESLOT bookings (not DATE bookings) that fall on the given date.
   *
   * MULTI-TENANT: Filtered by tenantId for data isolation
   *
   * @param tenantId - Tenant ID for isolation
   * @param date - The date to check for time-slot bookings
   * @param serviceId - Optional service ID to filter by specific service
   * @returns Array of time-slot bookings for conflict detection
   *
   * @example
   * ```typescript
   * const bookings = await repository.findTimeslotBookings(
   *   'tenant_123',
   *   new Date('2025-06-15'),
   *   'service_abc'
   * );
   * // Returns bookings with startTime on 2025-06-15
   * ```
   */
  async findTimeslotBookings(
    tenantId: string,
    date: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]> {
    // Calculate start and end of day in UTC
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        bookingType: 'TIMESLOT',
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        // Only filter by serviceId if provided
        ...(serviceId && { serviceId }),
        // Exclude cancelled bookings from conflict detection
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
      select: {
        id: true,
        tenantId: true,
        serviceId: true,
        startTime: true,
        endTime: true,
        status: true,
      },
    });

    // Map to TimeslotBooking type (filter out nulls and type-narrow)
    return bookings
      .filter(
        (
          b
        ): b is typeof b & {
          serviceId: string;
          startTime: Date;
          endTime: Date;
        } => b.serviceId !== null && b.startTime !== null && b.endTime !== null
      )
      .map((b) => ({
        id: b.id,
        tenantId: b.tenantId,
        serviceId: b.serviceId,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status as TimeslotBooking['status'],
      }));
  }

  /**
   * Find all TIMESLOT bookings within a date range (batch query)
   *
   * PERFORMANCE: Single query optimization to avoid N+1 problem.
   * Used by getNextAvailableSlot to batch-fetch bookings for entire search window.
   *
   * MULTI-TENANT: Filtered by tenantId for data isolation
   *
   * @param tenantId - Tenant ID for isolation
   * @param startDate - Start of date range (inclusive)
   * @param endDate - End of date range (inclusive)
   * @param serviceId - Optional service ID to filter by specific service
   * @returns Array of time-slot bookings for conflict detection
   *
   * @example
   * ```typescript
   * const bookings = await repository.findTimeslotBookingsInRange(
   *   'tenant_123',
   *   new Date('2025-06-01'),
   *   new Date('2025-06-30'),
   *   'service_abc'
   * );
   * // Returns all bookings from June 1-30 in a single query
   * ```
   */
  async findTimeslotBookingsInRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    serviceId?: string
  ): Promise<TimeslotBooking[]> {
    // Calculate start and end of date range in UTC
    const startOfRange = new Date(startDate);
    startOfRange.setUTCHours(0, 0, 0, 0);

    const endOfRange = new Date(endDate);
    endOfRange.setUTCHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        bookingType: 'TIMESLOT',
        startTime: {
          gte: startOfRange,
          lte: endOfRange,
        },
        // Only filter by serviceId if provided
        ...(serviceId && { serviceId }),
        // Exclude cancelled bookings from conflict detection
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
      select: {
        id: true,
        tenantId: true,
        serviceId: true,
        startTime: true,
        endTime: true,
        status: true,
      },
    });

    // Map to TimeslotBooking type (filter out nulls and type-narrow)
    return bookings
      .filter(
        (
          b
        ): b is typeof b & {
          serviceId: string;
          startTime: Date;
          endTime: Date;
        } => b.serviceId !== null && b.startTime !== null && b.endTime !== null
      )
      .map((b) => ({
        id: b.id,
        tenantId: b.tenantId,
        serviceId: b.serviceId,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status as TimeslotBooking['status'],
      }));
  }

  /**
   * Find all appointments (TIMESLOT bookings) with optional filters
   *
   * Performs server-side filtering directly in the database query.
   * This is more efficient than fetching all bookings and filtering in memory.
   *
   * MULTI-TENANT: Filtered by tenantId for data isolation
   *
   * @param tenantId - Tenant ID for isolation
   * @param filters - Optional filters for status, serviceId, and date range
   * @returns Array of appointments with full details
   *
   * @example
   * ```typescript
   * const appointments = await repository.findAppointments('tenant_123', {
   *   status: 'CONFIRMED',
   *   serviceId: 'service_abc',
   *   startDate: '2025-06-01',
   *   endDate: '2025-06-30'
   * });
   * ```
   */
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
    // P2 #052 FIX: Pagination constants to prevent DoS via unbounded queries
    const MAX_LIMIT = 500;
    const DEFAULT_LIMIT = 100;
    const MAX_DATE_RANGE_DAYS = 90;

    // Apply pagination with safe defaults
    const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(filters?.offset ?? 0, 0);

    // Validate date range to prevent excessive queries
    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > MAX_DATE_RANGE_DAYS) {
        throw new Error(
          `Date range too large. Maximum allowed: ${MAX_DATE_RANGE_DAYS} days, requested: ${daysDiff} days`
        );
      }

      if (daysDiff < 0) {
        throw new Error('Invalid date range: endDate must be after startDate');
      }
    }

    // Build WHERE clause with filters
    const where: {
      tenantId: string;
      bookingType: 'TIMESLOT';
      status?: string;
      serviceId?: string;
      date?: { gte?: Date; lte?: Date };
    } = {
      tenantId,
      bookingType: 'TIMESLOT',
    };

    // Apply status filter
    if (filters?.status) {
      where.status = filters.status;
    }

    // Apply serviceId filter
    if (filters?.serviceId) {
      where.serviceId = filters.serviceId;
    }

    // Apply date range filters
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    const bookings = await this.prisma.booking.findMany({
      where: where as any, // Type assertion needed for dynamic where clause
      include: {
        customer: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });

    // Map to AppointmentDto
    return bookings.map((b) => ({
      id: b.id,
      tenantId: b.tenantId,
      customerId: b.customerId,
      serviceId: b.serviceId,
      packageId: b.packageId,
      date: toISODate(b.date),
      startTime: b.startTime?.toISOString() || null,
      endTime: b.endTime?.toISOString() || null,
      clientTimezone: b.clientTimezone,
      status: b.status,
      totalPrice: b.totalPrice,
      notes: b.notes,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  /**
   * Update booking fields (reschedule, cancel, refund status, etc.)
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   * @param data - Fields to update
   * @returns Updated booking
   */
  async update(
    tenantId: string,
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
      reminderSentAt?: Date;
      reminderDueDate?: Date;
      depositPaidAmount?: number;
      balanceDueDate?: Date;
      balancePaidAmount?: number;
      balancePaidAt?: Date;
    }
  ): Promise<Booking> {
    const updateData: Record<string, unknown> = {};

    if (data.eventDate !== undefined) {
      updateData.date = new Date(data.eventDate);
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.cancelledAt !== undefined) {
      updateData.cancelledAt = data.cancelledAt;
    }
    if (data.cancelledBy !== undefined) {
      updateData.cancelledBy = data.cancelledBy;
    }
    if (data.cancellationReason !== undefined) {
      updateData.cancellationReason = data.cancellationReason;
    }
    if (data.refundStatus !== undefined) {
      updateData.refundStatus = data.refundStatus;
    }
    if (data.refundAmount !== undefined) {
      updateData.refundAmount = data.refundAmount;
    }
    if (data.refundedAt !== undefined) {
      updateData.refundedAt = data.refundedAt;
    }
    if (data.stripeRefundId !== undefined) {
      updateData.stripeRefundId = data.stripeRefundId;
    }
    if (data.reminderSentAt !== undefined) {
      updateData.reminderSentAt = data.reminderSentAt;
    }
    if (data.reminderDueDate !== undefined) {
      updateData.reminderDueDate = data.reminderDueDate;
    }
    if (data.depositPaidAmount !== undefined) {
      updateData.depositPaidAmount = data.depositPaidAmount;
    }
    if (data.balanceDueDate !== undefined) {
      updateData.balanceDueDate = data.balanceDueDate;
    }
    if (data.balancePaidAmount !== undefined) {
      updateData.balancePaidAmount = data.balancePaidAmount;
    }
    if (data.balancePaidAt !== undefined) {
      updateData.balancePaidAt = data.balancePaidAt;
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        customer: true,
        addOns: {
          select: {
            addOnId: true,
          },
        },
      },
    });

    // Verify tenant ownership
    if (updated.tenantId !== tenantId) {
      throw new Error('Tenant mismatch');
    }

    return this.toDomainBooking(updated);
  }

  /**
   * Reschedule booking to a new date with advisory lock protection
   *
   * Uses PostgreSQL advisory locks (ADR-006) to prevent race conditions.
   *
   * TODO-154 FIX: Recalculates reminderDueDate and resets reminderSentAt
   * when a booking is rescheduled to ensure reminders are sent at the
   * correct time based on the new event date.
   *
   * @param tenantId - Tenant ID for isolation
   * @param bookingId - Booking identifier
   * @param newDate - New event date (YYYY-MM-DD format)
   * @returns Updated booking
   * @throws {BookingConflictError} If new date is already booked
   */
  async reschedule(tenantId: string, bookingId: string, newDate: string): Promise<Booking> {
    return this.retryTransaction(async () => {
      return await this.prisma.$transaction(
        async (tx) => {
          // Acquire advisory lock for the new date
          const lockId = hashTenantDate(tenantId, newDate);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

          // Verify booking exists and belongs to tenant
          const booking = await tx.booking.findFirst({
            where: { id: bookingId, tenantId },
          });

          if (!booking) {
            throw new Error(`Booking ${bookingId} not found`);
          }

          if (booking.status === 'CANCELED') {
            throw new Error(`Booking ${bookingId} is already cancelled`);
          }

          // Check if new date is available
          const existing = await tx.booking.findFirst({
            where: {
              tenantId,
              date: new Date(newDate),
              status: { notIn: ['CANCELED'] },
              id: { not: bookingId }, // Exclude current booking
            },
          });

          if (existing) {
            throw new BookingConflictError(newDate);
          }

          // TODO-154 FIX: Calculate new reminder due date (7 days before new event date)
          // Only set if the event is more than 7 days away
          const eventDate = new Date(newDate + 'T00:00:00Z');
          const now = new Date();
          const daysUntilEvent = Math.floor(
            (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          const newReminderDueDate =
            daysUntilEvent > 7 ? new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000) : null;

          // Update booking date and reminder fields
          const updated = await tx.booking.update({
            where: { id: bookingId },
            data: {
              date: new Date(newDate),
              // TODO-154 FIX: Update reminder due date and reset sent flag
              reminderDueDate: newReminderDueDate,
              reminderSentAt: null, // Reset so new reminder will be sent
            },
            include: {
              customer: true,
              addOns: {
                select: {
                  addOnId: true,
                },
              },
            },
          });

          return this.toDomainBooking(updated);
        },
        {
          timeout: BOOKING_TRANSACTION_TIMEOUT_MS,
          isolationLevel: this.isolationLevel as any,
        }
      );
    }, `reschedule-booking-${tenantId}-${bookingId}-${newDate}`);
  }

  // Mappers
  // P1-149 FIX: Updated to include all BookingStatus values
  private mapToPrismaStatus(
    status: string
  ): 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED' {
    switch (status) {
      case 'PENDING':
        return 'PENDING';
      case 'DEPOSIT_PAID':
        return 'DEPOSIT_PAID';
      case 'PAID':
        return 'PAID';
      case 'CONFIRMED':
        return 'CONFIRMED';
      case 'CANCELED':
        return 'CANCELED';
      case 'REFUNDED':
        return 'REFUNDED';
      case 'FULFILLED':
        return 'FULFILLED';
      default:
        return 'PENDING';
    }
  }

  private toDomainBooking(booking: {
    id: string;
    packageId: string;
    date: Date;
    totalPrice: number;
    commissionAmount: number;
    commissionPercent: Decimal;
    status: string;
    createdAt: Date;
    customer: {
      name: string;
      email: string | null;
      phone: string | null;
    };
    addOns: { addOnId: string }[];
    // New booking management fields
    cancelledBy?: string | null;
    cancellationReason?: string | null;
    refundStatus?: string | null;
    refundAmount?: number | null;
    refundedAt?: Date | null;
    stripeRefundId?: string | null;
    reminderDueDate?: Date | null;
    reminderSentAt?: Date | null;
    depositPaidAmount?: number | null;
    balanceDueDate?: Date | null;
    balancePaidAmount?: number | null;
    balancePaidAt?: Date | null;
  }): Booking {
    // Map Prisma BookingStatus to domain status
    // P1-149 FIX: Updated to include all status types
    const mapStatus = (prismaStatus: string): Booking['status'] => {
      switch (prismaStatus) {
        case 'PENDING':
          return 'PENDING';
        case 'DEPOSIT_PAID':
          return 'DEPOSIT_PAID';
        case 'PAID':
          return 'PAID';
        case 'CONFIRMED':
          return 'CONFIRMED';
        case 'CANCELED':
          return 'CANCELED';
        case 'REFUNDED':
          return 'REFUNDED';
        case 'FULFILLED':
          return 'FULFILLED';
        default:
          return 'PENDING';
      }
    };

    const domainBooking: Booking = {
      id: booking.id,
      packageId: booking.packageId,
      coupleName: booking.customer.name,
      email: booking.customer.email || '',
      eventDate: toISODate(booking.date),
      addOnIds: booking.addOns.map((a) => a.addOnId),
      totalCents: booking.totalPrice,
      commissionAmount: booking.commissionAmount,
      commissionPercent: Number(booking.commissionPercent),
      status: mapStatus(booking.status),
      createdAt: booking.createdAt.toISOString(),
    };

    // Add optional phone
    if (booking.customer.phone) {
      domainBooking.phone = booking.customer.phone;
    }

    // Add cancellation fields if present
    if (booking.cancelledBy) {
      domainBooking.cancelledBy = booking.cancelledBy as Booking['cancelledBy'];
    }
    if (booking.cancellationReason) {
      domainBooking.cancellationReason = booking.cancellationReason;
    }

    // Add refund fields if present
    if (booking.refundStatus) {
      domainBooking.refundStatus = booking.refundStatus as Booking['refundStatus'];
    }
    if (booking.refundAmount !== null && booking.refundAmount !== undefined) {
      domainBooking.refundAmount = booking.refundAmount;
    }
    if (booking.refundedAt) {
      domainBooking.refundedAt = booking.refundedAt.toISOString();
    }
    if (booking.stripeRefundId) {
      domainBooking.stripeRefundId = booking.stripeRefundId;
    }

    // Add reminder fields if present
    if (booking.reminderDueDate) {
      domainBooking.reminderDueDate = toISODate(booking.reminderDueDate);
    }
    if (booking.reminderSentAt) {
      domainBooking.reminderSentAt = booking.reminderSentAt.toISOString();
    }

    // Add deposit fields if present
    if (booking.depositPaidAmount !== null && booking.depositPaidAmount !== undefined) {
      domainBooking.depositPaidAmount = booking.depositPaidAmount;
    }
    if (booking.balanceDueDate) {
      domainBooking.balanceDueDate = toISODate(booking.balanceDueDate);
    }
    if (booking.balancePaidAmount !== null && booking.balancePaidAmount !== undefined) {
      domainBooking.balancePaidAmount = booking.balancePaidAmount;
    }
    if (booking.balancePaidAt) {
      domainBooking.balancePaidAt = booking.balancePaidAt.toISOString();
    }

    return domainBooking;
  }

  /**
   * Find bookings that need reminders (reminderDueDate <= today, reminderSentAt is null, status is PAID)
   */
  async findBookingsNeedingReminders(tenantId: string, limit: number = 10): Promise<Booking[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookings = await this.prisma.booking.findMany({
      where: {
        tenantId,
        reminderDueDate: { lte: today },
        reminderSentAt: null,
        status: 'CONFIRMED',
      },
      include: {
        customer: true,
        addOns: { select: { addOnId: true } },
      },
      take: limit,
      orderBy: { reminderDueDate: 'asc' },
    });

    return bookings.map((b) => this.toDomainBooking(b));
  }

  /**
   * Mark a booking's reminder as sent
   */
  async markReminderSent(tenantId: string, bookingId: string): Promise<void> {
    await this.prisma.booking.update({
      where: { id: bookingId, tenantId },
      data: { reminderSentAt: new Date() },
    });
  }

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
  async completeBalancePayment(
    tenantId: string,
    bookingId: string,
    balanceAmountCents: number
  ): Promise<Booking | null> {
    return this.retryTransaction(async () => {
      return await this.prisma.$transaction(
        async (tx) => {
          // Acquire advisory lock for this specific booking's balance payment
          const lockId = hashTenantBooking(tenantId, bookingId);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

          // Check current booking state within the lock
          const booking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: {
              customer: true,
              addOns: { select: { addOnId: true } },
            },
          });

          if (!booking) {
            throw new NotFoundError(`Booking ${bookingId} not found`);
          }

          if (booking.tenantId !== tenantId) {
            throw new NotFoundError(`Booking ${bookingId} not found for tenant`);
          }

          // Idempotent: If balance already paid, return null (not an error)
          if (booking.balancePaidAt) {
            return null;
          }

          // Update booking with balance paid and mark as PAID
          const updated = await tx.booking.update({
            where: { id: bookingId },
            data: {
              balancePaidAmount: balanceAmountCents,
              balancePaidAt: new Date(),
              status: 'PAID',
            },
            include: {
              customer: true,
              addOns: { select: { addOnId: true } },
            },
          });

          return this.toDomainBooking(updated);
        },
        {
          timeout: BOOKING_TRANSACTION_TIMEOUT_MS,
          isolationLevel: this.isolationLevel as any,
        }
      );
    }, `complete-balance-payment-${tenantId}-${bookingId}`);
  }
}
