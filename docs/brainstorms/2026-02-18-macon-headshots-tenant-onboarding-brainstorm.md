# Macon Headshots — Tenant Onboarding Brainstorm

**Date:** 2026-02-18
**Status:** Complete
**Next:** `/workflows:plan` to implement seed + storefront content

---

## What We're Building

Onboarding **Macon Headshots** (maconheadshots.com) — a headshot photographer in Macon, GA — as a HANDLED tenant. This brainstorm captures how Mike Young's pricing model maps into the segment/tier/addon system with zero code changes.

### Tenant Profile

| Field            | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| **Business**     | Macon Headshots                                                |
| **Owner**        | Mike Young                                                     |
| **Email**        | mike@maconheadshots.com                                        |
| **Phone**        | 504-417-8242                                                   |
| **Location**     | Base Camp Macon, 1080 3rd Street, Macon, GA 31201              |
| **Instagram**    | @maconheadshots                                                |
| **Segment type** | Photographer (headshots)                                       |
| **Current site** | Squarespace (maconheadshots.com)                               |
| **Brand voice**  | Warm, self-deprecating humor, empathy-driven ("your hype man") |
| **Core promise** | "Transform the un-photogenic into unforgettable"               |

---

## Why This Approach

### Key Decision: 1 Segment, 3 Tiers (not 3 Segments)

**The tension:** Mike offers three service types — Individual, Group, On-Location. Should these be 3 segments or 3 tiers?

**Answer: 3 Tiers within 1 Segment.**

**Reasoning:**

- **Segments** are for fundamentally different service categories serving different audiences (e.g., Little Bit Farm: "Elopements" vs "Corporate Retreats" — different experiences, different customers).
- **Tiers** are for variations of the same core service with different delivery models.
- Individual / Group / On-Location are all **headshot photography** — same core service, different delivery.
- 1 segment means customers land on **one page** and compare all 3 options side-by-side. Clean, no extra clicks.
- 3 segments would force "pick a segment → see 1 lonely tier card" — unnecessary friction for this business.

### Key Decision: A-La-Carte Preserved (No Forced Bundles)

Mike's individual pricing is $200 session + $100/image purchased in-person. The system only books the $200 session fee. Image sales happen separately during the shoot via in-person transaction. No addon complexity needed.

### Key Decision: No Addons at Launch

Rush delivery and other extras can be handled conversationally or via email. Keeps the booking flow focused: pick a tier → book → done.

### Key Decision: Minimums Baked Into Base Price

- Group minimum (3 people) → `priceCents: 50000` ($500 covers 3)
- On-Location minimum (10 headshots) → `priceCents: 150000` ($1,500 covers 10)
- `scalingRules` handle per-person costs beyond the included count
- No new "minimum price" feature needed

---

## The Model

### Segment

```
Segment: "Headshot Photography"
slug: "headshots"
```

Single segment. Since there's only 1 segment, the frontend skips segment selection and shows tiers directly.

### Tier 1: Individual Session

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| `slug`              | `individual`                                          |
| `name`              | Individual Session                                    |
| `priceCents`        | 20000 ($200)                                          |
| `displayPriceCents` | null                                                  |
| `bookingType`       | TIMESLOT                                              |
| `durationMinutes`   | 60 (default slot, though "no time limit" in practice) |
| `scalingRules`      | null                                                  |
| `maxGuests`         | null                                                  |
| `sortOrder`         | 1                                                     |

**Features:**

- No time limit
- Live image review
- Expression coaching
- Multiple outfits welcome
- 5–7 day retouching turnaround
- Images purchased separately in session ($100 each)

**How it works:** Customer books $200 session online. Shows up, shoots with Mike (no time limit, live review, expression coaching). After shoot, reviews images with Mike and purchases favorites at $100/image in a separate in-person transaction. Retouched images delivered digitally in 5–7 days.

### Tier 2: Group In-Studio

| Field               | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `slug`              | `group`                                                                                     |
| `name`              | Group In-Studio                                                                             |
| `priceCents`        | 50000 ($500 — covers 3 people)                                                              |
| `displayPriceCents` | null                                                                                        |
| `bookingType`       | TIMESLOT                                                                                    |
| `durationMinutes`   | 120 (TBD)                                                                                   |
| `scalingRules`      | `{ components: [{ name: "Additional Person", includedGuests: 3, perPersonCents: 10000 }] }` |
| `maxGuests`         | null                                                                                        |
| `sortOrder`         | 2                                                                                           |

**Features:**

- 3 people included
- +$100 per additional person
- 1 retouched headshot per person
- Come together or schedule separately
- Live review & expression coaching

**How it works:** Group books online, selects headcount (min 3). $500 base covers 3 people, +$100 per additional person. Each person gets 1 retouched headshot included. Group can arrive together or stagger their sessions — same rate either way.

**Display:** "From $500" (auto-generated by `formatPriceDisplay` when scaling rules present)

### Tier 3: On-Location

| Field               | Value                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `slug`              | `on-location`                                                                                  |
| `name`              | On-Location                                                                                    |
| `priceCents`        | 150000 ($1,500 minimum)                                                                        |
| `displayPriceCents` | null                                                                                           |
| `bookingType`       | DATE                                                                                           |
| `durationMinutes`   | null (full event)                                                                              |
| `scalingRules`      | `{ components: [{ name: "Additional Headshot", includedGuests: 10, perPersonCents: 10000 }] }` |
| `maxGuests`         | null                                                                                           |
| `sortOrder`         | 3                                                                                              |

**Features:**

- Professional studio brought to your location
- 10 headshots included
- +$100 per additional headshot
- Group photos & portraits
- Full setup & teardown

**How it works:** Mike brings the studio to the client's office/event. $1,500 base covers setup + 10 headshots. Beyond 10, +$100 per person. For groups under 10, Mike works with the client to fill the package with additional deliverables (3/4 body portraits, group photos, etc.) to reach the $1,500 value. Most on-location clients have 10+ people, so the minimum is rarely an issue.

**Display:** "From $1,500"

### Visual Summary

```
┌──────────────────────────────────────────────────────────────────┐
│  Segment: Headshot Photography                                    │
│                                                                    │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │
│  │  Individual  │  │  Group In-Studio │  │    On-Location      │  │
│  │              │  │  ★ Most Popular  │  │                     │  │
│  │    $200      │  │   From $500      │  │   From $1,500       │  │
│  │   /session   │  │                  │  │                     │  │
│  │              │  │ 3 people incl.   │  │ 10 headshots incl.  │  │
│  │ No time      │  │ +$100/person     │  │ +$100/headshot      │  │
│  │ limit        │  │ 1 headshot each  │  │ Studio brought      │  │
│  │ Live review  │  │ Together or      │  │ to you              │  │
│  │ $100/image   │  │ separate         │  │ Group photos        │  │
│  │ in session   │  │                  │  │ included            │  │
│  │              │  │                  │  │                     │  │
│  │ [Book Now]   │  │   [Book Now]     │  │   [Book Now]        │  │
│  └─────────────┘  └──────────────────┘  └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Storefront Content (Section Ideas)

Beyond the tier cards, the storefront should include:

### Hero Section

- **Headline:** "Premier Headshot Photography"
- **Subtitle:** "Serving Macon, Middle Georgia, and Beyond"
- **CTA:** "See Options" → scrolls to tiers
- **Background:** Portfolio headshot sample

### About Section

- Mike's story: "I spent my life dreading having my picture taken"
- Mission: empathy-driven, "transform the un-photogenic into unforgettable"
- Personality: "your hype man and brand ambassador"

### How It Works (3-step)

- **Schedule** — Book online, bring multiple outfits
- **Shoot** — No time limit, live review, expression coaching
- **Select** — Pick your favorites, retouched and delivered digitally

### Testimonials

- Comfort and ease during session
- Quality that surprises colleagues
- Fast turnaround, flexible scheduling

### Contact

- Base Camp Macon, 1080 3rd Street, Macon, GA 31201
- mike@maconheadshots.com
- 504-417-8242

---

## Implementation Details

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| **Setup method** | Seed file (`server/prisma/seeds/macon-headshots.ts`) |
| **Tenant slug**  | `maconheadshots`                                     |
| **Payment**      | Full payment at booking                              |
| **URL**          | `/t/maconheadshots`                                  |

## Open Questions

_None — all resolved during brainstorm dialogue._

## Resolved Questions

1. **3 segments vs 3 tiers?** → 3 tiers. Same core service, different delivery models.
2. **Group in-studio: 2 sub-tiers (together vs separate)?** → No. Same rate either way. Simplified.
3. **Separate scheduling addon?** → Skipped. Unnecessary complexity.
4. **On-location: flat fee vs scaling?** → $1,500 base with scaling. 10 included, +$100/person.
5. **Image purchasing: in-system or in-person?** → In-person for Individual. Included for Group/On-Location.
6. **Addons at launch?** → None. Rush delivery handled conversationally.
7. **Booking type?** → Individual/Group: TIMESLOT. On-Location: DATE.
8. **Frontend quantity picker for images?** → Not needed. Images purchased separately in-person.

---

## Compatibility Notes

**Zero code changes required.** This model uses:

- `scalingRules` (existing) for per-person pricing
- `priceCents` baked minimums (existing pattern from Little Bit Farm)
- Single-segment display (existing, auto-skips segment selection)
- 3-tier grid with "Most Popular" badge (existing)
- `bookingType: DATE` vs `TIMESLOT` (existing)
- `features` array for "how it works" explanation (existing)

**Precedent:** La Petit Mariage uses single-tier segments. Little Bit Farm uses `scalingRules` + `displayPriceCents`. Demo Business uses addons. This tenant combines patterns already proven in the codebase.
