/**
 * Booking Query Service
 *
 * Read-only service for booking queries and retrieval operations.
 * Extracted from BookingService to separate read operations from write operations,
 * following CQRS (Command Query Responsibility Segregation) principles.
 *
 * All queries are scoped by tenantId for multi-tenant data isolation.
 */

import type { BookingRepository } from '../lib/ports';
import type { Booking } from '../lib/entities';
import { NotFoundError } from '../lib/errors';

/**
 * Filters for querying appointments
 *
 * Supports pagination to prevent DoS via unbounded queries.
 */
export interface GetAppointmentsFilters {
  /** Filter by booking status */
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'FULFILLED';
  /** Filter by service ID */
  serviceId?: string;
  /** Filter by start date (inclusive) */
  startDate?: Date;
  /** Filter by end date (inclusive) */
  endDate?: Date;
  /** Maximum number of results to return (default 100, max 500) */
  limit?: number;
  /** Number of results to skip for pagination (default 0) */
  offset?: number;
}

/**
 * Configuration options for BookingQueryService constructor
 */
export interface BookingQueryServiceOptions {
  bookingRepo: BookingRepository;
}

/**
 * Read-only service for booking queries
 *
 * Provides tenant-scoped read operations for bookings and appointments.
 * All methods require tenantId as the first parameter to ensure multi-tenant isolation.
 */
export class BookingQueryService {
  private readonly bookingRepo: BookingRepository;

  constructor(options: BookingQueryServiceOptions) {
    this.bookingRepo = options.bookingRepo;
  }

  /**
   * Retrieves all bookings from the database for a tenant
   *
   * MULTI-TENANT: Filters bookings by tenantId for data isolation
   * Returns bookings ordered by creation date (most recent first).
   *
   * @param tenantId - Tenant ID for data isolation
   * @returns Array of all bookings for the tenant
   *
   * @example
   * ```typescript
   * const bookings = await bookingQueryService.getAllBookings('tenant_123');
   * // Returns: [{ id: 'booking_123', status: 'PAID', ... }, ...]
   * ```
   */
  async getAllBookings(tenantId: string): Promise<Booking[]> {
    return this.bookingRepo.findAll(tenantId);
  }

  /**
   * Retrieves a specific booking by ID
   *
   * MULTI-TENANT: Validates booking belongs to specified tenant
   *
   * @param tenantId - Tenant ID for data isolation
   * @param id - Booking identifier
   *
   * @returns The requested booking
   *
   * @throws {NotFoundError} If booking doesn't exist
   *
   * @example
   * ```typescript
   * const booking = await bookingQueryService.getBookingById('tenant_123', 'booking_123');
   * // Returns: { id: 'booking_123', status: 'PAID', ... }
   * ```
   */
  async getBookingById(tenantId: string, id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(tenantId, id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }
    return booking;
  }

  /**
   * Retrieves all unavailable booking dates within a date range for a tenant
   *
   * MULTI-TENANT: Filters bookings by tenantId for data isolation
   * This method performs a batch query to fetch all booked dates in a given range,
   * which is much more efficient than checking each date individually.
   * Only returns dates with CONFIRMED or PENDING bookings (excludes CANCELED).
   *
   * @param tenantId - Tenant ID for data isolation
   * @param startDate - Start of date range
   * @param endDate - End of date range
   *
   * @returns Array of date strings in YYYY-MM-DD format
   *
   * @example
   * ```typescript
   * const unavailable = await bookingQueryService.getUnavailableDates(
   *   'tenant_123',
   *   new Date('2025-06-01'),
   *   new Date('2025-06-30')
   * );
   * // Returns: ['2025-06-15', '2025-06-22', '2025-06-29']
   * ```
   */
  async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<string[]> {
    const dates = await this.bookingRepo.getUnavailableDates(tenantId, startDate, endDate);
    return dates.map((d) => d.toISOString().split('T')[0]); // Return as YYYY-MM-DD strings
  }

  /**
   * Retrieves all appointment bookings with optional filters
   *
   * MULTI-TENANT: Filters by tenantId for data isolation
   * Returns only TIMESLOT bookings (excludes legacy DATE bookings).
   * Results are ordered by startTime ascending.
   *
   * Delegates to repository with pagination to prevent DoS.
   * - Default limit: 100 appointments
   * - Maximum limit: 500 appointments
   * - Maximum date range: 90 days
   *
   * @param tenantId - Tenant ID for data isolation
   * @param filters - Optional filters
   * @param filters.status - Filter by booking status
   * @param filters.serviceId - Filter by service ID
   * @param filters.startDate - Filter by start date (inclusive)
   * @param filters.endDate - Filter by end date (inclusive)
   * @param filters.limit - Maximum number of results to return (default 100, max 500)
   * @param filters.offset - Number of results to skip for pagination (default 0)
   *
   * @returns Array of appointment bookings
   *
   * @example
   * ```typescript
   * // Get all confirmed appointments (uses default limit of 100)
   * const appointments = await bookingQueryService.getAppointments('tenant_123', {
   *   status: 'CONFIRMED'
   * });
   *
   * // Get appointments for a specific service in a date range with pagination
   * const serviceAppointments = await bookingQueryService.getAppointments('tenant_123', {
   *   serviceId: 'service_abc',
   *   startDate: new Date('2025-06-01'),
   *   endDate: new Date('2025-06-30'),
   *   limit: 50,
   *   offset: 0
   * });
   * ```
   */
  async getAppointments(tenantId: string, filters?: GetAppointmentsFilters): Promise<any[]> {
    // Delegate to repository with pagination
    // Convert Date objects to ISO strings for repository
    const repositoryFilters = {
      status: filters?.status,
      serviceId: filters?.serviceId,
      startDate: filters?.startDate?.toISOString().split('T')[0],
      endDate: filters?.endDate?.toISOString().split('T')[0],
      limit: filters?.limit,
      offset: filters?.offset,
    };

    return this.bookingRepo.findAppointments(tenantId, repositoryFilters);
  }
}
