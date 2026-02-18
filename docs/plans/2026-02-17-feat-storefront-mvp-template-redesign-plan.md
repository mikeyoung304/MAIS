---
title: 'feat: Storefront MVP Template Redesign'
type: feat
status: complete
date: 2026-02-17
brainstorm: docs/brainstorms/2026-02-17-storefront-mvp-template-redesign-brainstorm.md
superseded_by: docs/plans/2026-02-18-feat-storefront-full-template-redesign-plan.md
---

# Storefront MVP Template Redesign

> **Note:** This MVP (4-section: Hero → Services → About → CTA) was extended to a production 7-section template on 2026-02-18. See [full template redesign plan](../2026-02-18-feat-storefront-full-template-redesign-plan.md) for the current layout: Hero → How It Works → Services → About → Testimonials → FAQ → CTA.

## Overview

Redesign the default storefront template for all HANDLED tenants. Replace the current menu-style landing page with a conversion-optimized layout: **Hero → Services → About → CTA**. Add CSS-only entrance animations, responsive segment cards, a trust-building About section, and enhanced segment detail views with price reveal.

**Impact:** Every tenant storefront. This is the standard template — not a one-off fix.

## Problem Statement

The current storefront has three rendering bugs and a weak visual narrative:

1. **`about` sections silently dropped** — `buildHomeSections()` only collects `s.type === 'text'`, missing `about` type entirely
2. **`SERVICES` block renders null** — dispatches to `FeaturesSection` which returns null when no `features` array exists
3. **Hero CTA hard-coded to `#packages`** — ignores `ctaLink` from DB, exists in **4 locations** not 1
4. **No emotional hook** — segment cards show Airbnb fee text and operational details instead of selling the experience
5. **No entrance animations** — hero loads flat, no visual polish
6. **No closing CTA** — visitors who scroll past everything have no final conversion point

## Proposed Solution

Seven-phase implementation touching ~15 files, adding one new utility hook and enhancing 5 existing components.

## Technical Approach

### Architecture

**No new routes, no new database fields, no new API endpoints.**

The redesign works entirely within the existing rendering pipeline:

```
SectionContent (DB) → sectionsToPages() → buildHomeSections() → SectionRenderer + SegmentTiersSection
```

Key architectural decisions:

- **Segment detail pages stay inline** — the current hash-based expand/collapse pattern is simpler than new routes and better for SEO (no additional pages to index). "Detail page" in the brainstorm means the expanded view, not a new route.
- **Services heading override** — uses the existing SERVICES SectionContent `title` field, plumbed as a prop from `buildHomeSections()` to `SegmentTiersSection`. No new DB field needed.
- **Anchor rename** — `#packages` → `#services` across all locations. Atomic coordinated change.
- **Animation as progressive enhancement** — elements render at `opacity: 1` (SSR-safe). The `useScrollReveal` hook adds animation classes via Intersection Observer. No flash-of-invisible-content.

### Implementation Phases

---

#### Phase 1: Foundation — Animation System + Bug Fixes

**Goal:** Fix the 3 rendering bugs, rename anchors, and build the reusable animation utility.

##### 1a. CSS Animation Keyframes

**File:** `apps/web/src/globals.css`

Add `storefront-reveal` keyframe (distinct name to avoid collision with existing `fade-in-up` used for chat):

```css
@keyframes storefront-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Utility class applied by useScrollReveal */
.reveal-visible {
  animation: storefront-reveal 0.7s cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* Stagger delays for hero elements */
.reveal-delay-1 {
  animation-delay: 150ms;
}
.reveal-delay-2 {
  animation-delay: 300ms;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .reveal-visible {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

##### 1b. `useScrollReveal` Hook

**New file:** `apps/web/src/hooks/useScrollReveal.ts`

```typescript
/**
 * useScrollReveal — Intersection Observer utility for scroll-triggered animations
 *
 * Progressive enhancement:
 * - Elements start visible (opacity: 1) for SSR safety
 * - Hook sets initial opacity to 0 on mount (client-only)
 * - IntersectionObserver adds .reveal-visible class when element enters viewport
 * - prefers-reduced-motion: elements stay visible, no animation
 *
 * @param options.threshold - Visibility threshold (default 0.15 = 15% visible)
 * @param options.stagger - Delay class suffix for staggered children
 */
```

- Returns a `ref` callback to attach to container elements
- Uses `IntersectionObserver` with `{ threshold: 0.15, rootMargin: '0px 0px -50px 0px' }` (triggers slightly before fully in view)
- On intersection: adds `.reveal-visible` to observed element, unobserves (one-shot)
- On mount: sets `opacity: 0` on observed elements (client-only, avoids SSR flash)
- Checks `window.matchMedia('(prefers-reduced-motion: reduce)')` — if true, skips opacity manipulation entirely
- ~25 lines of code, 0 dependencies

##### 1c. Bug Fix — `buildHomeSections` drops `about` sections

**File:** `apps/web/src/components/tenant/TenantLandingPage.tsx:80`

```typescript
// BEFORE:
const textSections = homeSections.filter((s) => s.type === 'text');

// AFTER:
const textSections = homeSections.filter((s) => s.type === 'text' || s.type === 'about');
```

##### 1d. Bug Fix — SERVICES block renders null via FeaturesSection

**File:** `apps/web/src/components/tenant/TenantLandingPage.tsx:67-74`

The SERVICES block is architecturally orphaned — it stores heading/subtitle metadata, not feature items. Instead of rendering it through FeaturesSection, extract its heading data and pass it to SegmentTiersSection.

Changes to `buildHomeSections()`:

1. Add return field: `servicesHeading: { title?: string; subtitle?: string } | null`
2. Find the `services` section: `const servicesMeta = homeSections.find(s => s.type === 'services')`
3. Extract heading: `servicesHeading: servicesMeta ? { title: servicesMeta.headline, subtitle: servicesMeta.subheadline } : null`
4. Do NOT include `services` type in either preSections or postSections (it's metadata, not a rendered section)

Pass `servicesHeading` prop to `SegmentTiersSection` in the JSX.

##### 1e. Bug Fix — Hero CTA hard-coded to `#packages`

**Coordinated anchor rename across 4 files:**

| File                      | Line                    | Change                                                                              |
| ------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `HeroSection.tsx`         | 66                      | `#packages` → use `ctaLink` prop, default `#services`                               |
| `CTASection.tsx`          | 39                      | `#packages` → `#services`                                                           |
| `TenantLandingPage.tsx`   | 149                     | `#packages` → `#services`                                                           |
| `SegmentTiersSection.tsx` | 403, 422, 437, 387, 313 | `id="packages"` → `id="services"`, `'#packages'` → `'#services'` in hash navigation |

Also check: `TenantSiteShell.tsx` StickyMobileCTA `href="#packages"` → `#services`

**Hero CTA prop:** Change from hard-coded anchor to using `ctaLink` from DB content, with fallback:

```typescript
const ctaHref = ctaLink || `${basePath}#services`;
```

Add `ctaLink?: string` to the `HeroSectionType` contract if not already present, or use an existing field.

##### 1f. Add `type="button"` to SegmentCard

**File:** `SegmentTiersSection.tsx:67`

```diff
- <button onClick={onSelect} className="group relative ...">
+ <button type="button" onClick={onSelect} className="group relative ...">
```

**Tests for Phase 1:**

- [x] Unit test `buildHomeSections` with `about` type sections → included in preSections
- [x] Unit test `buildHomeSections` with `services` type → extracts heading, not in pre/postSections
- [x] Unit test `useScrollReveal` — observes, adds class, unobserves
- [x] Verify token boundary test passes for new hook (not in `tenant/` dir, so auto-passes)

---

#### Phase 2: Hero Section Redesign

**Goal:** Full-bleed hero with gradient overlay, brand color fallback, staggered entrance animation.

**File:** `apps/web/src/components/tenant/sections/HeroSection.tsx`

##### Visual Changes

**With background image:**

- Full-viewport-ish height: `min-h-[70vh] md:min-h-[80vh]` (constrains mobile, prevents > 100vh)
- Bottom-heavy gradient: replace `bg-black/40` with `bg-gradient-to-t from-black/60 via-black/20 to-transparent`
- Next.js `Image` with `priority` (already present)
- Text positioned bottom-third: `flex flex-col justify-end pb-16 md:pb-24`

**Without background image (brand color fallback):**

- Gradient using tenant's accent color: `bg-gradient-to-br from-accent/15 via-background to-accent/5`
- Same text layout and spacing
- Still looks designed, not broken

##### Animation

Hero children get staggered `useScrollReveal`:

- Headline: `reveal-visible` (0ms delay)
- Subheadline: `reveal-visible reveal-delay-1` (150ms)
- CTA button: `reveal-visible reveal-delay-2` (300ms)

Since hero is above the fold, the Intersection Observer fires immediately on mount. The stagger creates a cascading entrance effect on initial page load.

**SSR safety:** Elements render at `opacity: 1` in SSR HTML. `useScrollReveal` sets `opacity: 0` on hydration, then immediately triggers the animation (since the hero is already in viewport). The visual sequence is: SSR paint (visible) → hydration (brief invisible, ~16ms) → animation plays. This 1-frame blink is imperceptible.

##### CTA Button

```tsx
<Button asChild variant="accent" size="xl">
  <a href={ctaLink || `${basePath}#services`}>{ctaText || 'View Services'}</a>
</Button>
```

Default CTA text changes from "View Packages" to "View Services".

**Accessibility:**

- `alt=""` on background image is correct (decorative)
- `aria-label` on section remains
- Color contrast: white text on gradient overlay meets AA (black/60 base)

---

#### Phase 3: Services Section — Segment Cards Redesign

**Goal:** Responsive use-case cards, heading override from SERVICES SectionContent, no pricing on cards.

**File:** `apps/web/src/components/tenant/SegmentTiersSection.tsx`

##### Heading Override

Accept new prop from `TenantLandingPage`:

```typescript
interface SegmentTiersSectionProps {
  data: TenantStorefrontData;
  basePath?: string;
  domainParam?: string;
  servicesHeading?: { title?: string; subtitle?: string } | null; // NEW
}
```

Use in the heading:

```tsx
<h2>{servicesHeading?.title || 'What brings you here?'}</h2>
<p>{servicesHeading?.subtitle || 'Choose the experience that fits your needs.'}</p>
```

Also apply heading to single-segment case (currently skipped — uses segment name directly). Wrap single-segment in the same section heading pattern for layout consistency.

##### Segment Card Redesign

Remove pricing from card face. The card should drive self-selection by use case:

```tsx
function SegmentCard({ segment, onSelect }: SegmentCardProps) {
  return (
    <button type="button" onClick={onSelect} className="...">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image ... />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3>{segment.name}</h3>
        {/* One-liner description instead of price */}
        {segment.description && (
          <p className="mt-3 line-clamp-2 text-muted-foreground">{segment.description}</p>
        )}
        <div className="mt-auto pt-6">
          <span className="flex items-center gap-1 text-sm font-medium text-accent">
            Explore <ArrowIcon />
          </span>
        </div>
      </div>
    </button>
  );
}
```

**Key change:** `priceRange` removed from card. Price appears only in the expanded tier cards (price reveal pattern).

##### Responsive Grid

```tsx
const gridClasses =
  segmentsWithTiers.length === 1
    ? 'mx-auto max-w-2xl md:grid-cols-1' // Full-width feature card
    : segmentsWithTiers.length === 2
      ? 'mx-auto max-w-3xl md:grid-cols-2' // 2-column
      : 'md:grid-cols-3'; // 3-column (wraps naturally for 4+)
```

4+ segments: 3-column grid wraps to 3+1, 3+2 etc. Natural CSS grid wrapping. No carousel for MVP.

##### Scroll Reveal

Wrap the segment cards grid in `useScrollReveal` ref. Cards fade up when scrolled into view.

---

#### Phase 4: About Section Enhancement

**Goal:** Hybrid story + experience layout. Uses existing `TextSection` component with enhanced styling.

**File:** `apps/web/src/components/tenant/sections/TextSection.tsx`

The `TextSection` component already handles `about` type sections (via `SectionRenderer` type override). The current two-column layout with image is close to the brainstorm spec. Enhancements:

##### Content Improvements

- **Empty content guard:** If `content` is empty/whitespace, hide the section entirely (return null)
- **Paragraph styling:** Keep current `split('\n\n')` pattern — agent-generated content uses double newlines

##### Image Fallback Enhancement

Current fallback (no image): gradient placeholder with tenant initial. This is already the brainstorm's recommended pattern. Keep as-is.

##### Scroll Reveal

Wrap the section content in `useScrollReveal`. The two-column grid fades up when scrolled into view.

##### About Heading Default

When `headline` is empty/missing for an `about` section, use a sensible default:

```typescript
const displayHeadline = headline || `About ${tenant.name}`;
```

This is already partially handled by the `alt` attribute but not the visible heading.

---

#### Phase 5: CTA Section — Bottom Accent Bar

**Goal:** Full-width accent bar at page bottom as final conversion point.

**File:** `apps/web/src/components/tenant/sections/CTASection.tsx`

The existing CTASection is already close to spec:

- `bg-accent` background ✓
- White text ✓
- Button linking to services ✓

##### Changes

1. **Anchor rename:** `#packages` → `#services` (Phase 1 handles this)
2. **Remove duplicate inline CTA** in `TenantLandingPage.tsx` lines 132-154. The CTA should only render through `SectionRenderer` via the `cta` section type. The inline duplication is architectural debt.

To remove the duplicate:

- Move `cta` from `postTierTypes` exclusion → include in the regular section flow
- Remove the `finalCta` logic from `buildHomeSections()` entirely
- Let the CTA render in its natural position via `SectionRenderer`

**But wait** — the current design intentionally places the CTA _after_ all post-sections (testimonials, gallery, FAQ). If we remove `finalCta` and let it render through `SectionRenderer`, it would render at whatever position it has in the sections array. This is actually fine for the new fixed layout (Hero → Services → About → CTA) since the CTA should always be last.

**Implementation:**

- `buildHomeSections()` no longer separates `finalCta`
- Add `'cta'` to `postTierTypes` set (so it renders after tiers)
- Remove the `{finalCta && (...)}` JSX block from `TenantLandingPage`
- CTA renders through `SectionRenderer` → `CTASection` component naturally

##### Scroll Reveal

CTA section fades up when scrolled into view. Single animation, no stagger.

---

#### Phase 6: Segment Detail Enhancement — Story Intro + Tier Cards

**Goal:** When a segment is expanded, show a story paragraph before tier cards. This is the "price reveal" page.

**File:** `apps/web/src/components/tenant/SegmentTiersSection.tsx` — `TierGridSection` component

##### Changes to `TierGridSection`

Already has `showExtendedInfo` prop that shows `segment.description` in the expanded view. Enhance:

1. **Story intro paragraph** (already exists via `segment.description` — just improve styling):

```tsx
{
  showExtendedInfo && segment.description && (
    <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
      {segment.description}
    </p>
  );
}
```

2. **Tier cards already show pricing** — this IS the price reveal. No change needed to pricing display.

3. **Features list on tier cards:** If the `TierData` has a `description` field with bullet-point content, render it as a features list. Current implementation already shows `pkg.description` as `whitespace-pre-line` text. This is sufficient for MVP.

4. **Animation:** Tier cards should stagger their entrance. Apply `useScrollReveal` with stagger to the tier grid:

```tsx
<div ref={tierGridRevealRef} className={`mt-16 grid gap-8 ${gridClasses}`}>
  {tiers.map((pkg, index) => (
    <div key={pkg.id} className={`reveal-delay-${Math.min(index, 2)}`}>
      <TierCard ... />
    </div>
  ))}
</div>
```

##### Back Button Enhancement

Increase tap target size for mobile (currently may be < 44px):

```tsx
<button
  type="button"
  onClick={handleBack}
  className="group mb-8 flex items-center gap-2 py-2 px-3 -ml-3 text-sm font-medium text-muted-foreground ..."
>
```

The `py-2 px-3 -ml-3` adds padding for tap target while maintaining visual alignment.

---

#### Phase 7: Testing & Polish

##### Token Boundary Compliance

The new `useScrollReveal` hook lives in `apps/web/src/hooks/` (not `components/tenant/`), so it won't be scanned by the token boundary test. All new CSS in `globals.css` uses only light-palette-safe tokens. No action needed — but verify.

##### Mobile Polish

- [x] Hero: `min-h-[70vh]` prevents overly tall heroes on small phones
- [x] Segment cards: `aspect-[16/10]` is fine on mobile (234px tall on 375px width — reasonable)
- [x] Stacked cards: CSS grid naturally stacks to single column via `md:grid-cols-*`
- [x] Touch targets: all buttons ≥ 44px (back button enhanced in Phase 6)

##### StickyMobileCTA + CTA Section

The StickyMobileCTA and the new bottom CTA section will coexist on mobile. This is the current behavior and is acceptable — the sticky CTA provides always-visible access, while the inline CTA is a natural endpoint for scrollers. Consider hiding StickyMobileCTA when the CTA section is in viewport (Intersection Observer), but this is **not MVP** — note as follow-up.

##### Accessibility

- [x] All animations respect `prefers-reduced-motion` via CSS media query
- [x] `useScrollReveal` checks `matchMedia` and skips opacity manipulation for reduced motion
- [x] Hero: `aria-label` maintained, decorative image `alt=""`
- [x] Segment cards: `type="button"` added (Phase 1)
- [x] Back button: increased tap target (Phase 6)
- [x] Screen reader announcements: existing `aria-live` region maintained

##### Tests to Write

| Test                                                           | File                                                                     | Type       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- |
| `useScrollReveal` observes and adds class                      | `apps/web/src/hooks/__tests__/useScrollReveal.test.ts`                   | Unit       |
| `buildHomeSections` includes `about` type                      | `apps/web/src/components/tenant/__tests__/TenantLandingPage.test.ts`     | Unit       |
| `buildHomeSections` extracts services heading                  | Same file                                                                | Unit       |
| `buildHomeSections` doesn't render services as FeaturesSection | Same file                                                                | Unit       |
| Hero renders gradient overlay on image                         | `apps/web/src/components/tenant/sections/__tests__/HeroSection.test.tsx` | Unit       |
| Hero renders brand color fallback without image                | Same file                                                                | Unit       |
| Hero CTA uses `ctaLink` prop with `#services` default          | Same file                                                                | Unit       |
| Segment card doesn't show pricing                              | `apps/web/src/components/tenant/__tests__/SegmentTiersSection.test.tsx`  | Unit       |
| Services heading uses override when provided                   | Same file                                                                | Unit       |
| CTA section links to `#services`                               | `apps/web/src/components/tenant/sections/__tests__/CTASection.test.tsx`  | Unit       |
| Token boundary passes for all modified/new files               | Existing test                                                            | Regression |

## Acceptance Criteria

### Functional Requirements

- [x] Hero section: full-bleed image with bottom-heavy gradient, staggered fade-up animation
- [x] Hero section: brand color gradient fallback when no image
- [x] Hero CTA: links to `#services` (from DB `ctaLink` field, with default)
- [x] Services section: responsive segment card grid (1→full-width, 2→2-col, 3→3-col)
- [x] Services section: heading defaults to "What brings you here?" with tenant override
- [x] Segment cards: show name + description only, no pricing
- [x] Segment detail: expanded view shows story intro + tier cards with price
- [x] About section: renders for `type: 'about'` sections (bug fix)
- [x] CTA section: full-width accent bar at bottom, links to `#services`
- [x] All sections: CSS-only fade-up animation on scroll
- [x] All animations: respect `prefers-reduced-motion`

### Non-Functional Requirements

- [x] No new npm dependencies (0KB bundle impact from animation)
- [x] No new database fields or migrations
- [x] No new API endpoints
- [x] Token boundary test passes (no dark palette tokens in storefront components)
- [x] Both workspace typechecks pass
- [x] All existing tests pass + new tests added

### Quality Gates

- [x] `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
- [x] `npm run --workspace=apps/web test` — new tests pass (42/42), pre-existing failures unchanged
- [ ] `npm run --workspace=server test` — not run (no server changes)
- [x] Token boundary test: `npx vitest run storefront-token-boundary`
- [ ] Manual visual review on 375px (mobile) and 1440px (desktop)

## Files Changed (Estimated)

| File                                                                 | Action                                                                            | Phase        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------ |
| `apps/web/src/globals.css`                                           | Edit — add `storefront-reveal` keyframe                                           | 1a           |
| `apps/web/src/hooks/useScrollReveal.ts`                              | **Create** — Intersection Observer hook                                           | 1b           |
| `apps/web/src/components/tenant/TenantLandingPage.tsx`               | Edit — fix `about` filter, extract services heading, remove inline CTA            | 1c, 1d, 5    |
| `apps/web/src/components/tenant/sections/HeroSection.tsx`            | Edit — full-bleed redesign, gradient, animation, CTA fix                          | 1e, 2        |
| `apps/web/src/components/tenant/sections/CTASection.tsx`             | Edit — anchor rename                                                              | 1e           |
| `apps/web/src/components/tenant/SegmentTiersSection.tsx`             | Edit — heading override, card redesign, scroll reveal, back button, anchor rename | 1e, 1f, 3, 6 |
| `apps/web/src/components/tenant/sections/TextSection.tsx`            | Edit — empty content guard, scroll reveal                                         | 4            |
| `apps/web/src/components/tenant/SectionRenderer.tsx`                 | No change needed                                                                  | —            |
| `apps/web/src/components/tenant/TenantSiteShell.tsx`                 | Edit — StickyMobileCTA `#packages` → `#services`                                  | 1e           |
| `apps/web/src/hooks/__tests__/useScrollReveal.test.ts`               | **Create** — hook tests                                                           | 7            |
| `apps/web/src/components/tenant/__tests__/TenantLandingPage.test.ts` | Edit — new tests                                                                  | 7            |
| Existing section test files                                          | Edit — updated tests                                                              | 7            |

~12-15 files total. Net LOC change: small positive (new hook + tests) with some deletion (inline CTA removal).

## Risk Analysis & Mitigation

| Risk                                                                | Severity | Mitigation                                                                               |
| ------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `#packages` → `#services` breaks existing bookmarks/links           | P2       | Add `id="packages"` as secondary anchor on SegmentTiersSection for backwards compat      |
| SSR flash-of-invisible-content from animation                       | P1       | Progressive enhancement: render visible, set invisible on hydration, animate immediately |
| Token boundary test fails on new files                              | P1       | `useScrollReveal` lives in `hooks/` not `components/tenant/`, auto-excluded              |
| Existing `text` sections reflowed into new About layout             | P3       | No layout change to TextSection — the two-column layout is unchanged                     |
| Build Mode integration gap (SegmentTiersSection no data attributes) | P2       | Out of scope for this PR — existing behavior, not a regression                           |
| StickyMobileCTA overlaps CTA section on mobile                      | P3       | Acceptable for MVP — both serve conversion. Hide-on-overlap is follow-up                 |

## YAGNI — What We're NOT Building

- Custom section ordering (fixed Hero → Services → About → CTA)
- Parallax or video heroes
- Framer Motion or any JS animation library
- New database fields or migrations
- New routes for segment detail pages
- Image upload UI
- Tier comparison tables
- Nav redesign
- StickyMobileCTA visibility toggle based on CTA section viewport

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-17-storefront-mvp-template-redesign-brainstorm.md`
- Section types trap: `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`
- Color token collision: `docs/solutions/runtime-errors/color-token-collision-storefront-wcag-contrast.md`
- Theming architecture: `docs/solutions/architecture/per-tenant-css-theming-semantic-tokens-and-branding-route-fix.md`
- Production smoke test bugs: `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md`
- Route dedup: `docs/solutions/architecture/app-router-route-tree-deduplication-domain-vs-slug-pattern.md`
- Brand voice: `docs/design/VOICE_QUICK_REFERENCE.md`

### Key Source Files

- `apps/web/src/components/tenant/TenantLandingPage.tsx` — main composition
- `apps/web/src/components/tenant/SectionRenderer.tsx` — section dispatcher
- `apps/web/src/components/tenant/SegmentTiersSection.tsx` — segment cards + tier grid
- `apps/web/src/components/tenant/sections/HeroSection.tsx` — hero
- `apps/web/src/components/tenant/sections/TextSection.tsx` — about/text
- `apps/web/src/components/tenant/sections/CTASection.tsx` — CTA
- `apps/web/src/lib/storefront-utils.ts` — data transformation pipeline
- `apps/web/src/components/tenant/TenantSiteShell.tsx` — brand colors + StickyMobileCTA
