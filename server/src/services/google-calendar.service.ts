/**
 * Google Calendar Service - One-way sync from MAIS to Google Calendar
 *
 * Pushes appointment events to Google Calendar when:
 * - New appointment is booked (paid)
 * - Appointment is cancelled
 *
 * This is ONE-WAY sync only - we don't read from Google Calendar
 */

import type { CalendarProvider } from '../lib/ports';
import { logger } from '../lib/core/logger';

export class GoogleCalendarService {
  constructor(private readonly calendarProvider: CalendarProvider) {}

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
