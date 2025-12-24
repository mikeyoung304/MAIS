# feat: mobile landing hero refresh (apple-quality)

> **Type:** UI/UX enhancement  
> **Priority:** High – user-facing conversion surface  
> **Status:** Draft for review  
> **Owner(s):** Frontend / Brand Systems

---

## Overview

The waitlist landing hero (`client/src/pages/Home/HeroSection.tsx`) delivers strong copy but feels cramped on mobile, especially once the absolute header from `client/src/app/AppShell.tsx` overlaps the top lines. Typography scales as large as `text-5xl` even at `320px` widths, the stacked paragraph copy lacks breathing room, and the email form plus CTA button sit in a tight column without tactile affordances. We need an Apple-quality refresh that reinforces the concierge positioning, restores generous whitespace, and keeps the early-access form effortless on small screens.

## Problem Statement / Motivation

_Current issues (validated on iPhone 13 physical capture and responsive dev tools):_

1. **Crowded top edge:** The absolute `header` (py-6) overlaps the hero kicker because the hero sets `min-h-screen` with zero top padding, giving no safe-area spacing. (`client/src/app/AppShell.tsx:34`)
2. **Typography overload:** `text-5xl` + bold serif across two lines renders ~32–34px on 375px widths, forcing 4 text blocks to stack without breathing room. (`client/src/pages/Home/HeroSection.tsx:33`)
3. **Form compression:** The `flex-col` form defaults to 100% width, but rounded pill input + CTA button share identical visual weight, lacking contrast/microcopy and hitting the same vertical rhythm as preceding paragraphs.
4. **Ambient layers scale poorly:** The two blurred `div`s use fixed widths (w-96 / w-72) and offsets; on mobile they pinch into visible blobs rather than a soft gradient field.

The brand voice guide (`docs/design/BRAND_VOICE_GUIDE.md:1`) explicitly calls for generous whitespace, serif warmth, and confident minimal copy. The current hero fails that promise on mobile, risking perception of a cramped SaaS template rather than a concierge-quality studio partner.

## Research Findings

### Repository context

- **Hero implementation:** `client/src/pages/Home/HeroSection.tsx:16-137` drives all copy, ambient elements, motion, and the waitlist form. Layout relies on Tailwind utility classes and a custom `useWaitlistForm` hook.
- **Page shell:** `client/src/app/AppShell.tsx:34-67` renders a transparent absolute header and skip link; it assumes the hero will provide its own safe-area padding.
- **Design tokens:** `client/src/styles/design-tokens.css:200-320` defines `--radius-2xl`, typography scale, and color tokens (sage, text-muted) that should remain canonical.
- **Brand/voice standards:** `docs/design/BRAND_VOICE_GUIDE.md` emphasizes short serif headlines, confident spacing, and careful CTA phrasing.
- **Related plans:** `plans/landing-page-apple-minimalism.md` and `plans/landing-page-redesign-managed-storefronts.md` both highlight single-section hero focus and concierge tone; we should align with their guidance.

### Observed device behavior

| Scenario                | Observation                                                                            | Impact                                         |
| ----------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| iOS Safari, 375×812     | Headline sits within 32px of status bar; nav text overlaps screenshot                  | Breaks premium feel, risks notch overlap       |
| iOS Safari, 320×568     | Input + button fill nearly full viewport height; error text pushes CTA below fold      | Hard to notice reassurance copy; higher bounce |
| Android Chrome, 393×852 | Scroll bounce reveals blank area because `min-h-screen` already consumed by nav + hero | Visual jitter reduces trust                    |

## SpecFlow Analysis

1. **Load hero with keyboard-only navigation**
   - Skip link should drop focus on hero heading without being hidden by nav.
   - Focus order: header links → `HeroSection` kicker → input → button.
2. **Fill email form with invalid input**
   - Error text currently renders below button; ensure proper spacing and ARIA.
3. **Successful submit state**
   - Confirmation pill must remain visible without causing layout shift.
4. **Scroll past hero**
   - CTA should leave at least 32px bottom breathing room before `WhoItsForSection`.

SpecFlow takeaways: hero requires structural spacing adjustments plus reflowed copy blocks so transitions between states (error/submitted) do not push content off-screen.

## Proposed Solution

### Visual & typographic direction

- Adopt a **“quiet luxury concierge”** direction: high-contrast serif headline with `clamp(2.5rem, 6vw, 4rem)` on mobile, paired with a refined sans (`font-light`) subhead at `clamp(1.125rem, 3vw, 1.5rem)`.
- Use CSS custom properties for new spacing tokens (e.g., `--hero-mobile-top: clamp(4rem, 12vw, 5.5rem)`).
- Limit line width to ~40 characters by wrapping hero copy in `max-w-[19.5rem]` container on mobile, expanding progressively.

### Layout & spacing

- Introduce safe-area inset utility (e.g., `pt-safe` or inline `paddingTop: env(safe-area-inset-top) + 2.5rem`) to keep header from colliding with the kicker.
- Break content into **modular blocks**: kicker, headline, empathy paragraph, reassurance line, form, trust line. Each block gets explicit `gap-y` values (12/16/24px).
- Let ambient gradient fill entire viewport via `::before` pseudo-element with `radial-gradient` rather than fixed-size blurred divs, so it scales fluidly.

### CTA & form treatment

- Create a **carded form block** with subtle glassmorphism: `bg-white/80`, `backdrop-blur-md`, `border border-white/60`, and 24px padding, separated from body copy by 20px.
- Input: maintain pill shape but drop from `border-2` to `border` with `focus:ring-sage/30`; left-align placeholder and add inline icon (mail) for polish.
- CTA button: expand to full width on mobile with gradient fill (sage → eucalyptus) and `box-shadow` to mimic tactile depth; reduce text to “Apply for Early Access”.
- Add microcopy (e.g., “No spam. First-come invites.”) inside form card to reassure.

### Motion & micro interactions

- Replace large `animate-fade-slide-up` per-element with CSS keyframe `fade-up` triggered via `prefers-reduced-motion` guard; use staggering only for kicker/headline/form.
- Add button press effect (`active:scale-95`, `transition-ease`) and input focus glow.
- Scroll cue: minimal downward chevron at bottom center with slow float to signal more content.

### Accessibility & content

- Ensure header safe-area and hero content maintain `min 16px` margin from viewport edges.
- Keep `aria-label`s for form, ensure error text uses `role="alert"`.
- Provide short supportive copy (~2 lines) with hyphenation disabled for readability.

### Editor/config alignment

- No schema changes required; hero content is static copy. However, if future configurability is planned, abstract hero layout tokens into `client/src/pages/Home/HeroSection.tsx` constants for reuse.

## Technical Considerations

- **Responsive utilities:** Introduce custom Tailwind classes or inline styles with `clamp` because existing `text-5xl` utilities jump too aggressively between breakpoints.
- **Safe area handling:** Evaluate using Tailwind plugin for `env(safe-area-inset-*)`, or add inline style referencing CSS custom properties to avoid hard-coding.
- **Reusable gradient assets:** Create CSS module or `HeroBackground` component to encapsulate gradient mesh for easier future adjustments.
- **State management:** Existing `useWaitlistForm` hook remains untouched, but we must ensure new layout gracefully handles loading and submitted states without layout shift.
- **Testing:** Update Playwright (`test-redesign.js` or `test-smoke.mjs`) snapshots if hero sections are captured; add new visual regression screenshot via `capture-landing.js`.

## Implementation Phases

### Phase 1 – UX spike & tokens (0.5 day)

- Audit `design-tokens.css` for reusable spacing/radius tokens; add clamp variables for hero typography if missing.
- Produce Figma/pen sketch referencing Apple quality.
- Deliver approval screenshot; success = stakeholder sign-off.

### Phase 2 – Mobile-first hero rebuild (1.5 days)

- Refactor `HeroSection.tsx` layout: add container wrapper, safe-area padding, new gradient background, modular blocks.
- Implement responsive typography + spacing via custom classes or inline style objects.
- Rework form card and CTA interactions; ensure ARIA hooks remain.
- Validate across viewport presets (320, 360, 390, 414, 768). Success = no overlap, CTA fully visible.

### Phase 3 – Polish & regression guardrails (1 day)

- Tune animations with `prefers-reduced-motion`.
- Update Playwright screenshot/regression tests, Storybook story (if relevant), and documentation.
- QA: manual a11y sweep, Lighthouse mobile run targeting 90+ score on CLS. Success = pass + updated docs.

## Alternative Approaches Considered

1. **Minimal tweak only (font-size reductions + padding):** Quick but fails to deliver the “Apple-quality” experiential lift.
2. **Replace hero with background illustration:** Adds asset dependencies and time; gradient mesh approach keeps load light while adding depth.

Chosen approach balances ambition with timeline while keeping code localized.

## Acceptance Criteria

### Functional

- [ ] Header/Kicker have ≥32px spacing from safe-area top on iPhone / Pixel viewports.
- [ ] Hero headline wraps to 2 lines max on widths ≤375px without overflow.
- [ ] Email form fits within viewport height alongside hero copy; CTA remains visible during error/submitted states.
- [ ] Scroll cue present and accessible (aria-hidden, decorative).
- [ ] Form retains analytics/test hooks (`data-testid="hero-waitlist-form"`).

### Non-functional

- [ ] CLS ≤ 0.05 across viewport sizes (verify via Lighthouse).
- [ ] All text maintains contrast ≥ 4.5:1 against background per WCAG AA.
- [ ] Animations respect `prefers-reduced-motion`.
- [ ] New CSS keeps bundle size change under +3kb gzip.

### Quality gates

- [ ] Unit/visual regression tests updated.
- [ ] Design/brand review sign-off recorded.
- [ ] Manual QA checklist (iOS Safari, Android Chrome, desktop) completed.

## Success Metrics

- +15% increase in hero form completion rate on mobile sessions (Mixpanel / GA event `waitlist_submitted`).
- -10% bounce rate for `/` on mobile.
- Qualitative: design leadership signs off as “Apple-quality” (tracked in QA doc).

## Dependencies & Risks

- **Dependencies:** `HeroSection` component, `useWaitlistForm`, `Container` component, Tailwind config, background assets (optional).
- **Risks:**
  - New CSS may regress desktop hero if responsive conditions misapplied.
  - Additional gradients/blur filters might impact performance on low-end devices; mitigate with `backdrop-filter` fallbacks and `will-change` hygiene.
  - Need alignment with brand copy before implementation to avoid rework.

## Documentation Plan

- Update `docs/design/BRAND_VOICE_GUIDE.md` with new hero spacing example once approved.
- Add mobile spacing tokens to `styles/DESIGN_TOKENS_GUIDE.md`.
- Capture new hero screenshot for `landing-page-full.png` reference assets.

## References & Research

- `client/src/pages/Home/HeroSection.tsx:16-137`
- `client/src/app/AppShell.tsx:34-74`
- `client/src/pages/Home/index.tsx:1-31`
- `client/src/styles/design-tokens.css:200-320`
- `docs/design/BRAND_VOICE_GUIDE.md:1-120`
- `plans/landing-page-apple-minimalism.md`
- `plans/landing-page-redesign-managed-storefronts.md`

## Outstanding Questions for Review

1. Should the hero headline remain identical on mobile, or do we want a shorter mobile-only variant?
2. Do we prefer to keep the hero 100% typographic, or incorporate subtle photography/texture?
3. Any analytics/tracking events we should add when the CTA is tapped (e.g., `cta_tap` before submission)?
4. How opinionated should we be about the nav treatment (e.g., convert to floating pill vs. keep text links)?

## Plan Review Notes

- Pending `/plan_review plans/feat-mobile-landing-hero-refresh.md` execution for automated feedback. Once review comments return, we will incorporate adjustments and reconfirm scope.
