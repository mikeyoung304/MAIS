# Handoff Prompt: Landing Page Conversion Overhaul v2.1

Copy this entire prompt into a new Claude Code session to continue the work.

---

## Context

This plan has been **APPROVED by all reviewers** (DHH 8.5/10, Kieran Approved, Simplicity Approved). It incorporates two rounds of expert review feedback and is ready for implementation.

**Plan file:** `plans/landing-page-carousel-and-conversion-overhaul-v2.md`

## Key Files to Read First

1. `plans/landing-page-carousel-and-conversion-overhaul-v2.md` — The implementation plan (READ THIS FIRST)
2. `docs/design/BRAND_VOICE_GUIDE.md` — Brand standards, voice, and design system
3. `apps/web/src/app/page.tsx` — Current landing page
4. `apps/web/src/components/home/ProductCarousel.tsx` — Current carousel component

## What's Already Done

- ProductCarousel.tsx exists with 3 slides (storefront, booking, client hub)
- Landing page copy has been tightened (67% reduction)
- Touch swipe, arrow navigation, and dot indicators work
- Plan v2.1 synthesizes 2 rounds of reviewer feedback (8 reviewers total)
- All code samples in plan include reviewer fixes

## What Needs to Be Built

Per the v2.1 plan, in this order:

### Phase 1: Scrolling Identity Hero (Brand Signature)

- Create `ScrollingIdentity.tsx` component
- **MUST INCLUDE** (from Round 2 reviews):
  - SSR hydration guard (`isClient` state)
  - Screen reader static fallback (`sr-only` element)
  - Index-based keys for motion spans
  - Identities array at module scope
  - `will-change: transform` CSS hints

### Phase 2: Transition Section (NEW)

- Add between Hero and Carousel
- Copy: "Your business runs on trust and transformation..."
- Creates narrative flow

### Phase 3: Enhanced Product Carousel

- **MUST INCLUDE** (from Round 2 reviews):
  - `aria-live="polite"` and `aria-atomic="true"`
  - Pause on hover/focus (WCAG 2.2.2)
  - Dot indicators for mobile
  - Focus-visible rings on all controls
  - Add Stripe badge to BookingMockup
  - Surface AI chatbot in ClientHubMockup
  - Do NOT add infinite loop

### Phase 4: 3-Tier Pricing Section

- Create `PricingSection.tsx`
- Tiers: $49 / $149 / "Let's talk"
- **MUST INCLUDE** (from Round 2 reviews):
  - Tiers extracted to module-scope const
  - Semantic `<button>` elements for CTAs
  - Focus-visible rings
  - Partnership CTA: "Let's Talk" (not "Book a Call")

### Phase 5: Testimonials (CONDITIONAL)

- If real testimonials available: Offset grid layout
- If none available: Founding member fallback OR skip section
- **NEVER** use placeholder testimonials

### Phase 6: FAQ Section (Conversational)

- Conversational copy (see plan for exact text)
- **MUST INCLUDE** (from Round 2 reviews):
  - Arrow key navigation (up/down/home/end)
  - Focus-visible rings on all triggers
  - Spring physics: `{ stiffness: 300, damping: 30 }`

### Phase 7: Section Reordering

1. Hero (scrolling identity)
2. Transition (NEW)
3. Carousel
4. Testimonials (conditional)
5. Project Hub + Memory
6. Pricing
7. FAQ
8. Closing CTA

## Critical Constraints

**Quality over speed.** No shortcuts. Every element earns its place.

**Brand voice requirements:**

- Identity-first messaging ("You're a [profession]")
- No hype words (revolutionary, game-changing, etc.)
- Cheeky but professional
- Sage color used sparingly (15% max)

**Technical requirements (from Round 2):**

- Full WCAG 2.1 AA accessibility
- SSR-safe with hydration guards
- Framer-motion for animations
- TypeScript strict mode
- Mobile-first responsive design
- `prefers-reduced-motion` respected

**Files to create (2 only):**

- `ScrollingIdentity.tsx`
- `PricingSection.tsx`

**Files to modify:**

- `ProductCarousel.tsx` — ARIA, pause-on-hover, dots
- `BookingMockup.tsx` — Stripe badge
- `ClientHubMockup.tsx` — AI visibility
- `page.tsx` — Imports, transition section, section order

## Skills to Load

Before starting, load the `frontend-design` skill from compound engineering. This ensures distinctive design and brand voice adherence.

## Verification Steps

After each phase:

1. Test on mobile viewport (iPhone SE)
2. Test keyboard navigation (Tab, arrows)
3. Test screen reader (VoiceOver/NVDA)
4. Run TypeScript check (`npm run typecheck`)
5. Visual review against brand guide

---

## Start Command

```
/workflows:work plans/landing-page-carousel-and-conversion-overhaul-v2.md
```

---

_Handoff v2.1 — 2026-01-03_
_Status: APPROVED by all reviewers_
