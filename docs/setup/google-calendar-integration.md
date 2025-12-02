# Google Calendar One-Way Sync Integration

## Overview

This document describes how to integrate Google Calendar one-way sync (MAIS → Google) into the scheduling platform. The sync automatically creates and deletes calendar events when appointments are booked or cancelled.

## Architecture

### Components

1. **GoogleCalendarService** (`services/google-calendar.service.ts`)
   - High-level service for managing appointment events
   - Gracefully degrades if calendar is not configured
   - Handles error logging and null checks

2. **GoogleCalendarSyncAdapter** (`adapters/google-calendar-sync.adapter.ts`)
   - Extends GoogleCalendarAdapter for full sync capabilities
   - Uses Google Calendar API v3 with service account authentication
   - Implements createEvent() and deleteEvent() methods

3. **MockCalendarProvider** (`adapters/mock/index.ts`)
   - Mock implementation for development/testing
   - Stores events in memory, logs to console

4. **BookingRepository.updateGoogleEventId()**
   - Stores Google Calendar event ID on Booking model
   - Required for future event cancellation

## Environment Variables

Add these to your `.env` file for real mode:

```bash
# Google Calendar Configuration (Optional - graceful fallback if missing)
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<base64-encoded-service-account-json>
```

### Getting Service Account Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create a service account with "Calendar Editor" role
5. Download the JSON key file
6. Base64 encode it: `cat service-account.json | base64`
7. Add to `.env` as `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`

### Sharing Calendar with Service Account

1. Open Google Calendar
2. Go to calendar settings
3. Share with service account email (found in JSON: `client_email`)
4. Grant "Make changes to events" permission

## Integration Example: Booking Flow

Here's how to integrate Google Calendar sync into a booking service:

### Example: Time-Slot Booking Service

```typescript
import { GoogleCalendarService } from '../services/google-calendar.service';
import { BookingRepository } from '../lib/ports';
import { logger } from '../lib/core/logger';

export class TimeSlotBookingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly googleCalendarService: GoogleCalendarService
  ) {}

  /**
   * Create a new time-slot booking with Google Calendar sync
   */
  async createBooking(
    tenantId: string,
    input: {
      serviceId: string;
      serviceName: string;
      clientName: string;
      clientEmail: string;
      startTime: Date;
      endTime: Date;
      notes?: string;
    }
  ): Promise<{ bookingId: string; googleEventId?: string }> {
    // 1. Create booking in database
    const booking = await this.bookingRepo.create(tenantId, {
      id: `booking_${Date.now()}`,
      serviceId: input.serviceId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      startTime: input.startTime,
      endTime: input.endTime,
      notes: input.notes,
      status: 'CONFIRMED',
      // ... other fields
    });

    logger.info({ bookingId: booking.id, tenantId }, 'Booking created successfully');

    // 2. Sync to Google Calendar (one-way)
    // This is OPTIONAL and gracefully degrades if calendar not configured
    const calendarResult = await this.googleCalendarService.createAppointmentEvent(
      tenantId,
      {
        id: booking.id,
        serviceName: input.serviceName,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        startTime: input.startTime,
        endTime: input.endTime,
        notes: input.notes,
      }
    );

    // 3. Store Google event ID for future cancellation
    if (calendarResult) {
      await this.bookingRepo.updateGoogleEventId(
        tenantId,
        booking.id,
        calendarResult.eventId
      );

      logger.info(
        {
          bookingId: booking.id,
          googleEventId: calendarResult.eventId,
          tenantId,
        },
        'Google Calendar event synced successfully'
      );

      return {
        bookingId: booking.id,
        googleEventId: calendarResult.eventId,
      };
    }

    // No calendar sync - that's OK, booking still created
    return { bookingId: booking.id };
  }

  /**
   * Cancel a booking and remove from Google Calendar
   */
  async cancelBooking(
    tenantId: string,
    bookingId: string
  ): Promise<void> {
    // 1. Get booking to retrieve Google event ID
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // 2. Update booking status to CANCELED
    await this.bookingRepo.update(tenantId, bookingId, {
      status: 'CANCELED',
      cancelledAt: new Date(),
    });

    logger.info({ bookingId, tenantId }, 'Booking cancelled');

    // 3. Delete Google Calendar event if it exists
    if (booking.googleEventId) {
      const deleted = await this.googleCalendarService.cancelAppointmentEvent(
        tenantId,
        booking.googleEventId
      );

      if (deleted) {
        logger.info(
          { bookingId, googleEventId: booking.googleEventId, tenantId },
          'Google Calendar event deleted successfully'
        );
      } else {
        logger.warn(
          { bookingId, googleEventId: booking.googleEventId, tenantId },
          'Failed to delete Google Calendar event (event may not exist)'
        );
      }
    }
  }
}
```

## Integration Pattern: Event-Driven Approach

Alternatively, you can use event emitters for decoupled integration:

```typescript
// In your booking service
eventEmitter.emit('AppointmentBooked', {
  tenantId,
  bookingId: booking.id,
  serviceName: service.name,
  clientName: booking.clientName,
  clientEmail: booking.email,
  startTime: booking.startTime,
  endTime: booking.endTime,
  notes: booking.notes,
});

// In your DI container (di.ts)
eventEmitter.subscribe('AppointmentBooked', async (payload) => {
  const result = await googleCalendarService.createAppointmentEvent(
    payload.tenantId,
    {
      id: payload.bookingId,
      serviceName: payload.serviceName,
      clientName: payload.clientName,
      clientEmail: payload.clientEmail,
      startTime: payload.startTime,
      endTime: payload.endTime,
      notes: payload.notes,
    }
  );

  if (result) {
    await bookingRepo.updateGoogleEventId(
      payload.tenantId,
      payload.bookingId,
      result.eventId
    );
  }
});
```

## Error Handling

The Google Calendar sync is designed to fail gracefully:

1. **Missing credentials**: Returns null, logs warning, continues
2. **API errors**: Returns null, logs error, continues
3. **Network failures**: Returns null, logs error, continues

**Important**: Your booking flow should NEVER fail because of calendar sync issues. The booking is the source of truth, calendar sync is a convenience feature.

## Testing

### Mock Mode

In mock mode, the calendar provider logs events to console:

```bash
📅 [MOCK GOOGLE CALENDAR] Event created: {
  eventId: 'mock_gcal_event_1234567890_abc',
  summary: '30-Minute Consultation - Jane Doe',
  startTime: '2025-06-15T10:00:00.000Z',
  endTime: '2025-06-15T10:30:00.000Z',
  attendees: 'jane@example.com'
}
```

### Real Mode Testing

1. Set up service account credentials (see above)
2. Share calendar with service account
3. Run in real mode: `ADAPTERS_PRESET=real npm run dev:api`
4. Create a test booking
5. Check Google Calendar for the event

## Troubleshooting

### Events not appearing in Google Calendar

1. **Check service account has calendar access**
   - Calendar must be shared with service account email
   - Service account must have "Make changes to events" permission

2. **Check credentials**
   - `GOOGLE_CALENDAR_ID` is correct
   - `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` is valid base64

3. **Check logs**
   - Look for "Google Calendar event created" (success)
   - Look for "Failed to create Google Calendar event" (error)

### Calendar events created but not deleted

1. **Check googleEventId is stored**
   - Query booking record for `googleEventId` field
   - Should be non-null after successful sync

2. **Check cancellation flow**
   - Ensure you're calling `cancelAppointmentEvent()`
   - Check logs for deletion errors

## Database Schema

The `Booking` model already has the required field:

```prisma
model Booking {
  // ... other fields
  googleEventId String? // Google Calendar event ID for sync
}
```

No migration needed - field already exists!

## API Endpoints (Optional)

If you want to expose calendar sync status via API:

```typescript
// GET /v1/bookings/:id
{
  "id": "booking_123",
  "serviceName": "30-Minute Consultation",
  "clientName": "Jane Doe",
  "startTime": "2025-06-15T10:00:00.000Z",
  "endTime": "2025-06-15T10:30:00.000Z",
  "googleEventId": "abc123xyz", // Present if synced
  "calendarSynced": true // Derived from googleEventId !== null
}
```

## Performance Considerations

1. **Async sync**: Calendar sync happens after booking creation
2. **No blocking**: Booking succeeds even if calendar sync fails
3. **Idempotency**: Safe to retry sync operations
4. **Rate limits**: Google Calendar API has quota limits (check console)

## Security Considerations

1. **Service account keys**: Store in environment variables, never commit
2. **Tenant isolation**: Calendar events include tenantId in metadata
3. **No cross-tenant access**: Each tenant should have their own calendar
4. **Audit logging**: All sync operations are logged with tenant context

## Future Enhancements

- **Two-way sync**: Read events from Google Calendar (currently one-way only)
- **Bulk sync**: Sync historical bookings to calendar
- **Event updates**: Sync booking modifications (reschedules)
- **Multiple calendars**: Support different calendars per service/segment
- **Conflict detection**: Check Google Calendar before confirming booking

## Reference

- [Google Calendar API v3 Documentation](https://developers.google.com/calendar/api/v3/reference)
- [Service Account Authentication](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Calendar Events Resource](https://developers.google.com/calendar/api/v3/reference/events)
