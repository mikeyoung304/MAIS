/**
 * Scheduling Availability Service
 *
 * Generates available time slots for time-based scheduling (Acuity-like booking).
 * Handles timezone conversion, rule-based slot generation, and conflict detection.
 *
 * Two-way calendar sync:
 * - Filters slots against MAIS bookings (database)
 * - Filters slots against Google Calendar busy times (external)
 * - Provides graceful degradation if Google Calendar is unavailable
 */

import type {
  BookingRepository,
  ServiceRepository,
  AvailabilityRuleRepository,
  AvailabilityRule,
  TimeslotBooking,
  CacheServicePort,
  BusyTimeBlock,
} from '../lib/ports';
import type { GoogleCalendarService } from './google-calendar.service';
import { logger } from '../lib/core/logger';
import { cachedOperation } from '../lib/cache-helpers';

// Re-export TimeslotBooking from ports for external consumers
export type { TimeslotBooking as TimeSlotBooking } from '../lib/ports';

// Internal alias for use within this file
type TimeSlotBooking = TimeslotBooking;

// ============================================================================
// Service Types
// ============================================================================

/**
 * Time slot with availability status
 */
export interface TimeSlot {
  startTime: Date; // UTC timestamp
  endTime: Date; // UTC timestamp
  available: boolean;
}

/**
 * Parameters for getting available slots
 */
export interface GetAvailableSlotsParams {
  tenantId: string;
  serviceId: string;
  date: Date; // The date to check (can be in any timezone, will use service timezone)
}

// ============================================================================
// Scheduling Availability Service
// ============================================================================

export class SchedulingAvailabilityService {
  constructor(
    private readonly serviceRepo: ServiceRepository,
    private readonly availabilityRuleRepo: AvailabilityRuleRepository,
    private readonly bookingRepo: BookingRepository,
    private readonly googleCalendarService?: GoogleCalendarService,
    private readonly cache?: CacheServicePort
  ) {}

  /**
   * Get available time slots for a service on a specific date
   *
   * MULTI-TENANT: Scoped to tenantId for data isolation
   *
   * Algorithm:
   * 1. Fetch service details (duration, buffer, timezone)
   * 2. Get effective availability rules for the date and service
   * 3. Generate all possible slots based on rules
   * 4. Fetch existing bookings for that date
   * 5. Mark slots as unavailable if they conflict with bookings
   * 6. Fetch Google Calendar busy times (two-way sync)
   * 7. Mark slots as unavailable if they conflict with Google Calendar events
   *
   * @param params - Service, tenant, and date parameters
   * @returns Array of time slots with availability status
   *
   * @example
   * ```typescript
   * const slots = await service.getAvailableSlots({
   *   tenantId: 'tenant_123',
   *   serviceId: 'service_abc',
   *   date: new Date('2025-06-15')
   * });
   * // Returns: [
   * //   { startTime: Date('2025-06-15T14:00:00Z'), endTime: Date('2025-06-15T14:30:00Z'), available: true },
   * //   { startTime: Date('2025-06-15T14:30:00Z'), endTime: Date('2025-06-15T15:00:00Z'), available: false },
   * //   ...
   * // ]
   * ```
   */
  async getAvailableSlots(params: GetAvailableSlotsParams): Promise<TimeSlot[]> {
    const { tenantId, serviceId, date } = params;

    // 1. Get service details
    const service = await this.serviceRepo.getById(tenantId, serviceId);
    if (!service) {
      return []; // Service not found, no slots available
    }

    if (!service.active) {
      return []; // Inactive service, no slots available
    }

    // 2. Get effective availability rules for this service and date
    const rules = await this.availabilityRuleRepo.getEffectiveRules(tenantId, date, serviceId);

    if (rules.length === 0) {
      return []; // No availability rules, no slots available
    }

    // 3. Generate all possible slots from rules
    const allSlots = this.generateSlotsFromRules(
      rules,
      date,
      service.durationMinutes,
      service.bufferMinutes,
      service.timezone,
      tenantId
    );

    if (allSlots.length === 0) {
      return []; // No slots generated (date doesn't match any rules)
    }

    // 4. Get existing bookings for this date
    const existingBookings = await this.getTimeslotBookings(tenantId, date);

    // 5. Filter out slots that conflict with MAIS bookings
    let availableSlots = this.filterConflictingSlots(allSlots, existingBookings);

    // 6. Filter out slots that conflict with Google Calendar events (two-way sync)
    if (this.googleCalendarService) {
      availableSlots = await this.filterGoogleCalendarConflicts(tenantId, date, availableSlots);
    }

    return availableSlots;
  }

  /**
   * Filter slots that conflict with Google Calendar events
   *
   * Fetches busy times from Google Calendar and marks slots as unavailable
   * if they overlap with external calendar events. Uses caching to reduce
   * API calls (5 minute TTL).
   *
   * Gracefully degrades on error - returns original slots if Google Calendar
   * API is unavailable.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param date - Date being checked
   * @param slots - Slots to filter
   * @returns Slots with availability updated based on Google Calendar conflicts
   *
   * @private
   */
  private async filterGoogleCalendarConflicts(
    tenantId: string,
    date: Date,
    slots: TimeSlot[]
  ): Promise<TimeSlot[]> {
    try {
      // Calculate date range for the entire day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch busy times with caching (5 minute TTL)
      const busyTimes = await cachedOperation<BusyTimeBlock[]>(
        this.cache,
        {
          prefix: 'gcal-busy',
          keyParts: [tenantId, date.toISOString().split('T')[0]], // Cache by date (YYYY-MM-DD)
          ttl: 300, // 5 minutes
        },
        async () => {
          if (!this.googleCalendarService) {
            return [];
          }
          return this.googleCalendarService.getBusyTimes(tenantId, startOfDay, endOfDay);
        }
      );

      // If no busy times, return all slots as-is
      if (busyTimes.length === 0) {
        return slots;
      }

      // Filter slots that conflict with Google Calendar busy times
      return slots.map((slot) => {
        // Check if this slot conflicts with any busy time block
        const hasConflict = busyTimes.some((busy) => {
          // Slots conflict if they overlap in time
          // Overlap occurs if: slot.start < busy.end AND slot.end > busy.start
          return slot.startTime < busy.end && slot.endTime > busy.start;
        });

        return {
          ...slot,
          available: slot.available && !hasConflict, // Only mark unavailable if both checks pass
        };
      });
    } catch (error) {
      logger.warn(
        {
          error,
          tenantId,
          date: date.toISOString(),
        },
        'Failed to filter Google Calendar conflicts - continuing without two-way sync'
      );
      // Graceful degradation - return original slots on error
      return slots;
    }
  }

  /**
   * Generate time slots from availability rules
   *
   * Converts rule times (in tenant timezone) to UTC slots.
   * Creates slots at regular intervals based on service duration.
   * Ensures slots don't extend past rule end time.
   *
   * @param rules - Effective availability rules
   * @param date - Target date (timezone-agnostic)
   * @param durationMinutes - Service duration
   * @param bufferMinutes - Buffer time after service
   * @param timezone - Tenant timezone (IANA format)
   * @param tenantId - Tenant ID for logging context
   * @returns Array of time slots in UTC
   *
   * @private
   */
  private generateSlotsFromRules(
    rules: AvailabilityRule[],
    date: Date,
    durationMinutes: number,
    bufferMinutes: number,
    timezone: string,
    tenantId: string
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

    // Filter rules that apply to this day of week
    const applicableRules = rules.filter((rule) => rule.dayOfWeek === dayOfWeek);

    for (const rule of applicableRules) {
      // Parse rule times (in tenant timezone)
      const [startHour, startMinute] = rule.startTime.split(':').map(Number);
      const [endHour, endMinute] = rule.endTime.split(':').map(Number);

      // Create Date objects for rule start/end in tenant timezone
      // We'll use the date parameter and manually set hours/minutes
      // Then convert to UTC for storage
      const ruleStart = this.createDateInTimezone(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        startHour,
        startMinute,
        timezone,
        tenantId
      );

      const ruleEnd = this.createDateInTimezone(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        endHour,
        endMinute,
        timezone,
        tenantId
      );

      // Generate slots at regular intervals
      let currentSlotStart = new Date(ruleStart);
      const slotDuration = durationMinutes + bufferMinutes; // Total time per slot

      while (currentSlotStart < ruleEnd) {
        // Calculate slot end time (just the service duration, not including buffer)
        const slotEnd = new Date(currentSlotStart.getTime() + durationMinutes * 60 * 1000);

        // Only add slot if it fits completely within the rule window
        if (slotEnd <= ruleEnd) {
          slots.push({
            startTime: new Date(currentSlotStart),
            endTime: slotEnd,
            available: true, // Default to available, will be filtered later
          });
        }

        // Move to next slot (service duration + buffer)
        currentSlotStart = new Date(currentSlotStart.getTime() + slotDuration * 60 * 1000);
      }
    }

    // Sort slots by start time
    slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return slots;
  }

  /**
   * Filter out slots that conflict with existing bookings
   *
   * A slot conflicts if:
   * - It overlaps with an existing booking's time range
   * - The existing booking is not CANCELED
   *
   * @param slots - Generated slots
   * @param existingBookings - Existing bookings for the date
   * @returns Slots with availability updated based on conflicts
   *
   * @private
   */
  private filterConflictingSlots(
    slots: TimeSlot[],
    existingBookings: TimeSlotBooking[]
  ): TimeSlot[] {
    // Filter to only confirmed/pending bookings (exclude canceled)
    const activeBookings = existingBookings.filter(
      (booking) => booking.status === 'CONFIRMED' || booking.status === 'PENDING'
    );

    return slots.map((slot) => {
      // Check if this slot conflicts with any booking
      const hasConflict = activeBookings.some((booking) => {
        // Slots conflict if they overlap in time
        // Overlap occurs if: slot.start < booking.end AND slot.end > booking.start
        return slot.startTime < booking.endTime && slot.endTime > booking.startTime;
      });

      return {
        ...slot,
        available: !hasConflict,
      };
    });
  }

  /**
   * Converts wall-clock time in a timezone to a UTC Date object.
   *
   * For example, calling with (2025, 5, 15, 9, 30, 'America/New_York') returns
   * the UTC timestamp for "2025-06-15 09:30:00 EDT".
   *
   * **Implementation Approach:**
   *
   * Uses the native Intl.DateTimeFormat API instead of a timezone library (date-fns-tz, Luxon).
   * This choice avoids additional dependencies while correctly handling common scheduling scenarios:
   *
   * - DST transitions: Intl automatically applies DST rules for the specified timezone
   * - Error resilience: Invalid timezones fall back to UTC with a logged warning
   * - Bundle size: No additional dependencies needed
   *
   * **How It Works:**
   *
   * 1. Create a UTC Date from the raw input values
   * 2. Format that UTC Date in the target timezone using Intl.DateTimeFormat
   * 3. Compare the formatted (local) time with the original (UTC) time to get offset
   * 4. Apply the offset to produce the correct UTC representation
   *
   * **DST Handling:**
   *
   * The Intl API automatically accounts for Daylight Saving Time. On March 9, 2025
   * in America/New_York (a DST transition date), times are correctly interpreted
   * whether in EDT or EST without additional logic.
   *
   * **Error Handling:**
   *
   * Invalid timezones (e.g., 'America/Invalid_City') are caught and logged as warnings.
   * The method falls back to UTC, preventing crashes while alerting operators to the issue.
   *
   * **See Also:**
   * - TODO-059: Discussion of timezone library alternatives
   * - MDN Intl.DateTimeFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
   *
   * @param year - Full year (e.g., 2025)
   * @param month - Month (0-11, like JavaScript Date; January=0)
   * @param day - Day of month (1-31)
   * @param hour - Hour (0-23, in the specified timezone)
   * @param minute - Minute (0-59)
   * @param timezone - IANA timezone string (e.g., "America/New_York", "Europe/London", "Asia/Tokyo")
   * @param tenantId - Tenant ID for logging context
   * @returns UTC Date object representing the specified wall-clock time in the timezone
   *
   * @example
   * ```typescript
   * // Create a Date for "2025-06-15 09:30:00 EDT"
   * const date = this.createDateInTimezone(2025, 5, 15, 9, 30, 'America/New_York', 'tenant_123');
   * // Returns: 2025-06-15T13:30:00Z (UTC, 4 hours ahead of EDT)
   * ```
   *
   * @private
   */
  private createDateInTimezone(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timezone: string,
    tenantId: string
  ): Date {
    // Create ISO string in the format: YYYY-MM-DDTHH:MM
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

    // Use Intl.DateTimeFormat to compute timezone offset.
    // See JSDoc above for detailed algorithm explanation.
    try {
      // Create a UTC date from the raw values
      const _localDate = new Date(dateStr);

      // Get the timezone offset by formatting the UTC date in the target timezone
      // and comparing wall-clock times to determine the offset
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      // Create a date at the same wall-clock time in UTC
      const utcDate = new Date(Date.UTC(year, month, day, hour, minute, 0));

      // Get the formatted string in the target timezone
      const parts = formatter.formatToParts(utcDate);
      const tzYear = parseInt(parts.find((p) => p.type === 'year')!.value);
      const tzMonth = parseInt(parts.find((p) => p.type === 'month')!.value) - 1;
      const tzDay = parseInt(parts.find((p) => p.type === 'day')!.value);
      const tzHour = parseInt(parts.find((p) => p.type === 'hour')!.value);
      const tzMinute = parseInt(parts.find((p) => p.type === 'minute')!.value);

      // Calculate the offset in milliseconds
      const offset =
        utcDate.getTime() - new Date(tzYear, tzMonth, tzDay, tzHour, tzMinute, 0).getTime();

      // Apply the offset to our target date
      return new Date(Date.UTC(year, month, day, hour, minute, 0) - offset);
    } catch (error) {
      // Fallback: treat as UTC if timezone conversion fails
      logger.warn(
        {
          providedTimezone: timezone,
          fallbackTimezone: 'UTC',
          tenantId,
          date: dateStr,
          error: error instanceof Error ? error.message : String(error),
        },
        'Timezone conversion failed, falling back to UTC'
      );
      return new Date(Date.UTC(year, month, day, hour, minute, 0));
    }
  }

  /**
   * Get all TIMESLOT bookings for a specific date
   *
   * MULTI-TENANT: Filtered by tenantId
   *
   * Uses the BookingRepository to fetch actual TIMESLOT bookings
   * for conflict detection during slot availability checks.
   *
   * @param tenantId - Tenant ID
   * @param date - Target date
   * @returns Array of time-slot bookings for conflict detection
   *
   * @private
   */
  private async getTimeslotBookings(tenantId: string, date: Date): Promise<TimeSlotBooking[]> {
    // Use the booking repository to fetch real TIMESLOT bookings
    return this.bookingRepo.findTimeslotBookings(tenantId, date);
  }

  /**
   * Check if a specific time slot is available
   *
   * Convenience method to check a single slot without generating all slots.
   *
   * @param tenantId - Tenant ID
   * @param serviceId - Service ID
   * @param startTime - Slot start time (UTC)
   * @param endTime - Slot end time (UTC)
   * @returns True if slot is available
   *
   * @example
   * ```typescript
   * const isAvailable = await service.isSlotAvailable(
   *   'tenant_123',
   *   'service_abc',
   *   new Date('2025-06-15T14:00:00Z'),
   *   new Date('2025-06-15T14:30:00Z')
   * );
   * ```
   */
  async isSlotAvailable(
    tenantId: string,
    serviceId: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    // Get the date portion
    const date = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());

    // Get existing bookings for this date
    const existingBookings = await this.getTimeslotBookings(tenantId, date);

    // Filter to active bookings
    const activeBookings = existingBookings.filter(
      (booking) => booking.status === 'CONFIRMED' || booking.status === 'PENDING'
    );

    // Check for conflicts
    const hasConflict = activeBookings.some((booking) => {
      return startTime < booking.endTime && endTime > booking.startTime;
    });

    return !hasConflict;
  }

  /**
   * Get next available slot for a service
   *
   * Finds the earliest available time slot starting from the given date.
   * Useful for "book next available" functionality.
   *
   * PERFORMANCE FIX (P2 #053): Optimized to use batch queries instead of N+1:
   * - Single query for all bookings in the date range
   * - Single query for all availability rules in the date range
   * - In-memory processing of slots and conflicts
   * This reduces database queries from O(N) to O(1), eliminating N+1 query problem.
   *
   * @param tenantId - Tenant ID
   * @param serviceId - Service ID
   * @param fromDate - Search from this date (inclusive)
   * @param maxDaysAhead - Maximum days to search (default: 30)
   * @returns Next available slot or null if none found
   *
   * @example
   * ```typescript
   * const nextSlot = await service.getNextAvailableSlot(
   *   'tenant_123',
   *   'service_abc',
   *   new Date(),
   *   30
   * );
   * if (nextSlot) {
   *   console.log(`Next available: ${nextSlot.startTime}`);
   * }
   * ```
   */
  async getNextAvailableSlot(
    tenantId: string,
    serviceId: string,
    fromDate: Date,
    maxDaysAhead: number = 30
  ): Promise<TimeSlot | null> {
    // Normalize start date to beginning of day
    const startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0);

    // Calculate end date for the search window
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + maxDaysAhead - 1);

    // 1. Get service details (needed for slot generation)
    const service = await this.serviceRepo.getById(tenantId, serviceId);
    if (!service || !service.active) {
      return null; // Service not found or inactive
    }

    // 2. PERFORMANCE: Batch-fetch all data with single queries instead of N queries
    const [allBookings, allAvailabilityRules] = await Promise.all([
      // Fetch all bookings in the entire search window (1 query)
      this.bookingRepo.findTimeslotBookingsInRange(tenantId, startDate, endDate, serviceId),
      // Fetch all effective availability rules for the service (1 query)
      // These rules are filtered by effectiveFrom/effectiveTo date range
      this.availabilityRuleRepo.getEffectiveRules(tenantId, endDate, serviceId),
    ]);

    // Filter to only active bookings (CONFIRMED/PENDING)
    const activeBookings = allBookings.filter(
      (booking) => booking.status === 'CONFIRMED' || booking.status === 'PENDING'
    );

    // 3. Group availability rules by day of week for O(1) lookup
    // This allows us to process each day without additional DB queries
    const rulesByDayOfWeek = new Map<number, AvailabilityRule[]>();
    for (const rule of allAvailabilityRules) {
      const existing = rulesByDayOfWeek.get(rule.dayOfWeek) || [];
      existing.push(rule);
      rulesByDayOfWeek.set(rule.dayOfWeek, existing);
    }

    // 4. Iterate through each day and generate slots in memory
    for (let i = 0; i < maxDaysAhead; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + i);
      const dayOfWeek = checkDate.getDay(); // 0=Sunday, 6=Saturday

      // Get rules for this day of week (in-memory lookup)
      const rulesForDay = rulesByDayOfWeek.get(dayOfWeek) || [];
      if (rulesForDay.length === 0) {
        continue; // No availability rules for this day of week
      }

      // Generate all possible slots for this day
      const slots = this.generateSlotsFromRules(
        rulesForDay,
        checkDate,
        service.durationMinutes,
        service.bufferMinutes,
        service.timezone,
        tenantId
      );

      if (slots.length === 0) {
        continue; // No slots generated for this day
      }

      // Filter slots against bookings (in memory)
      const availableSlots = this.filterConflictingSlots(slots, activeBookings);

      // Find first available slot
      const availableSlot = availableSlots.find((slot) => slot.available);
      if (availableSlot) {
        return availableSlot;
      }
    }

    return null; // No available slots in the search window
  }
}
