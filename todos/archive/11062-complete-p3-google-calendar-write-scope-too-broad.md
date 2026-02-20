---
status: complete
priority: p3
issue_id: '11062'
tags: [security, google-calendar, oauth-scopes]
dependencies: []
---

# 11062: Google Calendar OAuth Scope Too Broad for Read Operations

## Problem Statement

The Google Calendar sync adapter requests full calendar write scope
(`https://www.googleapis.com/auth/calendar`) even for operations that only need
read access (freeBusy checks for availability). This violates the principle of
least privilege. Requesting unnecessary write scope increases the blast radius if
a token is compromised and may reduce OAuth consent conversion rates (users see
"modify your calendars" instead of "view your calendars").

## Findings

The adapter uses a single OAuth scope for all operations. Free/busy availability
checks only need read-only access:

- `https://www.googleapis.com/auth/calendar` — full read/write (current)
- `https://www.googleapis.com/auth/calendar.readonly` — read-only (for freeBusy)
- `https://www.googleapis.com/auth/calendar.events` — event create/delete only

## Proposed Solution

Request scoped permissions based on required capability:

```typescript
// For availability checks only:
const READ_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// For full integration (availability + booking event creation):
const WRITE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];
```

The OAuth flow should request `WRITE_SCOPES` when the tenant enables full calendar
sync (event creation), and `READ_SCOPES` if they only want availability blocking.

**Note:** Existing tokens use the broader scope — existing tenants are unaffected.
New tenant OAuth flows should use narrower scopes going forward.

## Acceptance Criteria

- [ ] `calendar.readonly` scope used for freeBusy availability checks
- [ ] `calendar.events` scope used (not full `calendar`) for event create/delete
- [ ] OAuth consent screen text updated to reflect narrower scope
- [ ] Existing tokens remain valid (no re-auth required for current users)
- [ ] Unit tests updated to reflect scope change

## Effort

Small

## Work Log

- 2026-02-20: Security finding from integration review. Principle of least privilege violation.
- 2026-02-20: Resolved by design in OAuth adapter. OAUTH_SCOPES = ['calendar.readonly', 'calendar.events'] (not broad 'calendar'). Service account adapter unchanged (separate code path).
