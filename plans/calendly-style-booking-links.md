# Feature Plan: Premium Booking Links (Better Than Calendly)

> **Created:** 2025-01-05
> **Status:** Phase 0 MERGED TO MAIN - Ready for Phase 1
> **Timeline:** 6-8 weeks
> **Goal:** Not feature parity with Calendly - **exceed it**
> **Branch:** `booking-links`
> **Last Updated:** 2026-01-05

---

## Executive Summary

Add shareable booking links to MAIS that are **better than Calendly** in three key ways:

1. **AI-Powered Creation** - "Create me a 15-min Zoom link" via chatbot → shareable URL
2. **Premium Dark UI** - Graphite + sage aesthetic that makes Calendly look sterile
3. **Session Space** - Booking isn't a dead-end; it's the start of a relationship

Example URL: `gethandled.ai/t/jane-photography/book/consultation`

---

## Why This Will Beat Calendly

| Calendly Pain              | MAIS Solution                                                  |
| -------------------------- | -------------------------------------------------------------- |
| Timezone confusion         | Smart Timezone Card showing "9am YOUR time (12pm Jane's time)" |
| Ugly white embeds          | Dark theme matching tenant storefront                          |
| Generic confirmation       | Session Space with chat, prep checklist, "what's next"         |
| Form-fill only             | AI chatbot can book for visitors naturally                     |
| Desktop-first mobile       | Bottom sheet calendar with swipe gestures                      |
| Plain text emails          | Beautiful branded templates with one-click calendar add        |
| Eventually consistent sync | Real-time FreeBusy + advisory locks (we have this!)            |

---

## Phase 0: Agent-Native Integration (2 days) ✅ COMPLETE

> **Core Requirement:** User says "Create me a scheduling link for a 15 minute zoom call, no fee" → gets shareable URL
>
> **Status:** ✅ MERGED TO MAIN (commits `1bd733c9` → `0306c399`) - All P1 fixes applied, P3 optimizations complete

### Implementation Status

| Deliverable                                | Status      | Commit     |
| ------------------------------------------ | ----------- | ---------- |
| Zod schemas (`booking-link.schema.ts`)     | ✅ Complete | `1bd733c9` |
| Agent tools (`booking-link-tools.ts`)      | ✅ Complete | `1bd733c9` |
| T2 executors (`booking-link-executors.ts`) | ✅ Complete | `1bd733c9` |
| Unit tests (20 pass, 1 skip)               | ✅ Complete | `1bd733c9` |
| Code review (5 agents)                     | ✅ Complete | -          |
| Triage (3 reviewers voted)                 | ✅ Complete | -          |

### P1 Fixes Required (MUST FIX NOW)

| Todo | Issue                                             | Status                    |
| ---- | ------------------------------------------------- | ------------------------- |
| 617  | Missing `tenantId` in delete/update where clauses | `todos/617-ready-p1-*.md` |
| 618  | Missing from REQUIRED_EXECUTOR_TOOLS              | `todos/618-ready-p1-*.md` |
| 619  | Duplicate `getTenantInfo` function (DRY)          | `todos/619-ready-p1-*.md` |
| 620  | TOCTOU race condition on delete                   | `todos/620-ready-p1-*.md` |

### Phase 1 Fixes (Before Production)

| Todo | Issue                         | Status                      |
| ---- | ----------------------------- | --------------------------- |
| 621  | Schema fields not in database | `todos/621-pending-p3-*.md` |
| 622  | Hardcoded timezone default    | `todos/622-pending-p3-*.md` |
| 624  | Date range validation missing | `todos/624-pending-p3-*.md` |

### Next Steps

```bash
# Fix P1 issues
/resolve_todo_parallel

# Then commit
git add . && git commit -m "fix(agent): address P1 code review findings"
```

### New Agent Tools

```typescript
// server/src/agent/tools/booking-link-tools.ts

export const manageBookableServiceTool: AgentTool = {
  name: 'manage_bookable_service',
  trustTier: 'T2',
  description: `Create, update, or delete bookable services (scheduling links).

Use when tenant asks to:
- Create a booking link for calls/meetings
- Add a new appointment type
- Update scheduling settings
- Disable or delete a service

Parameters:
- operation: "create" | "update" | "delete"
- name: Display name (e.g., "15-Minute Intro Call")
- durationMinutes: 15, 30, 45, 60, 90, etc.
- priceCents: 0 for free, or price in cents
- bufferMinutes: Rest time between appointments
- minNoticeMinutes: How much advance notice (default 120 = 2 hours)
- maxAdvanceDays: How far ahead can book (default 60)

Returns the shareable booking URL on success.`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'update', 'delete'] },
      serviceId: { type: 'string', description: 'For update/delete' },
      name: { type: 'string' },
      durationMinutes: { type: 'number' },
      priceCents: { type: 'number' },
      bufferMinutes: { type: 'number' },
      minNoticeMinutes: { type: 'number' },
      maxAdvanceDays: { type: 'number' },
      description: { type: 'string' },
    },
    required: ['operation'],
  },
};

export const listBookableServicesTool: AgentTool = {
  name: 'list_bookable_services',
  trustTier: 'T1',
  description: `List all booking links for this tenant with their shareable URLs.`,
  inputSchema: {
    type: 'object',
    properties: {
      includeInactive: { type: 'boolean' },
    },
  },
};

export const manageWorkingHoursTool: AgentTool = {
  name: 'manage_working_hours',
  trustTier: 'T2',
  description: `Set business hours for when appointments can be booked.
Days: 0=Sunday, 6=Saturday. Times: 24-hour format.`,
  // ...
};

export const manageDateOverridesTool: AgentTool = {
  name: 'manage_date_overrides',
  trustTier: 'T2',
  description: `Block specific dates or set special hours (vacation, holidays).`,
  // ...
};
```

### System Prompt Context Injection

```markdown
## Scheduling & Booking Links

You can help tenants create and manage booking links - shareable URLs where clients book appointments directly.

### Current Services

{BOOKING_SERVICES_CONTEXT}

### Booking Link URL Pattern

- Default: https://gethandled.ai/t/{tenant-slug}/book/{service-slug}
- Custom domain: https://{custom-domain}/book/{service-slug}

### Common Patterns

- Free intro call: 15-30min, $0, 1hr notice
- Paid consultation: 60min, tenant's rate, 15min buffer
- Quick sync: 15min, $0, 30min notice
```

### Files to Create

| File                                                    | Purpose          |
| ------------------------------------------------------- | ---------------- |
| `server/src/agent/tools/booking-link-tools.ts`          | Tool definitions |
| `server/src/agent/executors/booking-link-executors.ts`  | T2 executors     |
| `packages/contracts/src/schemas/booking-link.schema.ts` | Zod schemas      |

### Action Parity Checklist

- [x] Create scheduling link → `manage_bookable_service` (create) ✅
- [x] Update settings → `manage_bookable_service` (update) ✅
- [x] Delete/disable → `manage_bookable_service` (delete) ✅
- [x] List existing → `list_bookable_services` ✅
- [x] Get shareable URL → Returned in responses ✅
- [x] Set working hours → `manage_working_hours` ✅
- [x] Block dates → `manage_date_overrides` ✅

---

## Phase 1: Foundation (1 week)

### Database Schema

```prisma
// Working hours per tenant
model WorkingHours {
  id        String  @id @default(cuid())
  tenantId  String
  dayOfWeek Int     // 0=Sunday, 6=Saturday
  startTime String  // "09:00" format
  endTime   String  // "17:00" format
  isActive  Boolean @default(true)

  tenant    Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, dayOfWeek])
  @@index([tenantId])
}

// Date overrides (vacation, special hours)
model DateOverride {
  id        String   @id @default(cuid())
  tenantId  String
  date      DateTime @db.Date
  available Boolean  @default(false)  // false = blocked
  startTime String?  // Override hours
  endTime   String?
  reason    String?

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, date])
  @@index([tenantId])
}

// Extend Service model
model Service {
  // ... existing fields ...

  // Booking link configuration
  isBookable        Boolean   @default(false)
  durationMinutes   Int       @default(60)
  bufferMinutes     Int       @default(15)
  minNoticeMinutes  Int       @default(120)  // 2 hours
  maxAdvanceDays    Int       @default(60)
  maxPerDay         Int?      // Optional daily limit
  customQuestions   Json?     // [{label, type, required}]
}
```

### Availability Algorithm

```typescript
// server/src/services/booking-link-availability.service.ts

async getAvailableSlots(params: {
  tenantId: string;
  serviceId: string;
  startDate: Date;
  endDate: Date;
  clientTimezone: string;
}): Promise<TimeSlot[]> {
  const service = await this.getService(params.serviceId);
  const workingHours = await this.getWorkingHours(params.tenantId);
  const dateOverrides = await this.getDateOverrides(params.tenantId, params);
  const existingBookings = await this.getBookings(params.tenantId, params);
  const calendarBusy = await this.calendarAdapter.getFreeBusy(params.tenantId, params);

  const slots: TimeSlot[] = [];

  for (const date of eachDayOfInterval(params)) {
    // 1. Check minimum notice
    if (differenceInMinutes(date, new Date()) < service.minNoticeMinutes) continue;

    // 2. Check max advance
    if (differenceInDays(date, new Date()) > service.maxAdvanceDays) continue;

    // 3. Get working hours (override > regular)
    const override = dateOverrides.find(d => isSameDay(d.date, date));
    if (override && !override.available) continue;

    const hours = override?.available
      ? { start: override.startTime!, end: override.endTime! }
      : workingHours.find(w => w.dayOfWeek === getDay(date));

    if (!hours) continue;

    // 4. Generate slots at configured interval
    let slotStart = parseTime(date, hours.start, params.clientTimezone);
    const dayEnd = parseTime(date, hours.end, params.clientTimezone);

    while (addMinutes(slotStart, service.durationMinutes) <= dayEnd) {
      const slotEnd = addMinutes(slotStart, service.durationMinutes);

      // 5. Check conflicts with buffer zone
      const conflictWindow = {
        start: slotStart,
        end: addMinutes(slotEnd, service.bufferMinutes)
      };

      const hasConflict = [...existingBookings, ...calendarBusy]
        .some(event => overlaps(event, conflictWindow));

      if (!hasConflict) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          clientTimezone: params.clientTimezone,
          providerTimezone: service.tenant.timezone,
        });
      }

      slotStart = addMinutes(slotStart, 15); // 15-min intervals
    }

    // 6. Apply daily limit if configured
    if (service.maxPerDay) {
      const todayBookings = existingBookings.filter(b => isSameDay(b.date, date));
      const remainingSlots = service.maxPerDay - todayBookings.length;
      if (remainingSlots <= 0) {
        slots = slots.filter(s => !isSameDay(new Date(s.start), date));
      }
    }
  }

  return slots;
}
```

### API Contracts

```typescript
// packages/contracts/src/schemas/booking-link.schema.ts

export const TimeSlotSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  clientTimezone: z.string(),
  providerTimezone: z.string(),
});

export const BookableServiceSchema = z.object({
  id: z.string().cuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
  bufferMinutes: z.number().int().nonnegative(),
  bookingUrl: z.string().url(),
});

export const GetAvailabilityQuerySchema = z.object({
  serviceId: z.string().cuid(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  timezone: z.string().min(1),
});

export const CreateBookingSchema = z.object({
  serviceId: z.string().cuid(),
  startTime: z.string().datetime(),
  timezone: z.string(),
  invitee: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().optional(),
    answers: z.record(z.string()).optional(),
  }),
});
```

### Tasks

| Task                               | Effort | Files                                  |
| ---------------------------------- | ------ | -------------------------------------- |
| Add WorkingHours model + migration | 2h     | `schema.prisma`                        |
| Add DateOverride model + migration | 1h     | `schema.prisma`                        |
| Extend Service model               | 2h     | `schema.prisma`                        |
| Create availability service        | 6h     | `booking-link-availability.service.ts` |
| Add contracts                      | 3h     | `booking-link.schema.ts`               |
| Create public routes               | 4h     | `public-booking-link.routes.ts`        |
| Unit tests for availability        | 4h     | `booking-link-availability.test.ts`    |

---

## Phase 2: Premium UI (2 weeks)

### Design System

```tsx
// Dark theme (Graphite + Sage)
const BOOKING_THEME = {
  background: '#18181B', // Graphite
  surface: '#27272A', // Cards
  accent: '#45B37F', // Electric Sage
  accentMuted: 'rgba(69, 179, 127, 0.1)',
  text: '#FAFAFA',
  textMuted: '#A1A1AA',
  border: '#3F3F46',
};
```

### Layout Pattern

```
Desktop:
+-----------------------------------+-------------------+
|                                   |                   |
|     CUSTOM CALENDAR (dark)        |   TIME SLOTS      |
|     (Month view, sage accents)    | (Morning/Afternoon)|
|                                   |                   |
+-----------------------------------+-------------------+
|                                                       |
|           BOOKING FORM (progressive disclosure)       |
|     [Name] [Email] [Phone] [Custom Questions]         |
|                                                       |
+-------------------------------------------------------+
|     TIMEZONE CARD: "9am PT (your time) = 12pm ET"     |
+-------------------------------------------------------+
|                  [Confirm Booking]                    |
+-------------------------------------------------------+

Mobile:
+---------------------------+
|    SERVICE HEADER         |
|  "30-min Consultation"    |
|       "$50"               |
+---------------------------+
|                           |
|   SELECT DATE BUTTON      |
|   → Opens bottom sheet    |
|                           |
+---------------------------+
|                           |
|   TIMEZONE CARD           |
|                           |
+---------------------------+
|                           |
|   FORM (slides up after   |
|   time selection)         |
|                           |
+---------------------------+
|   STICKY SUMMARY BAR      |
|   [Confirm Booking]       |
+---------------------------+
```

### Component Architecture

```
apps/web/src/app/t/[slug]/book/[eventType]/
├── page.tsx                    # SSR with ISR (60s)
├── BookingLinkClient.tsx       # Client orchestration
└── components/
    ├── BookingCalendar.tsx     # Custom dark calendar
    ├── TimeSlotPicker.tsx      # Morning/Afternoon/Evening groups
    ├── TimezoneCard.tsx        # Dual timezone display
    ├── InviteeForm.tsx         # Progressive disclosure form
    ├── BookingSummaryBar.tsx   # Sticky mobile CTA
    ├── ServiceHeader.tsx       # Provider info + price
    └── SuccessAnimation.tsx    # Confetti + checkmark
```

### Key Interactions

| Interaction | Animation                                       |
| ----------- | ----------------------------------------------- |
| Date hover  | `bg-sage/10` fade in (150ms)                    |
| Date select | Ring-2 glow, time slots slide in (300ms spring) |
| Time select | Pulse + checkmark, form expands                 |
| Form focus  | Sage border with ring-4 glow                    |
| Submit      | Loading spinner → confetti burst                |
| Month nav   | Slide left/right with fade                      |

### Mobile Gestures

- **Swipe left/right on calendar** → Navigate months
- **Drag down on bottom sheet** → Dismiss and deselect
- **Long press on date** → Tooltip "3 slots available"

### Accessibility (WCAG 2.1 AA+)

- 44x44px minimum touch targets
- Keyboard navigation (arrows, Enter, Escape)
- Screen reader announcements for selections
- Focus management on step transitions
- `aria-live` regions for updates
- Reduced motion support

### Tasks

| Task                             | Effort | Files                     |
| -------------------------------- | ------ | ------------------------- |
| Custom BookingCalendar component | 8h     | `BookingCalendar.tsx`     |
| TimeSlotPicker with grouping     | 4h     | `TimeSlotPicker.tsx`      |
| TimezoneCard component           | 3h     | `TimezoneCard.tsx`        |
| Mobile bottom sheet integration  | 4h     | `MobileCalendarSheet.tsx` |
| InviteeForm with validation      | 4h     | `InviteeForm.tsx`         |
| Dark theme styling               | 4h     | All components            |
| Animations (Framer Motion)       | 6h     | All components            |
| Accessibility audit + fixes      | 4h     | All components            |
| Responsive layout                | 4h     | Layout components         |

---

## Phase 3: Confirmation Excellence (1 week)

### Beautiful Email Templates

```html
<!-- Postmark template: booking-confirmation -->
<div style="background: #18181B; color: #FAFAFA; padding: 40px;">
  <h1 style="font-family: Georgia, serif;">You're booked!</h1>

  <div style="background: #27272A; border-radius: 16px; padding: 24px;">
    <h2>{{service_name}}</h2>
    <p>{{formatted_date}} at {{formatted_time}}</p>
    <p style="color: #A1A1AA;">
      That's {{client_time}} your time / {{provider_time}} {{provider_name}}'s time
    </p>
  </div>

  <div style="margin-top: 24px;">
    <a
      href="{{add_to_calendar_url}}"
      style="background: #45B37F; color: white; padding: 12px 24px; border-radius: 999px;"
    >
      Add to Calendar
    </a>
  </div>

  <p style="margin-top: 24px;">
    <a href="{{session_space_url}}">View your Session Space →</a>
  </p>
</div>
```

### Session Space Landing

After booking, redirect to `/t/[slug]/sessions/[bookingId]`:

```
+---------------------------+
|    SESSION SPACE          |
|    (Your Consultation)    |
+---------------------------+
|                           |
|   📅 Jan 9, 2pm PT        |
|   👤 with Jane Smith      |
|   📍 Video call           |
|                           |
+---------------------------+
|   PREP CHECKLIST          |
|   □ Questions to discuss  |
|   □ Goals for session     |
+---------------------------+
|   CHAT WITH PROVIDER      |
|   [Ask a question...]     |
+---------------------------+
|   MANAGE BOOKING          |
|   [Reschedule] [Cancel]   |
+---------------------------+
```

### Add to Calendar Button

```typescript
// One-click calendar add (no download)
function getCalendarUrl(booking: Booking): Record<string, string> {
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(booking.title)}&dates=${formatGoogleDate(booking.startTime)}/${formatGoogleDate(booking.endTime)}&details=${encodeURIComponent(booking.description)}`,
    apple: `/api/calendar/ics/${booking.id}`, // Generates .ics
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(booking.title)}&startdt=${booking.startTime}&enddt=${booking.endTime}`,
  };
}
```

### Success Animation

```tsx
// Confetti on booking success
import confetti from 'canvas-confetti';

const celebrate = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#45B37F', '#FAFAFA', '#A1A1AA'],
  });
};
```

### Tasks

| Task                      | Effort | Files                           |
| ------------------------- | ------ | ------------------------------- |
| Email template design     | 4h     | Postmark templates              |
| ICS file generation       | 2h     | `calendar.service.ts`           |
| Add to Calendar component | 3h     | `AddToCalendar.tsx`             |
| Session Space page        | 8h     | `sessions/[bookingId]/page.tsx` |
| Success animation         | 2h     | `SuccessAnimation.tsx`          |
| Reschedule flow           | 6h     | `reschedule/page.tsx`           |

---

## Phase 4: Admin Configuration (1 week)

### Working Hours Editor

```
+------------------------------------------+
|   AVAILABILITY                           |
+------------------------------------------+
|                                          |
|   Monday    [9:00 AM ▼] - [5:00 PM ▼]  ✓ |
|   Tuesday   [9:00 AM ▼] - [5:00 PM ▼]  ✓ |
|   Wednesday [9:00 AM ▼] - [5:00 PM ▼]  ✓ |
|   Thursday  [9:00 AM ▼] - [5:00 PM ▼]  ✓ |
|   Friday    [9:00 AM ▼] - [5:00 PM ▼]  ✓ |
|   Saturday  [───────── Off ─────────]  ☐ |
|   Sunday    [───────── Off ─────────]  ☐ |
|                                          |
|   Timezone: America/New_York ▼           |
|                                          |
+------------------------------------------+
```

### Date Override Calendar

```
+------------------------------------------+
|   BLOCKED DATES                          |
+------------------------------------------+
|                                          |
|   ◄  January 2025  ►                     |
|                                          |
|   Su  Mo  Tu  We  Th  Fr  Sa             |
|              1   2   3   4               |
|   5   6   7   8   9  10  11              |
|   12  13  14 [15] 16  17  18   ← Blocked |
|   19  20  21  22  23  24  25             |
|   26  27  28  29  30  31                 |
|                                          |
|   Click dates to block/unblock           |
|                                          |
+------------------------------------------+
```

### Service Booking Settings

```
+------------------------------------------+
|   BOOKING LINK SETTINGS                  |
+------------------------------------------+
|                                          |
|   ✓ Enable booking link                  |
|                                          |
|   Duration: [30 minutes ▼]               |
|   Buffer after: [15 minutes ▼]           |
|   Minimum notice: [2 hours ▼]            |
|   Book up to: [60 days ▼] in advance     |
|                                          |
|   YOUR BOOKING LINK                      |
|   ┌────────────────────────────────┐     |
|   │ gethandled.ai/t/jane/book/cons │ 📋  |
|   └────────────────────────────────┘     |
|                                          |
+------------------------------------------+
```

### Tasks

| Task                     | Effort | Files                            |
| ------------------------ | ------ | -------------------------------- |
| Working hours editor     | 6h     | `WorkingHoursEditor.tsx`         |
| Date override calendar   | 6h     | `DateOverrideCalendar.tsx`       |
| Service booking settings | 4h     | `ServiceBookingSettings.tsx`     |
| Admin API routes         | 4h     | `tenant-admin-booking.routes.ts` |
| Copy link with feedback  | 1h     | `CopyLinkButton.tsx`             |

---

## Phase 5: Premium Features (2 weeks)

| Feature                  | Effort | Description                         |
| ------------------------ | ------ | ----------------------------------- |
| SMS Reminders            | 8h     | Twilio integration, opt-in checkbox |
| Google Meet Auto-Link    | 4h     | Generate video link at booking time |
| Reschedule Self-Service  | 8h     | From confirmation email             |
| Waitlist                 | 6h     | "Notify me if something opens"      |
| Slot Preference Ordering | 4h     | Morning/afternoon preference        |
| Group Booking            | 16h    | Multiple attendees select slots     |

---

## Quality Metrics

| Metric                  | Target      | Measurement          |
| ----------------------- | ----------- | -------------------- |
| Booking Completion Rate | >75%        | Funnel analytics     |
| Time to Book            | <90 seconds | Session recording    |
| Mobile Completion Rate  | >70%        | Device segmentation  |
| Timezone Error Rate     | <1%         | Support tickets      |
| Double-Booking Rate     | 0%          | Database constraints |
| Accessibility Score     | 100/100     | Lighthouse           |
| LCP                     | <2.5s       | Core Web Vitals      |

---

## Success Criteria

- [ ] User can say "Create me a 15-min Zoom link" → gets shareable URL
- [ ] Booking page is dark-themed, visually premium
- [ ] Smart timezone card shows both client and provider times
- [ ] Confetti animation on successful booking
- [ ] Session Space continues the relationship post-booking
- [ ] Mobile experience uses bottom sheets and gestures
- [ ] Full keyboard navigation and screen reader support
- [ ] Emails are beautiful, on-brand, with one-click calendar add

---

## References

### Internal

- `server/src/services/availability.service.ts:43-96` - Existing availability logic
- `server/src/adapters/google-calendar-sync.adapter.ts:289-367` - FreeBusy API
- `server/src/adapters/prisma/booking.repository.ts:138-288` - Advisory locks
- `apps/web/src/components/booking/DateBookingWizard.tsx` - Existing wizard
- `docs/design/BRAND_VOICE_GUIDE.md` - Brand guidelines

### Skills Applied

- `agent-native-architecture` - Tool design, action parity
- `frontend-design` - Premium aesthetics, distinctive UI

### External

- [Cal.com GitHub](https://github.com/calcom/cal.com) - Open source reference
- [W3C Date Picker Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
- [Google Calendar FreeBusy API](https://developers.google.com/calendar/api/v3/reference/freebusy)

---

_Generated with Claude Code • Quality-First Edition • 2025-01-05_
