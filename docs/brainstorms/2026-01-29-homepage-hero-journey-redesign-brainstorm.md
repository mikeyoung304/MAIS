# Brainstorm: Homepage Hero + Journey Showcase Redesign

**Date:** 2026-01-29
**Status:** Ready for planning
**Participants:** Mike

---

## What We're Building

A two-part redesign of the homepage above-the-fold experience:

### Part 1: Text-Only Hero

**Current:** Hero section with Alex Chen storefront mockup
**New:** Clean, text-only hero with universal messaging

```
Do what you love.
The rest, is handled.

[Get Started]
```

No images. No demo personas. Let the message breathe.

### Part 2: Phone Mockup Journey Showcase

**Current:** Browser mockups crammed with too much content (hero, about, reviews, FAQ, CTA)
**New:** iPhone-style phone frames showing simplified views

- Panel 1: Storefront (hero + packages only)
- Panel 2: Booking flow
- Panel 3: Client hub

---

## Why This Approach

### The Mixed Audience Problem

Target audience is **all service professionals** — tutors, photographers, coaches, therapists, planners. No single demo persona (Alex Chen the tutor) resonates with everyone.

The previous Alex Chen mockup in the hero created a "this isn't for me" moment for non-tutors.

### Solution: Universal Message + Delayed Specifics

1. **Hero hooks everyone** — "Do what you love" is universal. Every service pro has a craft they love and admin they hate.
2. **Section 2 shows the product** — Journey showcase demonstrates how it works without anchoring to one vertical.
3. **Phone mockups feel modern** — Relatable, premium, naturally constrained to essentials.

### The "That Could Be ME" Principle

When visitors see the hero, they should think: **"That's exactly how I feel."**
When they see the phone mockups: **"This looks professional — I'd trust booking here."**

---

## Key Decisions

### Hero Section

| Decision       | Choice                      | Rationale                             |
| -------------- | --------------------------- | ------------------------------------- |
| Visual content | None (text only)            | Universal appeal, no persona mismatch |
| Headline       | "Do what you love."         | Universal hook for all service pros   |
| Subheadline    | "The rest, is handled."     | Product promise in 4 words            |
| CTA            | "Get Started" or "Try Free" | Primary conversion action             |
| Explanation    | Deferred to Section 2       | Hero hooks, journey explains          |

### Journey Showcase

| Decision       | Choice                    | Rationale                             |
| -------------- | ------------------------- | ------------------------------------- |
| Device type    | iPhone-style phone frame  | Universal, modern, relatable          |
| Content shown  | Hero + packages only      | Above-the-fold simplicity             |
| Scrolling      | None (static view)        | No interaction needed to "get it"     |
| Browser chrome | Removed                   | Phone frame replaces it               |
| Demo persona   | Keep Alex Chen in mockups | Need _some_ example; tutor is neutral |

---

## Open Questions

1. **Hero typography** — Serif or sans-serif for the headline? Size/weight?
2. **Scroll indicator** — Should there be a subtle "scroll to see more" chevron?
3. **Phone frame design** — Minimal notch? No notch? Specific device aesthetic?
4. **All panels as phones?** — Should BookingMockup and ClientHubMockup also become phone mockups for consistency?
5. **Demo persona in phones** — Keep Alex Chen, or use a more neutral/generic name?

---

## Out of Scope

- Changing navigation/header
- Other homepage sections (testimonials, pricing, etc.)
- Backend changes
- Mobile responsiveness of the page itself

---

## Visual Reference

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                                                         │
│              Do what you love.                          │
│              The rest, is handled.                      │
│                                                         │
│                  [ Get Started ]                        │
│                                                         │
│                        ↓                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                                                         │
│    ①                    ②                    ③          │
│  ┌─────┐             ┌─────┐             ┌─────┐        │
│  │     │             │     │             │     │        │
│  │ 📱  │             │ 📱  │             │ 📱  │        │
│  │     │             │     │             │     │        │
│  └─────┘             └─────┘             └─────┘        │
│  Storefront           Booking            Client Hub     │
│  goes live            happens            forever        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Next Steps

Run `/workflows:plan` to create implementation plan covering:

1. Hero section redesign (strip image, add new copy)
2. Phone frame component (reusable `<PhoneMockup>`)
3. Simplified storefront content for phone (hero + packages)
4. Update JourneyShowcase to use phone mockups
5. Visual polish (typography, spacing, shadows)
