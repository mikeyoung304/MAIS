# feat: Homepage Hero + Journey Showcase Redesign

**Date:** 2026-01-29
**Type:** Feature
**Status:** Ready for implementation
**Brainstorm:** `docs/brainstorms/2026-01-29-homepage-hero-journey-redesign-brainstorm.md`

---

## Overview

Redesign the homepage above-the-fold experience with a text-only hero and simplified journey showcase that tells a cohesive AI-assisted story.

### The Problem

1. **Hero:** Alex Chen storefront mockup doesn't resonate with mixed audience (tutors, photographers, coaches, therapists)
2. **Journey showcase:** Too much content crammed into browser mockups (about, reviews, FAQ) — undermines "this looks professional" message
3. **AI story untold:** The chatbot feature isn't showcased in the journey

### The Solution

1. **Text-only hero** with universal messaging
2. **Simplified storefront** showing hero + packages + chat button
3. **Booking panel** with chatbot open and helping
4. **Optimized client hub** with better vertical space usage

---

## Implementation

### Phase 1: Hero Section Redesign

**File:** `apps/web/src/components/home/Hero.tsx`

**Current state:** Two-part headline + StorefrontPreview mockup embedded

**Target state:** Clean text-only hero

```
Do what you love.
The rest, is handled.

[Get Started]
```

#### Changes:

- [x] Remove `StorefrontPreview` component import and usage
- [x] Replace headline copy:
  - Line 1: "Do what you love."
  - Line 2: "The rest, is handled." (with sage accent on "handled")
- [x] Keep CTA button ("Get Started" or "Try Free")
- [x] Remove or simplify subheadline (section 2 explains the product)
- [x] Adjust vertical spacing — hero should feel expansive, not cramped
- [x] Optional: Add subtle scroll indicator (chevron) pointing to journey section

#### Typography:

- Headline: `font-serif text-5xl md:text-6xl lg:text-7xl font-bold`
- "handled" word: `text-sage` for brand accent
- Generous `py-32 md:py-40` padding

---

### Phase 2: Storefront Panel (Journey Step 1)

**File:** `apps/web/src/components/home/FullStorefrontPreview.tsx`

**Current state:** Scrollable mockup with hero, about, packages, testimonials, FAQ, CTA

**Target state:** Static view with hero + packages + chat button

#### Changes:

- [x] Remove About section ("Meet Alex")
- [x] Remove Testimonials section
- [x] Remove FAQ section
- [x] Remove CTA banner section
- [x] Keep Hero section (profile badge, headline, trust indicators)
- [x] Keep Packages section (3-tier pricing)
- [x] Add floating chat button in bottom-right corner
- [x] Remove scroll behavior — content should fit without scrolling
- [x] Adjust vertical spacing for comfortable viewing

#### Chat Button Design:

```tsx
{
  /* Floating chat button - bottom right */
}
<div className="absolute bottom-4 right-4">
  <div className="w-12 h-12 rounded-full bg-sage flex items-center justify-center shadow-lg">
    <MessageCircle className="w-6 h-6 text-white" />
  </div>
</div>;
```

---

### Phase 3: Booking Panel with Active Chatbot (Journey Step 2)

**File:** `apps/web/src/components/home/BookingMockup.tsx`

**Current state:** Calendar + time slots, no chatbot visible

**Target state:** Calendar + chatbot panel open and active

#### Changes:

- [x] Split layout: Calendar on left, chatbot on right (or overlay)
- [x] Show chatbot as OPEN (not just a button)
- [x] Display AI message: "Any questions about Alex's sessions? I can help you find the right package and time."
- [x] Optional: Show user typing indicator or sample response

#### Layout Options:

**Option A: Side-by-side (60/40 split)**

```
┌─────────────────┬──────────────┐
│   Calendar      │   Chatbot    │
│   Mar 2025      │   ┌────────┐ │
│   [15] selected │   │ AI msg │ │
│                 │   └────────┘ │
│   Time slots    │   [Type...] │
└─────────────────┴──────────────┘
```

**Option B: Overlay (chatbot slides up from corner)**

```
┌─────────────────────────────────┐
│         Calendar                │
│         Mar 2025                │
│         [15] selected           │
│                    ┌───────────┐│
│   Time slots       │ Chatbot   ││
│                    │ open      ││
│                    └───────────┘│
└─────────────────────────────────┘
```

#### Chatbot Content:

- AI avatar (sage circle with sparkle icon)
- Message: "Any questions? I can help you find the perfect session time."
- Online indicator (green dot)
- Input field with placeholder "Ask anything..."

---

### Phase 4: Client Hub Panel Optimization (Journey Step 3)

**File:** `apps/web/src/components/home/ClientHubMockupTutor.tsx`

**Current state:** Two-column layout with upcoming sessions, tasks, and chat

**Target state:** Optimized vertical space, cleaner hierarchy

#### Review and optimize:

- [x] Audit current vertical spacing — identify wasted space
- [x] Ensure content hierarchy is clear (what's most important?)
- [x] Balance information density with readability
- [x] Consider if chat should be more prominent (continuing the chatbot story)

#### Specific improvements TBD during implementation based on current layout.

---

## Acceptance Criteria

### Hero

- [x] No storefront mockup visible in hero section
- [x] Headline displays "Do what you love." on first line
- [x] Second line displays "The rest, is handled." with "handled" in sage color
- [x] CTA button present and functional
- [x] Hero feels spacious with generous whitespace

### Journey Panel 1 (Storefront)

- [x] Only hero and packages sections visible
- [x] No about, testimonials, FAQ, or CTA sections
- [x] Chat button visible in bottom-right corner
- [x] No scrolling required to see all content
- [x] Alex Chen persona retained

### Journey Panel 2 (Booking)

- [x] Chatbot panel is OPEN (not minimized)
- [x] AI message visible asking a helpful booking question
- [x] Calendar still visible and functional-looking
- [x] Clear visual connection between chatbot and booking flow

### Journey Panel 3 (Client Hub)

- [x] Vertical space used efficiently
- [x] No awkward gaps or cramped sections
- [x] Information hierarchy is clear

### General

- [x] All three panels maintain visual consistency (same dark theme, typography)
- [x] Carousel navigation still works (arrows, dots, keyboard, swipe)
- [x] Mobile responsive (panels stack appropriately)

---

## Files to Modify

| File                                                     | Changes                                |
| -------------------------------------------------------- | -------------------------------------- |
| `apps/web/src/components/home/Hero.tsx`                  | Remove mockup, update copy             |
| `apps/web/src/components/home/FullStorefrontPreview.tsx` | Strip to hero + packages + chat button |
| `apps/web/src/components/home/BookingMockup.tsx`         | Add open chatbot panel                 |
| `apps/web/src/components/home/ClientHubMockupTutor.tsx`  | Optimize vertical spacing              |

---

## Out of Scope

- Navigation/header changes
- Other homepage sections (testimonials, pricing, etc.)
- Backend changes
- Creating phone/mobile device mockups
- Changing the carousel infrastructure (JourneyShowcase.tsx)

---

## Design References

- **Typography:** `font-serif` for headlines, sage accent color
- **Spacing:** Generous padding (`py-32`), 80% neutral / 20% sage
- **Cards:** `rounded-3xl shadow-lg` pattern
- **Voice:** No hype words, professional, anti-punching-down

---

## Open Questions (Resolve During Implementation)

1. **Chatbot layout in booking panel:** Side-by-side or overlay?
2. **Hero subheadline:** Keep a brief one or pure headline + CTA only?
3. **Scroll indicator:** Add chevron below hero pointing to journey section?
