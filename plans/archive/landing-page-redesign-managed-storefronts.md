# feat: Landing Page Redesign - "Managed Storefronts & The Collective"

**Type:** Enhancement
**Priority:** High
**Estimated Effort:** 4-5 days
**Status:** Ready to Implement
**Copy Source:** `docs/LANDING_PAGE_COPY_AUDIT.md` (FINAL LANDING PAGE COPY - Frozen/Approved)

---

## Summary

Complete redesign of the MAIS marketing landing page, shifting positioning from "Business Growth Software" to "Managed Storefronts & The Collective." The redesign introduces a premium editorial aesthetic targeting high-value service businesses (horse farms, elopement agencies, wedding photographers, event planners).

**Core Strategy:** "Premium Services Need Premium Systems" - Ship fast, iterate later.

---

## Decisions (Locked)

| Decision           | Choice                                       | Rationale                       |
| ------------------ | -------------------------------------------- | ------------------------------- |
| Serif font         | **Playfair Display** (400 + 700 only)        | Minimal weights = faster load   |
| Color palette      | **Earth tones** (cream, sage, charcoal)      | WCAG-compliant values below     |
| Lighthouse target  | **90+** (not 95+)                            | Pragmatic, achievable in 4 days |
| Images             | **Placeholders first**                       | Ship design, swap photos later  |
| Component strategy | **Inline everything**                        | No premature abstractions       |
| CTA destination    | **Contact form** (`/contact` or inline form) | User fills out form             |
| Dark mode          | **Force light theme**                        | Earth tones designed for light  |
| Animations         | **Static for V1**                            | Defer scroll animations to V2   |

---

## Color Palette (WCAG AA Compliant)

```
Backgrounds:
  surface:     #FFFBF8  (soft cream - primary)
  surface-alt: #F5F1EE  (warm cream - alternating sections)

Accents:
  accent:      #4A7C6F  (darker sage - PASSES 4.6:1 on cream)
  accent-hover:#3D6B5F  (deep sage - interactive states)

Text:
  text:        #1A1815  (deep charcoal - primary, 11.8:1 ratio)
  text-muted:  #4A4440  (medium charcoal - secondary, 7.2:1 ratio)

Decorative only (not for text):
  sage-light:  #8FAA9E  (backgrounds, borders only)
```

**Contrast verification:**

- `#1A1815` on `#FFFBF8` = **11.8:1** (AAA)
- `#4A4440` on `#FFFBF8` = **7.2:1** (AAA)
- `#4A7C6F` on `#FFFBF8` = **4.6:1** (AA)
- `#FFFBF8` on `#4A7C6F` = **4.6:1** (AA for large text/buttons)

---

## Technical Approach

### Minimal Tailwind Config Changes

```javascript
// client/tailwind.config.js - add to extend.colors
colors: {
  surface: '#FFFBF8',
  'surface-alt': '#F5F1EE',
  accent: '#4A7C6F',
  'accent-hover': '#3D6B5F',
  'text-primary': '#1A1815',
  'text-muted': '#4A4440',
},
fontFamily: {
  serif: ['Playfair Display', 'Georgia', 'serif'],
},
```

### Font Loading (index.html)

```html
<!-- Add to <head> - only 2 weights -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

### File Structure (No Sub-Components)

```
client/src/pages/Home/
├── index.tsx              # Section composition
├── HeroSection.tsx        # Refactor
├── ProblemSection.tsx     # Refactor
├── StorefrontSection.tsx  # NEW (inline 3-tier cards)
├── PsychologySection.tsx  # NEW (inline principle cards)
├── CollectiveSection.tsx  # NEW
├── PartnershipSection.tsx # NEW
├── FutureStateSection.tsx # Refactor
└── FinalCTASection.tsx    # Refactor
```

**No components/ subfolder.** All UI is inline Tailwind. Extract only if reused 2+ times.

---

## Implementation Plan (4 Days)

### Day 1: Foundation + Hero (4-6 hours)

**Morning: Setup**

- [ ] Add Playfair Display to `index.html` (400 + 700 weights only)
- [ ] Add 6 color tokens to `tailwind.config.js`
- [ ] Add `fontFamily.serif` to Tailwind config
- [ ] Measure current Lighthouse baseline

**Afternoon: Hero Section**

- [ ] Refactor `HeroSection.tsx` with new copy
- [ ] Apply serif font to headline, sans-serif to body
- [ ] Cream background (`bg-surface`)
- [ ] CTA button links to contact form
- [ ] Mobile: Stack vertically (no split-screen on mobile)

**Hero Copy:**

```
Headline: "AI-powered storefronts for high-value service businesses"
Subheadline: "MaconAI Solutions builds and runs a 3-tier online storefront for your services—booking, payments, and AI workflows included—so you sell more experiences without adding more admin."
Context: "Built for horse farm rentals, elopement agencies, wedding photographers, and event planners."
CTA: "Book a Discovery Call"
Supporting: "20 minutes to see if a done-for-you AI storefront makes sense for your business."
```

**Files:**

- `client/index.html`
- `client/tailwind.config.js`
- `client/src/pages/Home/HeroSection.tsx`

---

### Day 2: Core Sections (6-8 hours)

**Build 4 sections with inline Tailwind (no sub-components):**

#### ProblemSection.tsx

```
Title: "Your services are premium. Your systems shouldn't feel homemade."
Pain bullets:
- Bookings scattered across email, Instagram, and text
- Payments delayed by manual back-and-forth
- Clients unsure which option to choose or what happens next
Close: "MaconAI turns that chaos into a clean, trustworthy storefront your clients can actually buy from."
```

#### StorefrontSection.tsx (3 cards inline)

```
Title: "A 3-tier storefront, designed for how people actually buy services"
Tier 1: "Entry Offer" - Low-friction start
Tier 2: "Core Package" - Primary revenue driver (visually emphasized)
Tier 3: "Premium Experience" - High-touch, high-ticket
```

#### PsychologySection.tsx (3 principles inline)

```
Title: "Why three tiers work better than 'DM me for pricing'"
- Clear choices reduce decision friction
- A "middle" option anchors value
- Transparency builds trust
Authority: "At MaconAI, we've done the research, tested the flows, and refined the wording."
```

#### CollectiveSection.tsx

```
Title: "You're not buying software. You're gaining a collective."
AI capabilities:
- Qualify inquiries before you get on a call
- Answer common questions automatically
- Trigger reminders so clients don't drift
Close: "You stay focused on delivering unforgettable experiences. We handle the invisible infrastructure."
```

**Files:**

- `client/src/pages/Home/ProblemSection.tsx`
- `client/src/pages/Home/StorefrontSection.tsx`
- `client/src/pages/Home/PsychologySection.tsx`
- `client/src/pages/Home/CollectiveSection.tsx`

---

### Day 3: Remaining Sections + Composition (4-6 hours)

#### PartnershipSection.tsx

```
Title: "A simple partnership that scales with your bookings"
Model:
- A predictable monthly fee for hosting, maintenance, and ongoing optimization
- A percentage of sales that go through your storefront
Close: "If your storefront isn't producing, we feel it too. Our incentives are aligned with your growth."
```

#### FutureStateSection.tsx

```
Title: "From inquiry to paid booking—without the chase"
Narrative: "A couple finds your elopement services. They land on a page with three clear options. They choose a package, see available dates, answer a few guided questions, sign the agreement, and pay a deposit—without a single email thread.

You wake up to a notification: 'New booking confirmed.' Your calendar is fuller. Your inbox is quieter."
```

#### FinalCTASection.tsx

```
Headline: "Ready for a storefront that sells while you serve?"
Body: "If you're a service business owner who's serious about growth but done with duct-taped systems, MaconAI can help."
Button: "Book a Discovery Call" → links to contact form
```

#### Update index.tsx

```typescript
export function Home() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <StorefrontSection />
      <PsychologySection />
      <CollectiveSection />
      <PartnershipSection />
      <FutureStateSection />
      <FinalCTASection />
    </>
  );
}
```

**Files:**

- `client/src/pages/Home/PartnershipSection.tsx`
- `client/src/pages/Home/FutureStateSection.tsx`
- `client/src/pages/Home/FinalCTASection.tsx`
- `client/src/pages/Home/index.tsx`

---

### Day 4: Polish + Ship (4-6 hours)

**Morning: Quality Check**

- [ ] Run Lighthouse audit (target: 90+)
- [ ] Fix any critical performance issues
- [ ] Verify WCAG AA contrast (use WebAIM checker)
- [ ] Test keyboard navigation

**Afternoon: Device Testing**

- [ ] Chrome mobile (375px)
- [ ] Safari mobile
- [ ] Desktop (1440px)
- [ ] Fix any layout breaks

**Ship:**

- [ ] Deploy to staging
- [ ] Final review
- [ ] Deploy to production

---

## Acceptance Criteria

### Must Have (Day 4 Ship)

- [ ] All 8 sections render with correct copy
- [ ] Serif headlines, sans-serif body throughout
- [ ] Earth tone palette applied (cream backgrounds, charcoal text)
- [ ] CTAs link to contact form
- [ ] Responsive at 375px, 768px, 1440px
- [ ] Lighthouse 90+ (desktop)
- [ ] WCAG AA color contrast passes

### Nice to Have (V2)

- [ ] Real photography (replace placeholders)
- [ ] Scroll-triggered animations
- [ ] Lighthouse 95+
- [ ] Dark mode support

---

## Post-Launch Tasks (Separate Sprint)

1. **Image integration** - Source and optimize real photography
2. **Animation polish** - Add subtle scroll-triggered fade-ins
3. **Performance tuning** - Push from 90 to 95+ Lighthouse
4. **Analytics** - Add CTA click tracking
5. **A/B testing** - Test CTA copy variations

---

## References

### Copy Source

`docs/LANDING_PAGE_COPY_AUDIT.md` lines 589-814 (FINAL LANDING PAGE COPY)

### Key Files

- Current hero: `client/src/pages/Home/HeroSection.tsx`
- Tailwind config: `client/tailwind.config.js`
- Router: `client/src/router.tsx`
- Font loading: `client/index.html`

### Tools

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Google Lighthouse](https://developer.chrome.com/docs/lighthouse/)
- [Playfair Display - Google Fonts](https://fonts.google.com/specimen/Playfair+Display)
