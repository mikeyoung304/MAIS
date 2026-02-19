# Storefront Full Template Redesign

**Date:** 2026-02-18
**Status:** Complete
**Participants:** Mike + Claude
**Extends:** `docs/brainstorms/2026-02-17-storefront-mvp-template-redesign-brainstorm.md` (lean MVP)

## What We're Building

A **complete 7-section storefront template** that ships to every HANDLED tenant, replacing the lean 4-section MVP plan from 2026-02-17. The full layout is:

**Hero → How It Works → Services → About → Testimonials → FAQ → CTA**

With strategic CTA anchor links throughout, section-based navigation with smooth scrolling, and a polished FAQ accordion. This is the production template — not a one-off fix for littlebit-farm.

### Why Expand from 4 to 7 Sections

The lean MVP (Hero → Services → About → CTA) was a valid starting point, but the live demo at gethandled.ai/t/littlebit-farm revealed gaps:

1. **No process explanation** — visitors see offerings without understanding how booking works
2. **No social proof** — zero testimonials means zero trust signals
3. **FAQ is a wall of text** — flat cards with no interactivity, most users scroll past
4. **Navigation is too minimal** — only Home + Book Now, no section anchoring
5. **Footer is bare bones** — no social links, no contact info

The trust-first funnel (with escape-hatch CTAs) addresses all of these while keeping the page focused on conversion.

## Why This Approach

**Trust-first with escape hatches:** The page tells a story top-to-bottom (understand → explore → trust → decide), but strategic CTA buttons at Hero and after Services let impatient buyers skip ahead. This is the "Netflix browse" pattern — sequential narrative with shortcut access.

**Section emotional flow:**

| Section          | Purpose     | Emotional Job               | CTA?                 |
| ---------------- | ----------- | --------------------------- | -------------------- |
| **Hero**         | Hook        | "I want to know more"       | Yes → `#services`    |
| **How It Works** | Orient      | "Oh, that's easy"           | No                   |
| **Services**     | Self-select | "This one's for me"         | Yes → segment detail |
| **About**        | Trust       | "These are real people"     | No                   |
| **Testimonials** | Validate    | "Others loved it"           | No                   |
| **FAQ**          | Reassure    | "My concerns are addressed" | No                   |
| **CTA**          | Convert     | "I'm ready to book"         | Yes → `#services`    |

## Key Decisions

### 1. Section Order: Hero → How It Works → Services

**Previous plan:** Hero → Services → About (services-first, Airbnb pattern)
**New order:** Hero → How It Works → Services (process-first, trust funnel)

**Why the change:** The user observed that showing offerings before explaining the process confused visitors. "How It Works" above Services builds understanding → reduces friction when evaluating specific experiences. Research confirms: Hero → Problem/Process → Solution → Social Proof → CTA is the highest-converting funnel for service businesses.

**CTA shortcut:** The Hero CTA says "Explore Experiences" and links to `#services`, letting ready-to-act visitors skip How It Works entirely.

### 2. How It Works — Numbered Steps

**Pattern:** 3-4 numbered steps in a horizontal row (desktop) / vertical stack (mobile).

```
  ①                ②                ③
Choose Your     Book Your       Show Up &
Experience      Date            Enjoy

Browse our      Reserve your    We handle
services and    preferred date  everything
pick what       and time.       on-site.
fits.
```

**Design:**

- Large step numbers (accent color, `text-4xl font-bold`)
- Short headline per step (`font-heading text-lg font-semibold`)
- 1-line description (`text-muted-foreground`)
- Responsive: 3-col grid desktop → single column mobile
- Scroll-reveal animation with staggered entrance per step

**Why numbered steps over alternatives:**

- **Icons alone** don't convey sequence (visitors miss the order)
- **Visual timelines** add complexity for marginal visual gain
- **Numbered steps** are universally understood, scannable, and work for any business type

**Content:** Steps are NOT stored in the database (no new model). They're derived from a simple config in the component — the agent can't edit them. For MVP, the steps are generic and work for all tenants. Per-tenant customization is a future enhancement.

### 3. FAQ — Accordion Upgrade

**Current:** `FAQSection.tsx` renders flat cards (all answers visible, no interactivity)
**Existing asset:** `FAQAccordion.tsx` already implements a full interactive accordion

**Approach:** Port the accordion pattern from `FAQAccordion.tsx` into `FAQSection.tsx`. Specifically:

- CSS Grid `grid-template-rows: 0fr → 1fr` for smooth height animation
- Chevron rotation (180°) with `transition-transform duration-300`
- Arrow key navigation between items (Up/Down/Home/End)
- ARIA: `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`
- `motion-reduce:transition-none` for prefers-reduced-motion
- First item open by default (gives visitors an immediate answer)

**No new dependency needed.** This is a copy of existing proven code.

**FAQ JSON-LD:** Add `FAQPage` structured data for SEO. Each tenant's FAQ gets its own schema markup. High-ROI SEO investment — AI search tools (Google AI Overviews, Perplexity) extract structured FAQ data for citations.

### 4. Navigation — Section Scroll Links

**Current:** Home + Book Now only
**New:** Home | Services | About | FAQ | Book Now

**Design:**

- Smooth-scroll to anchored sections (`scroll-behavior: smooth` + `scroll-padding-top` for sticky nav offset)
- Active link highlighting based on scroll position (Intersection Observer on each section)
- Sticky header with blur backdrop (already implemented: `bg-white/80 backdrop-blur-lg`)
- Mobile: hamburger menu with same section links

**Implementation:** Extend `TenantNav.tsx` to generate nav items from available sections. Not all tenants will have all sections — nav items should only appear for sections that exist in the tenant's content.

### 5. Experience Cards — Short Teaser Only

**Previous:** Cards dump house rules and Airbnb fee text into description
**New:** Cards show segment name + compelling 1-line description only

**Price reveal pattern:** Pricing appears AFTER clicking into segment detail. Reduces sticker shock, increases curiosity.

**Detail view:** Expanded segment view shows:

- Segment story paragraph (`segment.description`)
- Tier cards with pricing, features, and Book CTA
- Same scroll-reveal animation treatment

This is unchanged from the 2026-02-17 plan.

### 6. Testimonials — Card Grid

**Pattern:** 2-column card grid (desktop) / single column (mobile)

**Content per card:**

- Star rating (existing StarRating component)
- Quote text with smart quotes
- Author name + optional role/company
- Optional author photo (circular, `rounded-full`)

**Design enhancements over current `TestimonialsSection.tsx`:**

- Scroll-reveal with staggered card entrance
- Hover effect: `hover:shadow-xl hover:-translate-y-1` (matches other card patterns)
- `line-clamp-4` on quotes to manage card height variance
- Empty state: section hidden if no testimonials (return null)

### 7. Footer Upgrade

**Current:** Logo + Home link + copyright + "Powered by HANDLED"
**New:** Add optional sections based on available data:

- **Social links:** Instagram, Facebook, LinkedIn (from tenant profile)
- **Contact info:** Email, phone (if available)
- **Background:** Subtle `bg-neutral-50` for visual separation
- **Back-to-top:** Optional scroll-to-top button (follow-up, not MVP)

**Constraint:** Footer content comes from existing tenant data. No new DB fields. If tenant has no social links or contact info, footer stays minimal.

### 8. CTA Placement Strategy

**Three CTA touchpoints:**

1. **Hero CTA:** "Explore Experiences" → `#services` (catches eager visitors)
2. **Inline after Services:** Built into segment card expansion (Book button on tier cards)
3. **Bottom CTA:** Full-width accent bar → `#services` (catches scrollers)

**No CTA after About or Testimonials** — these are trust-building sections that should flow into the next section, not interrupt with a sales pitch.

### 9. Animations — Consistent Scroll Reveal

**Same system from 2026-02-17 plan:**

- CSS-only `@keyframes storefront-reveal` (0KB bundle cost)
- `useScrollReveal` hook with Intersection Observer
- Staggered delays via `reveal-delay-1`, `reveal-delay-2` classes
- Respects `prefers-reduced-motion`

**Applied to ALL sections** (current plan only applied to hero + services):

- Hero: staggered entrance (headline → subheadline → CTA)
- How It Works: staggered steps (step 1 → step 2 → step 3)
- Services: card grid fade-up
- About: content + image fade-up
- Testimonials: staggered cards
- FAQ: section fade-up (accordion animation is separate)
- CTA: single fade-up

## Resolved Questions

1. ~~**Section order**~~ → **Hero → How It Works → Services → About → Testimonials → FAQ → CTA** (trust-first with CTA shortcuts)
2. ~~**FAQ interaction**~~ → **Accordion** using existing `FAQAccordion.tsx` pattern (CSS Grid 0fr/1fr, no new dependency)
3. ~~**How It Works pattern**~~ → **Numbered steps** (3-4 steps, horizontal row desktop, vertical mobile)
4. ~~**Navigation**~~ → **Section scroll links** (Home | Services | About | FAQ | Book Now) with smooth-scroll and active link highlighting
5. ~~**Card content**~~ → **Short teaser only** (house rules removed from card, pricing in detail view)
6. ~~**Build on existing plan?**~~ → **Yes.** The 2026-02-17 foundation (bug fixes, animations, hero, segment cards) is still valid. We expand with How It Works, Testimonials, FAQ accordion, nav, and footer.
7. ~~**Testimonials design**~~ → **Card grid** with staggered scroll-reveal, hover effects, line-clamp
8. ~~**Footer scope**~~ → **Minimal expansion** — social links + contact info from existing data, no new DB fields

## Open Questions

None — all design questions resolved.

## What We're NOT Building (YAGNI)

- Custom section ordering per tenant (MVP uses fixed template)
- Parallax scrolling or complex scroll effects
- Video heroes
- Framer Motion or any JS animation library
- New database fields or migrations
- Carousel/slider for testimonials
- How It Works per-tenant customization (generic steps for MVP)
- Multi-page templates
- A/B testing infrastructure
- Image upload UI
- Tier comparison tables
- Gallery section in the default template (tenant-optional)
- Contact form in the default template (tenant-optional)

## Technical Constraints

- **CSS-only animations** — no Framer Motion, no GSAP
- **No new dependencies** — accordion is custom, not Radix
- **No new database fields** — How It Works is config-driven, not stored
- **Same component tree for all tenants** — no per-tenant custom layouts
- **Progressive enhancement** — SSR-safe, animations are additive
- **Respects `prefers-reduced-motion`** — all animations disabled
- **Intersection Observer** — shared utility for scroll reveals and active nav

## Research Sources

### Internal (Compound Knowledge)

- `docs/brainstorms/2026-02-17-storefront-mvp-template-redesign-brainstorm.md` (lean MVP)
- `docs/plans/2026-02-17-feat-storefront-mvp-template-redesign-plan.md` (7-phase plan)
- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`
- `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md`
- `docs/solutions/patterns/tenant-storefront-content-authoring-workflow.md`
- `docs/design/VOICE_QUICK_REFERENCE.md` + `docs/design/BRAND_VOICE_GUIDE.md`

### External (Swarm Research)

- Unbounce 2024 Conversion Benchmark Report — median landing page conversion 6.6%
- NNGroup footer patterns — 7 core patterns, 2-level max hierarchy
- LogRocket accordion UX — caret icons most effective, 44px touch targets, no nesting
- Smashing Magazine sticky nav — hide on scroll-down, show on scroll-up, 300-400ms transition
- SaaS Landing Page "How It Works" examples — 3-5 steps, minimal text, bold formatting
- Landing Page Flow CTA strategies — distribute CTAs after major content sections, single goal per section
