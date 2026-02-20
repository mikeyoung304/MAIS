---
issue_id: 11047
status: pending
priority: p2
tags: [validation, google-calendar, ux]
effort: Small
---

# P2: Service Account JSON Missing Required Field Validation

## Problem Statement

When a tenant pastes a Google service account JSON blob, the system validates only that it is syntactically valid JSON. It does not check for the required fields `client_email` and `private_key`. A user who pastes an arbitrary valid JSON object (e.g., wrong file, partially copied) will receive a confusing error only when the first real Google Calendar API call fails — potentially minutes or bookings later.

## Findings

- Current validation in `CalendarConfigInputSchema` (or equivalent): `z.string().refine(isValidJson)` or similar.
- Google service account JSON requires at minimum: `type`, `client_email`, `private_key`, `token_uri`.
- The critical fields for JWT auth are `client_email` and `private_key`.
- Without these fields, `gcal.jwt.ts` will throw a runtime error on the first API call, not at save time.

## Proposed Solutions

Add a Zod refinement to `CalendarConfigInputSchema` that parses the JSON string and checks for required fields:

```typescript
z.string().refine(
  (val) => {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed.client_email === 'string' && typeof parsed.private_key === 'string';
    } catch {
      return false;
    }
  },
  { message: 'Service account JSON must contain client_email and private_key fields' }
);
```

Return a clear 400 error with a descriptive message so the user knows exactly what is wrong.

## Acceptance Criteria

- [ ] `CalendarConfigInputSchema` validates presence and string type of `client_email` and `private_key`.
- [ ] Saving a service account JSON missing either field returns a 400 with a human-readable error message.
- [ ] Valid service account JSON (with required fields) still saves successfully.
- [ ] Unit tests cover: valid JSON with required fields, valid JSON missing fields, invalid JSON.
- [ ] TypeScript typecheck passes.

## Work Log

_(empty)_
