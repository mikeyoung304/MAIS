# 11002 — Seed deleteMany Breaks When Bookings Exist (FK Restrict)

**Status:** complete
**Priority:** P2
**Created:** 2026-02-17
**Source:** code-review (data-integrity-guardian P1-1, downgraded to P2 per triage — no bookings yet)

## Problem

`server/prisma/seeds/little-bit-horse-farm.ts` uses `deleteMany` on Tier and AddOn before recreating them. The Prisma schema defines `Booking.tierId` with `onDelete: Restrict` and `BookingAddOn.addOnId` with `onDelete: Restrict`.

Once Adele receives her first real booking, every subsequent deploy that runs `seed:production` will throw an FK constraint violation. The entire transaction rolls back and the CI pipeline fails.

**Current delete cascade order (lines 246-251):**

```typescript
await tx.tierAddOn.deleteMany({ where: { tier: { tenantId: tenant.id } } });
await tx.tier.deleteMany({ where: { tenantId: tenant.id } }); // FAILS if Booking refs exist
await tx.addOn.deleteMany({ where: { tenantId: tenant.id } }); // FAILS if BookingAddOn refs exist
await tx.sectionContent.deleteMany({ where: { tenantId: tenant.id } });
await tx.segment.deleteMany({ where: { tenantId: tenant.id } });
```

## Proposed Solutions

### Option A: Booking-aware guard with upsert fallback (Recommended)

Check `booking.count()` at start of transaction. If > 0, skip `deleteMany` and use upsert-only path for all entities.

**Pros:** Safe for production, preserves existing IDs, no data loss
**Cons:** Two code paths to maintain
**Effort:** Medium

### Option B: Pure upsert-only pattern

Remove all `deleteMany` calls entirely. Convert section content from `create` to `upsert`. Segments, tiers, and blackout dates already use upsert.

**Pros:** Single code path, always safe, simpler
**Cons:** Can't remove stale tiers/segments that were renamed (orphaned rows persist). Need unique constraint fields for section content upsert where clause.
**Effort:** Medium

### Option C: Delete bookings first (dangerous)

Add `booking.deleteMany` and `bookingAddOn.deleteMany` before tier deletion.

**Pros:** Simple, clean slate guaranteed
**Cons:** Destroys real customer data. Never acceptable in production.
**Effort:** Small but DANGEROUS

## Recommended Action

Option A — booking-aware guard. If `booking.count() > 0`, log a warning and switch to upsert-only. This keeps clean-slate behavior for fresh databases while protecting production data.

## Technical Details

**Affected files:**

- `server/prisma/seeds/little-bit-horse-farm.ts` (lines 246-251)
- Same pattern exists in `plate.ts`, `la-petit-mariage.ts` — should be fixed there too

**Schema references:**

- `Booking.tierId` — `onDelete: Restrict`
- `BookingAddOn.addOnId` — `onDelete: Restrict`

## Acceptance Criteria

- [ ] Seed succeeds on fresh database (no bookings)
- [ ] Seed succeeds on database WITH existing bookings (upsert path)
- [ ] Existing booking FK references remain valid after seed
- [ ] Test covers both paths (with and without bookings)

## Work Log

- 2026-02-17: Created from code review. Triaged as P2 — no bookings exist yet, fix before Adele goes live.
- 2026-02-18: Fixed. Booking count guard added — if bookings exist, skips destructive deleteMany and uses upsert-only. 2 new tests added. Archived with PR fix/deploy-pipeline-reliability.
