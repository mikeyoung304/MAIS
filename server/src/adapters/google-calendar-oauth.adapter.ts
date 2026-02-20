/**
 * Google Calendar OAuth Adapter
 *
 * Implements CalendarProvider port using OAuth 2.0 tokens for authentication.
 * Each tenant has their own OAuth tokens stored encrypted in Tenant.secrets.googleCalendar.
 *
 * Unlike the service account adapter (gcal.adapter.ts) which uses a JWT for auth,
 * this adapter uses the tenant's OAuth access token directly. Token refresh is
 * handled by GoogleCalendarOAuthService.getValidAccessToken().
 *
 * SECURITY:
 * - All API calls use per-tenant OAuth tokens (no shared credentials)
 * - Tokens are encrypted at rest (AES-256-GCM)
 * - 401 responses trigger token refresh, then fail-close
 * - Timeouts at 10s to prevent blocking bookings on Google outages
 */

import type { CalendarProvider, BusyTimeBlock } from '../lib/ports';
import type { GoogleCalendarOAuthService } from '../services/google-calendar-oauth.service';
import { logger } from '../lib/core/logger';

interface FreeBusyResponse {
  calendars?: {
    [calendarId: string]: {
      busy?: Array<{ start: string; end: string }>;
    };
  };
}

interface EventResponse {
  id: string;
  summary: string;
}

/**
 * Retry a Google API call with exponential backoff.
 * Retries on 5xx errors and timeouts. Non-retryable errors are thrown immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isServerError =
        err instanceof Error &&
        'status' in err &&
        typeof (err as { status: unknown }).status === 'number' &&
        (err as { status: number }).status >= 500;
      const isTimeoutError = err instanceof Error && err.name === 'AbortError';
      const isRetryable = isServerError || isTimeoutError;

      if (attempt === maxAttempts - 1 || !isRetryable) throw err;

      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 100, 10_000);
      logger.warn(
        { attempt: attempt + 1, maxAttempts, delay: Math.round(delay) },
        'Google Calendar OAuth API retry'
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('unreachable');
}

export class GoogleOAuthCalendarAdapter implements CalendarProvider {
  constructor(private readonly oauthService: GoogleCalendarOAuthService) {}

  /**
   * Check if a date is available by querying Google Calendar FreeBusy API.
   *
   * Uses the tenant's OAuth access token. If no token is available (calendar
   * not connected), returns true (available) to avoid blocking bookings.
   *
   * @param dateUtc - Date in YYYY-MM-DD format (UTC)
   * @param tenantId - Tenant ID for per-tenant OAuth token lookup
   */
  async isDateAvailable(dateUtc: string, tenantId?: string): Promise<boolean> {
    if (!tenantId) {
      logger.debug('No tenantId provided to OAuth calendar adapter; treating date as available');
      return true;
    }

    const accessToken = await this.oauthService.getValidAccessToken(tenantId);
    if (!accessToken) {
      logger.debug(
        { tenantId },
        'No OAuth access token available; treating date as available'
      );
      return true;
    }

    try {
      const timeMin = `${dateUtc}T00:00:00.000Z`;
      const timeMax = `${dateUtc}T23:59:59.999Z`;

      // We use 'primary' as the calendar ID since OAuth gives access to the user's primary calendar
      const response = await withRetry(() =>
        fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          signal: AbortSignal.timeout(10_000),
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: [{ id: 'primary' }],
          }),
        })
      );

      if (!response.ok) {
        // 401: token invalid — fail closed (treat as unavailable)
        if (response.status === 401) {
          logger.warn(
            { status: 401, date: dateUtc, tenantId },
            'Google Calendar OAuth API returned 401; treating date as unavailable'
          );
          return false;
        }

        const errorText = await response.text().catch(() => '');
        logger.warn(
          { status: response.status, error: errorText, date: dateUtc, tenantId },
          'Google Calendar OAuth FreeBusy failed; assuming date is available'
        );
        return true;
      }

      const data = (await response.json()) as FreeBusyResponse;
      const busySlots = data?.calendars?.['primary']?.busy ?? [];
      const isBusy = Array.isArray(busySlots) && busySlots.length > 0;

      return !isBusy;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn(
          { date: dateUtc, tenantId },
          'Google Calendar OAuth FreeBusy timed out; assuming date is available'
        );
        return true;
      }

      logger.warn(
        { error, date: dateUtc, tenantId },
        'Error checking Google Calendar OAuth availability; assuming date is available'
      );
      return true;
    }
  }

  /**
   * Create a calendar event via Google Calendar API using OAuth token.
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
    const accessToken = await this.oauthService.getValidAccessToken(input.tenantId);
    if (!accessToken) {
      logger.warn(
        { tenantId: input.tenantId },
        'No OAuth access token for event creation; skipping'
      );
      return null;
    }

    try {
      const timeZone = input.timezone || 'America/New_York';

      const event = {
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

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
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
          'Google Calendar OAuth event creation failed'
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
        'Google Calendar OAuth event created'
      );

      return { eventId: data.id };
    } catch (error) {
      logger.error(
        { error, tenantId: input.tenantId, summary: input.summary },
        'Error creating Google Calendar OAuth event'
      );
      return null;
    }
  }

  /**
   * Delete a calendar event via Google Calendar API using OAuth token.
   */
  async deleteEvent(tenantId: string, eventId: string): Promise<boolean> {
    const accessToken = await this.oauthService.getValidAccessToken(tenantId);
    if (!accessToken) {
      logger.warn({ tenantId, eventId }, 'No OAuth access token for event deletion; skipping');
      return false;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          signal: AbortSignal.timeout(10_000),
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        // 404 = already deleted
        if (response.status === 404) {
          logger.warn(
            { tenantId, eventId, status: 404 },
            'Google Calendar OAuth event not found (already deleted)'
          );
          return true;
        }

        const errorText = await response.text().catch(() => '');
        logger.error(
          { status: response.status, error: errorText, tenantId, eventId },
          'Google Calendar OAuth event deletion failed'
        );
        return false;
      }

      logger.info({ tenantId, eventId }, 'Google Calendar OAuth event deleted');
      return true;
    } catch (error) {
      logger.error({ error, tenantId, eventId }, 'Error deleting Google Calendar OAuth event');
      return false;
    }
  }

  /**
   * Get busy time blocks from Google Calendar for two-way sync.
   */
  async getBusyTimes(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BusyTimeBlock[]> {
    const accessToken = await this.oauthService.getValidAccessToken(tenantId);
    if (!accessToken) {
      logger.debug(
        { tenantId },
        'No OAuth access token for busy times; returning empty'
      );
      return [];
    }

    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        signal: AbortSignal.timeout(10_000),
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          items: [{ id: 'primary' }],
        }),
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
          'Google Calendar OAuth FreeBusy query failed'
        );
        return [];
      }

      const data = (await response.json()) as FreeBusyResponse;
      const calendarBusy = data?.calendars?.['primary']?.busy ?? [];

      const busyBlocks: BusyTimeBlock[] = calendarBusy.map((busy) => ({
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
        'Google Calendar OAuth busy times fetched'
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
        'Error fetching Google Calendar OAuth busy times'
      );
      return [];
    }
  }
}
