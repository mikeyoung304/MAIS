/**
 * Google Calendar Sync Adapter - One-way sync to Google Calendar
 *
 * Extends GoogleCalendarAdapter with event creation and deletion capabilities.
 * Uses Google Calendar API v3 with service account authentication.
 */

import type { CalendarProvider } from '../lib/ports';
import { GoogleCalendarAdapter } from './gcal.adapter';
import { createGServiceAccountJWT } from './gcal.jwt';
import { logger } from '../lib/core/logger';
import type { PrismaTenantRepository } from './prisma/tenant.repository';

interface CalendarEvent {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

interface EventResponse {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

/**
 * Google Calendar Sync Adapter
 *
 * Provides one-way sync from MAIS to Google Calendar:
 * - Create events when appointments are booked
 * - Delete events when appointments are cancelled
 *
 * Inherits date availability checking from GoogleCalendarAdapter.
 * Supports per-tenant calendar configuration via tenant secrets.
 */
export class GoogleCalendarSyncAdapter extends GoogleCalendarAdapter implements CalendarProvider {
  private readonly calendarId: string;
  private readonly serviceAccountJsonBase64: string;

  constructor(
    config: {
      calendarId: string;
      serviceAccountJsonBase64: string;
    },
    tenantRepo?: PrismaTenantRepository
  ) {
    // Initialize parent GoogleCalendarAdapter for date availability checking
    // Pass tenantRepo to enable per-tenant calendar configuration
    super(
      {
        calendarId: config.calendarId,
        serviceAccountJsonBase64: config.serviceAccountJsonBase64,
      },
      tenantRepo
    );

    this.calendarId = config.calendarId;
    this.serviceAccountJsonBase64 = config.serviceAccountJsonBase64;
  }

  /**
   * Create a calendar event
   *
   * Uses Google Calendar API v3 events.insert endpoint.
   * Stores booking metadata in extendedProperties for future reference.
   *
   * @param input - Event details
   * @returns Google Calendar event ID or null if creation fails
   */
  async createEvent(input: {
    tenantId: string;
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { email: string; name?: string }[];
    metadata?: Record<string, string>;
  }): Promise<{ eventId: string } | null> {
    try {
      // Parse service account JSON from base64
      const serviceAccountJson = JSON.parse(
        Buffer.from(this.serviceAccountJsonBase64, 'base64').toString('utf8')
      );

      // Get access token via JWT
      const accessToken = await createGServiceAccountJWT(serviceAccountJson, [
        'https://www.googleapis.com/auth/calendar',
      ]);

      // Build event payload
      const event: CalendarEvent = {
        summary: input.summary,
        description: input.description,
        start: {
          dateTime: input.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: input.endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: input.attendees?.map((a) => ({
          email: a.email,
          displayName: a.name,
        })),
        extendedProperties: {
          private: {
            tenantId: input.tenantId,
            bookingId: input.metadata?.bookingId || '',
            source: input.metadata?.source || 'mais-scheduling',
          },
        },
      };

      // Create event via Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(
          {
            status: response.status,
            error: errorText,
            tenantId: input.tenantId,
            summary: input.summary,
          },
          'Google Calendar event creation failed'
        );
        return null;
      }

      const data = (await response.json()) as EventResponse;

      logger.info(
        {
          eventId: data.id,
          tenantId: input.tenantId,
          summary: input.summary,
          startTime: input.startTime.toISOString(),
        },
        'Google Calendar event created'
      );

      return { eventId: data.id };
    } catch (error) {
      logger.error(
        {
          error,
          tenantId: input.tenantId,
          summary: input.summary,
        },
        'Error creating Google Calendar event'
      );
      return null;
    }
  }

  /**
   * Delete a calendar event
   *
   * Uses Google Calendar API v3 events.delete endpoint.
   *
   * @param tenantId - Tenant ID (for logging/auditing)
   * @param eventId - Google Calendar event ID to delete
   * @returns True if successfully deleted, false otherwise
   */
  async deleteEvent(tenantId: string, eventId: string): Promise<boolean> {
    try {
      // Parse service account JSON from base64
      const serviceAccountJson = JSON.parse(
        Buffer.from(this.serviceAccountJsonBase64, 'base64').toString('utf8')
      );

      // Get access token via JWT
      const accessToken = await createGServiceAccountJWT(serviceAccountJson, [
        'https://www.googleapis.com/auth/calendar',
      ]);

      // Delete event via Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        // 404 is OK - event already deleted or never existed
        if (response.status === 404) {
          logger.warn(
            { tenantId, eventId, status: 404 },
            'Google Calendar event not found (already deleted or never existed)'
          );
          return true;
        }

        const errorText = await response.text().catch(() => '');
        logger.error(
          {
            status: response.status,
            error: errorText,
            tenantId,
            eventId,
          },
          'Google Calendar event deletion failed'
        );
        return false;
      }

      logger.info(
        { tenantId, eventId },
        'Google Calendar event deleted'
      );

      return true;
    } catch (error) {
      logger.error(
        { error, tenantId, eventId },
        'Error deleting Google Calendar event'
      );
      return false;
    }
  }
}
