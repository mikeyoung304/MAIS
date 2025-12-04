# MVP Gaps Phased Implementation Plan (Simplified)

## Executive Summary

This is the **simplified implementation plan** for MVP gaps, reduced from 29 days to **~10 days** based on reviewer feedback. The plan prioritizes reusing existing infrastructure over building new abstractions.

**Total Effort:** ~10 working days
**Team Size:** 1 engineer
**New Database Models:** 0 (fields added to existing models)
**New Dependencies:** 0

---

## Key Decisions

| Decision            | Choice              | Rationale                                                 |
| ------------------- | ------------------- | --------------------------------------------------------- |
| Invoicing           | **CUT**             | Stripe receipts sufficient. Build when customers request. |
| Token System        | **JWT signed URLs** | Reuse existing infrastructure (see ADR below)             |
| Reminders           | **Lazy evaluation** | "Within 24 hours" acceptable for MVP                      |
| Per-Tenant Calendar | **KEEP**            | Tenants need their own calendar integration               |
| Deposits            | **SIMPLIFIED**      | Add `depositPercent` to Tenant, not policy model          |

---

## ADR: JWT vs Database Tokens for Booking Actions

**Status:** Accepted (with revisit note)

**Context:**
Customers need secure links to reschedule/cancel bookings without logging in. Two approaches were considered:

**Option A: JWT Signed URLs (Chosen)**

```typescript
const token = jwt.sign(
  {
    bookingId: booking.id,
    action: 'manage',
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  },
  config.JWT_SECRET
);

const manageUrl = `${baseUrl}/bookings/${booking.id}/manage?token=${token}`;
```

**Option B: Database Tokens (Deferred)**

```prisma
model BookingActionToken {
  id        String   @id
  token     String   @unique  // HMAC-SHA256 hash
  bookingId String
  action    String
  expiresAt DateTime
  usedAt    DateTime?
  // ... more fields
}
```

**Decision:** Use JWT signed URLs for MVP.

**Pros:**

- ✅ Zero new database tables
- ✅ Stateless (no DB hit to validate)
- ✅ Reuses existing JWT infrastructure
- ✅ Already has expiry built-in
- ✅ 100 lines vs 400+ lines

**Cons:**

- ⚠️ Cannot revoke individual tokens (only by rotating JWT_SECRET)
- ⚠️ No audit trail of token usage
- ⚠️ Token replay possible until expiry

**Revisit When:**

- If we need to revoke specific booking tokens
- If we need audit trail of who accessed manage links
- If security audit requires single-use enforcement
- If we add sensitive actions beyond reschedule/cancel

**Mitigation:**

- Short expiry (7 days)
- Include booking status check on validation (canceled bookings reject tokens)
- Log all token validations for forensics

---

## Gap Summary (Simplified)

| Gap                 | Approach                          | Effort     |
| ------------------- | --------------------------------- | ---------- |
| Reschedule/Cancel   | JWT tokens + existing patterns    | 3-4 days   |
| Reminders           | Lazy evaluation on dashboard load | 1-2 days   |
| Per-Tenant Calendar | Store config in Tenant.secrets    | 2-3 days   |
| Deposits            | Simple `depositPercent` on Tenant | 2 days     |
| ~~Invoicing~~       | ~~CUT - defer to v2~~             | ~~0 days~~ |

**Total: ~10 days**

---

## Phase 1: Self-Service Actions (Days 1-4)

**Goal:** Let customers reschedule and cancel bookings via email links.

### Schema Changes

Add fields to existing `Booking` model:

```prisma
model Booking {
  // ... existing fields ...

  // Cancellation tracking (no separate table)
  cancelledAt       DateTime?
  cancelledBy       CancelledBy?
  cancellationReason String?

  // Refund tracking
  refundStatus      RefundStatus @default(NONE)
  refundAmount      Int?
  refundedAt        DateTime?
  stripeRefundId    String?

  // Reminder tracking
  reminderSentAt    DateTime?
  reminderDueDate   DateTime?
}

enum CancelledBy {
  CUSTOMER
  TENANT
  ADMIN
  SYSTEM
}

enum RefundStatus {
  NONE
  PENDING
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
}
```

### JWT Token Utility

Create `server/src/lib/booking-tokens.ts`:

```typescript
import jwt from 'jsonwebtoken';
import { config } from './core/config';

interface BookingTokenPayload {
  bookingId: string;
  tenantId: string;
  action: 'manage' | 'reschedule' | 'cancel' | 'pay_balance';
}

export function generateBookingToken(
  bookingId: string,
  tenantId: string,
  action: BookingTokenPayload['action'],
  expiresInDays: number = 7
): string {
  return jwt.sign({ bookingId, tenantId, action }, config.JWT_SECRET, {
    expiresIn: `${expiresInDays}d`,
  });
}

export function validateBookingToken(
  token: string,
  expectedAction?: BookingTokenPayload['action']
): BookingTokenPayload {
  const payload = jwt.verify(token, config.JWT_SECRET) as BookingTokenPayload;

  if (expectedAction && payload.action !== expectedAction) {
    throw new Error(`Invalid token action: expected ${expectedAction}, got ${payload.action}`);
  }

  return payload;
}

export function generateManageBookingUrl(
  bookingId: string,
  tenantId: string,
  baseUrl: string = process.env.CLIENT_URL || 'http://localhost:5173'
): string {
  const token = generateBookingToken(bookingId, tenantId, 'manage');
  return `${baseUrl}/bookings/manage?token=${token}`;
}
```

### Reschedule Service

Extend existing `BookingService` (don't create new service):

```typescript
// In server/src/services/booking.service.ts

async rescheduleBooking(
  tenantId: string,
  bookingId: string,
  newDate: string
): Promise<Booking> {
  return this.prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, tenantId }
    });

    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.status === 'CANCELED') throw new ValidationError('Cannot reschedule canceled booking');

    // Lock new date using existing ADR-006 pattern
    const lockId = hashTenantDate(tenantId, newDate);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    // Check availability
    const conflict = await tx.booking.findFirst({
      where: {
        tenantId,
        eventDate: newDate,
        status: { notIn: ['CANCELED'] }
      }
    });
    if (conflict) throw new BookingConflictError(newDate);

    // Update booking
    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: { eventDate: newDate }
    });

    return updated;
  });
}

async cancelBooking(
  tenantId: string,
  bookingId: string,
  cancelledBy: CancelledBy,
  reason?: string
): Promise<Booking> {
  // Phase 1: Mark canceled (always succeeds)
  const booking = await this.bookingRepo.update(tenantId, bookingId, {
    status: 'CANCELED',
    cancelledAt: new Date(),
    cancelledBy,
    cancellationReason: reason,
    refundStatus: 'PENDING'
  });

  // Phase 2: Calculate refund amount
  const refundAmount = await this.calculateRefundAmount(tenantId, bookingId);

  // Phase 3: Queue async refund (fire and forget)
  this.eventEmitter.emit('RefundRequested', {
    tenantId,
    bookingId,
    refundAmount
  });

  // Side effects (non-blocking)
  this.cancelReminders(tenantId, bookingId).catch(err =>
    logger.error({ err, bookingId }, 'Failed to cancel reminders')
  );

  this.deleteCalendarEvent(tenantId, bookingId).catch(err =>
    logger.error({ err, bookingId }, 'Failed to delete calendar event')
  );

  return booking;
}

private async calculateRefundAmount(tenantId: string, bookingId: string): Promise<number> {
  const booking = await this.bookingRepo.findById(tenantId, bookingId);
  const tenant = await this.tenantRepo.findById(tenantId);

  // If deposit is non-refundable, only refund balance
  if (tenant.depositPercent && booking.depositPaidAmount) {
    return booking.balancePaidAmount || 0;
  }

  // Full refund
  return booking.totalAmount;
}
```

### Public Routes

Create `server/src/routes/public-booking-management.routes.ts`:

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const publicBookingManagementContract = c.router({
  getBookingForManagement: {
    method: 'GET',
    path: '/v1/public/bookings/manage',
    query: z.object({
      token: z.string(),
    }),
    responses: {
      200: BookingManagementSchema,
      401: ErrorSchema,
      404: ErrorSchema,
    },
  },

  getAvailableDates: {
    method: 'GET',
    path: '/v1/public/bookings/:id/available-dates',
    query: z.object({
      token: z.string(),
      month: z.string().optional(), // YYYY-MM format
    }),
    responses: {
      200: z.array(z.string()),
      401: ErrorSchema,
    },
  },

  rescheduleBooking: {
    method: 'POST',
    path: '/v1/public/bookings/:id/reschedule',
    body: z.object({
      token: z.string(),
      newDate: z.string(), // YYYY-MM-DD
    }),
    responses: {
      200: BookingSchema,
      400: ErrorSchema,
      401: ErrorSchema,
      409: ErrorSchema,
    },
  },

  cancelBooking: {
    method: 'POST',
    path: '/v1/public/bookings/:id/cancel',
    body: z.object({
      token: z.string(),
      reason: z.string().optional(),
    }),
    responses: {
      200: BookingSchema,
      401: ErrorSchema,
    },
  },
});
```

### Client Pages

**`client/src/pages/ManageBooking.tsx`**

- Validates token from URL
- Shows booking details
- Provides reschedule/cancel buttons

**`client/src/features/booking/RescheduleFlow.tsx`**

- Date picker showing available dates
- Confirmation step
- Success/error handling

**`client/src/features/booking/CancelFlow.tsx`**

- Confirmation dialog
- Optional reason input
- Refund information display

### Acceptance Criteria

- [ ] JWT token generation utility created
- [ ] Booking model extended with cancellation/refund fields
- [ ] Reschedule with advisory locks working
- [ ] Cancel with 3-phase pattern working
- [ ] Refund processing via existing Stripe adapter
- [ ] Public routes created and tested
- [ ] React UI components working
- [ ] E2E tests for reschedule + cancel flows

---

## Phase 2: Lazy Reminders (Days 5-6)

**Goal:** Send booking reminders without cron complexity.

### Schema Changes

Fields already added to Booking in Phase 1:

```prisma
reminderSentAt    DateTime?
reminderDueDate   DateTime?  // Calculated: eventDate - 7 days
```

### Implementation

**On booking confirmation, calculate reminder date:**

```typescript
// In BookingService.onPaymentCompleted()
const reminderDueDate = new Date(booking.eventDate);
reminderDueDate.setDate(reminderDueDate.getDate() - 7);

await this.bookingRepo.update(tenantId, booking.id, {
  reminderDueDate: reminderDueDate > new Date() ? reminderDueDate : null,
});
```

**Lazy evaluation on dashboard load:**

```typescript
// In tenant-admin dashboard API
async getDashboardData(tenantId: string) {
  // Check for overdue reminders
  const overdueReminders = await this.prisma.booking.findMany({
    where: {
      tenantId,
      status: 'CONFIRMED',
      reminderSentAt: null,
      reminderDueDate: { lte: new Date() }
    },
    take: 10 // Process in batches
  });

  // Send reminders inline (non-blocking)
  for (const booking of overdueReminders) {
    this.sendReminderEmail(booking).catch(err =>
      logger.error({ err, bookingId: booking.id }, 'Failed to send reminder')
    );
  }

  // Return dashboard data...
}

private async sendReminderEmail(booking: Booking) {
  const manageUrl = generateManageBookingUrl(booking.id, booking.tenantId);

  await this.mailProvider.sendEmail({
    to: booking.email,
    subject: `Reminder: Your booking on ${formatDate(booking.eventDate)}`,
    html: this.renderReminderTemplate({
      booking,
      manageUrl,
      daysUntil: differenceInDays(booking.eventDate, new Date())
    })
  });

  await this.bookingRepo.update(booking.tenantId, booking.id, {
    reminderSentAt: new Date()
  });
}
```

**Add reminder template to Postmark adapter:**

```typescript
// In postmark.adapter.ts
async sendBookingReminder(
  to: string,
  payload: {
    coupleName: string;
    eventDate: string;
    packageTitle: string;
    manageUrl: string;
    daysUntil: number;
  }
): Promise<void> {
  const subject = `Reminder: Your ${payload.packageTitle} is in ${payload.daysUntil} days`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${payload.coupleName}!</h2>
      <p>This is a friendly reminder that your <strong>${payload.packageTitle}</strong>
         is coming up on <strong>${payload.eventDate}</strong>.</p>
      <p>Need to make changes? You can manage your booking here:</p>
      <p><a href="${payload.manageUrl}" style="...">Manage Booking</a></p>
    </body>
    </html>
  `;

  await this.sendEmail({ to, subject, html: htmlBody });
}
```

### Acceptance Criteria

- [ ] Reminder due date calculated on booking confirmation
- [ ] Reminders sent within 24 hours of due date
- [ ] Reminder email includes manage booking link
- [ ] Reminders not re-sent (check `reminderSentAt`)
- [ ] Dashboard shows pending/sent reminders

---

## Phase 3: Per-Tenant Calendar (Days 7-9)

**Goal:** Each tenant uses their own Google Calendar.

### Schema Changes

Reuse existing `Tenant.secrets` JSON field:

```typescript
// Structure within Tenant.secrets JSON:
{
  "stripe": { "ciphertext": "...", "iv": "...", "authTag": "..." },
  "googleCalendar": {
    "ciphertext": "...",  // Encrypted: { calendarId, serviceAccountJson }
    "iv": "...",
    "authTag": "..."
  }
}
```

### Modified Calendar Adapter

```typescript
// In google-calendar-sync.adapter.ts

export class GoogleCalendarSyncAdapter {
  constructor(
    private readonly globalConfig: GoogleCalendarConfig,
    private readonly tenantRepo: TenantRepository,
    private readonly encryptionService: EncryptionService
  ) {}

  async createEvent(input: CreateEventInput): Promise<{ eventId: string } | null> {
    const config = await this.getConfigForTenant(input.tenantId);

    if (!config) {
      logger.warn({ tenantId: input.tenantId }, 'No calendar config, skipping sync');
      return null;
    }

    // Use tenant-specific or global config
    const accessToken = await this.getAccessToken(config);

    // ... rest of existing implementation
  }

  private async getConfigForTenant(tenantId: string): Promise<GoogleCalendarConfig | null> {
    const tenant = await this.tenantRepo.findById(tenantId);

    if (tenant.secrets?.googleCalendar) {
      // Decrypt tenant-specific config
      const decrypted = await this.encryptionService.decrypt(tenant.secrets.googleCalendar);
      return JSON.parse(decrypted);
    }

    // Fall back to global config
    if (this.globalConfig.calendarId) {
      return this.globalConfig;
    }

    return null;
  }

  async deleteEvent(tenantId: string, eventId: string): Promise<void> {
    const config = await this.getConfigForTenant(tenantId);
    if (!config) return;

    const accessToken = await this.getAccessToken(config);

    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${config.calendarId}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  }

  async updateEvent(tenantId: string, eventId: string, newDate: Date): Promise<void> {
    const config = await this.getConfigForTenant(tenantId);
    if (!config) return;

    const accessToken = await this.getAccessToken(config);

    // Get existing event
    const eventResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${config.calendarId}/events/${eventId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const event = await eventResp.json();

    // Update dates
    const duration =
      new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime();
    event.start.dateTime = newDate.toISOString();
    event.end.dateTime = new Date(newDate.getTime() + duration).toISOString();

    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${config.calendarId}/events/${eventId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );
  }
}
```

### Tenant Admin Routes

Add to existing tenant-admin routes:

```typescript
// GET /v1/tenant-admin/calendar/status
// Returns: { configured: boolean, calendarId?: string }

// POST /v1/tenant-admin/calendar/config
// Body: { calendarId: string, serviceAccountJson: string }
// Encrypts and stores in Tenant.secrets

// DELETE /v1/tenant-admin/calendar/config
// Removes calendar config from Tenant.secrets
```

### Admin UI

**`client/src/features/tenant-admin/CalendarConfigCard.tsx`**

- Shows current configuration status
- File upload for service account JSON
- Calendar ID input
- Test connection button

### Acceptance Criteria

- [ ] Store encrypted calendar config in Tenant.secrets
- [ ] Calendar adapter loads tenant-specific config
- [ ] Falls back to global config if tenant not configured
- [ ] Delete event works on cancellation
- [ ] Update event works on reschedule
- [ ] Admin UI for calendar configuration
- [ ] Test connection endpoint

---

## Phase 4: Simplified Deposits (Days 9-10)

**Goal:** Support partial deposits without complex policy engine.

### Schema Changes

Add to `Tenant` model:

```prisma
model Tenant {
  // ... existing fields ...

  depositPercent    Decimal?  @db.Decimal(5, 2)  // null = full payment required
  balanceDueDays    Int       @default(30)       // Days before event
}
```

Add to `Booking` model:

```prisma
model Booking {
  // ... existing fields ...

  depositPaidAmount  Int?      // Cents paid as deposit
  balanceDueDate     DateTime?
  balancePaidAmount  Int?      // Cents paid as balance
  balancePaidAt      DateTime?
}
```

### Modified Checkout Flow

```typescript
// In BookingService.createCheckout()

async createCheckout(tenantId: string, input: CreateBookingInput) {
  const tenant = await this.tenantRepo.findById(tenantId);
  const totalAmount = await this.calculateTotal(tenantId, input);

  let checkoutAmount = totalAmount;
  let isDepositOnly = false;

  // Calculate deposit if configured
  if (tenant.depositPercent) {
    const depositPercent = Number(tenant.depositPercent);
    checkoutAmount = Math.floor(totalAmount * (depositPercent / 100));
    isDepositOnly = true;
  }

  const session = await this.paymentProvider.createCheckoutSession({
    amountCents: checkoutAmount,
    email: input.email,
    metadata: {
      tenantId,
      packageId: input.packageId,
      eventDate: input.eventDate,
      isDeposit: isDepositOnly ? 'true' : 'false',
      totalAmount: String(totalAmount)
    }
  });

  return { checkoutUrl: session.url };
}

async onPaymentCompleted(tenantId: string, session: StripeSession) {
  const isDeposit = session.metadata.isDeposit === 'true';
  const totalAmount = parseInt(session.metadata.totalAmount);

  const tenant = await this.tenantRepo.findById(tenantId);

  let bookingData: Partial<Booking> = {
    status: isDeposit ? 'DEPOSIT_PAID' : 'CONFIRMED',
    totalAmount
  };

  if (isDeposit) {
    const eventDate = new Date(session.metadata.eventDate);
    const balanceDueDate = new Date(eventDate);
    balanceDueDate.setDate(balanceDueDate.getDate() - tenant.balanceDueDays);

    bookingData = {
      ...bookingData,
      depositPaidAmount: session.amount_total,
      balanceDueDate,
      balancePaidAmount: null
    };
  }

  // Create or update booking...
}
```

### Balance Payment

```typescript
// Public route: POST /v1/public/bookings/:id/pay-balance
async createBalanceCheckout(tenantId: string, bookingId: string, token: string) {
  // Validate JWT token
  const payload = validateBookingToken(token, 'pay_balance');
  if (payload.bookingId !== bookingId) throw new ValidationError('Token mismatch');

  const booking = await this.bookingRepo.findById(tenantId, bookingId);

  if (booking.status !== 'DEPOSIT_PAID') {
    throw new ValidationError('Booking does not require balance payment');
  }

  const balanceAmount = booking.totalAmount - (booking.depositPaidAmount || 0);

  const session = await this.paymentProvider.createCheckoutSession({
    amountCents: balanceAmount,
    email: booking.email,
    metadata: {
      tenantId,
      bookingId,
      isBalance: 'true'
    }
  });

  return { checkoutUrl: session.url };
}
```

### Acceptance Criteria

- [ ] Tenant can set deposit percentage
- [ ] Checkout creates deposit-only payment when configured
- [ ] Balance due date calculated correctly
- [ ] Balance payment link works
- [ ] Booking status transitions: DEPOSIT_PAID → CONFIRMED
- [ ] Confirmation email shows deposit vs full payment info

---

## Migration Summary

**Single migration file:** `20251202_add_booking_management_fields.sql`

```sql
-- Add cancellation fields to Booking
ALTER TABLE "Booking" ADD COLUMN "cancelledAt" TIMESTAMP;
ALTER TABLE "Booking" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "Booking" ADD COLUMN "cancellationReason" TEXT;

-- Add refund fields to Booking
ALTER TABLE "Booking" ADD COLUMN "refundStatus" TEXT DEFAULT 'NONE';
ALTER TABLE "Booking" ADD COLUMN "refundAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "refundedAt" TIMESTAMP;
ALTER TABLE "Booking" ADD COLUMN "stripeRefundId" TEXT;

-- Add reminder fields to Booking
ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TIMESTAMP;
ALTER TABLE "Booking" ADD COLUMN "reminderDueDate" TIMESTAMP;

-- Add deposit fields to Booking
ALTER TABLE "Booking" ADD COLUMN "depositPaidAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "balanceDueDate" TIMESTAMP;
ALTER TABLE "Booking" ADD COLUMN "balancePaidAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "balancePaidAt" TIMESTAMP;

-- Add deposit settings to Tenant
ALTER TABLE "Tenant" ADD COLUMN "depositPercent" DECIMAL(5,2);
ALTER TABLE "Tenant" ADD COLUMN "balanceDueDays" INTEGER DEFAULT 30;

-- Create enums
DO $$ BEGIN
  CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'TENANT', 'ADMIN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Indexes for reminder queries
CREATE INDEX IF NOT EXISTS "idx_booking_reminder_due"
ON "Booking" ("tenantId", "reminderDueDate")
WHERE "reminderSentAt" IS NULL AND "status" = 'CONFIRMED';

-- Indexes for balance due queries
CREATE INDEX IF NOT EXISTS "idx_booking_balance_due"
ON "Booking" ("tenantId", "balanceDueDate")
WHERE "status" = 'DEPOSIT_PAID';
```

---

## Deliverables Summary

| Phase       | Days         | Deliverables                                                   |
| ----------- | ------------ | -------------------------------------------------------------- |
| **Phase 1** | 3-4          | JWT tokens, reschedule/cancel, refund, public routes, React UI |
| **Phase 2** | 1-2          | Lazy reminders, email template, dashboard integration          |
| **Phase 3** | 2-3          | Per-tenant calendar config, admin UI                           |
| **Phase 4** | 2            | Simple deposits, balance payment                               |
| **Total**   | **~10 days** |                                                                |

---

## What We Cut (Deferred to v2)

| Feature                    | Original Effort | Reason for Cut                    |
| -------------------------- | --------------- | --------------------------------- |
| Invoicing                  | 7 days          | Stripe receipts sufficient        |
| BookingActionToken model   | 2-3 days        | JWT signed URLs simpler           |
| BookingReminder model      | 2-3 days        | Lazy evaluation sufficient        |
| DepositPolicy model        | 2-3 days        | Simple tenant settings sufficient |
| BookingCancellation model  | 1-2 days        | Fields on Booking sufficient      |
| node-cron / Bull queue     | 1-2 days        | Lazy evaluation sufficient        |
| Puppeteer / PDF generation | 2-3 days        | Cut with invoicing                |

**Total Savings:** ~18-20 days

---

## Success Metrics

| Metric                       | Target            | Measurement                          |
| ---------------------------- | ----------------- | ------------------------------------ |
| Self-service reschedule rate | >50%              | `cancelledBy` = CUSTOMER             |
| Reminder delivery            | >90% within 24hrs | `reminderSentAt` - `reminderDueDate` |
| Calendar sync success        | >95%              | Track in logs                        |
| Balance collection           | >80% before due   | `balancePaidAt` vs `balanceDueDate`  |

---

## Next Steps

1. Create migration file
2. Implement JWT token utility
3. Extend BookingService with reschedule/cancel
4. Build public routes
5. Build React UI components
6. Add lazy reminder logic
7. Extend calendar adapter for per-tenant
8. Add deposit calculation to checkout

---

_Simplified from 29 days → 10 days based on DHH, Technical, and Simplicity reviews_

_Generated with [Claude Code](https://claude.ai/code)_
