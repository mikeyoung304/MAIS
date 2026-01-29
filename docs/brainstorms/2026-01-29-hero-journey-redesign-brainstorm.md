# Hero & Journey Redesign Brainstorm

**Date:** 2026-01-29
**Status:** Ready for Planning

---

## What We're Building

### 1. Simplified Hero (Full-Width Centered Mockup)

**Current state:** 4-vertical selector with pills and arrows, showing different professions (tutor, photographer, chef, consultant). Visually repetitive and adds decision fatigue.

**New design:**

- **Remove** the vertical selector entirely
- **Keep** Alex Chen tutoring as the single persona (specific = believable)
- **Layout:** Headline + subheadline centered above, full-width browser mockup below
- **Goal:** Communicate "this is what you get" at first glance — one calm, unified storefront

**Visual structure:**

```
┌─────────────────────────────────────────────────────────┐
│                      [HANDLED logo]                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│     The operations layer that keeps bookings moving.     │  ← H1, centered
│                                                          │
│     Client communication, booking, and follow-up —       │  ← Subhead
│     handled in one calm system.                          │
│                                                          │
│          [Get Handled]    [See how it works]             │  ← CTAs
│                                                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │  ● ● ●   alexchen.gethandled.ai                 │    │  ← Browser chrome
│  ├─────────────────────────────────────────────────┤    │
│  │                                                  │    │
│  │         [Alex Chen Storefront Mockup]            │    │  ← Full preview
│  │         - Hero with headline                     │    │
│  │         - 3-tier pricing                         │    │
│  │         - Trust indicators                       │    │
│  │                                                  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Key changes from current:**

- No vertical switcher pills
- No left/right arrow navigation
- No keyboard switching logic
- Mockup is larger and centered (not split-screen)
- Copy is centered above mockup

---

### 2. Journey Carousel (Horizontal Swipe/Arrows)

**Current state:** Vertical scroll with 3 stages stacked, arrow connectors between them. Long page, loses engagement.

**New design:**

- Horizontal carousel with 3 slides
- Left/right arrow buttons
- Dot indicators (3 dots showing position)
- Swipe gesture on mobile
- Smooth slide animation (CSS scroll-snap or Embla)

**Visual structure:**

```
┌─────────────────────────────────────────────────────────┐
│                  See it in action                        │
│            The complete client journey                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [←]   ┌─────────────────────────────────────┐    [→]   │
│        │  ① They find your storefront        │          │
│        │                                      │          │
│        │  [Storefront Mockup]                 │          │
│        │                                      │          │
│        └─────────────────────────────────────┘          │
│                                                          │
│                      ● ○ ○                               │  ← Dot indicators
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Carousel slides:**

1. **Find** — "They find your storefront" → DemoStorefrontShowcase
2. **Book** — "They book you" → BookingMockup
3. **Hub** — "Everything lives in one hub" → ClientHubMockup

**Implementation options:**
| Option | Pros | Cons |
|--------|------|------|
| CSS scroll-snap | Zero dependencies, native feel | Limited animation control |
| Embla Carousel | Lightweight (3kb), accessible, React hooks | New dependency |
| Manual state + transform | Full control, matches existing patterns | More code to maintain |

**Recommendation:** CSS scroll-snap for simplicity, with arrow buttons triggering `scrollTo()`.

---

## Why This Approach

### Hero simplification rationale:

1. **Clarity over cleverness** — Visitors should immediately understand what Handled is, not be distracted by profession selection
2. **Brand voice alignment** — "Sound expensive — fewer words = premium"
3. **Reduced cognitive load** — One example that translates vs. four that create "which am I?" friction
4. **Mobile-first** — Split-screen with switcher is complex on mobile; centered layout is cleaner

### Journey carousel rationale:

1. **Engagement** — Horizontal carousel invites interaction vs. vertical scroll that gets skipped
2. **Pacing** — User controls the reveal, creating anticipation
3. **Familiarity** — Classic pattern that users understand immediately
4. **Mobile-friendly** — Swipe is natural on touch devices

---

## Key Decisions

| Decision                | Choice              | Rationale                                        |
| ----------------------- | ------------------- | ------------------------------------------------ |
| Hero layout             | Full-width centered | Maximum visual impact, cleaner than split-screen |
| Vertical selector       | Remove entirely     | Adds confusion, not value                        |
| Hero persona            | Keep Alex Chen      | Specific feels real, tutoring is relatable       |
| Journey format          | Horizontal carousel | More engaging than vertical scroll               |
| Carousel implementation | CSS scroll-snap     | Lightweight, native, no dependencies             |
| Journey stages          | Keep existing 3     | Find → Book → Hub flow is clear                  |

---

## Open Questions

1. **Mockup size:** How large should the centered browser mockup be? Options:
   - `max-w-4xl` (1024px) — substantial but not overwhelming
   - `max-w-5xl` (1280px) — nearly full-width, very prominent
   - Full bleed — edge to edge with padding

2. **Hero animation:** Should the mockup have any entrance animation?
   - Fade-in-up on page load
   - Static (no animation)
   - Subtle parallax on scroll

3. **Carousel auto-advance:** Should the journey carousel auto-cycle?
   - No (user-controlled only) — recommended
   - Yes with pause on hover (adds complexity)

4. **Existing components:** Should we reuse `StorefrontPreview` from HeroWithVerticals or extract a simpler version?

---

## Files to Modify

| File                                                 | Changes                                            |
| ---------------------------------------------------- | -------------------------------------------------- |
| `apps/web/src/components/home/HeroWithVerticals.tsx` | Replace with new `Hero.tsx` or heavily simplify    |
| `apps/web/src/components/home/JourneyShowcase.tsx`   | Convert from vertical stack to horizontal carousel |
| `apps/web/src/app/page.tsx`                          | Update imports if component names change           |
| `apps/web/tailwind.config.js`                        | May need scroll-snap utilities if not present      |

---

## Next Steps

1. Run `/workflows:plan` to create implementation plan
2. Build simplified Hero component
3. Build Journey carousel with CSS scroll-snap
4. Test on mobile for swipe behavior
5. Review with design-implementation-reviewer agent

---

_Brainstorm captured 2026-01-29_
