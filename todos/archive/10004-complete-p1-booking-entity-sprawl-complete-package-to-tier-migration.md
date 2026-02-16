# TODO 10004: Complete Package → Tier Migration — Booking Entity Sprawl

**Priority:** P1
**Status:** pending
**Source:** Technical Debt Audit 2026-02-13, Issue #3
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Three bookable entities coexist: Package (legacy), Tier (current), Service (scheduling). Booking model has three nullable FKs (`packageId?`, `tierId?`, `serviceId?`). Schema comment at line 268 says "Tier replaces Package" but migration is incomplete.

## Key Files

- `server/prisma/schema.prisma:268,387,482-498` — Three entities + nullable FKs
- `server/src/routes/internal-agent-booking.routes.ts:212-253` — Branching availability logic
- Booking queries require OR across three fields

## Fix Strategy

1. **Audit production data** — How many bookings use packageId vs tierId vs serviceId?
2. **Migrate Package bookings to Tier** — Backfill tierId from packageId where possible
3. **Introduce discriminated bookableType/bookableId** (or just tierId if Service can reference Tier)
4. **Remove Package model** once all references are migrated
5. **Remove nullable FKs** — make tierId required (or bookableId)
6. **Clean up branching logic** in booking routes

## Risk

- Existing bookings reference packageId — need data migration
- External integrations (Stripe) may reference package IDs
