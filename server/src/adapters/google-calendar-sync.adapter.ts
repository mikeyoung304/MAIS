/**
 * Google Calendar Sync Adapter - Two-way sync with Google Calendar
 *
 * Extends GoogleCalendarAdapter with:
 * - Event creation and deletion (one-way sync: MAIS → Google)
 * - FreeBusy API integration (two-way sync: reads Google Calendar busy times)
 * Uses Google Calendar API v3 with service account authentication.
 *
 * Per-tenant credentials are resolved via getConfigForTenant() on every call,
 * so this adapter is fully stateless with respect to credentials.
 */

import type { CalendarProvider, BusyTimeBlock } from '../lib/ports';
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

interface FreeBusyRequest {
  timeMin: string;
  timeMax: string;
  items: Array<{ id: string }>;
}

interface FreeBusyResponse {
  calendars: {
    [calendarId: string]: {
      busy: Array<{
        start: string;
        end: string;
      }>;
    };
  };
}

/**
 * Google Calendar Sync Adapter
 *
 * Provides two-way sync with Google Calendar:
 * - Create events when appointments are booked (MAIS → Google)
 * - Delete events when appointments are cancelled (MAIS → Google)
 * - Read busy times to prevent double-booking (Google → MAIS)
 *
 * Inherits date availability checking from GoogleCalendarAdapter.
 * Supports per-tenant calendar configuration via tenant secrets.
 * All credential lookups are done per-request via getConfigForTenant().
 */
export class GoogleCalendarSyncAdapter extends GoogleCalendarAdapter implements CalendarProvider {
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
  }

  /**
   * Create a calendar event
   *
   * Resolves per-tenant credentials via getConfigForTenant(). If no config
   * is found for the tenant, the sync is skipped gracefully.
   *
   * @param input - Event details including tenantId for credential lookup
   * @returns Google Calendar event ID or null if creation fails / no config
   */
  async createEvent(input: {
    tenantId: string;
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { email: string; name?: string }[];
    metadata?: Record<string, string>;
    timezone?: string;
  }): Promise<{ eventId: string } | null> {
    try {
      // Resolve per-tenant credentials
      const calendarConfig = await this.getConfigForTenant(input.tenantId);
      if (!calendarConfig) {
        logger.warn(
          { tenantId: input.tenantId },
          'No Google Calendar config for tenant; skipping event creation'
        );
        return null;
      }

      // Parse service account JSON from base64
      const serviceAccountJson = JSON.parse(
        Buffer.from(calendarConfig.serviceAccountJsonBase64, 'base64').toString('utf8')
      );

      // Get access token via JWT
      const accessToken = await createGServiceAccountJWT(serviceAccountJson, [
        'https://www.googleapis.com/auth/calendar',
      ]);

      // Build event payload
      // Use client timezone if provided, otherwise fall back to America/New_York
      const timeZone = input.timezone || 'America/New_York';

      const event: CalendarEvent = {
        summary: input.summary,
        description: input.description,
        start: {
          dateTime: input.startTime.toISOString(),
          timeZone,
        },
        end: {
          dateTime: input.endTime.toISOString(),
          timeZone,
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
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarConfig.calendarId)}/events`,
        {
          signal: AbortSignal.timeout(10_000),
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
   * Resolves per-tenant credentials via getConfigForTenant(). If no config
   * is found for the tenant, the sync is skipped gracefully.
   *
   * @param tenantId - Tenant ID for credential lookup and logging
   * @param eventId - Google Calendar event ID to delete
   * @returns True if successfully deleted, false otherwise
   */
  async deleteEvent(tenantId: string, eventId: string): Promise<boolean> {
    try {
      // Resolve per-tenant credentials
      const calendarConfig = await this.getConfigForTenant(tenantId);
      if (!calendarConfig) {
        logger.warn(
          { tenantId, eventId },
          'No Google Calendar config for tenant; skipping event deletion'
        );
        return false;
      }

      // Parse service account JSON from base64
      const serviceAccountJson = JSON.parse(
        Buffer.from(calendarConfig.serviceAccountJsonBase64, 'base64').toString('utf8')
      );

      // Get access token via JWT
      const accessToken = await createGServiceAccountJWT(serviceAccountJson, [
        'https://www.googleapis.com/auth/calendar',
      ]);

      // Delete event via Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarConfig.calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          signal: AbortSignal.timeout(10_000),
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

      logger.info({ tenantId, eventId }, 'Google Calendar event deleted');

      return true;
    } catch (error) {
      logger.error({ error, tenantId, eventId }, 'Error deleting Google Calendar event');
      return false;
    }
  }

  /**
   * Get busy time blocks from Google Calendar
   *
   * Resolves per-tenant credentials via getConfigForTenant(). If no config
   * is found for the tenant, returns an empty array (graceful degradation).
   *
   * @param tenantId - Tenant ID for credential lookup and logging
   * @param startDate - Start of time range to check
   * @param endDate - End of time range to check
   * @returns Array of busy time blocks, or empty array on error / no config
   */
  async getBusyTimes(tenantId: string, startDate: Date, endDate: Date): Promise<BusyTimeBlock[]> {
    try {
      // Resolve per-tenant credentials
      const calendarConfig = await this.getConfigForTenant(tenantId);
      if (!calendarConfig) {
        logger.warn(
          { tenantId, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          'No Google Calendar config for tenant; returning empty busy times'
        );
        return [];
      }

      // Parse service account JSON from base64
      const serviceAccountJson = JSON.parse(
        Buffer.from(calendarConfig.serviceAccountJsonBase64, 'base64').toString('utf8')
      );

      // Get access token via JWT
      const accessToken = await createGServiceAccountJWT(serviceAccountJson, [
        'https://www.googleapis.com/auth/calendar',
      ]);

      // Build FreeBusy query request
      const requestBody: FreeBusyRequest = {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: calendarConfig.calendarId }],
      };

      // Query FreeBusy API
      const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        signal: AbortSignal.timeout(10_000),
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.warn(
          {
            status: response.status,
            error: errorText,
            tenantId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          'Google Calendar FreeBusy query failed - returning empty busy times'
        );
        return [];
      }

      const data = (await response.json()) as FreeBusyResponse;

      // Extract busy times for our calendar
      const calendarBusyTimes = data.calendars[calendarConfig.calendarId]?.busy || [];

      // Convert to BusyTimeBlock format
      const busyBlocks: BusyTimeBlock[] = calendarBusyTimes.map((busy) => ({
        start: new Date(busy.start),
        end: new Date(busy.end),
      }));

      logger.debug(
        {
          tenantId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          busyBlocksCount: busyBlocks.length,
        },
        'Google Calendar busy times fetched'
      );

      return busyBlocks;
    } catch (error) {
      logger.warn(
        {
          error,
          tenantId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        'Error fetching Google Calendar busy times - returning empty array for graceful degradation'
      );
      return [];
    }
  }
}
