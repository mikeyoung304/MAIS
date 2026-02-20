---
issue_id: 11053
status: pending
priority: p2
tags: [ux, google-calendar]
effort: Small
---

# P2: Calendar ID Masking Uses Wrong Format for Non-Email IDs

## Problem Statement

The calendar status endpoint masks the calendar ID using an email-style masking format (e.g., `test@gro...e.com`). While this format works for email-address-style calendar IDs, Google Calendar IDs also commonly appear as `primary` or opaque strings like `abc123@group.calendar.google.com`. Applying email masking to `primary` produces a confusing result. A consistent masking strategy should be used for all calendar ID formats.

## Findings

- The calendar status endpoint returns a masked version of the calendar ID for display.
- Current masking appears to assume an email-like format with `@` character.
- Google Calendar ID formats:
  - `primary` — shorthand for the user's primary calendar
  - `user@example.com` — email-style ID (primary or shared)
  - `abc123def@group.calendar.google.com` — secondary calendar ID
- Masking `primary` as an email produces something like `pri...ry` or a broken format.
- Users need enough of the ID to verify they configured the correct calendar without seeing the full value.

## Proposed Solutions

Use a consistent masking strategy: show the first 8 characters followed by `...` for all calendar ID formats. This is unambiguous regardless of whether the ID is `primary`, an email, or an opaque string.

```typescript
function maskCalendarId(calendarId: string): string {
  if (calendarId.length <= 8) return calendarId;
  return `${calendarId.slice(0, 8)}...`;
}
```

## Acceptance Criteria

- [ ] Calendar ID masking uses "first 8 chars + ..." format for all calendar ID types.
- [ ] `primary` masks to `primary` (8 chars exactly, no truncation needed — or `primary.` if exactly 8).
- [ ] Email-style IDs mask correctly (first 8 chars + ...).
- [ ] Opaque group calendar IDs mask correctly (first 8 chars + ...).
- [ ] Unit tests cover all three format variants.
- [ ] No change to the calendar ID stored in the database — masking is display-only.

## Work Log

_(empty)_
