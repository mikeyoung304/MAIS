# Storefront MVP Template Redesign

**Date:** 2026-02-17
**Status:** Complete
**Participants:** Mike + Claude

## What We're Building

A **default storefront template** that ships to every HANDLED tenant. The MVP layout is **Hero → Services → About → CTA**, with a premium aesthetic, CSS-only entrance animations, and responsive segment cards optimized for conversion through clear use-case matching.

This is NOT a one-off fix for littlebit.farm — it's the standard storefront experience for the platform. Segment detail pages are in scope — the template covers the full click-through from landing to tier selection.

## Why This Approach

**Core insight:** The current storefront shows a menu, not a story. There's no emotional hook, no trust-building, no narrative flow. Visitors see segment cards with Airbnb fee text and operational details — there's nothing selling the _experience_.

**First impression goal:** "This place is real." Authenticity first. Trust before conversion.

**Design philosophy:** Premium sites let imagery and whitespace do the emotional work. Copy gives permission to feel it. Fewer words = more expensive feeling.

## Key Decisions

### 1. Hero Section — Full-Bleed Photo

- **Large background image** with **bottom-heavy gradient overlay** (`transparent → rgba(0,0,0,0.6)`) — keeps image vivid at top, ensures text readability at bottom
- **Minimal text:** Headline (6-8 words), one-line subheadline, single CTA button
- **CTA links to `#services`** (the segment section)
- **No-image fallback:** Brand color gradient using tenant's accent colors. Still looks designed, not broken.
- Next.js `Image` with `priority` (no lazy-load — it's above the fold)

### 2. Entrance Animation — CSS-Only Fade-Up Reveal

- **Pattern:** Elements fade in + slide up 12px with staggered timing
  - Headline: 0ms delay
  - Subheadline: 150ms delay
  - CTA button: 300ms delay
- **Pure CSS `@keyframes`** — 0KB bundle cost, works before JS hydration
- **Respects `prefers-reduced-motion`** — instant display when motion is disabled
- **Reusable:** Same fade-up applies to below-fold sections via Intersection Observer (one small utility)
- No Framer Motion (~30KB gzipped, requires hydration)

### 3. Page Flow — Hero → Services → About

| Section                 | Purpose     | Emotional Job                           |
| ----------------------- | ----------- | --------------------------------------- |
| **Hero**                | Hook        | "I want to know more"                   |
| **Services** (Segments) | Self-select | "This one's for me"                     |
| **About**               | Trust       | "These are real people, I believe them" |
| **CTA**                 | Convert     | "I'm ready — let me book"               |

**Why Services before About:** Show them what you've got, THEN tell them why they should trust you. More action-oriented. Similar to Airbnb (listings before host profiles).

**Closing CTA:** Simple full-width accent bar at the bottom. Catches visitors who scrolled through everything but haven't committed. One headline + one button.

### 4. Segment Cards — Use-Case Matching, No Pricing

**Current problems (all of them):**

- Airbnb fee text dominates each card (operational info where selling copy should be)
- Cards look identical — nothing differentiates the three experiences
- Not enough info to understand what you're getting
- Generic dark image overlays

**New design:**

- **Content:** Segment name + compelling one-liner only. No pricing on card.
- **Click driver:** Clear use-case match — visitor self-selects by situation ("This is for my wedding" / "This is for our team retreat")
- **Price reveal:** Pricing appears AFTER clicking into the segment detail page. Reduces sticker shock, increases curiosity.
- **Layout:** Responsive card grid
  - 1 segment → full-width feature card
  - 2 segments → 2-column grid
  - 3 segments → 3-column grid
  - 4+ segments → scroll/carousel (TBD)
- **Visual differentiation:** Each card needs a distinct image/mood that signals its use case

### 5. About Section — Hybrid Story + Experience

**Structure:** One paragraph about the place/feeling, one about the person behind it.

**Content source:** 10 onboarding questions designed to elicit authentic, sensory-specific material:

**Story questions:**

1. What made you start this business?
2. What do you want people to feel when they leave?
3. What's something about your space/service that surprises first-time visitors?
4. How long have you been doing this, and what did you do before?
5. What's your favorite part of what you do?

**Experience questions:** 6. Describe your space or experience in 3 words. 7. What's the first thing people notice when they arrive? 8. What do your happiest clients have in common? 9. Is there a moment during the experience that you're most proud of? 10. If a friend was visiting for the first time, how would you describe what to expect?

**Why these work:** Questions 6, 7, and 10 elicit sensory specifics — the raw material that makes AI-generated copy feel real instead of generic. The AI can't invent authentic details; it can only rearrange what the tenant provides.

### 6. Services Section Heading — Smart Default + Override

- **Default heading:** "What brings you here?" — conversational, works for any business type, drives self-selection
- **Override:** If the tenant's SERVICES SectionContent has a custom `title`, use that instead (e.g., "Experiences" for littlebit.farm)
- **Subheadline:** Same pattern — default "Choose the experience that fits your needs." with tenant override via `subtitle` field

### 7. Segment Detail Pages — Story + Tier Cards

When a visitor clicks a segment card, the detail page continues the narrative:

- **Segment intro:** Brief story paragraph about this segment ("Your ceremony, your way. Whether it's just the two of you or a small gathering...")
- **Tier cards:** The 2-3 tiers within that segment, now showing:
  - Tier name
  - Description
  - Price (this is the price reveal — first time they see numbers)
  - What's included (features list)
  - "Book" CTA
- **Same animation treatment:** Fade-up reveal on scroll
- **Content source:** Tier descriptions from the Tier model, segment intro from seed/agent-generated content

### 8. Mobile Layout — Single Column Stack

- Segment cards stack to full-width single column on mobile
- Hero maintains full-bleed, text scales down
- About section image stacks above text (not side-by-side)
- Touch-friendly: all tap targets ≥ 44px

### 9. Existing Code Bugs to Fix

Two silent rendering bugs contribute to the current empty page:

1. **`about` type dropped from home page:** `buildHomeSections()` in `TenantLandingPage` only collects `s.type === 'text'` for pre-sections. `ABOUT` → `about` sections silently vanish. Fix: include `|| s.type === 'about'`.

2. **`SERVICES` block renders null:** `ServicesContentSchema` stores only display settings (title/subtitle) — no `items` array. `FeaturesSection` requires non-empty `features` array and returns null. The actual services come from `SegmentTiersSection` via the Tier model. This block type is architecturally orphaned.

3. **Hero CTA hard-coded:** Component hard-codes `href={basePath + '#packages'}` regardless of `ctaLink` in DB. Should use the DB value, defaulting to `#services`.

## Resolved Questions

1. ~~**Closing CTA section?**~~ → **Yes.** Simple full-width accent bar at bottom with headline + button.
2. ~~**"What brings you here?" heading**~~ → **Smart default + override.** Default "What brings you here?" with tenant override from SectionContent.
3. ~~**Segment detail pages**~~ → **In scope.** Segment story paragraph + tier cards with pricing (price reveal page).
4. ~~**Mobile breakpoints**~~ → **Single column stack.** Cards go full-width vertically.
5. ~~**Header/nav styling**~~ → **Keep minimal.** Current nav (tenant name + Home + Book Now) is clean and functional. No changes.
6. ~~**Image upload flow**~~ → **Seed/manual for MVP.** Images are seeded or manually added. Build upload flow later.
7. ~~**Tier card design**~~ → **Individual cards.** Each tier as its own card with name, price, description, features, and Book button. Works for any number of tiers.
8. ~~**Segment intro content**~~ → **Use `Segment.description`.** Existing field is enough. Ensure the agent writes a compelling description during onboarding.

## Open Questions

None — all design questions resolved.

## What We're NOT Building (YAGNI)

- Custom section ordering per tenant (MVP uses fixed Hero → Services → About → CTA)
- Parallax scrolling or complex scroll effects
- Video heroes
- Multiple page templates
- A/B testing infrastructure
- Custom font selection per tenant
- Nav redesign (current nav is sufficient)
- Image upload UI (images are seed/manual for MVP)
- Tier comparison tables (individual cards work for any tier count)
- New database fields for segment intros (use existing `Segment.description`)

## Technical Constraints

- **CSS-only animations** — no Framer Motion, no GSAP
- **Next.js Image** with priority for hero, lazy for below-fold
- **Same component tree for all tenants** — no per-tenant custom layouts
- **Lightweight:** Every decision must work for thousands of storefronts
- **Intersection Observer** — one shared utility for scroll-triggered fade-ins
