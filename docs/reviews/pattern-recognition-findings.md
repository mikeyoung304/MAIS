# Integration Landscape Review — Pattern Recognition Findings

**Reviewer:** Pattern Recognition Specialist
**Date:** 2026-02-20
**Scope:** Full integration audit — existing integrations, patterns, and gaps for a service professional membership platform (photographers, coaches, therapists, wedding planners)

---

## Executive Summary

| Severity          | Count  |
| ----------------- | ------ |
| P1 (Critical)     | 3      |
| P2 (Important)    | 7      |
| P3 (Nice-to-Have) | 8      |
| **Total**         | **18** |

The platform has a solid, consistent integration pattern but covers only ~25% of the integrations typical for a service professional membership platform. Payments (Stripe) and calendar sync (Google Calendar) are production-grade. Email (Postmark) and file storage (Supabase) are functional. Everything else is absent.

---

## Section 1: What Integrations Already Exist

### 1.1 Stripe — Payment Processing (Production-Grade)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/stripe.adapter.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/services/stripe-connect.service.ts`

**Coverage:**

- One-time checkout sessions (`createCheckoutSession`)
- Stripe Connect Express accounts (tenant-owned payouts with platform fee)
- Subscription billing (`createSubscriptionCheckout`) with price IDs
- Refunds (full and partial, with reason validation)
- Webhook verification with HMAC signature checking
- Idempotency keys on all mutations
- BullMQ async queue for webhook processing (prevents Stripe 5s timeout)

**Depth of implementation:** Very good. The adapter correctly handles both standard and Connect destination charges, validates application fee bounds (0.5%–50%), and retries on network errors. Stripe Connect onboarding is tracked via `stripeAccountId` and `stripeOnboarded` on the Tenant model.

**Gap noted:** The `PaymentProvider` port interface exposes only checkout sessions and refunds — it does not expose subscription management methods (`cancelSubscription`, `updateSubscription`, `getSubscriptionStatus`). Those are handled ad-hoc inside `StripeConnectService` and billing routes, bypassing the port abstraction.

---

### 1.2 Google Calendar — Scheduling Sync (Production-Grade)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.adapter.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/google-calendar-sync.adapter.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.jwt.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/services/google-calendar.service.ts`

**Coverage:**

- Two-way sync: creates/deletes Google Calendar events when appointments are booked or cancelled
- FreeBusy API: prevents double-booking with existing calendar events (reads tenant's calendar)
- Per-tenant calendar configuration (encrypted in `tenant.secrets.calendar`)
- Global fallback config via env vars (`GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`)
- 60-second in-process cache for availability checks
- Graceful degradation: all dates assumed available if calendar credentials missing

**Gap noted:** Only Google Calendar is supported. No Outlook/Microsoft 365 Calendar, no Calendly/Acuity import of existing bookings. The `CalendarProvider` port interface is well-designed and could accept other implementations, but none exist.

---

### 1.3 Postmark — Email Notifications (Functional)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/postmark.adapter.ts`

**Coverage:**

- Booking confirmation email (plain text)
- Booking reminder email (7-day pre-event, HTML + text)
- Password reset email (HTML + text)
- Generic `sendEmail()` for arbitrary HTML
- File-sink fallback when `POSTMARK_SERVER_TOKEN` not configured (dev mode)
- Retry with exponential backoff (3 attempts) on 5xx, 429, and network errors

**Significant gap:** The `EmailProvider` port interface defines only `sendEmail({ to, subject, html })`. The Postmark adapter has four concrete methods (`sendBookingConfirm`, `sendBookingReminder`, `sendPasswordReset`, `sendEmail`), but only `sendEmail` is in the port. This means injecting any other email provider would require rewriting the event handlers in `di.ts` that call the concrete methods directly. The port abstraction is incomplete.

**Missing email types for a membership platform:**

- Welcome email on tenant signup
- Invoice/receipt delivery
- Post-session follow-up / review request
- Onboarding checklist / drip sequence
- Customer cancellation confirmation (currently only tenant receives event)

---

### 1.4 Supabase Storage — File Storage (Functional)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/upload.adapter.ts`

**Coverage:**

- Logo uploads (tenant branding)
- Tier/service photos
- Segment images
- Landing page images
- Dual-mode: Supabase Storage (production) vs local filesystem (dev/test)
- MIME type validation with magic bytes verification
- SVG sanitization (blocks XSS vectors)
- Per-tenant path scoping (`tenantId/folder/filename`) with security check on delete

**Gap noted:** Supabase is used purely for blob storage, not as an alternative to Prisma/PostgreSQL for querying. The `SUPABASE_JWT_SECRET` is validated in env but Supabase Auth is not used — the platform has its own JWT system. This dual authentication reality (Supabase for storage, custom JWT for auth) adds operational complexity with no structural benefit.

---

### 1.5 Redis — Caching and Job Queue (Production-Grade)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/redis/cache.adapter.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/jobs/webhook-queue.ts`

**Coverage:**

- `RedisCacheAdapter`: full TTL-based key-value caching via ioredis, SCAN-based pattern flush, health check via PING
- `WebhookQueue` (BullMQ): async Stripe webhook processing with exponential backoff retry
- Graceful degradation when `REDIS_URL` missing (in-memory fallback for cache, synchronous processing for webhooks)

---

### 1.6 Google Vertex AI / ADK — AI Agents (Production-Grade)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/` (three Cloud Run agents)
- `/Users/mikeyoung/CODING/MAIS/server/src/llm/vertex-client.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/services/vocabulary-embedding.service.ts`

**Coverage:**

- Three production agents on Cloud Run: `customer-agent`, `tenant-agent`, `research-agent`
- Gemini via Vertex AI (project/location config)
- `text-embedding-005` for semantic vocabulary matching (pgvector)
- Google ADK for agent orchestration
- Per-tenant AI usage limits (`aiMessagesUsed`, `aiMessagesResetAt`)

---

### 1.7 Sentry — Error Monitoring (Functional)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/sentry.ts`
- `@sentry/nextjs` in `apps/web/`

**Coverage:** Both server and frontend instrumented. DSN via `SENTRY_DSN` env var.

---

### 1.8 Prometheus — Metrics (Minimal)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/routes/metrics.routes.ts`

**Coverage:** `prom-client` is installed and the metrics route exists. Default Node.js metrics only. No custom business metrics (bookings/day, revenue, cancellation rate, AI message usage, etc.).

---

### 1.9 Outbound Webhooks — Third-Party Extensibility (Functional)

**Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/services/webhook-delivery.service.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/webhook-subscription.repository.ts`

**Coverage:** Tenants can register webhook endpoints to receive `appointment.created`, `appointment.canceled`, `appointment.rescheduled` events. HMAC-SHA256 signing. Database-backed delivery tracking with retry via `WebhookDelivery` table. This is the platform's primary extensibility mechanism for tenants who want to connect to their own CRMs, spreadsheets, or Zapier.

---

## Section 2: Integration Pattern Analysis

### 2.1 The Pattern: Ports and Adapters (Hexagonal Architecture)

The codebase follows a strict ports-and-adapters pattern documented in ADR-006:

```
Port Interface (lib/ports/*.ts)
    ↓
Adapter Implementation (adapters/*.ts)
    ↓
Injected via DI Container (di.ts)
```

**Ports defined:**

- `PaymentProvider` (`payment.port.ts`)
- `CalendarProvider` (`calendar.port.ts`)
- `EmailProvider` (`email.port.ts`)
- `StorageProvider` (`storage.port.ts`)
- `CacheServicePort` (`cache.port.ts`)

**Pattern consistency: 7/10.**

The pattern is well-established for the core integrations but has documented drift:

1. `EmailProvider` port only declares `sendEmail()`, but the Postmark adapter has 4 methods called directly in `di.ts`, bypassing the port.
2. Stripe subscription management (`StripeConnectService`) bypasses `PaymentProvider` entirely — it holds its own `Stripe` instance and talks to the SDK directly.
3. `HealthCheckService` casts the `StripePaymentAdapter` from `PaymentProvider` to access its internal `stripe.balance.retrieve()` — the port abstraction leaks at the seam.

### 2.2 Mock-First Pattern (ADR-007)

Every integration has a mock counterpart:

- `adapters/mock/payment.provider.ts` — mock Stripe
- `adapters/mock/calendar.provider.ts` — mock Google Calendar (all dates available)
- `adapters/mock/email.provider.ts` — writes to filesystem
- `adapters/mock/cache.adapter.ts` — in-memory Map

**This is the best aspect of the integration architecture.** Adding a new integration means: write port interface → write real adapter → write mock adapter → wire in `di.ts`. The test suite can run entirely without any external service.

### 2.3 Secrets Management for Per-Tenant Integrations

The platform correctly handles per-tenant third-party credentials:

- Stripe Connect `stripeAccountId` stored plaintext (public ID, safe)
- Google Calendar service account JSON stored encrypted in `tenant.secrets.calendar` (AES-256-GCM)
- Stripe restricted key also encrypted in `tenant.secrets.stripe`

The `TENANT_SECRETS_ENCRYPTION_KEY` pattern is sound and documented. Any new per-tenant integration credentials (e.g., OAuth tokens for QuickBooks, Zoom, or DocuSign) should follow this same encrypted secrets pattern.

---

## Section 3: Missing Integrations

### P1 Findings — Critical Gaps

---

**P1-1: No SMS / Mobile Notification Channel**

Service professionals (photographers, therapists, coaches) rely on phone-based appointment reminders. Email reminders exist, but SMS has ~98% open rate vs ~20% for email. Wedding photographers lose deposits when clients no-show due to missed email confirmations.

**What is missing:** No `SMSProvider` port, no Twilio/Vonage adapter. The `Customer` model has a `phone String?` field that is collected but never used for notifications. Collecting a phone number but never using it is a trust gap.

**Implementation path:** Add `SMSProvider` port to `lib/ports/sms.port.ts`, implement `TwilioSMSAdapter` following the same pattern as `PostmarkMailAdapter`. Wire `BookingEvents.REMINDER_DUE` to also send SMS when the customer has a phone number on file. The `ReminderService` already fires the reminder event — it just needs a second listener.

**Priority rationale:** No-shows are the top complaint from service professionals. The data collection (phone field) is in place. This is a high-ROI addition.

---

**P1-2: No Contract / eSignature Integration**

Service professionals require signed contracts before sessions or on booking confirmation. Currently, the platform shows `FileCategory.CONTRACT` exists in the schema (a project file can be categorized as a contract), but there is no mechanism to:

- Generate a contract from a template
- Send it to the client for e-signature
- Block booking confirmation until signed
- Store the signed PDF with audit trail

**What is missing:** No DocuSign, PandaDoc, or HelloSign integration. No contract template management.

**Current workaround:** Tenants paste a contract PDF into a chat message or use a separate account manually. This breaks the "done-for-you" promise.

**Implementation path:** Add `ContractProvider` port. Implement a DocuSign or PandaDoc adapter. Hook into the booking state machine (currently `PENDING → PAID → CONFIRMED`): add `AWAITING_SIGNATURE` state. The schema already has `FileCategory.CONTRACT` acknowledging contracts exist — it just does nothing with them.

**Priority rationale:** For wedding photographers and therapists especially, an unsigned contract is a legal and financial liability. Competitors (HoneyBook, Dubsado) lead with contract signing as their #1 feature.

---

**P1-3: No Branded Invoice / Receipt Delivery**

Stripe generates payment intents and sends Stripe-branded receipts by default, but:

- Stripe receipts carry no tenant branding (no business logo, no custom terms)
- There is no mechanism to issue a formal invoice (therapists need invoices for HSA/FSA reimbursement; coaches whose clients expense the coaching need formal invoices)
- No invoice history in the tenant dashboard

**What is missing:** No invoice generation or PDF delivery. The platform processes payment via Stripe but does not produce a formal invoice document.

**Implementation path:** Either expose Stripe's hosted billing portal (which generates invoices automatically) or add lightweight PDF generation post-payment using a library like `pdfkit`. Trigger invoice email delivery on `BookingEvents.PAID`. Add an `Invoice` model to the schema or denormalize invoice data onto `Payment`.

**Priority rationale:** Required for therapists with HSA/FSA clients and coaches with corporate-paying clients. These are high-value customer segments the platform targets.

---

### P2 Findings — Important Gaps

---

**P2-1: Outlook / Microsoft 365 Calendar Not Supported**

Only Google Calendar is supported. Many service professionals (therapists, coaches, corporate-adjacent wedding planners) use Outlook. The `CalendarProvider` port is well-designed and could accept a Microsoft Graph API adapter with no changes to the rest of the system.

**Implementation path:** Implement `OutlookCalendarAdapter implements CalendarProvider`, using the Microsoft Graph `calendarView` endpoint for FreeBusy and `events` for create/delete. OAuth2 token stored encrypted in `tenant.secrets.outlook`. The port interface already supports optional `createEvent`, `deleteEvent`, and `getBusyTimes` methods.

---

**P2-2: No Video Meeting Link Integration**

Virtual coaching sessions, therapy consultations, and discovery calls require a unique video meeting link per booking. Currently:

- The `Booking` model has no `meetingUrl` field
- There is no `VideoProvider` port
- Tenants manually paste a static Zoom link into emails, which means every client gets the same link (privacy/security problem)

**Implementation path:** Add `VideoProvider` port with `createMeeting(input)` returning a meeting URL. Implement `ZoomVideoAdapter` and/or `GoogleMeetAdapter`. Hook into `AppointmentEvents.BOOKED` to create a unique meeting link per booking. Add `meetingUrl String?` to the `Booking` schema. Include meeting link in the confirmation email template.

---

**P2-3: Stripe Subscription Management Bypasses the Port**

`StripeConnectService` holds its own `Stripe` SDK instance:

```typescript
// server/src/services/stripe-connect.service.ts — own Stripe instance, not injected
this.stripe = new Stripe(apiKey, { apiVersion: '2025-10-29.clover' });
```

This bypasses the `PaymentProvider` port entirely. Mocking subscription management in tests requires either real Stripe or a manual override — the existing `MockPaymentProvider` does not cover Connect/subscription operations.

**Fix:** Either extend `PaymentProvider` with subscription/Connect methods, or create a separate `SubscriptionProvider` port. Document the intentional architectural split if the separation is by design.

---

**P2-4: EmailProvider Port Does Not Cover Booking Emails**

The `EmailProvider` port declares only `sendEmail({ to, subject, html })`. The `di.ts` event handlers call `mailProvider.sendBookingConfirm(...)` and `mailProvider.sendBookingReminder(...)` directly on the concrete `PostmarkMailAdapter`, not through any port.

**Consequence:** Any email provider swap requires modifying `di.ts` event subscriptions, not just swapping the adapter class. The port provides zero abstraction for the most important email flows.

**Fix:** Extend `EmailProvider` with typed methods matching the concrete adapter, or move template rendering into a separate layer and have the port accept a template enum + payload.

---

**P2-5: No CRM or Lead Tracking Integration**

Service professionals accumulate repeat clients and leads. The `Customer` model is minimal (name, email, phone). There is no:

- Client notes / session history visible to the tenant
- Lifetime booking value tracking
- Lead tracking (inquiry → consultation → booked → repeat)
- Native export to HubSpot, Pipedrive, or even CSV

The outbound webhook system (`WebhookDeliveryService`) is the closest thing — tenants could route events to Zapier → HubSpot. But this requires the tenant to configure Zapier workflows manually.

**Implementation path for MVP:** Expand outbound webhooks to include `customer.created` and `invoice.paid` event types, improving Zapier integration coverage. For a native CRM, this is a longer-term roadmap item.

---

**P2-6: No Deliverable Delivery Mechanism**

The `FileCategory.DELIVERABLE` enum and `ProjectFile` model exist in the schema, but there is no delivery mechanism:

- No shareable gallery link for photo delivery
- No notification when deliverables are uploaded
- No integration with Pixieset, SmugMug, Google Drive, or Dropbox

For photographers, delivering edited photos to the client is the final and most visible step of the project. Currently there is no native path from "tenant uploads files" to "client downloads finished work."

**Implementation path:** Add a shareable project link (`/project/{token}`) where clients can view and download their deliverables. For large photo galleries, integrate with Pixieset (photography-native platform) via API, or implement Google Drive OAuth upload.

---

**P2-7: No Review / Testimonial Collection Automation**

The platform has a `TESTIMONIALS` section type in the storefront and an AI agent that can write testimonial text for the storefront. However:

- No mechanism requests a Google Review after project completion
- No platform-native testimonial form for customers
- No sync with Google Business Profile reviews

Testimonials are currently typed manually into the storefront editor via AI chat. For photographers who live on Google reviews, this is a significant missing workflow.

**Implementation path:** Trigger a `ReviewRequest` email 3 days after `Project.status = COMPLETED`. Include a Google review link + a short platform feedback form. Store platform testimonials in a new `Testimonial` model that feeds the `TESTIMONIALS` storefront section automatically.

---

### P3 Findings — Nice-to-Have

---

**P3-1: No QuickBooks / Xero Accounting Integration**

Photographers and therapists need to reconcile Stripe payouts with accounting software. Currently, payment data lives in Stripe and the `Booking`/`Payment` models. No export path to QuickBooks or Xero exists. Lower priority because Stripe's revenue reports + manual export are workable.

---

**P3-2: No Social Media Scheduling Integration**

Coaches and wedding planners want to publish booking milestones or new service offerings to Instagram/Facebook. The `research-agent` does competitive research but there is no social publishing. P3 because this is a marketing accelerator, not a core workflow.

---

**P3-3: Prometheus Metrics Are Bare**

`prom-client` is installed and a `/metrics` endpoint exists, but only Node.js default metrics are emitted. No custom business counters for `bookings_created_total`, `payments_failed_total`, `ai_messages_used_total`, or `calendar_sync_latency_ms`. Makes SLA monitoring and capacity planning difficult.

---

**P3-4: No Apple Calendar / iCal Support**

Apple Calendar is common among creative professionals. iCal export (`.ics` file) would cover the use case at low implementation cost — the `CalendarProvider` port could add an optional `exportICS()` method. No adapter changes needed to existing functionality.

---

**P3-5: No Pre-Booking Intake Questionnaire**

Therapists, coaches, and photographers typically send intake questionnaires before the first session. Currently there is no way to attach a required questionnaire to a booking. The `ProjectRequest` system handles post-booking Q&A but not pre-booking intake. Required for therapists who need clinical intake information before accepting a client.

---

**P3-6: No Email Marketing / Drip Sequence Integration**

Tenants cannot run email campaigns to their customer list. No Mailchimp, ConvertKit, or native bulk email capability. Postmark is transactional-only. Needed for coaches who run nurture sequences or photographers who want to send seasonal promotions.

---

**P3-7: Phone Number Not Propagated to Booking Record**

`Customer.phone` exists but the `Booking` model does not capture phone at booking time. If the customer's phone changes between bookings, there is no way to contact them for a specific booking. Minor schema gap needed before SMS reminders can be reliably implemented.

---

**P3-8: Stripe Customer Portal Not Exposed**

Stripe's hosted customer portal allows self-service subscription management (upgrade, downgrade, cancel). The platform handles subscription state via webhooks but has no self-service subscription management UI. Tenants must contact support to cancel. This is a UX gap for platform subscriptions, not a third-party integration gap per se.

---

## Section 4: Pattern Consistency Assessment

### What Is Consistent

1. **Port/adapter separation** for all five production integrations (Stripe checkout, Google Calendar, Postmark, Supabase storage, Redis).
2. **Mock-first**: every integration has a mock adapter that enables full test runs without any external service.
3. **Tenant-scoped secrets**: per-tenant credentials encrypted with AES-256-GCM in `tenant.secrets` JSON column.
4. **Graceful degradation**: all optional integrations (calendar, cache) fail open — the application continues without them.
5. **Single wiring point**: all adapters instantiated in `di.ts`, never inside services.

### Where Consistency Breaks Down

1. **Email port is too narrow**: `EmailProvider` exposes only generic `sendEmail()`. The three booking-specific email methods bypass the port and are called directly on the concrete adapter in `di.ts`.
2. **StripeConnectService is a sidecar**: holds its own Stripe instance, not injected through `PaymentProvider`. This may be intentional (Connect is architecturally separate from checkout) but it is undocumented and untestable via mock.
3. **Supabase auth variables collected but unused**: `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` are validated and required in real mode but Supabase Auth is not used. The platform uses its own JWT system. This creates operational confusion.

### Integration Readiness for New Adapters

The ports-and-adapters pattern means adding new integrations is structurally clear:

1. Define `SMSProvider` / `VideoProvider` / `ContractProvider` port interface in `lib/ports/`
2. Implement real adapter (Twilio, Zoom, DocuSign)
3. Implement mock adapter returning predictable test data
4. Wire in `di.ts`
5. Add encrypted secret storage for per-tenant credentials in `tenant.secrets`

The architecture earns a **B+** for integration readiness. The main risk is that ad-hoc additions (like `StripeConnectService`) bypass the pattern and create operational debt.

---

## Section 5: Recommended Priority Order

### Phase A — Before Broad Launch

1. **SMS reminders** (Twilio/Vonage): `Customer.phone` already collected; port/adapter pattern is clear; directly addresses the #1 service professional pain point (no-shows)
2. **Contract e-signature** (DocuSign/PandaDoc): schema acknowledges contracts exist; required for wedding photographers and therapists; competitors lead with this
3. **Branded invoices** (Stripe billing portal or PDF generation): required for therapists with HSA clients and coaches with corporate clients

### Phase B — Post-Launch

4. **Fix EmailProvider port leak**: architectural debt; blocks swapping email providers
5. **Outlook Calendar** (Microsoft Graph API): expand from Google-only to cover Microsoft-heavy verticals
6. **Video meeting links** (Zoom/Google Meet): essential for virtual coaching and therapy
7. **Deliverable delivery** (shareable project link): photographers need native delivery

### Phase C — Roadmap

8. Review collection automation (Google Business Profile)
9. Apple Calendar / iCal export
10. Pre-booking intake forms
11. Prometheus custom business metrics
12. Email marketing / drip sequences (ConvertKit)

---

## Section 6: Prior Documentation

No prior ADRs or `docs/solutions` documents address integration strategy at the platform level. ADR-011 (`PaymentProvider Interface`) is the only integration-focused ADR, and it covers only the payment abstraction pattern. The `docs/brainstorms/` and `docs/solutions/` directories contain no documents discussing SMS, contracts, invoices, video meetings, or CRM integrations. This is a genuine roadmap gap, not a consciously deferred decision.

---

## Appendix: Full Integration Inventory

| Integration                               | Status      | Port Interface              | Mock Adapter    | Notes                    |
| ----------------------------------------- | ----------- | --------------------------- | --------------- | ------------------------ |
| Stripe (checkout, Connect, subscriptions) | Production  | `PaymentProvider` (partial) | Yes             | Connect bypasses port    |
| Google Calendar (two-way sync)            | Production  | `CalendarProvider`          | Yes             | Service account auth     |
| Postmark (transactional email)            | Production  | `EmailProvider` (partial)   | Yes (file sink) | Port too narrow          |
| Supabase Storage (file uploads)           | Production  | `StorageProvider`           | Local FS        | Auth layer unused        |
| Redis (cache + BullMQ queue)              | Production  | `CacheServicePort`          | In-memory       |                          |
| Google Vertex AI / ADK (agents)           | Production  | None (direct SDK)           | No              | By design                |
| Sentry (error monitoring)                 | Production  | None (direct SDK)           | No              | Standard practice        |
| Prometheus (metrics)                      | Minimal     | None                        | No              | Default metrics only     |
| Outbound Webhooks (tenant endpoints)      | Functional  | N/A                         | N/A             | Tenant-configured        |
| DNS TXT Verification (custom domains)     | Functional  | None                        | No              | Internal service         |
| **SMS (Twilio/Vonage)**                   | **MISSING** | None                        | None            | P1 Gap                   |
| **Contract e-signature (DocuSign)**       | **MISSING** | None                        | None            | P1 Gap                   |
| **Branded invoice / PDF**                 | **MISSING** | None                        | None            | P1 Gap                   |
| **Outlook / Microsoft 365 Calendar**      | **MISSING** | None                        | None            | P2 Gap                   |
| **Video meetings (Zoom/Google Meet)**     | **MISSING** | None                        | None            | P2 Gap                   |
| **Deliverable delivery (Pixieset/Drive)** | **MISSING** | None                        | None            | P2 Gap                   |
| **Review automation (Google Business)**   | **MISSING** | None                        | None            | P2 Gap                   |
| **CRM integration (HubSpot/Zapier)**      | **PARTIAL** | None                        | None            | P2; covered via webhooks |
| **QuickBooks / Xero**                     | **MISSING** | None                        | None            | P3 Gap                   |
| **Apple Calendar / iCal**                 | **MISSING** | None                        | None            | P3 Gap                   |
| **Intake questionnaires**                 | **MISSING** | None                        | None            | P3 Gap                   |
| **Email marketing (ConvertKit)**          | **MISSING** | None                        | None            | P3 Gap                   |
