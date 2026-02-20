/**
 * Availability domain service
 */

import type {
  CalendarProvider,
  BlackoutRepository,
  BookingRepository,
  AvailabilityCheck,
} from '../lib/ports';

export class AvailabilityService {
  constructor(
    private readonly calendarProvider: CalendarProvider,
    private readonly blackoutRepo: BlackoutRepository,
    private readonly bookingRepo: BookingRepository
  ) {}

  /**
   * Checks if a wedding date is available for booking
   *
   * MULTI-TENANT: Scoped to tenantId for data isolation
   * Performs multi-source availability check:
   * 1. Blackout dates (administrative blocks)
   * 2. Existing bookings
   * 3. Google Calendar availability
   *
   * Returns first blocking reason found (short-circuit evaluation).
   *
   * @param tenantId - Tenant ID for data isolation
   * @param date - Date string in YYYY-MM-DD format
   *
   * @returns Availability check result with reason if unavailable
   *
   * @example
   * ```typescript
   * const check = await availabilityService.checkAvailability('tenant_123', '2025-06-15');
   * if (!check.available) {
   *   console.log(`Unavailable: ${check.reason}`); // 'blackout', 'booked', or 'calendar'
   * }
   * ```
   */
  async checkAvailability(tenantId: string, date: string): Promise<AvailabilityCheck> {
    // Check blackout dates first (fast local DB, most common blocking reason)
    const isBlackout = await this.blackoutRepo.isBlackoutDate(tenantId, date);
    if (isBlackout) {
      return { date, available: false, reason: 'blackout' };
    }

    // Parallelize the remaining checks for 50-70% latency reduction
    // - Booking check: local DB query
    // - Calendar check: external API call (slower)
    // MULTI-TENANT: Pass tenantId to ensure per-tenant calendar config and cache isolation
    const [isBooked, isCalendarAvailable] = await Promise.all([
      this.bookingRepo.isDateBooked(tenantId, date),
      this.calendarProvider.isDateAvailable(date, tenantId),
    ]);

    if (isBooked) {
      return { date, available: false, reason: 'booked' };
    }

    if (!isCalendarAvailable) {
      return { date, available: false, reason: 'calendar' };
    }

    return { date, available: true };
  }

  /**
   * Retrieves all unavailable booking dates within a date range for a tenant
   *
   * MULTI-TENANT: Filters bookings by tenantId for data isolation
   * Performs batch query to fetch all booked dates efficiently (60 API calls → 1).
   * Used by DatePicker component to disable unavailable dates.
   *
   * @param tenantId - Tenant ID for data isolation
   * @param startDate - Start of date range
   * @param endDate - End of date range
   *
   * @returns Array of date strings in YYYY-MM-DD format
   *
   * @example
   * ```typescript
   * const unavailable = await availabilityService.getUnavailableDates(
   *   'tenant_123',
   *   new Date('2025-06-01'),
   *   new Date('2025-06-30')
   * );
   * // Returns: ['2025-06-15', '2025-06-22', '2025-06-29']
   * ```
   */
  async getUnavailableDates(tenantId: string, startDate: Date, endDate: Date): Promise<string[]> {
    // Batch fetch all booked dates in the range (single DB query, tenant-scoped)
    const bookedDates = await this.bookingRepo.getUnavailableDates(tenantId, startDate, endDate);
    return bookedDates.map((d) => d.toISOString().split('T')[0]); // Return as YYYY-MM-DD strings
  }
}
