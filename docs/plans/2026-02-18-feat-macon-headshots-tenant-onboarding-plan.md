---
title: 'feat: Macon Headshots Tenant Onboarding'
type: feat
status: active
date: 2026-02-18
brainstorm: docs/brainstorms/2026-02-18-macon-headshots-tenant-onboarding-brainstorm.md
---

# Macon Headshots — Tenant Onboarding

## Overview

Onboard **Macon Headshots** (headshot photographer in Macon, GA) as a production tenant on the HANDLED platform. This requires **zero code changes** — only a new seed file and registration in the seed runner. The brainstorm has already resolved all modeling decisions.

## Problem Statement / Motivation

Mike Young operates a headshot photography business that needs a professional booking storefront. The HANDLED segment/tier/addon model already supports his pricing structure: 1 segment, 3 tiers with scaling rules, no addons. This is a pure data onboarding task.

## Proposed Solution

Create a production-ready seed file following the Little Bit Horse Farm pattern (closest precedent: single production tenant with `scalingRules` + `SectionContent`).

## Technical Approach

### Phase 1: Seed File Creation

**File:** `server/prisma/seeds/macon-headshots.ts`

**Export:** `seedMaconHeadshots(prisma: PrismaClient): Promise<void>`

#### 1.1 Tenant Record

| Field               | Value                        |
| ------------------- | ---------------------------- |
| `slug`              | `maconheadshots`             |
| `name`              | `Macon Headshots`            |
| `email`             | `mike@maconheadshots.com`    |
| `primaryColor`      | `#1C1917` (warm stone-black) |
| `secondaryColor`    | `#A78B5A` (muted gold)       |
| `accentColor`       | `#5A7C65` (deep sage)        |
| `backgroundColor`   | `#FAFAF7` (warm ivory)       |
| `commissionPercent` | `5.0`                        |

#### 1.2 Segment

Single segment — frontend auto-skips segment selection.

| Field          | Value                                       |
| -------------- | ------------------------------------------- |
| `slug`         | `headshots`                                 |
| `name`         | `Headshot Photography`                      |
| `heroTitle`    | `Premier Headshot Photography`              |
| `heroSubtitle` | `Serving Macon, Middle Georgia, and Beyond` |
| `sortOrder`    | `0`                                         |

#### 1.3 Tiers (3)

**Tier 1: Individual Session**

| Field             | Value                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`            | `individual`                                                                                                                                            |
| `name`            | `Individual Session`                                                                                                                                    |
| `priceCents`      | `20000` ($200)                                                                                                                                          |
| `bookingType`     | `TIMESLOT`                                                                                                                                              |
| `durationMinutes` | `60`                                                                                                                                                    |
| `scalingRules`    | `null`                                                                                                                                                  |
| `sortOrder`       | `1`                                                                                                                                                     |
| `features`        | No time limit, Live image review, Expression coaching, Multiple outfits welcome, 5-7 day retouching turnaround, Images purchased separately ($100 each) |

**Tier 2: Group In-Studio**

| Field             | Value                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`            | `group`                                                                                                                                                  |
| `name`            | `Group In-Studio`                                                                                                                                        |
| `priceCents`      | `50000` ($500 — covers 3 people)                                                                                                                         |
| `bookingType`     | `TIMESLOT`                                                                                                                                               |
| `durationMinutes` | `120`                                                                                                                                                    |
| `scalingRules`    | `{ components: [{ name: "Additional Person", includedGuests: 3, perPersonCents: 10000 }] }`                                                              |
| `sortOrder`       | `2`                                                                                                                                                      |
| `isMostPopular`   | `true`                                                                                                                                                   |
| `features`        | 3 people included, +$100 per additional person, 1 retouched headshot per person, Come together or schedule separately, Live review & expression coaching |

**Tier 3: On-Location**

| Field             | Value                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`            | `on-location`                                                                                                                                       |
| `name`            | `On-Location`                                                                                                                                       |
| `priceCents`      | `150000` ($1,500 minimum)                                                                                                                           |
| `bookingType`     | `DATE`                                                                                                                                              |
| `durationMinutes` | `null`                                                                                                                                              |
| `scalingRules`    | `{ components: [{ name: "Additional Headshot", includedGuests: 10, perPersonCents: 10000 }] }`                                                      |
| `sortOrder`       | `3`                                                                                                                                                 |
| `features`        | Professional studio brought to your location, 10 headshots included, +$100 per additional headshot, Group photos & portraits, Full setup & teardown |

#### 1.4 Section Content (6 blocks, all published)

| Order | BlockType      | Key Content                                                                                       |
| ----- | -------------- | ------------------------------------------------------------------------------------------------- |
| 0     | `HERO`         | "Premier Headshot Photography" / "Serving Macon, Middle Georgia, and Beyond" / CTA: "See Options" |
| 1     | `ABOUT`        | Mike's story — empathy-driven "transform the un-photogenic into unforgettable", "your hype man"   |
| 2     | `FEATURES`     | 3-step How It Works: Schedule → Shoot → Select (cards layout, 3 columns)                          |
| 3     | `SERVICES`     | Title: "Our Sessions" / subtitle / `showPricing: true` (renders from Tier data)                   |
| 4     | `TESTIMONIALS` | 3 representative testimonials (comfort, quality, turnaround)                                      |
| 5     | `CONTACT`      | Base Camp Macon, 1080 3rd Street / mike@maconheadshots.com / 504-417-8242                         |

**Critical:** Pass plain JS objects to Prisma `Json` columns — **never** `JSON.stringify()`. See `docs/solutions/database-issues/prisma-json-double-encoding-seed-cache-amplification.md`.

#### 1.5 Blackout Dates

Standard holidays for 2026:

- July 4 (Independence Day)
- November 26 (Thanksgiving)
- December 25 (Christmas)

### Phase 2: Seed Runner Registration

**File:** `server/prisma/seed.ts`

- [x] Add import: `import { seedMaconHeadshots } from './seeds/macon-headshots';`
- [x] Add `'macon-headshots'` to `SeedMode` union type
- [x] Add `'macon-headshots'` to `getSeedMode()` includes array
- [x] Add case: `case 'macon-headshots': await seedMaconHeadshots(prisma); break;`
- [x] Add to `case 'production':` block (this is a real production tenant)
- [x] Add to `case 'all':` block
- [x] Update JSDoc header with new seed mode

### Phase 3: Verification

- [x] Run `npm run --workspace=server typecheck` — confirm no type errors
- [ ] Run `SEED_MODE=macon-headshots npm exec prisma db seed` — confirm seed succeeds
- [ ] Visit `/t/maconheadshots` locally — confirm storefront renders with all 6 sections
- [ ] Confirm 3 tier cards render with correct pricing (Individual $200, Group "From $500", On-Location "From $1,500")
- [ ] Confirm single-segment mode (no segment picker shown)

## Acceptance Criteria

- [x] Seed file creates tenant + 1 segment + 3 tiers + 6 section content blocks + blackout dates
- [x] All operations are atomic (single `$transaction`)
- [x] Re-running the seed is idempotent (upsert pattern, keys preserved)
- [x] No `JSON.stringify()` on Prisma Json columns
- [x] All queries scoped by `tenantId` (multi-tenant isolation)
- [x] Features stored as plain objects (not stringified)
- [ ] Storefront renders at `/t/maconheadshots` with Hero, About, How It Works, Sessions, Testimonials, Contact
- [x] TypeScript strict — no `any` usage
- [x] Production guard present (blocks in production without `ALLOW_PRODUCTION_SEED=true`)

## Dependencies & Risks

**Dependencies:** None — zero code changes, only new seed data.

**Risks:**

- **Low:** `scalingRules` JSON shape mismatch — mitigated by copying exact structure from Little Bit Farm seed
- **Low:** `SectionContent` schema validation failure — mitigated by following `section-content.schema.ts` types exactly

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-18-macon-headshots-tenant-onboarding-brainstorm.md`
- Closest precedent: `server/prisma/seeds/little-bit-horse-farm.ts`
- Seed utilities: `server/prisma/seeds/utils.ts`
- Seed runner: `server/prisma/seed.ts`
- Section content schemas: `packages/contracts/src/schemas/section-content.schema.ts`
- Block type mapper: `server/src/lib/block-type-mapper.ts`

### Pitfalls to Avoid

- **#1:** Never `JSON.stringify()` Prisma Json columns — auto-serialized (`docs/solutions/database-issues/prisma-json-double-encoding-seed-cache-amplification.md`)
- **#14:** Read existing tenant INSIDE transaction, not outside (stale read prevention)
- **#7:** MAIS uses CUIDs, not UUIDs
