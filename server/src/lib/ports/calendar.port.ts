/**
 * Calendar Provider Port — External calendar integration
 */

/**
 * Busy time block from external calendar
 */
export interface BusyTimeBlock {
  start: Date;
  end: Date;
}

/**
 * Calendar Provider - External calendar integration
 */
export interface CalendarProvider {
  isDateAvailable(date: string): Promise<boolean>;

  /**
   * Create a calendar event (optional - for one-way sync)
   * Returns null if calendar provider doesn't support event creation
   */
  createEvent?(input: {
    tenantId: string;
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { email: string; name?: string }[];
    metadata?: Record<string, string>;
    timezone?: string; // IANA timezone (e.g., "America/New_York")
  }): Promise<{ eventId: string } | null>;

  /**
   * Delete a calendar event (optional - for one-way sync)
   * Returns true if successfully deleted, false otherwise
   */
  deleteEvent?(tenantId: string, eventId: string): Promise<boolean>;

  /**
   * Get busy time blocks from external calendar (optional - for two-way sync)
   * Returns empty array if calendar provider doesn't support FreeBusy API or on error
   *
   * Used for two-way calendar sync to prevent double-booking when external
   * events already exist in the calendar.
   *
   * @param tenantId - Tenant ID for multi-tenant calendar configuration
   * @param startDate - Start of time range to check
   * @param endDate - End of time range to check
   * @returns Array of busy time blocks, or empty array on error/not supported
   */
  getBusyTimes?(tenantId: string, startDate: Date, endDate: Date): Promise<BusyTimeBlock[]>;
}
