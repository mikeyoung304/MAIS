---
status: pending
priority: p3
issue_id: '11057'
tags: [integrations, sms, twilio, notifications]
dependencies: []
---

# 11057: SMS/Twilio Integration Missing

## Problem Statement

`Customer.phone` is already collected during booking but is never used for notifications.
SMS has 98% open rates vs 20% for email. Service professionals — especially photographers —
rely heavily on day-before reminders to prevent no-shows. The platform currently has no
SMS capability whatsoever.

## Findings

- `Customer` model has a `phone` field that is populated at booking time
- All notifications (booking confirmation, reminders) are email-only via Postmark
- No Twilio SDK or SMS adapter exists anywhere in the codebase
- Competitors HoneyBook and Dubsado both offer SMS reminders

## Proposed Solution

Add a Twilio adapter implementing a `SmsProvider` port (following the `CalendarProvider`
pattern already established):

1. Define `ISmsProvider` port in `packages/contracts/` or `server/src/lib/ports/`
2. Implement `TwilioSmsAdapter` in `server/src/adapters/twilio/`
3. Add `MockSmsAdapter` for test/dev environments
4. Wire into booking confirmation and reminder workflows
5. Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` to config + render.yaml

**Key use cases:**

- Booking confirmation SMS immediately after booking
- Day-before reminder (requires scheduled job or cron)
- Cancellation notification

## Acceptance Criteria

- [ ] `ISmsProvider` port defined with `sendSms(to, body)` interface
- [ ] `TwilioSmsAdapter` implemented and registered in DI
- [ ] `MockSmsAdapter` available for test/mock mode
- [ ] Booking confirmation triggers SMS when phone is present
- [ ] Env vars documented in render.yaml with `sync: false`
- [ ] Unit tests for adapter and notification flow

## Effort

Medium

## Work Log

- 2026-02-20: Strategic finding from integration review. High-value, low-hanging fruit given phone is already collected.
