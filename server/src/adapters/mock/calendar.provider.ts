/**
 * Mock Calendar Provider
 *
 * In-memory implementation of CalendarProvider for testing and local development.
 */

import { toUtcMidnight } from '@macon/shared';
import type { CalendarProvider } from '../../lib/ports';
import { logger } from '../../lib/core/logger';
import { calendarBusyDates } from './state';

export class MockCalendarProvider implements CalendarProvider {
  private mockEvents = new Map<
    string,
    {
      eventId: string;
      summary: string;
      startTime: Date;
      endTime: Date;
      tenantId: string;
    }
  >();

  async isDateAvailable(date: string): Promise<boolean> {
    const dateKey = toUtcMidnight(date);
    return !calendarBusyDates.has(dateKey);
  }

  // Helper method to mark dates as busy (for testing)
  markBusy(date: string): void {
    const dateKey = toUtcMidnight(date);
    calendarBusyDates.add(dateKey);
  }

  async createEvent(input: {
    tenantId: string;
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { email: string; name?: string }[];
    metadata?: Record<string, string>;
  }): Promise<{ eventId: string } | null> {
    const eventId = `mock_gcal_event_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.mockEvents.set(eventId, {
      eventId,
      summary: input.summary,
      startTime: input.startTime,
      endTime: input.endTime,
      tenantId: input.tenantId,
    });

    logger.debug(
      {
        eventId,
        summary: input.summary,
        startTime: input.startTime.toISOString(),
        endTime: input.endTime.toISOString(),
        attendees: input.attendees?.map((a) => a.email).join(', '),
      },
      'Mock Google Calendar event created'
    );

    return { eventId };
  }

  async deleteEvent(_tenantId: string, eventId: string): Promise<boolean> {
    const event = this.mockEvents.get(eventId);

    if (!event) {
      logger.debug({ eventId }, 'Mock Google Calendar event not found');
      return false;
    }

    this.mockEvents.delete(eventId);
    logger.debug(
      {
        eventId,
        summary: event.summary,
      },
      'Mock Google Calendar event deleted'
    );

    return true;
  }

  getMockEvents(): Array<{ eventId: string; summary: string; startTime: Date; endTime: Date }> {
    return Array.from(this.mockEvents.values());
  }
}
