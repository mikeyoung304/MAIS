# Google Calendar Integration - Phased Implementation Plan

> **Status**: Email notifications ✅ COMPLETE (Postmark configured)
> **Next Priority**: Google Calendar sync for booking management

---

## 📊 Current State (60% Complete)

### ✅ Already Implemented (READ-ONLY Operations)

- Google Calendar availability checking via freeBusy API
- Service account JWT authentication (RS256)
- 60-second caching for performance
- Integration with AvailabilityService
- Mock fallback when credentials missing
- Full TypeScript type safety

**Files Working:**

```
✅ server/src/adapters/gcal.adapter.ts (112 lines)
✅ server/src/adapters/gcal.jwt.ts (86 lines)
✅ server/src/services/availability.service.ts (lines 57-60)
✅ server/src/di.ts (lines 218-230)
```

### ❌ Not Implemented (WRITE Operations)

- Calendar event creation on booking confirmation
- Calendar event deletion on booking cancellation/refund
- Event updates when booking modified
- OAuth2 user authorization flow (not needed for Phase 1)
- Per-tenant calendar configuration
- Multi-calendar support

---

## 🎯 Implementation Phases

### Phase 1: Event Creation (Core Feature) - **8 hours**

Create calendar events when bookings are confirmed via Stripe webhooks.

### Phase 2: Event Deletion (Refund Support) - **4 hours**

Remove calendar events when bookings are refunded or cancelled.

### Phase 3: Event Updates (Enhancement) - **6 hours**

Update calendar events when booking details change.

### Phase 4: Testing & Polish - **4 hours**

Comprehensive testing, error handling, monitoring.

**Total Estimate: 22 hours (3 days)**

---

## 📋 PHASE 1: Event Creation (Priority 1)

### Goal

Automatically create Google Calendar events when customers complete bookings.

### Prerequisites

```bash
# Verify these environment variables are set:
GOOGLE_CALENDAR_ID=your-calendar@gmail.com
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<base64-encoded-service-account.json>

# Test current setup:
npm run doctor  # Should show "✅ Google Calendar configured"
```

### Step 1.1: Upgrade OAuth2 Scope (30 min)

**File**: `server/src/adapters/gcal.jwt.ts`

**Current (line 59-60):**

```typescript
const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
```

**Change to:**

```typescript
const scopes = ['https://www.googleapis.com/auth/calendar.events'];
```

**Why**: `calendar.events` allows read/write access (includes readonly permissions).

**Google Cloud Console Action Required:**

1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Find your service account
3. No changes needed - service account permissions are set at calendar share level
4. Verify calendar is shared with "Make changes to events" permission

---

### Step 1.2: Add Event Creation Method (2 hours)

**File**: `server/src/adapters/gcal.adapter.ts`

**Add after line 110 (end of class):**

```typescript
/**
 * Create a calendar event for a confirmed booking
 * @param event Event details
 * @returns Google Calendar event ID
 */
async createEvent(event: {
  summary: string;
  description: string;
  location?: string;
  start: string; // ISO 8601 date (YYYY-MM-DD)
  end: string;   // ISO 8601 date (YYYY-MM-DD)
  attendees?: string[]; // Email addresses
}): Promise<string> {
  // Get access token
  const accessToken = await createGServiceAccountJWT(
    this.serviceAccountJson,
    ['https://www.googleapis.com/auth/calendar.events']
  );

  // Create event payload
  const eventPayload = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      date: event.start, // All-day event (wedding date)
      timeZone: 'UTC',
    },
    end: {
      date: event.end, // Same day or next day
      timeZone: 'UTC',
    },
    attendees: event.attendees?.map(email => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 * 7 }, // 1 week before
        { method: 'popup', minutes: 24 * 60 * 3 },  // 3 days before
        { method: 'popup', minutes: 24 * 60 },      // 1 day before
      ],
    },
  };

  // Create event via Google Calendar API
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({
      status: response.status,
      error: errorText,
      event: event.summary
    }, 'Failed to create calendar event');
    throw new Error(`Calendar event creation failed: ${response.status}`);
  }

  const data = await response.json();
  logger.info({
    eventId: data.id,
    summary: event.summary
  }, 'Calendar event created successfully');

  return data.id; // Return Google Calendar event ID
}
```

**Key Design Decisions:**

- All-day events (weddings are typically full-day)
- Email reminders at 7 days, 3 days, 1 day before
- Returns event ID for future reference (deletion/updates)
- Proper error handling with logging

---

### Step 1.3: Update CalendarProvider Interface (15 min)

**File**: `server/src/lib/ports.ts`

**Current (lines 85-87):**

```typescript
export interface CalendarProvider {
  isDateAvailable(date: string): Promise<boolean>;
}
```

**Change to:**

```typescript
export interface CalendarProvider {
  isDateAvailable(date: string): Promise<boolean>;

  createEvent(event: {
    summary: string;
    description: string;
    location?: string;
    start: string;
    end: string;
    attendees?: string[];
  }): Promise<string>;
}
```

---

### Step 1.4: Update Mock Calendar Provider (30 min)

**File**: `server/src/adapters/mock/index.ts`

**Add after line 443 (in MockCalendarProvider class):**

```typescript
async createEvent(event: {
  summary: string;
  description: string;
  location?: string;
  start: string;
  end: string;
  attendees?: string[];
}): Promise<string> {
  // Mock implementation - just log and return fake ID
  console.log('📅 [MOCK CALENDAR] Event created:', {
    summary: event.summary,
    date: event.start,
    attendees: event.attendees,
  });

  // Auto-mark date as busy in mock calendar
  this.markBusy(event.start);

  // Return fake event ID
  return `mock_event_${Date.now()}`;
}
```

**Why**: Ensures mock mode still works for testing without real Google credentials.

---

### Step 1.5: Integrate with Booking Service (2 hours)

**File**: `server/src/services/booking.service.ts`

**Find the webhook success handler (around line 290-330):**

Look for where `BookingPaid` event is emitted:

```typescript
// After payment confirmation (around line 316-325)
this.eventEmitter.emit<BookingPaidPayload>('BookingPaid', {
  bookingId: booking.id,
  email: booking.email,
  coupleName: booking.coupleName,
  eventDate: booking.eventDate,
  packageTitle: pkg.title,
  addOnTitles: addOnTitles,
  totalCents: booking.totalPrice,
});
```

**Add AFTER this block:**

```typescript
// Create calendar event
try {
  const calendarEventId = await this.calendarProvider.createEvent({
    summary: `Wedding: ${booking.coupleName}`,
    description: [
      `Package: ${pkg.title}`,
      addOnTitles.length > 0 ? `Add-ons: ${addOnTitles.join(', ')}` : '',
      `Total: $${(booking.totalPrice / 100).toFixed(2)}`,
      ``,
      `Booking ID: ${booking.id}`,
      `Confirmed: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join('\n'),
    location: '', // Could add from tenant settings later
    start: booking.eventDate, // YYYY-MM-DD format
    end: booking.eventDate, // Same day (all-day event)
    attendees: [booking.email], // Couple's email
  });

  // Store calendar event ID in booking for future reference
  await this.bookingRepo.update(booking.id, {
    metadata: {
      ...booking.metadata,
      calendarEventId, // Store for deletion later
    },
  });

  logger.info(
    {
      bookingId: booking.id,
      calendarEventId,
    },
    'Calendar event created for booking'
  );
} catch (error) {
  // Don't fail booking if calendar creation fails
  logger.error(
    {
      error,
      bookingId: booking.id,
    },
    'Failed to create calendar event (non-fatal)'
  );
}
```

**Why**:

- Calendar creation is non-fatal (booking still succeeds even if calendar fails)
- Stores event ID in booking metadata for future deletion
- Includes all relevant booking details in event description

---

### Step 1.6: Add Constructor Dependency (15 min)

**File**: `server/src/services/booking.service.ts`

**Find constructor (around line 30-40):**

```typescript
constructor(
  private bookingRepo: BookingRepository,
  private packageRepo: PackageRepository,
  private addOnRepo: AddOnRepository,
  private availabilityService: AvailabilityService,
  private paymentProvider: PaymentProvider,
  private commissionService: CommissionService,
  private eventEmitter: EventEmitter,
  private tenantRepo: TenantRepository,
) {}
```

**Add calendarProvider:**

```typescript
constructor(
  private bookingRepo: BookingRepository,
  private packageRepo: PackageRepository,
  private addOnRepo: AddOnRepository,
  private availabilityService: AvailabilityService,
  private paymentProvider: PaymentProvider,
  private commissionService: CommissionService,
  private eventEmitter: EventEmitter,
  private tenantRepo: TenantRepository,
  private calendarProvider: CalendarProvider, // ADD THIS
) {}
```

---

### Step 1.7: Update Dependency Injection (15 min)

**File**: `server/src/di.ts`

**Find BookingService instantiation (around line 250-260):**

```typescript
const bookingService = new BookingService(
  bookingRepo,
  packageRepo,
  addOnRepo,
  availabilityService,
  paymentProvider,
  commissionService,
  eventEmitter,
  tenantRepo
);
```

**Add calendarProvider:**

```typescript
const bookingService = new BookingService(
  bookingRepo,
  packageRepo,
  addOnRepo,
  availabilityService,
  paymentProvider,
  commissionService,
  eventEmitter,
  tenantRepo,
  calendarProvider // ADD THIS (already instantiated earlier)
);
```

---

### Step 1.8: Database Migration for Event ID Storage (30 min)

**File**: `server/prisma/schema.prisma`

**Find Booking model (around line 237-279):**

**Add field:**

```prisma
model Booking {
  // ... existing fields
  metadata  Json?  // ADD THIS if not exists

  // Or if metadata exists, document it should store:
  // metadata: {
  //   calendarEventId: string  // Google Calendar event ID
  // }
}
```

**If metadata doesn't exist, run migration:**

```bash
# Create migration
npx prisma migrate dev --name add_booking_metadata

# Or if you prefer manual SQL:
# ALTER TABLE "Booking" ADD COLUMN "metadata" JSONB;
```

---

### Step 1.9: Testing Phase 1 (2 hours)

**Test Plan:**

**1. Unit Test - Event Creation**

Create: `server/test/adapters/gcal.adapter.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GoogleCalendarAdapter } from '../../src/adapters/gcal.adapter';

describe('GoogleCalendarAdapter', () => {
  describe('createEvent', () => {
    it('should create calendar event with correct payload', async () => {
      // Mock service account (use test credentials)
      const adapter = new GoogleCalendarAdapter({
        calendarId: 'test@example.com',
        serviceAccountJsonBase64: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64!,
      });

      const eventId = await adapter.createEvent({
        summary: 'Test Wedding',
        description: 'Test booking',
        start: '2025-12-25',
        end: '2025-12-25',
        attendees: ['couple@example.com'],
      });

      expect(eventId).toBeTruthy();
      expect(typeof eventId).toBe('string');
    });
  });
});
```

**2. Integration Test - End-to-End**

Add to: `server/test/integration/booking-flow.integration.spec.ts`

```typescript
it('should create Google Calendar event on booking confirmation', async () => {
  // Create test booking
  const booking = await createTestBooking();

  // Simulate Stripe webhook (payment succeeded)
  await simulateStripeWebhook('checkout.session.completed', {
    id: booking.stripeCheckoutSessionId,
  });

  // Verify booking is confirmed
  const confirmedBooking = await bookingRepo.findById(booking.id);
  expect(confirmedBooking.status).toBe('CONFIRMED');

  // Verify calendar event was created
  expect(confirmedBooking.metadata?.calendarEventId).toBeTruthy();

  // Optional: Verify event exists in Google Calendar
  // (requires calendar query API)
});
```

**3. Manual Test - Real Flow**

```bash
# 1. Start dev server
npm run dev:all

# 2. Create test booking via Stripe checkout
# 3. Complete payment with test card: 4242 4242 4242 4242
# 4. Check Google Calendar - event should appear
# 5. Check server logs for:
#    "Calendar event created successfully"
```

**4. Error Scenario Tests**

Test these failure modes:

- ❌ Invalid credentials → Should log error but not fail booking
- ❌ Network timeout → Should log error but not fail booking
- ❌ Invalid date format → Should log error but not fail booking
- ❌ Calendar API rate limit → Should log error but not fail booking

---

### Phase 1 Completion Checklist

```
□ OAuth2 scope updated to calendar.events
□ createEvent() method added to GoogleCalendarAdapter
□ CalendarProvider interface updated
□ MockCalendarProvider implements createEvent()
□ BookingService calls createEvent() on BookingPaid
□ CalendarProvider injected into BookingService
□ Database migration for metadata field
□ Unit tests written and passing
□ Integration tests written and passing
□ Manual testing completed
□ Error handling verified
□ Logging verified in production mode
```

**Deliverables:**

- ✅ Calendar events auto-created on booking confirmation
- ✅ Event ID stored in booking metadata
- ✅ Non-fatal failure mode (booking succeeds even if calendar fails)
- ✅ Comprehensive test coverage

---

## 📋 PHASE 2: Event Deletion (Priority 2)

### Goal

Delete calendar events when bookings are refunded or cancelled.

### Step 2.1: Add Event Deletion Method (1 hour)

**File**: `server/src/adapters/gcal.adapter.ts`

**Add after createEvent() method:**

```typescript
/**
 * Delete a calendar event
 * @param eventId Google Calendar event ID
 */
async deleteEvent(eventId: string): Promise<void> {
  // Get access token
  const accessToken = await createGServiceAccountJWT(
    this.serviceAccountJson,
    ['https://www.googleapis.com/auth/calendar.events']
  );

  // Delete event via Google Calendar API
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    // 404 is acceptable (event already deleted)
    if (response.status === 404) {
      logger.warn({ eventId }, 'Calendar event already deleted or not found');
      return;
    }

    const errorText = await response.text();
    logger.error({
      status: response.status,
      error: errorText,
      eventId
    }, 'Failed to delete calendar event');
    throw new Error(`Calendar event deletion failed: ${response.status}`);
  }

  logger.info({ eventId }, 'Calendar event deleted successfully');
}
```

---

### Step 2.2: Update Interface (15 min)

**File**: `server/src/lib/ports.ts`

**Add to CalendarProvider:**

```typescript
export interface CalendarProvider {
  isDateAvailable(date: string): Promise<boolean>;
  createEvent(event: { ... }): Promise<string>;
  deleteEvent(eventId: string): Promise<void>; // ADD THIS
}
```

---

### Step 2.3: Update Mock Provider (15 min)

**File**: `server/src/adapters/mock/index.ts`

```typescript
async deleteEvent(eventId: string): Promise<void> {
  console.log('📅 [MOCK CALENDAR] Event deleted:', eventId);
  // Could track deleted events if needed for testing
}
```

---

### Step 2.4: Integrate with Refund Flow (2 hours)

**Prerequisites**: RefundService must exist (from earlier implementation plan).

**File**: `server/src/services/refund.service.ts`

**In the refund method (after Stripe refund succeeds):**

```typescript
// After successful refund processing
try {
  // Get calendar event ID from booking metadata
  const calendarEventId = booking.metadata?.calendarEventId;

  if (calendarEventId) {
    await this.calendarProvider.deleteEvent(calendarEventId);

    logger.info(
      {
        bookingId: booking.id,
        calendarEventId,
      },
      'Calendar event deleted for refunded booking'
    );
  } else {
    logger.warn(
      {
        bookingId: booking.id,
      },
      'No calendar event ID found for refunded booking'
    );
  }
} catch (error) {
  // Don't fail refund if calendar deletion fails
  logger.error(
    {
      error,
      bookingId: booking.id,
    },
    'Failed to delete calendar event (non-fatal)'
  );
}
```

---

### Step 2.5: Testing Phase 2 (1 hour)

**Test Cases:**

```typescript
// Unit test
it('should delete calendar event by ID', async () => {
  const eventId = await adapter.createEvent({ ... });
  await adapter.deleteEvent(eventId);

  // Verify event no longer exists (or just verify no error)
});

// Integration test
it('should delete calendar event on booking refund', async () => {
  const booking = await createConfirmedBooking();
  const eventId = booking.metadata.calendarEventId;

  await refundService.initiateRefund(booking.id);

  // Verify event deleted from calendar
  // (Could query calendar API or check logs)
});

// Error handling
it('should handle 404 gracefully when event already deleted', async () => {
  await adapter.deleteEvent('non-existent-id');
  // Should not throw error
});
```

---

### Phase 2 Completion Checklist

```
□ deleteEvent() method added to GoogleCalendarAdapter
□ CalendarProvider interface updated
□ MockCalendarProvider implements deleteEvent()
□ RefundService calls deleteEvent() on refund
□ 404 errors handled gracefully
□ Unit tests written and passing
□ Integration tests written and passing
□ Error handling verified
```

**Deliverables:**

- ✅ Calendar events auto-deleted on booking refund
- ✅ Graceful handling of already-deleted events
- ✅ Non-fatal failure mode

---

## 📋 PHASE 3: Event Updates (Priority 3)

### Goal

Update calendar events when booking details change (date reschedule, package change).

### Step 3.1: Add Event Update Method (2 hours)

**File**: `server/src/adapters/gcal.adapter.ts`

```typescript
/**
 * Update an existing calendar event
 * @param eventId Google Calendar event ID
 * @param updates Partial event updates
 */
async updateEvent(
  eventId: string,
  updates: Partial<{
    summary: string;
    description: string;
    location: string;
    start: string;
    end: string;
    attendees: string[];
  }>
): Promise<void> {
  const accessToken = await createGServiceAccountJWT(
    this.serviceAccountJson,
    ['https://www.googleapis.com/auth/calendar.events']
  );

  // Build update payload
  const updatePayload: any = {};

  if (updates.summary) updatePayload.summary = updates.summary;
  if (updates.description) updatePayload.description = updates.description;
  if (updates.location !== undefined) updatePayload.location = updates.location;

  if (updates.start) {
    updatePayload.start = {
      date: updates.start,
      timeZone: 'UTC',
    };
  }

  if (updates.end) {
    updatePayload.end = {
      date: updates.end,
      timeZone: 'UTC',
    };
  }

  if (updates.attendees) {
    updatePayload.attendees = updates.attendees.map(email => ({ email }));
  }

  // Patch event (partial update)
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({
      status: response.status,
      error: errorText,
      eventId
    }, 'Failed to update calendar event');
    throw new Error(`Calendar event update failed: ${response.status}`);
  }

  logger.info({ eventId, updates }, 'Calendar event updated successfully');
}
```

---

### Step 3.2: Integrate with Booking Updates (3 hours)

**File**: Create `server/src/services/booking-update.service.ts` (if doesn't exist)

```typescript
async updateBookingDate(
  bookingId: string,
  newEventDate: string
): Promise<void> {
  const booking = await this.bookingRepo.findById(bookingId);

  // Update booking in database
  await this.bookingRepo.update(bookingId, {
    eventDate: newEventDate,
  });

  // Update calendar event
  try {
    const calendarEventId = booking.metadata?.calendarEventId;

    if (calendarEventId) {
      await this.calendarProvider.updateEvent(calendarEventId, {
        start: newEventDate,
        end: newEventDate,
        description: `[UPDATED] Wedding date changed to ${newEventDate}`,
      });

      logger.info({ bookingId, newEventDate }, 'Calendar event date updated');
    }
  } catch (error) {
    logger.error({ error, bookingId }, 'Failed to update calendar event');
    // Continue - booking update succeeded
  }
}
```

---

### Phase 3 Completion Checklist

```
□ updateEvent() method added to GoogleCalendarAdapter
□ CalendarProvider interface updated
□ BookingUpdateService (or equivalent) calls updateEvent()
□ Unit tests written and passing
□ Integration tests written and passing
```

**Note**: Phase 3 is lower priority. Most bookings don't change after confirmation.

---

## 📋 PHASE 4: Testing & Polish (Priority 4)

### Comprehensive Test Suite

**Create**: `server/test/calendar-integration.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Google Calendar Integration (E2E)', () => {
  let createdEventIds: string[] = [];

  afterAll(async () => {
    // Cleanup: Delete all test events
    for (const eventId of createdEventIds) {
      await calendarAdapter.deleteEvent(eventId);
    }
  });

  it('should create, update, and delete calendar events', async () => {
    // Create
    const eventId = await calendarAdapter.createEvent({
      summary: 'E2E Test Wedding',
      description: 'Automated test',
      start: '2025-12-31',
      end: '2025-12-31',
    });
    createdEventIds.push(eventId);
    expect(eventId).toBeTruthy();

    // Update
    await calendarAdapter.updateEvent(eventId, {
      summary: 'Updated Test Wedding',
    });

    // Delete
    await calendarAdapter.deleteEvent(eventId);
    createdEventIds = createdEventIds.filter((id) => id !== eventId);
  });

  it('should handle booking lifecycle', async () => {
    // Create booking → Create event
    // Refund booking → Delete event
    // Verify end-to-end flow
  });
});
```

---

### Monitoring & Logging

**Add to**: `server/src/lib/core/logger.ts` (if structured logging exists)

```typescript
// Calendar-specific log events
export const CALENDAR_EVENTS = {
  EVENT_CREATED: 'calendar.event.created',
  EVENT_DELETED: 'calendar.event.deleted',
  EVENT_UPDATED: 'calendar.event.updated',
  EVENT_FAILED: 'calendar.event.failed',
};
```

**Usage in adapter:**

```typescript
logger.info(
  {
    event: CALENDAR_EVENTS.EVENT_CREATED,
    eventId,
    bookingId,
    summary,
  },
  'Calendar event created'
);
```

---

### Error Monitoring

**Add Sentry tags for calendar errors:**

```typescript
// In error catch blocks
Sentry.withScope((scope) => {
  scope.setTag('component', 'google-calendar');
  scope.setTag('operation', 'create-event');
  scope.setContext('event', {
    summary,
    date: start,
    bookingId,
  });
  Sentry.captureException(error);
});
```

---

## 🚀 Deployment Checklist

### Pre-Production

```bash
# 1. Verify environment variables
npm run doctor

# Expected output:
# ✅ Google Calendar configured
# ✅ GOOGLE_CALENDAR_ID set
# ✅ GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 set

# 2. Run all tests
npm test

# 3. Test in staging environment
# - Create test booking
# - Verify event appears in calendar
# - Refund booking
# - Verify event deleted from calendar

# 4. Check logs for any errors
grep "calendar" logs/app.log | grep "error"
```

### Production Deployment

```bash
# 1. Update environment variables in production
#    (Use same service account as staging)

# 2. Deploy code
git push production main

# 3. Monitor for 24 hours
# - Check error rates in Sentry
# - Verify calendar events being created
# - Check customer feedback

# 4. Rollback plan if needed
git revert <commit-hash>
git push production main --force
```

---

## 📚 Troubleshooting Guide

### Issue: "Failed to create calendar event: 403"

**Cause**: Calendar not shared with service account.

**Fix**:

1. Open Google Calendar
2. Settings → Share calendar
3. Add service account email (from service-account.json)
4. Grant "Make changes to events" permission

---

### Issue: "Invalid JWT signature"

**Cause**: Corrupted or incorrect service account JSON.

**Fix**:

```bash
# Re-encode service account JSON
cat service-account.json | base64 | tr -d '\n'

# Update .env
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<new-base64>
```

---

### Issue: Events not appearing in calendar

**Cause**: Using wrong calendar ID.

**Fix**:

1. Get calendar ID from Google Calendar settings
2. Usually your Gmail address: `you@gmail.com`
3. Or custom calendar ID: `abc123@group.calendar.google.com`
4. Update `.env`:

```bash
GOOGLE_CALENDAR_ID=correct-calendar@gmail.com
```

---

### Issue: Rate limit errors (429)

**Cause**: Too many API calls.

**Fix**:

- Current cache: 60 seconds for availability checks
- Consider increasing to 5 minutes
- Implement retry with exponential backoff
- Use batch API for multiple operations

---

## 📊 Success Metrics

Track these KPIs after implementation:

```
✅ Calendar event creation success rate: >99%
✅ Calendar event deletion success rate: >99%
✅ Average API response time: <500ms
✅ Error rate: <1%
✅ Customer satisfaction: Survey feedback on calendar sync
```

---

## 🎯 Future Enhancements (Phase 5+)

### Per-Tenant Calendars

- Store `googleCalendarId` in Tenant model
- Each wedding vendor gets their own calendar
- Requires database migration

### OAuth2 User Flow

- Allow couples to sync to their personal calendars
- Requires OAuth2 consent screen setup
- Token storage and refresh

### Multi-Calendar Support

- Support multiple calendars per tenant
- Example: Different calendars for different package types

### Advanced Features

- Recurring events (for multi-day weddings)
- Time zone support beyond UTC
- Buffer time between bookings
- Working hours constraints

---

## 📝 Resources

### Google Calendar API Documentation

- Events API: https://developers.google.com/calendar/api/v3/reference/events
- Service Accounts: https://developers.google.com/identity/protocols/oauth2/service-account
- Error Codes: https://developers.google.com/calendar/api/guides/errors

### Internal Documentation

- `server/ENV_VARIABLES.md` (lines 218-258) - Setup guide
- `server/src/adapters/gcal.adapter.ts` - Current implementation
- `server/test/availability.service.spec.ts` - Test examples

---

## ✅ Final Checklist

**Before marking Phase 1 complete:**

```
□ All code changes committed and pushed
□ Tests written and passing (>80% coverage)
□ Documentation updated
□ Staging environment tested
□ Production deployment successful
□ Monitoring alerts configured
□ Team trained on new features
□ Customer communication sent (if needed)
```

**Estimated Total Time**: 22 hours (3 days)

**Priority Order**:

1. Phase 1 (Event Creation) - **MUST HAVE**
2. Phase 2 (Event Deletion) - **SHOULD HAVE**
3. Phase 3 (Event Updates) - **NICE TO HAVE**
4. Phase 4 (Testing/Polish) - **MUST HAVE**

---

## 🎉 Success!

Once all phases are complete, your platform will:

- ✅ Automatically create calendar events when bookings are confirmed
- ✅ Automatically delete calendar events when bookings are refunded
- ✅ Keep customer calendars in sync with booking status
- ✅ Reduce manual calendar management for wedding vendors
- ✅ Improve customer experience with automatic reminders

**Next Steps After Completion:**

1. Monitor production for 1 week
2. Gather customer feedback
3. Plan Phase 5 enhancements based on usage patterns

---

_End of Implementation Plan_
