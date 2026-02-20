---
issue_id: 11055
status: pending
priority: p2
tags: [performance, database, google-calendar]
effort: Small
---

# P2: Missing Composite Index on (tenantId, googleEventId) for Booking Lookups

## Problem Statement

`Booking.googleEventId` lacks a composite index on `(tenantId, googleEventId)`. Google Calendar webhook callbacks that need to find which booking corresponds to a calendar event must do a full table scan on the `Booking` table. As booking volume grows, this becomes a significant performance problem and threatens the reliability of calendar sync.

## Findings

- Google Calendar sends webhook notifications when events are updated/cancelled.
- The webhook handler must look up the booking by `googleEventId` to process the update.
- Without a composite index, this query is `O(n)` across all bookings for the tenant.
- The `Booking` table will grow unboundedly as the platform is used — this index gap gets worse over time.
- Multi-tenant isolation requires `tenantId` as the leading column of the index.
- The Prisma schema supports `@@index` for composite indexes.

## Proposed Solutions

Add a composite index to the `Booking` model in the Prisma schema:

```prisma
model Booking {
  // ... existing fields ...
  googleEventId String?

  @@index([tenantId, googleEventId])
}
```

Then run `npx prisma migrate dev --name add_booking_google_event_id_index`.

## Acceptance Criteria

- [ ] `@@index([tenantId, googleEventId])` is added to the `Booking` model in `schema.prisma`.
- [ ] A Prisma migration is generated and applied.
- [ ] The index is confirmed present in the database (via `\d+ "Booking"` in psql or migration review).
- [ ] No changes to application code required (Prisma uses indexes transparently).
- [ ] Migration runs cleanly in CI.

## Work Log

_(empty)_
