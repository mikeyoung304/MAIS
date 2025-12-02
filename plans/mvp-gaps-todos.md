# MVP Gaps Implementation - Todo List

## Phase 1: Foundation (Days 1-5)

### 1.1 Secure Token System
- [ ] Create Prisma migration for `BookingActionToken` model
- [ ] Implement `BookingTokenService` with HMAC-SHA256 generation
- [ ] Add token validation with expiry + single-use enforcement
- [ ] Add rate limiting (10 validations/min per IP)
- [ ] Write unit tests for token generation, validation, expiry, replay prevention
- [ ] Wire service in DI container (`server/src/di.ts`)

### 1.2 Reminder Infrastructure
- [ ] Install `luxon` for timezone handling
- [ ] Install `node-cron` for scheduled jobs
- [ ] Create Prisma migration for `BookingReminder` model + enums
- [ ] Implement `ReminderService` with schedule/cancel/process methods
- [ ] Add timezone-aware scheduling
- [ ] Write unit tests for scheduling, cancellation, timezone handling
- [ ] Wire cron job in server startup

---

## Phase 2: Core Features (Days 6-15)

### 2.1 Per-Tenant Google Calendar
- [ ] Create `TenantCalendarRepository` with encrypted config storage
- [ ] Modify `GoogleCalendarSyncAdapter` for per-tenant config loading
- [ ] Add fallback to global config when tenant config missing
- [ ] Create tenant-admin calendar routes (`GET/POST/DELETE /v1/tenant-admin/calendar/config`)
- [ ] Build admin UI for calendar configuration
- [ ] Write E2E test: configure calendar → create booking → verify event

### 2.2 Deposit System
- [ ] Create Prisma migration for `DepositPolicy` model
- [ ] Add deposit fields to `Booking` model (depositAmount, balanceDueDate, etc.)
- [ ] Implement `DepositService` with calculate/checkout methods
- [ ] Add balance due reminder scheduling (7 days before)
- [ ] Implement auto-cancel after grace period
- [ ] Create tenant-admin routes for deposit policy CRUD
- [ ] Write E2E test: full deposit-to-balance flow

---

## Phase 3: Self-Service (Days 16-22)

### 3.1 Cancel/Refund System
- [ ] Create Prisma migration for `BookingCancellation` model + enums
- [ ] Implement `CancellationService` with 3-phase cancellation
- [ ] Add refund processing via Stripe API
- [ ] Implement refund retry on failure
- [ ] Cancel reminders on booking cancellation
- [ ] Delete calendar event on cancellation
- [ ] Write E2E test: cancel booking → verify refund → verify calendar deleted

### 3.2 Reschedule System
- [ ] Implement `RescheduleService` with advisory lock (ADR-006 pattern)
- [ ] Generate secure reschedule tokens
- [ ] Create public routes for reschedule flow
- [ ] Sync calendar event to new date
- [ ] Reschedule reminders to new date
- [ ] Build client pages: `ManageBooking.tsx`, `RescheduleFlow.tsx`, `CancelFlow.tsx`
- [ ] Write E2E test: reschedule flow + race condition test

---

## Phase 4: Invoicing (Days 23-29)

### 4.1 Invoice Model & Generation
- [ ] Install `pdfkit` for PDF generation
- [ ] Create Prisma migration for `Invoice` + `InvoiceLineItem` models
- [ ] Implement `InvoiceService` with generateFromBooking method
- [ ] Add unique invoice number generation (`INV-{tenant}-{YYYYMMDD}-{counter}`)
- [ ] Calculate line items from booking + add-ons
- [ ] Calculate tax and commission

### 4.2 Invoice Management
- [ ] Implement status updates (DRAFT → ISSUED → PAID)
- [ ] Handle refunds (update status to REFUNDED/PARTIAL)
- [ ] Implement PDF generation
- [ ] Implement email invoice to customer via Postmark
- [ ] Create tenant-admin invoice routes (list, get, generate, pdf, send)
- [ ] Build admin UI for invoice management

---

## Dependencies to Install
```bash
npm install luxon @types/luxon node-cron @types/node-cron pdfkit @types/pdfkit
```

## Migrations to Create (in order)
1. `20251202_add_booking_action_tokens`
2. `20251202_add_booking_reminders`
3. `20251203_add_deposit_policy`
4. `20251203_add_booking_deposit_fields`
5. `20251204_add_booking_cancellation`
6. `20251205_add_invoice`
