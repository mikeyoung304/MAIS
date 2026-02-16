---
status: pending
priority: p1
issue_id: 9012
tags: [code-review, schema, plan-gap]
dependencies: []
---

# Missing Prisma Relations — Tenant.tiers[] and AddOn.tiers[]

## Problem Statement

Phase 1 adds `tenantId` to Tier with `tenant Tenant @relation(...)` back-reference. However, the current Tenant model does NOT have a `tiers Tier[]` relation array. Prisma requires both sides of a relation to be declared. Schema will fail validation.

Similarly, Phase 1 creates `TierAddOn` model but doesn't mention adding `tiers TierAddOn[]` to the AddOn model. The current AddOn model has `packages PackageAddOn[]` but no `tiers TierAddOn[]`.

## Findings

- Architecture Strategist P1-04: Explicit evidence at schema.prisma:37-155 (Tenant) and :411-434 (AddOn)
- Tenant model has `packages Package[]` (line 128) but no `tiers Tier[]`
- AddOn model has `packages PackageAddOn[]` (line 427) but no `tiers TierAddOn[]`

## Proposed Solutions

### Option A: Add to Phase 1 schema migration (Recommended)

- Add `tiers Tier[]` to Tenant model
- Add `tiers TierAddOn[]` to AddOn model
- Add `bookings Booking[]` to Tier model (for the new Booking.tierId relation)
- **Effort:** Tiny — 3 lines in schema

## Acceptance Criteria

- [ ] Tenant model has `tiers Tier[]` relation
- [ ] AddOn model has `tiers TierAddOn[]` relation
- [ ] Tier model has `bookings Booking[]` relation
- [ ] `npx prisma validate` passes

## Work Log

| Date       | Action                   | Learnings                                    |
| ---------- | ------------------------ | -------------------------------------------- |
| 2026-02-12 | Schema validation review | Prisma requires both sides of every relation |
