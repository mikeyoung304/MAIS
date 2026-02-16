---
status: pending
priority: p1
issue_id: 9004
tags: [code-review, stripe, data-integrity]
dependencies: []
---

# webhook-processor.ts Not Listed for Stripe Dual-ID Transition Fix

## Problem Statement

The plan identifies Stripe dual-ID transition as P1-CRITICAL and says "webhook handlers check for BOTH `metadata.tierId` AND `metadata.packageId` during 48-hour transition window." However, `server/src/jobs/webhook-processor.ts` — the primary file that parses Stripe webhook metadata — is NOT listed in any phase's files-to-modify.

This file contains:

- `StripeSessionSchema` with **required** `packageId: z.string()` (line 37)
- `MetadataSchema` with `packageId: z.string().optional()` (line 50)
- Direct usage of `packageId` from metadata in booking processing (lines 227, 260, 404, 423)

**Why it matters:** If the schema still requires `packageId` but new checkout sessions send `tierId`, Zod validation will reject ALL new webhooks. Complete payment processing failure.

## Findings

### Evidence

- `webhook-processor.ts:37` — `packageId: z.string()` (REQUIRED in StripeSessionSchema)
- `webhook-processor.ts:50` — `packageId: z.string().optional()` (in MetadataSchema)
- `webhook-processor.ts:227,260,351,404,423` — Direct packageId usage
- Plan risk table line 981 — mentions "8 webhook handlers" but doesn't list this file
- Plan Phase 6 files-to-modify — webhook-processor.ts NOT listed
- Plan Phase 7 files-to-modify — webhook-processor.ts NOT listed

### Also Missing

- `server/src/services/wedding-booking.orchestrator.ts` — 12+ packageId refs, not listed in Phase 6/7
- `server/src/adapters/prisma/catalog.repository.ts` — 30+ packageId refs, scope underestimated

## Proposed Solutions

### Option A: Add to Phase 6 files-to-modify (Recommended)

1. Update `StripeSessionSchema` to accept either `packageId` OR `tierId`
2. Update `MetadataSchema` to make packageId optional, add tierId optional
3. Add resolution helper: `const tierId = metadata.tierId ?? await lookupTierByPackageId(metadata.packageId)`
4. Update all downstream usage to use resolved tierId

- **Effort:** Medium
- **Risk:** Low — dual-ID pattern is well understood

### Option B: Add separate Phase 6b for Stripe migration

- **Effort:** Medium
- **Risk:** Low

## Recommended Action

<!-- Fill during triage -->

## Technical Details

**Affected files:**

- `server/src/jobs/webhook-processor.ts` — Zod schemas + metadata handling
- `server/src/services/wedding-booking.orchestrator.ts` — 12+ packageId refs
- `server/src/adapters/prisma/catalog.repository.ts` — 30+ packageId refs
- `server/src/services/booking.service.ts` — Already listed, but scope underestimated

**Affected phases:** Phase 6 (booking backend), Phase 7 (Package deletion)

## Acceptance Criteria

- [ ] `webhook-processor.ts` accepts both `tierId` and `packageId` in metadata
- [ ] `wedding-booking.orchestrator.ts` uses tierId
- [ ] Zod schemas updated for dual-ID transition
- [ ] All 3 files added to plan's files-to-modify

## Work Log

| Date       | Action                        | Learnings                                                           |
| ---------- | ----------------------------- | ------------------------------------------------------------------- |
| 2026-02-12 | Discovered during plan review | Plan risk table identified the problem but file list missed the fix |

## Resources

- `server/src/jobs/webhook-processor.ts:37,50,227,260`
- `server/src/services/wedding-booking.orchestrator.ts:30,73,89,135,164`
- Plan risk table: line 981
