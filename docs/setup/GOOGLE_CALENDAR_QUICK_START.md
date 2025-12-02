# Google Calendar Sync - Quick Start Guide

## TL;DR

Google Calendar one-way sync is now available. Add these env vars to enable:

```bash
GOOGLE_CALENDAR_ID=your-calendar@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Li4u
```

Use in your booking service:

```typescript
// Inject GoogleCalendarService from container
const { googleCalendar } = container.services;

// After creating a booking
const result = await googleCalendar.createAppointmentEvent(tenantId, {
  id: booking.id,
  serviceName: 'Consultation',
  clientName: 'Jane Doe',
  clientEmail: 'jane@example.com',
  startTime: new Date('2025-06-15T10:00:00Z'),
  endTime: new Date('2025-06-15T10:30:00Z'),
  notes: 'First visit',
});

if (result) {
  await bookingRepo.updateGoogleEventId(tenantId, booking.id, result.eventId);
}
```

## Setup (5 minutes)

### 1. Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project → Enable Calendar API
3. Create Service Account → Download JSON key
4. Copy the `client_email` from the JSON

### 2. Share Calendar

1. Open Google Calendar
2. Settings → Your calendar → Share with specific people
3. Add the service account email from step 1
4. Grant "Make changes to events" permission

### 3. Configure Environment

```bash
# Base64 encode the service account JSON
cat service-account.json | base64

# Add to .env
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com  # From calendar settings
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<paste-base64-here>
```

### 4. Test

```bash
# Start in real mode
ADAPTERS_PRESET=real npm run dev:api

# Create a test booking - check Google Calendar for the event!
```

## API Reference

### Create Event

```typescript
googleCalendar.createAppointmentEvent(
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
): Promise<{ eventId: string } | null>
```

**Returns**: `{ eventId: 'abc123' }` on success, `null` on failure

### Cancel Event

```typescript
googleCalendar.cancelAppointmentEvent(
  tenantId: string,
  googleEventId: string
): Promise<boolean>
```

**Returns**: `true` on success, `false` on failure

### Store Event ID

```typescript
bookingRepo.updateGoogleEventId(
  tenantId: string,
  bookingId: string,
  googleEventId: string
): Promise<void>
```

## Key Features

✅ **Graceful Degradation** - Works without calendar configured (logs warning)
✅ **Non-Blocking** - Calendar failures don't prevent bookings
✅ **Multi-Tenant** - Tenant ID stored in event metadata
✅ **Mock Mode** - Development without real calendar
✅ **Logging** - All operations logged for debugging

## Common Patterns

### Pattern 1: Direct Integration

```typescript
async createBooking(tenantId, input) {
  const booking = await bookingRepo.create(tenantId, {...});

  const calResult = await googleCalendar.createAppointmentEvent(tenantId, {
    id: booking.id,
    serviceName: input.serviceName,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    startTime: input.startTime,
    endTime: input.endTime,
  });

  if (calResult) {
    await bookingRepo.updateGoogleEventId(tenantId, booking.id, calResult.eventId);
  }

  return booking;
}
```

### Pattern 2: Event-Driven

```typescript
// In DI container
eventEmitter.subscribe('AppointmentBooked', async (payload) => {
  const result = await googleCalendar.createAppointmentEvent(
    payload.tenantId,
    payload
  );

  if (result) {
    await bookingRepo.updateGoogleEventId(
      payload.tenantId,
      payload.bookingId,
      result.eventId
    );
  }
});

// In your service
await bookingRepo.create(tenantId, booking);
eventEmitter.emit('AppointmentBooked', { tenantId, bookingId: booking.id, ... });
```

## Troubleshooting

### Events not appearing?

1. **Check calendar sharing**: Service account email has edit permission?
2. **Check credentials**: Base64 decode to verify JSON is valid
3. **Check logs**: Look for "Google Calendar event created" (success) or errors

### How to test without real calendar?

Use mock mode - it logs to console:

```bash
ADAPTERS_PRESET=mock npm run dev:api
# See: 📅 [MOCK GOOGLE CALENDAR] Event created: {...}
```

### Where is the event ID stored?

In the `Booking` model:

```sql
SELECT id, googleEventId FROM "Booking" WHERE id = 'booking_abc';
```

## Complete Documentation

- **Integration Guide**: [google-calendar-integration.md](./google-calendar-integration.md)
- **Implementation Summary**: [google-calendar-implementation-summary.md](./google-calendar-implementation-summary.md)

## Support

Questions? Check:
1. Logs for error messages
2. Google Cloud Console → API quotas
3. Calendar sharing permissions
4. Environment variables are set correctly
