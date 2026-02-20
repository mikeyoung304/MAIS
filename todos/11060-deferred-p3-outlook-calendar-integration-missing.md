---
status: pending
priority: p3
issue_id: '11060'
tags: [integrations, calendar, outlook, microsoft]
dependencies: []
---

# 11060: Outlook/Microsoft 365 Calendar Integration Missing

## Problem Statement

Many therapists and corporate coaches use Outlook/Microsoft 365 Calendar rather than
Google Calendar. The platform only supports Google Calendar. The `CalendarProvider`
port abstraction is already in place — adding Microsoft Graph API support requires
only a new adapter with no service layer changes.

## Findings

- `ICalendarProvider` port exists (established pattern)
- `GoogleCalendarAdapter` is the only concrete implementation
- Microsoft Graph API provides equivalent OAuth2-based calendar access
- Therapist and corporate coach personas heavily use Outlook

**Existing port interface (already correct):**

```typescript
interface ICalendarProvider {
  getFreeBusy(params: FreeBusyParams): Promise<FreeBusyResult>;
  createEvent(params: CreateEventParams): Promise<CalendarEvent>;
  deleteEvent(eventId: string): Promise<void>;
}
```

## Proposed Solution

1. Implement `MicrosoftCalendarAdapter` in `server/src/adapters/microsoft-calendar/`
2. OAuth2 flow via Microsoft Identity Platform (Azure AD app registration required)
3. Tenant connects Outlook calendar via `/settings/calendar` → redirects to Microsoft OAuth
4. Store Microsoft refresh token encrypted (same pattern as Google tokens)
5. Wire into DI: select adapter based on `tenant.calendarProvider` enum value
6. Add `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` to config + render.yaml

**Schema change needed:**

```prisma
enum CalendarProviderType {
  GOOGLE
  MICROSOFT  // add this
}
```

## Acceptance Criteria

- [ ] `MicrosoftCalendarAdapter` implements `ICalendarProvider` fully
- [ ] OAuth2 connection flow works end-to-end
- [ ] Microsoft refresh token stored encrypted
- [ ] Free/busy check uses read-only scope (see 11062)
- [ ] Event creation/deletion works
- [ ] `MockCalendarAdapter` unchanged (still works for both providers in test mode)
- [ ] Migration for `CalendarProviderType` enum addition

## Effort

Large

## Work Log

- 2026-02-20: Strategic finding from integration review. Low implementation risk due to existing CalendarProvider abstraction.
