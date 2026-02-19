---
status: pending
priority: p2
issue_id: '11016'
tags: [code-review, frontend, storefront, seed, data-transform, testimonials]
---

# P2-01 — Testimonials Transform: Seed Is the Bug Source, Presentation Layer Is the Wrong Fix

## Problem Statement

`storefront-utils.ts` maps `name → authorName` and `role → authorRole` to fix a seed authoring defect. This masks the real bug in the seed. Additionally, the current transform has null-safety issues and misses `authorPhotoUrl`. 5-agent convergence — highest confidence finding in this review.

## Findings

- **Files:**
  - `apps/web/src/lib/storefront-utils.ts:102-118` (wrong-layer fix + bugs)
  - `server/prisma/seeds/macon-headshots.ts:490-507` (root cause)
- **Root cause:** `TestimonialsSectionSchema` requires `authorName`/`authorRole`, but seed writes `name`/`role`
- **Consequences:**
  1. Raw `SectionContent.content` JSON fails Zod validation
  2. AI agents write `authorName`/`authorRole` (correct); seed uses `name`/`role` (wrong) — two formats silently coexist
  3. Any future server-side consumer sees wrong field names
- **Code bugs in current transform:**
  - `as Record<string, unknown>[]` cast: if DB returns `[null, {...}]`, `{ ...null }` throws `TypeError`
  - `if (out.name && ...)` truthiness: skips remap when `out.name === ""`
  - No remap for `authorPhotoUrl` → silently drops testimonial images

## Proposed Solution

### Step 1: Fix the seed (root cause)

Change `name`/`role` to `authorName`/`authorRole` in `server/prisma/seeds/macon-headshots.ts`

### Step 2: Fix the transform (defensive safety net)

```typescript
case 'testimonials':
  if (Array.isArray(transformed.items)) {
    transformed.items = (transformed.items as unknown[])
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => {
        const out = { ...item };
        // Safety net: seed data may use legacy field names
        if (out.name !== undefined && !out.authorName) {
          out.authorName = out.name;
          delete out.name;
        }
        if (out.role !== undefined && !out.authorRole) {
          out.authorRole = out.role;
          delete out.role;
        }
        if ((out.photo || out.photoUrl) && !out.authorPhotoUrl) {
          out.authorPhotoUrl = out.photo ?? out.photoUrl;
          delete out.photo;
          delete out.photoUrl;
        }
        return out;
      });
  }
  break;
```

## Known Pattern

- `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md` — null defeats array defaults
- `docs/solutions/patterns/tenant-storefront-content-authoring-workflow.md` — `transformContentForSection` is the seam for field aliasing

## Acceptance Criteria

- [ ] Seed uses `authorName`/`authorRole`/`authorPhotoUrl` (not `name`/`role`)
- [ ] Transform null-guards array items with `typeof item === 'object' && item !== null`
- [ ] Truthiness check replaced with `!== undefined`
- [ ] `authorPhotoUrl` remap added
- [ ] Testimonial images render correctly on macon-headshots storefront
- [ ] Tests pass

## Work Log

- 2026-02-18: Created from 5-agent review (5-way convergence)
