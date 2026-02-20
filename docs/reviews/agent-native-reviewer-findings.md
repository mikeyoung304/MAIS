# Agent-Native Reviewer Findings: Google Calendar Integration

**Date:** 2026-02-20
**Reviewer:** agent-native-reviewer
**Scope:** 3-agent AI architecture review for Google Calendar integration readiness

---

## Executive Summary

The backend infrastructure for Google Calendar integration is **largely complete**. The `CalendarProvider` port, `GoogleCalendarAdapter`, `GoogleCalendarSyncAdapter`, `GoogleCalendarService`, and event-driven sync are all implemented and wired in `di.ts`. However, **zero agent tools exist** for calendar operations — neither tenant-agent nor customer-agent can read, write, or manage calendar state through conversation. Adding Google Calendar to the agent layer requires new tools in both agents plus new internal API routes to bridge them.

---

## Part 1: Existing Calendar Infrastructure

### 1.1 Backend Calendar Stack (Already Implemented)

**Port:**

- `/Users/mikeyoung/CODING/MAIS/server/src/lib/ports/calendar.port.ts`
- `CalendarProvider` interface defines: `isDateAvailable()`, optional `createEvent()`, optional `deleteEvent()`, optional `getBusyTimes()`

**Adapters:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/gcal.adapter.ts` — `GoogleCalendarAdapter`
  - Reads FreeBusy API (read-only, per-tenant config, 60s cache)
  - Supports per-tenant calendar config decrypted from `tenant.secrets.calendar`
  - Falls back to global env var config, then gracefully degrades to "available" on missing creds
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/google-calendar-sync.adapter.ts` — `GoogleCalendarSyncAdapter` (extends `GoogleCalendarAdapter`)
  - Adds `createEvent()` — creates Google Calendar events with booking metadata
  - Adds `deleteEvent()` — deletes Google Calendar events
  - Adds `getBusyTimes()` — FreeBusy range queries for two-way sync

**Service:**

- `/Users/mikeyoung/CODING/MAIS/server/src/services/google-calendar.service.ts` — `GoogleCalendarService`
  - `createAppointmentEvent()` — wraps `createEvent()` with graceful degradation
  - `cancelAppointmentEvent()` — wraps `deleteEvent()`
  - `getBusyTimes()` — wraps `getBusyTimes()` with graceful degradation

**Mock:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/calendar.provider.ts` — `MockCalendarProvider`
  - Fully implements `CalendarProvider` including `createEvent()` and `deleteEvent()`
  - In-memory event store with `markBusy()` helper for tests

**Wiring (DI):**

- `/Users/mikeyoung/CODING/MAIS/server/src/di.ts` lines 480-501, 678-731
- Real mode: `GoogleCalendarSyncAdapter` instantiated when `GOOGLE_CALENDAR_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` env vars are set
- Event-driven sync: `AppointmentEvents.BOOKED` triggers `createAppointmentEvent()`, `BookingEvents.CANCELLED` triggers `cancelAppointmentEvent()`
- Google Calendar event IDs stored in booking records via `bookingRepo.updateGoogleEventId()`

**Availability Integration:**

- `/Users/mikeyoung/CODING/MAIS/server/src/services/scheduling-availability.service.ts`
  - `SchedulingAvailabilityService.filterGoogleCalendarConflicts()` queries `getBusyTimes()` with 5-minute cache when generating TIMESLOT slots
  - Gracefully degrades if Google Calendar unavailable
- `/Users/mikeyoung/CODING/MAIS/server/src/services/availability.service.ts`
  - `AvailabilityService.checkAvailability()` calls `calendarProvider.isDateAvailable()` for DATE-based bookings (wedding-style)

**Tenant Calendar Settings (HTTP API, NOT agent-accessible):**

- `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts`
  - `GET /v1/tenant-admin/calendar/status` — check if calendar configured
  - `POST /v1/tenant-admin/calendar/config` — save calendar ID + service account JSON (encrypted)
  - `DELETE /v1/tenant-admin/calendar/config` — remove calendar config
  - `POST /v1/tenant-admin/calendar/test` — verify connection to Google Calendar API
  - Protected by `tenantAuthMiddleware` — only direct HTTP callers (dashboard frontend) can use these

**Environment:**

- `/Users/mikeyoung/CODING/MAIS/server/src/config/env.schema.ts` — Tier 3 (optional) vars:
  - `GOOGLE_CALENDAR_ID` — global fallback calendar ID
  - `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` — global service account credentials

---

## Part 2: Agent Tool Inventory

### 2.1 Tenant-Agent Tools (36 total)

Source: `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/tenant/src/tools/`

**Calendar-related tools:** NONE

Relevant context: the `navigateToDashboardSectionTool` mentions "bookings (calendar & appointments)" as a navigation target, but this only navigates the frontend UI — it performs no calendar data operations.

All 36 tenant-agent tools are:

- Navigation (3): `navigate_to_dashboard_section`, `scroll_to_website_section`, `show_preview`
- Vocabulary (1): `resolve_vocabulary`
- Storefront read (2): `get_page_structure`, `get_section_content`
- Storefront write (6): `update_section`, `add_section`, `remove_section`, `reorder_sections`, `publish_section`, `discard_section`
- Branding (1): `update_branding`
- Draft management (3): `preview_draft`, `publish_draft`, `discard_draft`
- Marketing copy (2): `generate_copy`, `improve_section_copy`
- Project management (7): `get_pending_requests`, `get_customer_activity`, `get_project_details`, `approve_request`, `deny_request`, `send_message_to_customer`, `update_project_status`
- Discovery/onboarding (3): `store_discovery_fact`, `get_known_facts`, `build_first_draft`
- Catalog management (3): `manage_segments`, `manage_tiers`, `manage_addons`
- Guided refinement (4): `generate_section_variants`, `apply_section_variant`, `mark_section_complete`, `get_next_incomplete_section`
- Research (1): `delegate_to_research`

### 2.2 Customer-Agent Tools (13 total)

Source: `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/customer/src/tools/`

**Calendar-related tools:** NONE

The `checkAvailabilityTool` calls the `/availability` internal route which queries `SchedulingAvailabilityService` (which does use Google Calendar busy times for TIMESLOT bookings), but the agent has no direct awareness of the calendar integration — it receives available/unavailable slots.

All 13 customer-agent tools are:

- Booking (7): `get_services`, `get_service_details`, `check_availability`, `get_business_info`, `answer_faq`, `recommend_tier`, `create_booking`
- Project (6): `bootstrap_customer_session`, `get_project_status`, `get_prep_checklist`, `answer_prep_question`, `get_timeline`, `submit_request`

### 2.3 Internal API Routes Available to Agents

Source: `/Users/mikeyoung/CODING/MAIS/server/src/routes/internal-agent-booking.routes.ts`

The `/availability` route (POST) does query `schedulingAvailabilityService.getAvailableSlots()`, which internally uses Google Calendar busy times. However:

- Line 254 contains an explicit `TODO`: "Integrate with AvailabilityService for DATE bookings" — DATE-based bookings always return `available: true` without checking Google Calendar
- The TIMESLOT path correctly threads through Google Calendar conflict filtering
- There is no internal agent route for calendar configuration management

---

## Part 3: Gap Analysis for Google Calendar Integration

### P1 Findings (Breaking / Blocking)

**P1-CAL-01: DATE booking availability never checks Google Calendar via agent**

- File: `/Users/mikeyoung/CODING/MAIS/server/src/routes/internal-agent-booking.routes.ts`, lines 252-264
- The `/availability` internal route has a `TODO` and returns `available: true` for all DATE-type bookings without querying `AvailabilityService` (which does check Google Calendar via `calendarProvider.isDateAvailable()`). When a customer-agent calls `check_availability` for a wedding/event date booking, Google Calendar busy status is silently ignored.
- Fix: Wire `AvailabilityService.checkAvailability()` into the DATE branch of the `/availability` route.

**P1-CAL-02: No agent tool exists for tenant to manage calendar connection**

- The tenant-admin calendar config routes are HTTP-only, protected by `tenantAuthMiddleware`. They are not accessible from tenant-agent, which uses `INTERNAL_API_SECRET` authentication.
- If a tenant asks their AI assistant "Can you connect my Google Calendar?" — the agent has no tool to perform or guide this operation.
- Fix: Either expose calendar config management via internal agent routes with new tenant-agent tools, or make tenant-agent aware that it should navigate the user to the settings page via `navigate_to_dashboard_section`.

**P1-CAL-03: No internal API route for calendar status or config accessible to agents**

- The internal agent API at `/v1/internal/agent/*` has no calendar management endpoints at all.
- New tools added to tenant-agent would have no backend routes to call.

### P2 Findings (Significant Gaps)

**P2-CAL-01: No `get_calendar_status` tool for tenant-agent**

- A tenant should be able to ask "Is my Google Calendar connected?" and get an answer in chat.
- Currently there is no tool for this. The tenant-admin HTTP API exists but is not agent-accessible.
- Suggested new tool: `get_calendar_status` (T1) calling an internal route that checks `tenantRepo.findById()` and inspects `tenant.secrets.calendar`.

**P2-CAL-02: No `configure_calendar` or `connect_google_calendar` tool**

- Connecting Google Calendar requires providing a calendar ID and service account JSON — a multi-step, sensitive operation.
- The existing HTTP route (`POST /v1/tenant-admin/calendar/config`) handles encryption and storage, but is not callable by the agent.
- Options: (a) New T3 agent tool proxying to admin calendar config logic via a new internal route, or (b) agent navigates tenant to settings page via `navigate_to_dashboard_section`.

**P2-CAL-03: Customer-agent returns incomplete availability data for DATE bookings**

- Even when Google Calendar is configured, the `/availability` route's DATE branch ignores it (P1-CAL-01). The customer-agent cannot surface calendar-based conflicts to the customer.
- Once P1-CAL-01 is fixed, this should work transparently since the tool already presents available/unavailable dates.

**P2-CAL-04: No `get_calendar_busy_times` or upcoming events tool for tenant-agent**

- Tenant cannot ask "What's on my calendar next week?" or "Show me my blocked days."
- The `GoogleCalendarSyncAdapter.getBusyTimes()` could support this but no tool or internal route exists.

**P2-CAL-05: `getNextAvailableSlot()` does not apply Google Calendar filtering**

- File: `/Users/mikeyoung/CODING/MAIS/server/src/services/scheduling-availability.service.ts`, lines 564-644
- `getNextAvailableSlot()` does not call `filterGoogleCalendarConflicts()` — only `getAvailableSlots()` applies it. If a slot is blocked on Google Calendar but not in the MAIS DB, "book next available" logic may offer that slot.

### P3 Findings (Improvements / Nice-to-Have)

**P3-CAL-01: System prompts do not mention calendar capabilities**

- Neither `TENANT_AGENT_SYSTEM_PROMPT` nor `CUSTOMER_AGENT_SYSTEM_PROMPT` mentions Google Calendar integration, what it does, or how to guide users through setup.
- Once calendar tools are added, both prompts must be updated. The tenant prompt needs a forbidden-word equivalent (e.g., "service account JSON" → "your calendar credentials" or "a key file from Google").

**P3-CAL-02: Availability tool does not distinguish reason for unavailability**

- `checkAvailabilityTool` returns `available: true/false` but not why a slot/date is unavailable.
- `AvailabilityService.checkAvailability()` returns a `reason` field (`booked`, `calendar`, `blackout`). Surfacing this would let the agent say "That date is already on your Google Calendar" vs "That date is already booked by a client."

**P3-CAL-03: `GoogleCalendarSyncAdapter` does not use per-tenant config for `createEvent`/`deleteEvent`**

- File: `/Users/mikeyoung/CODING/MAIS/server/src/adapters/google-calendar-sync.adapter.ts`
- `GoogleCalendarSyncAdapter` uses constructor-injected `this.calendarId` and `this.serviceAccountJsonBase64` (global config) for `createEvent()` and `deleteEvent()`. The per-tenant config lookup (`getConfigForTenant()`) is only used in the inherited `isDateAvailable()`. Tenants who configure their own Google Calendar credentials via `POST /v1/tenant-admin/calendar/config` will have their events written to the global calendar, not their personal one.
- This is a backend service bug independent of agent tools but would be triggered by any booking created through the agent.

**P3-CAL-04: Agent tool architecture for new calendar tools is well-established**

- The pattern for adding calendar tools is clear: (1) create `tools/calendar.ts` with `FunctionTool` instances using `wrapToolExecute` + `validateParams` + `requireTenantId`, (2) export from `tools/index.ts`, (3) import and register in `agent.ts`, (4) add corresponding route in a new `internal-agent-calendar.routes.ts`.
- Trust tier guidance: `get_calendar_status` / `test_calendar_connection` → T1; `configure_calendar` / `remove_calendar` → T3 (modifies secrets).

**P3-CAL-05: Agent comment in navigate.ts suggests calendar is a bookings dashboard section**

- File: `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/tenant/src/tools/navigate.ts`, line 50
- The dashboard navigation description says "bookings (calendar & appointments)" — this implies the bookings view has calendar UI. If that is the case, directing tenants to "bookings" via `navigate_to_dashboard_section` is a valid short-term workaround while calendar tools are not yet implemented.

---

## Part 4: Recommended Tool Architecture for Calendar Integration

### Tools to Add to `tenant-agent`

1. **`get_calendar_status`** (T1, new file `tools/calendar.ts`)
   - Calls: new internal route `GET /v1/internal/agent/calendar/status`
   - Returns: `{ configured: boolean, calendarId: string | null }`
   - Use: tenant asks "Is my Google Calendar connected?"

2. **`configure_calendar`** (T3, same file)
   - Calls: new internal route `POST /v1/internal/agent/calendar/config`
   - Proxies to existing admin calendar config logic (encrypt + store)
   - T3 because it modifies tenant secrets — requires explicit confirmation
   - Use: "Connect my Google Calendar"

3. **`test_calendar_connection`** (T1, same file)
   - Calls: new internal route `POST /v1/internal/agent/calendar/test`
   - Returns: `{ success: boolean, calendarName?: string, error?: string }`
   - Use: troubleshooting after configuration

4. **`remove_calendar`** (T3, same file)
   - Calls: new internal route `DELETE /v1/internal/agent/calendar/config`
   - T3 because it deletes tenant secrets
   - Use: "Disconnect my Google Calendar"

### Tools NOT needed in `customer-agent`

The customer-agent should not access calendar configuration. Calendar-aware availability is already transparently handled through `SchedulingAvailabilityService` once P1-CAL-01 (DATE booking gap) is fixed.

### Internal Routes to Create

New file: `server/src/routes/internal-agent-calendar.routes.ts`

- Must use `INTERNAL_API_SECRET` authentication (same pattern as all agent routes)
- Must scope all operations by `tenantId` from request body
- Wraps the same logic as `tenant-admin-calendar.routes.ts` but with internal auth

---

## Part 5: File Map

| File                                                     | Role         | Calendar Relevance                                                                       |
| -------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `server/src/lib/ports/calendar.port.ts`                  | Interface    | Defines `CalendarProvider` with optional `createEvent`, `deleteEvent`, `getBusyTimes`    |
| `server/src/adapters/gcal.adapter.ts`                    | Adapter      | Read-only FreeBusy, per-tenant config support                                            |
| `server/src/adapters/google-calendar-sync.adapter.ts`    | Adapter      | Full sync: create/delete events, FreeBusy range queries                                  |
| `server/src/services/google-calendar.service.ts`         | Service      | Wraps adapter with graceful degradation                                                  |
| `server/src/services/scheduling-availability.service.ts` | Service      | Uses `getBusyTimes` for TIMESLOT slot generation; `getNextAvailableSlot` gap (P2-CAL-05) |
| `server/src/services/availability.service.ts`            | Service      | Uses `isDateAvailable` for DATE booking availability                                     |
| `server/src/adapters/mock/calendar.provider.ts`          | Mock         | Full mock including event creation/deletion                                              |
| `server/src/routes/tenant-admin-calendar.routes.ts`      | HTTP routes  | Calendar config management (HTTP only, not agent-accessible)                             |
| `server/src/routes/internal-agent-booking.routes.ts`     | Agent routes | `/availability` has DATE booking TODO — P1-CAL-01                                        |
| `server/src/di.ts`                                       | Wiring       | Event-driven sync, calendar adapter instantiation                                        |
| `server/src/config/env.schema.ts`                        | Config       | `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` env vars                      |
| `server/src/agent-v2/deploy/tenant/src/agent.ts`         | Agent        | 36 tools, zero calendar tools                                                            |
| `server/src/agent-v2/deploy/customer/src/agent.ts`       | Agent        | 13 tools, zero calendar tools                                                            |
| `server/src/agent-v2/deploy/tenant/src/tools/`           | Tool dir     | 16 tool files, no `calendar.ts`                                                          |
| `server/src/agent-v2/deploy/customer/src/tools/`         | Tool dir     | 2 tool files, no calendar tools                                                          |

---

## Finding Counts

| Priority | Count | Findings                                                                                                                                                                                                             |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | 3     | DATE booking ignores Google Calendar (P1-CAL-01); no agent calendar management tools (P1-CAL-02); no internal calendar routes for agents (P1-CAL-03)                                                                 |
| P2       | 5     | Missing `get_calendar_status` (P2-CAL-01); missing `configure_calendar` (P2-CAL-02); DATE availability incomplete (P2-CAL-03); no upcoming events tool (P2-CAL-04); `getNextAvailableSlot` bypasses gcal (P2-CAL-05) |
| P3       | 5     | System prompt gaps (P3-CAL-01); reason field not surfaced (P3-CAL-02); per-tenant `createEvent` bug (P3-CAL-03); tool architecture note (P3-CAL-04); navigate workaround exists (P3-CAL-05)                          |

**Total: 13 findings (3 P1, 5 P2, 5 P3)**
