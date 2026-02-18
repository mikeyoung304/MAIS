---
title: 'feat: Storefront Full Template Redesign'
type: feat
status: active
date: 2026-02-18
brainstorm: docs/brainstorms/2026-02-18-storefront-full-template-redesign-brainstorm.md
extends: docs/plans/2026-02-17-feat-storefront-mvp-template-redesign-plan.md
---

# Storefront Full Template Redesign

## Overview

Replace the current 4-section storefront MVP with a production-ready **7-section trust-first template** that ships to every HANDLED tenant:

**Hero → How It Works → Services → About → Testimonials → FAQ → CTA**

This extends the 2026-02-17 MVP foundation (Hero redesign, segment cards, about enhancement, CTA section, `useScrollReveal`) with five new capabilities: a "How It Works" numbered steps section, FAQ accordion upgrade, section-based navigation with active link highlighting, enhanced testimonials with scroll-reveal, and a polished footer.

The design follows a trust-first emotional funnel (understand → explore → trust → decide) with strategic CTA escape hatches at Hero and bottom for impatient buyers.

## Problem Statement

The live demo at gethandled.ai/t/littlebit-farm reveals five gaps in the current template:

1. **No process explanation** — visitors see offerings without understanding how booking works
2. **No social proof** — zero testimonials means zero trust signals
3. **FAQ is a wall of text** — flat cards with no interactivity, most users scroll past
4. **Navigation is too minimal** — only Home + Book Now, no section anchoring
5. **Footer is bare bones** — no social links, no contact info, no visual separation

Additionally, SpecFlow analysis uncovered **4 critical bugs** in the existing template that must be fixed:

- "Book Now" nav links to `#packages` (stale anchor that doesn't exist)
- Mobile menu doesn't close on anchor link taps
- `StickyMobileCTA` observes the wrong element and never appears
- `scroll-padding-top` overshoots by 56px, causing excessive whitespace on scroll-to-section

## Proposed Solution

A 6-phase implementation that builds on the existing component architecture:

1. **Fix existing bugs** discovered by SpecFlow (P1 critical fixes)
2. **New "How It Works" section** — static numbered steps, no DB storage
3. **FAQ accordion upgrade** — port interaction pattern from existing `FAQAccordion.tsx` + add JSON-LD SEO
4. **Navigation enhancement** — section scroll links with Intersection Observer active highlighting
5. **Section polish** — scroll-reveal on all sections, testimonials hover/line-clamp, footer styling
6. **Testing & accessibility** — WCAG audit, mobile responsive, token boundary, brand voice

## Technical Approach

### Architecture

**No new database fields or migrations.** All changes are frontend-only (Next.js App Router components).

**Key architectural decisions:**

| Decision                | Choice                                                        | Rationale                                                                    |
| ----------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| How It Works storage    | Component constant (not DB)                                   | Agent can't edit; generic steps work for all tenants                         |
| How It Works rendering  | Direct insertion in `TenantLandingPage.tsx`                   | Not a SectionRenderer type — avoids 10-step section type checklist           |
| FAQ accordion           | Port interaction logic into `FAQSection.tsx`                  | Reuse proven pattern; `FAQAccordion.tsx` is a full page, not embeddable      |
| Active nav highlighting | New `useActiveSection` hook (separate from `useScrollReveal`) | Different IO strategies: persistent watch vs one-shot reveal                 |
| Footer social links     | **Deferred** — data doesn't exist on Tenant model             | Brainstorm assumed fields that don't exist; footer gets styling-only upgrade |
| Section ordering        | How It Works always slot 2 (Hero → HowItWorks → DB sections)  | Fixed position; per-tenant ordering requires future DB field                 |

**Files affected (estimated):**

| File                                                              | Change Type | Description                                            |
| ----------------------------------------------------------------- | ----------- | ------------------------------------------------------ |
| `apps/web/src/components/tenant/sections/HowItWorksSection.tsx`   | **NEW**     | Numbered steps component                               |
| `apps/web/src/components/tenant/sections/FAQSection.tsx`          | **REWRITE** | Flat cards → accordion                                 |
| `apps/web/src/components/tenant/sections/index.ts`                | EDIT        | Export HowItWorksSection                               |
| `apps/web/src/components/tenant/TenantNav.tsx`                    | EDIT        | Section scroll links + active highlighting + bug fixes |
| `apps/web/src/components/tenant/TenantFooter.tsx`                 | EDIT        | Styling upgrade                                        |
| `apps/web/src/components/tenant/TenantLandingPage.tsx`            | EDIT        | Insert HowItWorksSection between Hero and Services     |
| `apps/web/src/components/tenant/StickyMobileCTA.tsx`              | EDIT        | Fix observe element ID                                 |
| `apps/web/src/components/tenant/sections/TestimonialsSection.tsx` | EDIT        | Scroll-reveal, hover, line-clamp                       |
| `apps/web/src/components/tenant/sections/CTASection.tsx`          | EDIT        | Scroll-reveal                                          |
| `apps/web/src/hooks/useActiveSection.ts`                          | **NEW**     | IO-based active section tracking                       |
| `apps/web/src/hooks/index.ts`                                     | EDIT        | Export useActiveSection                                |
| `apps/web/src/lib/storefront-utils.ts`                            | EDIT        | Add `generateFAQSchema()` utility                      |
| `apps/web/src/app/t/[slug]/(site)/page.tsx`                       | EDIT        | Inject FAQ JSON-LD                                     |
| `apps/web/src/app/t/_domain/page.tsx`                             | EDIT        | Inject FAQ JSON-LD (mirror)                            |
| `apps/web/src/styles/globals.css`                                 | EDIT        | Fix scroll-padding-top, add reveal-delay-3             |
| `apps/web/src/components/tenant/sections/SegmentTiersSection.tsx` | EDIT        | Remove ghost `reveal-on-scroll` class                  |

### Implementation Phases

---

#### Phase 1: Foundation & Bug Fixes

**Goal:** Fix 4 P1 critical bugs discovered by SpecFlow + lay CSS groundwork.

**P1 Bug Fixes:**

- [x] **P1-A: Fix "Book Now" anchor in `TenantNav.tsx`**
  - Lines 214, 273: change `href={`${basePath}#packages`}` → `href={`${basePath}#services`}`
  - Both desktop and mobile "Book Now" buttons

- [x] **P1-B: Fix mobile menu not closing on anchor link tap**
  - `TenantNav.tsx` line 58: `useEffect` watches `pathname` but hash changes don't update `pathname`
  - Add `onClick={() => setIsOpen(false)}` to each anchor `Link` in the mobile nav
  - Reset `document.body.style.overflow = ''` synchronously in the `onClick` handler (before state update) to avoid iOS Safari scroll-lock race condition

- [x] **P1-C: Fix StickyMobileCTA observe element**
  - `StickyMobileCTA.tsx`: change `observeElementId="main-content"` → `observeElementId="hero"`
  - `main-content` fills the entire viewport and never exits → CTA never shows
  - `hero` exits viewport immediately after scrolling past → CTA appears correctly

- [x] **P2-G: Fix scroll-padding-top overshoot**
  - `globals.css` line 15: change `scroll-padding-top: 120px` → `scroll-padding-top: 80px` (64px nav `h-16` + 16px buffer)
  - Remove or reconsider the duplicate `[id] { scroll-margin-top: 2rem }` rule that stacks on top of `scroll-padding-top`

**CSS Groundwork:**

- [x] **Add `reveal-delay-3` class** in `globals.css` for 4-step stagger patterns (How It Works)

  ```css
  .reveal-delay-3 {
    animation-delay: 450ms;
  }
  ```

- [x] **Remove ghost `reveal-on-scroll` class** from `SegmentTiersSection.tsx` lines 229, 477 (undefined CSS class that does nothing)

**Acceptance criteria:**

- "Book Now" button scrolls to `#services` on both desktop and mobile
- Mobile menu closes immediately when tapping a section anchor link
- StickyMobileCTA appears after scrolling past the hero
- Section anchor scrolling positions sections correctly below the sticky nav
- All existing tests pass

---

#### Phase 2: How It Works Section

**Goal:** Create a new numbered-steps component and integrate it into the storefront template.

- [x] **Create `HowItWorksSection.tsx`** in `apps/web/src/components/tenant/sections/`
  - `'use client'` directive (needs `useScrollReveal`)
  - Props: `tenant: TenantPublicDto` (for potential future per-tenant customization)
  - 3 numbered steps as a component constant (not DB-stored):
    ```
    ① Choose Your Experience — Browse services and pick what fits.
    ② Book Your Date — Reserve your preferred date and time.
    ③ Show Up & Enjoy — We handle everything on-site.
    ```
  - Desktop: 3-column grid (`grid-cols-1 md:grid-cols-3 gap-8`)
  - Mobile: single column stack
  - Step number: `text-4xl font-bold text-accent`
  - Step headline: `font-heading text-lg font-semibold text-primary`
  - Step description: `text-muted-foreground`
  - `useScrollReveal` on wrapper with staggered delays per step (`reveal-delay-1`, `reveal-delay-2`, `reveal-delay-3`)
  - Section wrapper: `<section id="how-it-works" className="py-24 md:py-32">`
  - Section heading: `<h2>` with "How It Works" (not `<h1>` — nested inside page)
  - Generous whitespace: `py-24 md:py-32` section padding, `gap-8` between cards

- [x] **Export from barrel** in `apps/web/src/components/tenant/sections/index.ts`

- [x] **Integrate into `TenantLandingPage.tsx`**
  - Insert `<HowItWorksSection tenant={tenant} />` after Hero section(s) and before `SegmentTiersSection`
  - Position between `preSections` render and `SegmentTiersSection` render
  - **Document:** This static component is always slot 2, invisible to Build Mode editor, and independent of DB section ordering

**Design reference:**

```
┌─────────────────────────────────────────────┐
│              How It Works                    │
│                                              │
│  ①                ②               ③          │
│ Choose Your    Book Your      Show Up &      │
│ Experience     Date           Enjoy          │
│                                              │
│ Browse our     Reserve your   We handle      │
│ services and   preferred      everything     │
│ pick what      date and       on-site.       │
│ fits.          time.                         │
└─────────────────────────────────────────────┘
```

**Acceptance criteria:**

- Section renders between Hero and Services on all storefronts
- Responsive: 3-col desktop, 1-col mobile
- Staggered scroll-reveal animation
- `prefers-reduced-motion` disables animation
- Uses semantic tokens only (`text-primary`, `text-accent`, `font-heading`, `text-muted-foreground`)

---

#### Phase 3: FAQ Accordion Upgrade

**Goal:** Replace flat FAQ cards with an interactive accordion + add FAQ JSON-LD for SEO.

- [x] **Rewrite `FAQSection.tsx`** with accordion interaction pattern from `FAQAccordion.tsx`
  - Add `'use client'` directive
  - Extract ONLY the interaction logic (NOT the page-level hero/CTA from `FAQAccordion.tsx`):
    - `useState` for open item index (first item open by default)
    - CSS Grid `gridTemplateRows: '0fr'` → `'1fr'` for smooth height animation
    - ChevronDown icon rotation (`rotate-180`) with `transition-transform duration-300`
    - Arrow key navigation: Up/Down to move between items, Home/End to jump to first/last
    - ARIA: `aria-expanded` on button, `aria-controls` pointing to panel ID
    - `motion-reduce:transition-none` on all animated elements
  - Panel IDs: `faq-panel-${sectionId}-${index}` (not `faq-panel-${index}`) to avoid collision if multiple FAQ sections ever exist
  - Remove `role="region"` from individual accordion panels (causes landmark noise per P3-A); keep it on the outer wrapper only
  - Maintain existing empty-state guard: `if (!content?.items?.length) return null`
  - Section heading: `<h2>` "Frequently Asked Questions"
  - Touch target: minimum 44px height on accordion buttons
  - `useScrollReveal` on the section wrapper

- [x] **Add `generateFAQSchema()` to `storefront-utils.ts`**

  ```typescript
  export function generateFAQSchema(sections: Section[]): object | null {
    const faqSection = sections.find((s) => s.type === 'faq');
    const items = faqSection?.content?.items;
    if (!items?.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((item: { question: string; answer: string }) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    };
  }
  ```

- [x] **Inject FAQ JSON-LD in both page.tsx files**
  - `apps/web/src/app/t/[slug]/(site)/page.tsx`: add second `<script type="application/ld+json">` block (only when `generateFAQSchema` returns non-null)
  - `apps/web/src/app/t/_domain/page.tsx`: mirror the same injection

- [x] **Evaluate `FAQAccordion.tsx` for deletion** (deleted — no routes used it)
  - Check if the standalone `/faq` sub-page route still uses it
  - If yes: keep it but add a comment noting `FAQSection.tsx` is the landing-page version
  - If no: delete it (project principle: no debt)

**Acceptance criteria:**

- First FAQ item open by default
- Smooth CSS Grid height animation on expand/collapse
- Arrow key navigation between FAQ items
- Correct ARIA attributes (screen reader tested)
- `prefers-reduced-motion` disables accordion animation
- FAQ JSON-LD appears in page source for SEO crawlers
- Empty FAQ → section hidden, no JSON-LD emitted

---

#### Phase 4: Navigation Enhancement

**Goal:** Add section scroll links with active link highlighting to the sticky nav.

- [x] **Create `useActiveSection` hook** in `apps/web/src/hooks/`
  - Single shared `IntersectionObserver` watching all section anchor IDs
  - Threshold: `0.3` (section must be ~30% visible to be "active")
  - `rootMargin: '-80px 0px 0px 0px'` (offset for sticky nav height)
  - Returns `activeSection: string | null` (the `id` of the most visible section)
  - Persistent observation (does NOT unobserve after first intersection — unlike `useScrollReveal`)
  - Cleans up observer on unmount
  - SSR-safe: returns `null` during SSR

- [x] **Export from hooks barrel** in `apps/web/src/hooks/index.ts`

- [x] **Extend `TenantNav.tsx` section links**
  - Desktop nav items: Home | Services | About | FAQ | Book Now
  - Derive nav items from available sections (only show links for sections that exist in the tenant's content)
  - Active link styling: `text-accent font-semibold` (or `border-b-2 border-accent`) on the currently active section
  - Smooth scroll: `<a href="#services">` (native smooth scrolling via `scroll-behavior: smooth` in CSS)
  - Mobile hamburger: same section links + `onClick={() => setIsOpen(false)}` on each (from Phase 1 fix)

- [x] **Add anchor IDs to How It Works wrapper**
  - Verify `id="how-it-works"` is set on the HowItWorksSection wrapper (from Phase 2)
  - Optional: include "How It Works" in nav if space permits, or omit for cleaner nav

- [x] **Verify all section anchor IDs are consistent**
  - Check `SECTION_TYPE_TO_ANCHOR_ID` in `SectionRenderer.tsx` matches the actual section wrapper IDs
  - Ensure no duplicate IDs (especially `id="services"` — only on `SegmentTiersSection`, not in `SectionRenderer` postSections)

**Acceptance criteria:**

- Desktop: 5 nav links with smooth scroll to correct sections
- Mobile: hamburger menu with same section links; menu closes on tap
- Active link highlighting updates as user scrolls through sections
- Nav items only appear for sections the tenant actually has
- Active highlighting works correctly with the sticky nav offset

---

#### Phase 5: Section Polish

**Goal:** Apply scroll-reveal animations to all sections and enhance Testimonials, Footer, and CTA.

**Testimonials Enhancement (`TestimonialsSection.tsx`):**

- [ ] Add `'use client'` directive
- [ ] Add `useScrollReveal` with staggered card entrance
- [ ] Add hover effect: `hover:shadow-xl hover:-translate-y-1 transition-all duration-300`
- [ ] Add `line-clamp-4` on quote text to manage card height variance in the 2-column grid
- [ ] Maintain empty-state guard: return `null` if no testimonials

**Footer Upgrade (`TenantFooter.tsx`):**

- [ ] Add `bg-neutral-50` background for visual separation from page content
- [ ] Improve layout spacing and visual hierarchy
- [ ] **Defer social links and contact info** — `TenantPublicDto` has no social media fields; footer stays minimal for now
- [ ] Add TODO comment: `// TODO: Add social links when Tenant model gains socialLinks field`

**CTA Section (`CTASection.tsx`):**

- [ ] Add `'use client'` directive
- [ ] Add `useScrollReveal` for fade-up animation
- [ ] Verify CTA anchor links to `#services` (from existing implementation)

**FAQ Section scroll-reveal:**

- [ ] Verify `useScrollReveal` is applied (from Phase 3 rewrite)
- [ ] Confirm accordion animation is separate from section-level scroll-reveal

**Acceptance criteria:**

- All 7 sections have scroll-reveal animations
- Testimonials cards have hover lift effect and clamped quotes
- Footer has visual separation from main content
- `prefers-reduced-motion` disables ALL animations across ALL sections
- No `text-text-primary` or `bg-surface` tokens used (tenant token boundary)

---

#### Phase 6: Testing & Accessibility

**Goal:** Comprehensive quality assurance pass.

- [ ] **WCAG Accessibility Audit**
  - FAQ accordion: keyboard navigation (Tab, Arrow keys, Home, End, Escape)
  - All interactive elements: minimum 44px touch targets
  - Color contrast: verify accent text on white bg meets 4.5:1 ratio
  - Heading hierarchy: one `<h1>` per page, sections use `<h2>`
  - `aria-expanded`, `aria-controls`, `aria-current` attributes correct
  - Skip-to-content link still works with new section layout

- [ ] **Mobile Responsive Testing**
  - Test all 7 sections at 320px, 375px, 768px, 1024px, 1440px widths
  - How It Works: 3-col → 1-col transition is clean
  - FAQ accordion: touch targets large enough, smooth animation on mobile
  - Nav: hamburger menu section links work correctly
  - StickyMobileCTA: appears after scrolling past hero

- [ ] **Color Token Boundary Verification**
  - `grep -r "text-text-primary\|text-text-muted\|bg-surface" apps/web/src/components/tenant/sections/` → zero results
  - All new components use `text-primary`, `text-muted-foreground`, `text-accent`, `bg-background`, `font-heading`, `font-body`
  - No hardcoded hex colors in tenant components

- [ ] **Brand Voice Audit on Default Copy**
  - How It Works step text: short, specific, active voice, no hype words
  - CTA text: "Explore Experiences" (not aggressive "Book Now" in hero)
  - Section headings: concrete, not fluffy — check against Voice Quick Reference

- [ ] **prefers-reduced-motion Testing**
  - Enable reduced motion in OS settings
  - Verify: no scroll-reveal animations, no accordion transitions, no hover transforms
  - Content still fully visible and functional

- [ ] **Build Mode Compatibility**
  - Verify agent can still edit Hero, About, Services, FAQ, Testimonials, CTA sections in Build Mode
  - Document: How It Works is NOT editable via Build Mode (static component, no `data-section-index`)
  - Verify `indexOffset` prop on post-sections SectionRenderer is correct after HowItWorks insertion

- [ ] **Existing Test Suite**
  - `npm run --workspace=apps/web test` — all passing
  - `npm run --workspace=apps/web typecheck` — clean
  - `npm run --workspace=server typecheck` — clean (no server changes, but verify)

## Alternative Approaches Considered

| Approach                                                   | Rejected Because                                                                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| How It Works as a new `SectionType` in DB                  | Requires 10-step checklist (7+ file changes, Prisma migration), agent tool for editing — all for content that's identical across tenants |
| Framer Motion for animations                               | Adds 30KB+ bundle cost for scroll-reveal that CSS handles at 0KB                                                                         |
| Radix Accordion for FAQ                                    | New dependency for a pattern we already built; existing code has full a11y                                                               |
| Testimonials carousel/slider                               | Complex interaction pattern, poor mobile UX, brainstorm explicitly excluded                                                              |
| Footer with new DB fields for social links                 | Would require Prisma migration + API changes + agent tools — deferred to future sprint                                                   |
| Shared IntersectionObserver for scroll-reveal + active nav | Incompatible strategies: scroll-reveal unobserves after firing, active nav must watch persistently                                       |

## Acceptance Criteria

### Functional Requirements

- [ ] All 7 sections render in correct order: Hero → How It Works → Services → About → Testimonials → FAQ → CTA
- [ ] How It Works shows 3 numbered steps, responsive grid
- [ ] FAQ uses interactive accordion (first item open, keyboard navigation, smooth animation)
- [ ] Navigation has section scroll links (Home | Services | About | FAQ | Book Now)
- [ ] Active nav link highlights based on scroll position
- [ ] All sections have scroll-reveal animations
- [ ] FAQ JSON-LD structured data appears in page source
- [ ] Empty sections (no testimonials, no FAQ items) gracefully hidden
- [ ] StickyMobileCTA appears correctly on mobile
- [ ] Mobile menu closes on anchor link tap

### Non-Functional Requirements

- [ ] Zero new npm dependencies
- [ ] Zero new database fields or migrations
- [ ] CSS-only animations (0KB additional JS for animation)
- [ ] WCAG AA compliance (4.5:1 contrast, 44px touch targets, keyboard nav)
- [ ] `prefers-reduced-motion` respected across all animations
- [ ] No `text-text-primary` or platform color tokens in tenant components
- [ ] SSR-safe: all components render correctly before hydration

### Quality Gates

- [ ] `npm run --workspace=apps/web typecheck` — clean
- [ ] `npm run --workspace=apps/web test` — all passing
- [ ] Brand voice audit: no hype words, no filler, headlines < 15 words
- [ ] Manual test on littlebit-farm storefront

## Dependencies & Prerequisites

- **2026-02-17 MVP plan (complete):** Hero redesign, segment cards, about enhancement, CTA section, `useScrollReveal` hook — all implemented and merged
- **No blocked dependencies** — all phase 1-6 work is frontend-only on existing data

## Risk Analysis & Mitigation

| Risk                                                        | Likelihood | Impact | Mitigation                                                                                    |
| ----------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------- |
| How It Works breaks Build Mode section indexing             | Medium     | Medium | Test `indexOffset` arithmetic; document static section is not Build Mode selectable           |
| FAQ accordion animation janky on mobile Safari              | Low        | Medium | CSS Grid `0fr→1fr` is well-supported; test on actual iOS device                               |
| Active nav IO + scroll-reveal IO performance                | Low        | Low    | Separate observers by design; total ~10 instances is well within browser limits               |
| Footer social links expectations from stakeholders          | Medium     | Low    | Explicitly deferred in plan; no DB fields exist. Create follow-up todo if needed              |
| Section ordering confusion (DB order vs fixed How It Works) | Low        | Medium | Documented clearly: HowItWorks is always slot 2, independent of DB `order` column             |
| CTA anchor `#services` broken if no segments exist          | Low        | High   | SegmentTiersSection renders with `id="services"` even when empty (shows placeholder) — verify |

## Known Gaps (Deferred)

These are explicitly OUT OF SCOPE for this plan:

1. **Footer social links** — requires new DB fields (`instagramUrl`, `facebookUrl`, `linkedinUrl`) on Tenant model + Prisma migration + API update + agent `update_branding` tool change. Create separate todo.
2. **Per-tenant How It Works customization** — requires new DB model or section type. Future enhancement when tenants request it.
3. **Back-to-top button** — follow-up polish, not MVP.
4. **Gallery section in default template** — tenant-optional, not part of the standard 7-section layout.
5. **Contact form in default template** — tenant-optional.

## References & Research

### Internal References (Compound Knowledge)

- Brainstorm: `docs/brainstorms/2026-02-18-storefront-full-template-redesign-brainstorm.md`
- MVP plan (foundation): `docs/plans/2026-02-17-feat-storefront-mvp-template-redesign-plan.md`
- Constants duplication trap: `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`
- Production smoke test bugs: `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md`
- Color token collision: `docs/solutions/runtime-errors/color-token-collision-storefront-wcag-contrast.md`
- Content authoring workflow: `docs/solutions/patterns/tenant-storefront-content-authoring-workflow.md`
- Per-tenant CSS theming: `docs/solutions/architecture/per-tenant-css-theming-semantic-tokens-and-branding-route-fix.md`
- Route tree dedup: `docs/solutions/architecture/app-router-route-tree-deduplication-domain-vs-slug-pattern.md`
- Brand voice: `docs/design/VOICE_QUICK_REFERENCE.md`

### Key Files

- `apps/web/src/components/tenant/TenantLandingPage.tsx` — main landing page layout
- `apps/web/src/components/tenant/SectionRenderer.tsx` — section type → component mapping
- `apps/web/src/components/tenant/TenantNav.tsx` — navigation (291 lines)
- `apps/web/src/components/tenant/TenantFooter.tsx` — footer (101 lines)
- `apps/web/src/components/tenant/FAQAccordion.tsx` — standalone accordion page (166 lines, pattern source)
- `apps/web/src/components/tenant/sections/FAQSection.tsx` — current flat cards (45 lines, rewrite target)
- `apps/web/src/components/tenant/sections/TestimonialsSection.tsx` — testimonials (70 lines)
- `apps/web/src/components/tenant/sections/CTASection.tsx` — CTA section (46 lines)
- `apps/web/src/components/tenant/StickyMobileCTA.tsx` — mobile CTA (98 lines)
- `apps/web/src/components/tenant/sections/SegmentTiersSection.tsx` — services (531 lines)
- `apps/web/src/hooks/useScrollReveal.ts` — scroll reveal hook (62 lines)
- `apps/web/src/styles/globals.css` — animation keyframes + scroll-padding
- `apps/web/src/lib/storefront-utils.ts` — storefront data transforms
- `packages/contracts/src/landing-page.ts` — SECTION_TYPES canonical source

### External Research (from brainstorm swarm)

- Unbounce 2024 Conversion Benchmark — median landing page conversion 6.6%
- NNGroup footer patterns — 7 core patterns, 2-level max hierarchy
- LogRocket accordion UX — caret icons most effective, 44px touch targets, no nesting
- Smashing Magazine sticky nav — hide on scroll-down, show on scroll-up, 300-400ms
- Landing Page Flow CTA strategies — distribute CTAs after major content sections

### SpecFlow Analysis Findings Incorporated

- P1-A: Nav `#packages` → `#services` (Phase 1)
- P1-B: Mobile menu anchor close (Phase 1)
- P1-C: StickyMobileCTA observe element (Phase 1)
- P2-G: scroll-padding-top overshoot (Phase 1)
- P2-A: Footer social links deferred (Phase 5 + Known Gaps)
- P2-B: Build Mode invisibility documented (Phase 2 + Phase 6)
- P2-C: Separate useActiveSection hook (Phase 4)
- P2-D: Ghost reveal-on-scroll class removed (Phase 1)
- P2-E: FAQAccordion is a full page, extract only interaction logic (Phase 3)
- P2-F: How It Works fixed position documented (Phase 2)
- P3-A: Remove inner role="region" from accordion panels (Phase 3)
- P3-B: Accept 'use client' conversion for scroll-reveal sections (Phase 5)
- P3-C: FAQ JSON-LD implementation path (Phase 3)
- P3-D: Testimonials line-clamp-4 (Phase 5)
