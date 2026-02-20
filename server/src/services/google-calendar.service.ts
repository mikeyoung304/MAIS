/**
 * Google Calendar Service - Two-way sync with Google Calendar
 *
 * Pushes appointment events to Google Calendar when:
 * - New appointment is booked (paid)
 * - Appointment is cancelled
 *
 * Reads busy times from Google Calendar to:
 * - Prevent double-booking with existing calendar events
 * - Enable two-way calendar sync (Acuity parity)
 */

import type { CalendarProvider, BusyTimeBlock } from '../lib/ports';
import { logger } from '../lib/core/logger';
import { encryptionService } from '../lib/encryption.service';
import type { TenantSecrets, PrismaJson } from '../types/prisma-json';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import { createGServiceAccountJWT } from '../adapters/gcal.jwt';
import type { TenantCalendarConfig } from '../adapters/gcal.adapter';

export class GoogleCalendarService {
  constructor(
    private readonly calendarProvider: CalendarProvider,
    private readonly tenantRepo?: PrismaTenantRepository
  ) {}

  /**
   * Create a calendar event for a new appointment
   *
   * Gracefully degrades if Google Calendar is not configured:
   * - Logs warning and returns null
   * - Application continues to function normally
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param appointment - Appointment details to sync
   * @returns Google Calendar event ID or null if calendar not configured/failed
   *
   * @example
   * ```typescript
   * const result = await googleCalendarService.createAppointmentEvent('tenant_123', {
   *   id: 'booking_abc',
   *   serviceName: '30-Minute Consultation',
   *   clientName: 'Jane Doe',
   *   clientEmail: 'jane@example.com',
   *   startTime: new Date('2025-06-15T10:00:00Z'),
   *   endTime: new Date('2025-06-15T10:30:00Z'),
   *   notes: 'First-time client'
   * });
   * if (result) {
   *   console.log('Event created:', result.eventId);
   * }
   * ```
   */
  async createAppointmentEvent(
    tenantId: string,
    appointment: {
      id: string;
      serviceName: string;
      clientName: string;
      clientEmail: string;
      startTime: Date;
      endTime: Date;
      notes?: string;
      timezone?: string;
    }
  ): Promise<{ eventId: string } | null> {
    // Check if calendar provider supports event creation
    if (!this.calendarProvider.createEvent) {
      logger.debug(
        { tenantId, bookingId: appointment.id },
        'Calendar provider does not support event creation - skipping Google Calendar sync'
      );
      return null;
    }

    try {
      const summary = `${appointment.serviceName} - ${appointment.clientName}`;
      const description = this.buildEventDescription(appointment);

      const result = await this.calendarProvider.createEvent({
        tenantId,
        summary,
        description,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        attendees: [
          {
            email: appointment.clientEmail,
            name: appointment.clientName,
          },
        ],
        metadata: {
          bookingId: appointment.id,
          source: 'mais-scheduling',
        },
        timezone: appointment.timezone,
      });

      if (result) {
        logger.info(
          {
            tenantId,
            bookingId: appointment.id,
            eventId: result.eventId,
            startTime: appointment.startTime.toISOString(),
          },
          'Google Calendar event created successfully'
        );
        return result;
      }

      logger.warn(
        { tenantId, bookingId: appointment.id },
        'Google Calendar event creation returned null - calendar may not be configured'
      );
      return null;
    } catch (error) {
      logger.error(
        {
          error,
          tenantId,
          bookingId: appointment.id,
          startTime: appointment.startTime.toISOString(),
        },
        'Failed to create Google Calendar event - continuing without sync'
      );
      return null;
    }
  }

  /**
   * Delete/cancel a calendar event
   *
   * Gracefully degrades if Google Calendar is not configured or deletion fails.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param googleEventId - Google Calendar event ID to delete
   * @returns True if successfully deleted, false otherwise
   *
   * @example
   * ```typescript
   * const deleted = await googleCalendarService.cancelAppointmentEvent(
   *   'tenant_123',
   *   'google_event_abc123'
   * );
   * if (deleted) {
   *   console.log('Calendar event cancelled');
   * }
   * ```
   */
  async cancelAppointmentEvent(tenantId: string, googleEventId: string): Promise<boolean> {
    // Check if calendar provider supports event deletion
    if (!this.calendarProvider.deleteEvent) {
      logger.debug(
        { tenantId, googleEventId },
        'Calendar provider does not support event deletion - skipping Google Calendar sync'
      );
      return false;
    }

    try {
      const result = await this.calendarProvider.deleteEvent(tenantId, googleEventId);

      if (result) {
        logger.info({ tenantId, googleEventId }, 'Google Calendar event deleted successfully');
        return true;
      }

      logger.warn({ tenantId, googleEventId }, 'Google Calendar event deletion returned false');
      return false;
    } catch (error) {
      logger.error(
        { error, tenantId, googleEventId },
        'Failed to delete Google Calendar event - continuing without sync'
      );
      return false;
    }
  }

  /**
   * Get busy time blocks from Google Calendar
   *
   * Used for two-way sync to prevent double-booking when external calendar
   * events already exist. Gracefully degrades if calendar provider doesn't
   * support FreeBusy API or on error.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param startDate - Start of time range to check
   * @param endDate - End of time range to check
   * @returns Array of busy time blocks, or empty array if not supported/error
   *
   * @example
   * ```typescript
   * const busyTimes = await googleCalendarService.getBusyTimes(
   *   'tenant_123',
   *   new Date('2025-06-15T00:00:00Z'),
   *   new Date('2025-06-15T23:59:59Z')
   * );
   * // Returns: [
   * //   { start: Date('2025-06-15T14:00:00Z'), end: Date('2025-06-15T15:00:00Z') },
   * //   { start: Date('2025-06-15T16:30:00Z'), end: Date('2025-06-15T17:30:00Z') }
   * // ]
   * ```
   */
  async getBusyTimes(tenantId: string, startDate: Date, endDate: Date): Promise<BusyTimeBlock[]> {
    // Check if calendar provider supports busy time queries
    if (!this.calendarProvider.getBusyTimes) {
      logger.debug(
        { tenantId, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        'Calendar provider does not support getBusyTimes - skipping two-way sync'
      );
      return [];
    }

    try {
      const busyTimes = await this.calendarProvider.getBusyTimes(tenantId, startDate, endDate);

      logger.debug(
        {
          tenantId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          busyTimesCount: busyTimes.length,
        },
        'Fetched Google Calendar busy times'
      );

      return busyTimes;
    } catch (error) {
      logger.warn(
        {
          error,
          tenantId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        'Failed to fetch Google Calendar busy times - continuing without two-way sync'
      );
      return [];
    }
  }

  /**
   * Test the Google Calendar connection for a specific tenant.
   *
   * Decrypts the tenant's stored calendar credentials and makes a lightweight
   * GET request to the Google Calendar API to verify they are valid.
   *
   * @param tenantId - Tenant ID whose calendar config should be tested
   * @returns Result object with success flag and either calendarName or error message
   */
  async testConnection(
    tenantId: string
  ): Promise<
    { success: true; calendarId: string; calendarName: string } | { success: false; error: string }
  > {
    if (!this.tenantRepo) {
      return { success: false, error: 'Calendar service not configured with a tenant repository' };
    }

    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    const secrets = (tenant.secrets as PrismaJson<TenantSecrets>) ?? {};
    const calendarSecret = secrets.calendar;
    const hasConfig = !!(
      calendarSecret?.ciphertext &&
      calendarSecret?.iv &&
      calendarSecret?.authTag
    );

    if (!hasConfig || !calendarSecret) {
      return { success: false, error: 'No calendar configuration found' };
    }

    let calendarConfig: TenantCalendarConfig;
    try {
      calendarConfig = encryptionService.decryptObject<TenantCalendarConfig>(calendarSecret);
    } catch (decryptErr) {
      logger.error({ tenantId, error: decryptErr }, 'Failed to decrypt calendar config');
      return { success: false, error: 'Failed to read calendar configuration' };
    }

    try {
      const serviceAccountJson = JSON.parse(calendarConfig.serviceAccountJson) as unknown as {
        client_email: string;
        private_key: string;
      };

      const accessToken = await createGServiceAccountJWT(serviceAccountJson, [
        'https://www.googleapis.com/auth/calendar.readonly',
      ]);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarConfig.calendarId)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.warn(
          { tenantId, status: response.status, error: errorText },
          'Google Calendar API test failed'
        );
        return {
          success: false,
          error: `Failed to connect to Google Calendar (status ${response.status})`,
        };
      }

      const calendarData = (await response.json()) as { summary?: string };

      logger.info({ tenantId }, 'Google Calendar connection test successful');

      return {
        success: true,
        calendarId: calendarConfig.calendarId,
        calendarName: calendarData.summary ?? 'Unknown',
      };
    } catch (error) {
      logger.error({ tenantId, error }, 'Google Calendar connection test failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build event description with appointment details
   *
   * @private
   */
  private buildEventDescription(appointment: {
    serviceName: string;
    clientName: string;
    clientEmail: string;
    notes?: string;
  }): string {
    const parts = [
      `Service: ${appointment.serviceName}`,
      `Client: ${appointment.clientName}`,
      `Email: ${appointment.clientEmail}`,
    ];

    if (appointment.notes) {
      parts.push('', `Notes: ${appointment.notes}`);
    }

    parts.push('', '---', 'Synced from MAIS Scheduling Platform');

    return parts.join('\n');
  }
}
