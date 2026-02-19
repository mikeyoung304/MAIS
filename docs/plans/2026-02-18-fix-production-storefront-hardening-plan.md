---
title: 'fix: Production Storefront Hardening — 7 P1-P2 Issues From Smoke Test'
type: fix
status: complete
date: 2026-02-18
---

# Production Storefront Hardening — 7 P1-P2 Issues

## Overview

Production smoke test on two live tenants (Macon Headshots `/t/maconheadshots` and Little Bit Farm `/t/littlebit-farm`) revealed 7 issues blocking enterprise-grade quality. One P1 (broken booking flow), six P2 (visual/UX). The storefront skeleton (TenantSiteShell → TenantLandingPage → SectionRenderer → SegmentTiersSection) is architecturally sound — these are data mismatches, ghost components, and missing field transforms.

## Problem Statement

The storefront renders but looks unfinished:

1. **P1:** 2 of 3 Macon tiers show "Different Booking Type" error → zero revenue path
2. **P2:** "How It Works" renders twice (hardcoded + database-driven)
3. **P2:** Macon has no images → gradient placeholders with "M" initial
4. **P2:** Google Fonts fail to load → fallback system fonts
5. **P2:** Testimonials appear as empty void (opacity stuck at 0 + field mismatch)
6. **P2:** Nav shows only "Home" + "Book Now" despite 5-6 sections existing
7. **P2:** Checkout shows $800 when storefront says $1,000 (no explanation)

## Root Cause Analysis

| #   | Issue                  | Root Cause                                                                                                                                                                                          | Affected Files                                             |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | TIMESLOT booking type  | Seed uses `bookingType: 'TIMESLOT'` but no frontend wizard exists for it                                                                                                                            | `macon-headshots.ts:264,295`                               |
| 2   | Duplicate How It Works | `HowItWorksSection` hardcoded in layout AND FEATURES block in seed renders via `FeaturesSection`                                                                                                    | `TenantLandingPage.tsx:129`                                |
| 3   | Missing images         | Macon seed omits `backgroundImage` (hero) and `image` (about) fields                                                                                                                                | `macon-headshots.ts:376,395`                               |
| 4   | Font loading failure   | `<link>` tag in TenantSiteShell body — need to investigate if CSP or Next.js optimization issue                                                                                                     | `TenantSiteShell.tsx:58-60`                                |
| 5   | Testimonials void      | TWO bugs: (a) `useScrollReveal` sets `opacity:0` inline — may not recover; (b) `transformContentForSection` has NO testimonials case — seed `name`/`role` never mapped to `authorName`/`authorRole` | `TestimonialsSection.tsx:37`, `storefront-utils.ts:61-113` |
| 6   | Nav shows only Home    | All sections have `pageName:'home'` → `sectionsToPages()` only enables `home` page → `getAnchorNavigationItems()` checks page-level `enabled` flags, finds only Home enabled                        | `navigation.ts:89-95`, `storefront-utils.ts:177`           |
| 7   | Price confusion        | `DateBookingWizard.ReviewStep` shows `priceCents` (experience only), storefront shows `displayPriceCents` (all-in), no explanation                                                                  | `DateBookingWizard.tsx:384`                                |

## Proposed Solution

Three phases ordered by dependency and risk. Phase 1 is data-only (seed), Phase 2 is frontend component fixes, Phase 3 is polish.

## Technical Approach

### Phase 1: Seed Data Fixes (Issues 1, 3)

No frontend code changes. Fixes data mismatches in the Macon Headshots seed.

#### 1a. Change TIMESLOT → DATE in Macon seed

**File:** `server/prisma/seeds/macon-headshots.ts`

- [x] Line 264: Change `bookingType: 'TIMESLOT'` → `bookingType: 'DATE'` (Individual Session tier)
- [x] Line 295: Change `bookingType: 'TIMESLOT'` → `bookingType: 'DATE'` (Group In-Studio tier)

**Why DATE, not build a TimeslotWizard:** The DateBookingWizard already handles all tier configurations including scaling rules (`Group In-Studio` has `scalingRules.components`), guest counts, and duration. Building a separate TimeslotWizard (with time slot selection, calendar grid, availability checking) is a significant feature that belongs in a future sprint. Changing the seed is the pragmatic fix — all 3 tiers use the same proven booking flow.

**Regression check:** `DateBookingWizard` triggers the Guests step when `hasScalingPricing(tier) || tier.maxGuests` — the Group tier's `scalingRules` will correctly activate this step. No code changes to the wizard needed.

#### 1b. Add images to Macon seed

**File:** `server/prisma/seeds/macon-headshots.ts`

- [x] HERO section (~line 376): Add `backgroundImage` field with Unsplash headshot studio URL
  - Use `?w=1920&h=1080&fit=crop&q=80` params for hero dimensions
- [x] ABOUT section (~line 395): Add `image` field with Unsplash portrait photographer URL
  - Use `?w=800&h=600&fit=crop&q=80` params for about section dimensions

**Image selection criteria:**

- Professional headshot photography context (studio lighting, camera equipment, or portrait session)
- Warm/neutral tones matching the `classic` font preset aesthetic
- `images.unsplash.com` domain already in `next.config.js` remotePatterns (line 89)

**Pattern to follow:** Little Bit Farm seed uses the same approach:

```typescript
// Little Bit Farm HERO (reference pattern)
backgroundImage: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&h=1080&fit=crop&q=80';
// Little Bit Farm ABOUT (reference pattern)
image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop&q=80';
```

---

### Phase 2: Frontend Component Fixes (Issues 2, 5, 6)

These are independent of each other and can be developed in parallel.

#### 2a. Remove hardcoded HowItWorksSection (Issue 2)

**Files:**

- `apps/web/src/components/tenant/TenantLandingPage.tsx` — remove import + render
- `apps/web/src/components/tenant/sections/HowItWorksSection.tsx` — delete file
- `apps/web/src/components/tenant/sections/index.ts` — remove export

**Changes:**

- [x] `TenantLandingPage.tsx:18`: Remove `import { HowItWorksSection } from './sections'`
- [x] `TenantLandingPage.tsx:128-129`: Remove the `{/* HOW IT WORKS */}` comment and `<HowItWorksSection tenant={tenant} />` line
- [x] Delete `HowItWorksSection.tsx` entirely
- [x] Remove `HowItWorksSection` from `sections/index.ts` barrel export

**Why safe to remove:** Both seeds (Macon + Little Bit Farm) create a FEATURES block with title "How It Works". The `buildHomeSections` function puts `features` in `postTierTypes` (line 72), so the FEATURES section renders via `SectionRenderer → FeaturesSection` in the post-tier area. The seeded FEATURES sections have customized content per tenant (Schedule/Shoot/Select for Macon, not the generic Choose/Book/Enjoy).

**Layout impact:** The page flow changes from:

```
Hero → About → [HowItWorks STATIC] → Services/Tiers → [HowItWorks DYNAMIC] → Testimonials → Contact
```

to:

```
Hero → About → Services/Tiers → How It Works (FEATURES) → Testimonials → Contact
```

**Note:** The today's brainstorm (`docs/brainstorms/2026-02-18-storefront-full-template-redesign-brainstorm.md`) wants "How It Works" ABOVE services. That's the template redesign scope — not this fix. For now, removing the duplicate is the correct fix. The template redesign can reorder sections later.

#### 2b. Fix testimonials rendering (Issue 5)

**Two bugs to fix:**

**Bug 5a — Field name mismatch in transform function:**

**File:** `apps/web/src/lib/storefront-utils.ts`

- [x] Add `testimonials` case to `transformContentForSection()` switch statement (after line 101):

```typescript
case 'testimonials':
  // Map seed field names to component field names
  if (Array.isArray(transformed.items)) {
    transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => ({
      ...item,
      // Map name → authorName (seed uses short names, component expects full names)
      ...(item.name && !item.authorName ? { authorName: item.name, name: undefined } : {}),
      ...(item.role && !item.authorRole ? { authorRole: item.role, role: undefined } : {}),
    }));
  }
  break;
```

**Why this matters:** The Macon seed creates testimonial items with `name: 'Sarah M.'` and `role: 'Real Estate Agent'`, but `TestimonialsSection.tsx:66` accesses `testimonial.authorName` and `:68` accesses `testimonial.authorRole`. Without the mapping, both fields are `undefined` → empty author attribution below each quote.

**Bug 5b — Ghost `reveal-on-scroll` class:**

**File:** `apps/web/src/components/tenant/sections/TestimonialsSection.tsx`

- [x] Line 37: Remove `reveal-on-scroll` from className (it's a ghost class — no CSS definition exists)

The class name `reveal-on-scroll` has zero CSS rules. The actual scroll-reveal mechanism works via `useScrollReveal()` which:

1. Sets `node.style.opacity = '0'` inline on mount
2. Uses IntersectionObserver to add `.reveal-visible` class when element enters viewport
3. `.reveal-visible` triggers `storefront-reveal` animation (`opacity: 0 → 1`)

The `reveal-on-scroll` class was likely meant as a semantic marker but never had CSS rules. Removing it changes nothing functionally but clarifies intent. The compound doc at `docs/solutions/ui-bugs/scroll-reveal-playwright-inline-opacity-specificity.md` documents this inline-vs-class specificity pattern.

**Verification:** After both fixes, testimonials should show:

- Star ratings (already working via `testimonial.rating`)
- Quote text (already working via `testimonial.quote`)
- Author name (NOW working via mapped `testimonial.authorName`)
- Author role (NOW working via mapped `testimonial.authorRole`)
- Smooth fade-in animation when scrolled into view

#### 2c. Fix navigation to derive items from home sections (Issue 6)

**Root cause deep dive:** All seed sections have `pageName: 'home'`. The `sectionsToPages()` function groups by `pageName`, so only `pageMap.get('home')` has entries. The page-level flags (`about.enabled`, `services.enabled`, etc.) are derived from `sortedPageMap.has('about')` — which is `false` because there's no `about` page entry, only an `about` section on the `home` page. The `getAnchorNavigationItems()` function checks `pages[page].enabled` → only `home` passes → nav shows only "Home".

**Fix approach:** Add a new function that derives nav items from the SECTIONS present on the home page, rather than from page-level enabled flags. Modify `TenantNav` to use this function when in single-page (anchor navigation) mode.

**File:** `apps/web/src/components/tenant/navigation.ts`

- [x] Add new function `getNavItemsFromHomeSections()`:

```typescript
/**
 * Section types that should appear as nav items when present on home page.
 * Maps section type → page name for anchor lookup.
 */
const SECTION_TYPE_TO_PAGE: Partial<Record<string, PageName>> = {
  about: 'about',
  text: 'about', // text sections map to About nav item
  services: 'services',
  features: 'services', // features maps to Services nav item
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  contact: 'contact',
};

/**
 * Derive anchor navigation items from home page sections.
 *
 * For single-page storefronts where all sections live on the home page,
 * this scans the actual sections present and generates nav items with
 * anchor links. Deduplicates by page name (e.g., features + services
 * both map to 'services' → only one nav item).
 */
export function getNavItemsFromHomeSections(pages?: PagesConfig | null): NavItem[] {
  if (!pages?.home?.sections?.length) {
    return [{ label: 'Home', path: '' }];
  }

  const items: NavItem[] = [{ label: 'Home', path: '' }];
  const seen = new Set<PageName>();

  for (const section of pages.home.sections) {
    const pageName = SECTION_TYPE_TO_PAGE[section.type];
    if (!pageName || seen.has(pageName)) continue;
    // Skip hero — it's always at top, no nav needed
    if (section.type === 'hero') continue;
    seen.add(pageName);
    items.push({
      label: PAGE_LABELS[pageName],
      path: PAGE_ANCHORS[pageName],
    });
  }

  return items;
}
```

**File:** `apps/web/src/components/tenant/TenantNav.tsx`

- [x] Lines 49-56: Replace `getAnchorNavigationItems(pages)` with `getNavItemsFromHomeSections(pages)`:

```typescript
import { getNavItemsFromHomeSections, buildAnchorNavHref } from './navigation';
// ...
const navItems = useMemo<NavItemWithHref[]>(
  () =>
    getNavItemsFromHomeSections(pages).map((item) => ({
      label: item.label,
      href: buildAnchorNavHref(basePath, item),
    })),
  [basePath, pages]
);
```

**Expected result for Macon Headshots:** Home | About | Services | Testimonials | Contact
**Expected result for Little Bit Farm:** Home | About | Services | FAQ

**Edge cases handled:**

- `features` and `services` sections both map to `'services'` page → `seen` Set deduplicates
- `text` and `about` sections both map to `'about'` page → deduplicates
- Hero is explicitly skipped (always at top)
- CTA is not in `SECTION_TYPE_TO_PAGE` → doesn't appear in nav (correct — it's a closing section)

---

### Phase 3: Polish (Issues 4, 7)

#### 3a. Investigate and fix Google Fonts loading (Issue 4)

**File:** `apps/web/src/components/tenant/TenantSiteShell.tsx`

**Current approach (lines 58-60):**

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href={fontPreset.googleFontsUrl} rel="stylesheet" />
```

This is a `<link>` tag rendered in the component body (not `<head>`). In Next.js App Router, `<link>` tags in component JSX render in the DOM where they appear. Modern browsers still process `<link rel="stylesheet">` in the body, but it's non-standard and can cause FOUC.

**Investigation steps:**

- [x] Check `fontPreset.googleFontsUrl` value for the `classic` preset — verify URL is well-formed
- [x] Check if `net::ERR_FAILED` is a CORS, CSP, or network issue (test URL directly in browser)
- [x] Check `apps/web/src/middleware.ts` for CSP headers that might block `fonts.googleapis.com`
- [x] Check `next.config.js` for security headers

**Potential fixes (investigate before choosing):**

**Option A — URL is broken:** Fix the URL in `packages/contracts/src/constants/font-presets.ts`. The `classic` preset's `googleFontsUrl` might have a malformed query parameter.

**Option B — CSP blocking:** Add `fonts.googleapis.com` and `fonts.gstatic.com` to `style-src` and `font-src` CSP directives in middleware.

**Option C — Move `<link>` to `<head>`:** Use Next.js `<Script>` strategy or metadata API. However, per-tenant fonts are dynamic (based on `tenant.fontPreset`), which makes static `next/font` imports impossible. The `<link>` approach may be the only viable option for dynamic fonts.

> **Note:** Root layout already loads Inter + Playfair Display via `next/font/google` (line 9-19 of `layout.tsx`). The TenantSiteShell `<link>` loads the tenant-specific preset (could be Lora, DM Sans, etc.). If both tenants use `classic` preset (Playfair Display), the root layout already handles it — the `<link>` is redundant. Check if the error only occurs for non-classic presets.

#### 3b. Add checkout price explanation (Issue 7)

**File:** `apps/web/src/components/booking/DateBookingWizard.tsx`

- [x] In the `ReviewStep` component (around line 384), add an explanation when `displayPriceCents` differs from the charged price:

```tsx
{
  /* Price explanation — only shown when storefront price differs from charge price */
}
{
  tier.displayPriceCents && tier.displayPriceCents !== effectiveTotal && (
    <p className="mt-2 text-sm text-muted-foreground">
      Experience fee: {formatCurrency(effectiveTotal)}.
      {tier.displayPriceCents > effectiveTotal && (
        <> Accommodation booked separately after purchase.</>
      )}
    </p>
  );
}
```

**Why this wording:** Little Bit Farm's pricing model splits "experience fee" (what we charge) from "accommodation" (Airbnb, booked separately). The explanation avoids showing the full `displayPriceCents` at checkout (which would confuse — "why am I being charged less?") and instead explains what the charge covers.

**Edge cases:**

- If `displayPriceCents === priceCents` → no explanation shown (guard clause)
- If `displayPriceCents` is `null`/`undefined` → no explanation shown (falsy check)
- Scaling tiers: `effectiveTotal` already accounts for guest count, so comparison is against the computed total, not base price

---

## Acceptance Criteria

### Functional Requirements

- [ ] **Issue 1:** All 3 Macon tiers open DateBookingWizard (no "Different Booking Type" error)
- [ ] **Issue 2:** "How It Works" appears exactly once per storefront (the database-driven FEATURES version)
- [ ] **Issue 3:** Macon hero has background image, about section has photo (no "M" placeholder)
- [ ] **Issue 4:** Fonts load without console errors on both tenants
- [ ] **Issue 5:** Testimonials fade in on scroll with star ratings, quotes, AND author names visible
- [ ] **Issue 6:** Nav shows anchor links for all present sections (About, Services, Testimonials, Contact/FAQ)
- [ ] **Issue 7:** Checkout explains price when displayPriceCents differs from charge amount

### Non-Functional Requirements

- [ ] All existing server tests pass (`npm run --workspace=server test`)
- [ ] Both workspaces typecheck clean (`npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`)
- [ ] No orphaned imports after deleting HowItWorksSection
- [ ] No bundle size regression (HowItWorksSection deletion should reduce bundle)

### Quality Gates

- [ ] Lighthouse performance > 90 on both tenant storefronts
- [ ] No WCAG AA contrast violations in changed components
- [ ] Mobile-responsive at 375px, 768px, 1920px viewports

## Dependencies & Prerequisites

- **No schema migrations** — all changes are seed data + frontend components
- **No API changes** — `transformContentForSection` is client-side utility
- **Seed re-run required** for Phase 1 changes to take effect in production
- **Agent re-deploy NOT required** — no changes to agent system prompts or tools

## Risk Analysis & Mitigation

| Risk                                                              | Severity | Mitigation                                                          |
| ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| HowItWorksSection removal leaves gap for tenants without FEATURES | Medium   | Both seeds have FEATURES; agent `build_first_draft` auto-creates it |
| Testimonials transform breaks if items schema changes             | Low      | Transform uses defensive `item.name && !item.authorName` checks     |
| Nav derivation from sections shows too many/few items             | Medium   | `SECTION_TYPE_TO_PAGE` mapping is explicit; `seen` Set deduplicates |
| Unsplash URLs go stale                                            | Low      | Use stable photo IDs; document refresh interval                     |
| Font `<link>` fix may require deeper investigation                | Medium   | Phase 3; can be deferred if root cause unclear                      |

## Documented Learnings to Apply

From `docs/solutions/` (preventing known regressions):

1. **Constants duplication trap** (`CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`): When adding the testimonials transform case, verify the field mapping matches the `TestimonialsSectionSchema` in contracts
2. **null defeats [] defaults** (`PRODUCTION_SMOKE_TEST_6_BUGS.md`): The testimonials transform MUST use `Array.isArray(transformed.items)` guard, not default params
3. **Scroll-reveal specificity** (`scroll-reveal-playwright-inline-opacity-specificity.md`): Inline `opacity: 0` has higher specificity than CSS classes; animation `fill: both` overrides it
4. **Orphan imports after deletions** (Pitfall #14): Run `rm -rf server/dist packages/*/dist && npm run typecheck` after deleting HowItWorksSection
5. **Cache staleness after seed deploys** (`production-seed-pipeline-ipv6-cache-cascade.md`): After running seed, wait 5 min for cache TTL or hard-refresh

## Files Changed (Estimated)

| File                                                              | Action                                     | Phase  |
| ----------------------------------------------------------------- | ------------------------------------------ | ------ |
| `server/prisma/seeds/macon-headshots.ts`                          | EDIT — bookingType + images                | 1a, 1b |
| `apps/web/src/components/tenant/TenantLandingPage.tsx`            | EDIT — remove HowItWorksSection            | 2a     |
| `apps/web/src/components/tenant/sections/HowItWorksSection.tsx`   | DELETE                                     | 2a     |
| `apps/web/src/components/tenant/sections/index.ts`                | EDIT — remove export                       | 2a     |
| `apps/web/src/lib/storefront-utils.ts`                            | EDIT — add testimonials transform case     | 2b     |
| `apps/web/src/components/tenant/sections/TestimonialsSection.tsx` | EDIT — remove ghost class                  | 2b     |
| `apps/web/src/components/tenant/navigation.ts`                    | EDIT — add `getNavItemsFromHomeSections()` | 2c     |
| `apps/web/src/components/tenant/TenantNav.tsx`                    | EDIT — use new nav function                | 2c     |
| `apps/web/src/components/tenant/TenantSiteShell.tsx`              | EDIT — font loading fix (TBD)              | 3a     |
| `apps/web/src/components/booking/DateBookingWizard.tsx`           | EDIT — price explanation                   | 3b     |

**Estimated impact:** ~10 files changed, ~1 file deleted, net LOC reduction (HowItWorksSection removal)

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-18-storefront-full-template-redesign-brainstorm.md` (supersedes this fix long-term)
- Compound doc: `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`
- Compound doc: `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md`
- Compound doc: `docs/solutions/ui-bugs/scroll-reveal-playwright-inline-opacity-specificity.md`
- Compound doc: `docs/solutions/deployment-issues/production-seed-pipeline-ipv6-cache-cascade.md`
- Content authoring: `docs/solutions/patterns/tenant-storefront-content-authoring-workflow.md`

### Architecture Files

- Transform chain: `apps/web/src/lib/storefront-utils.ts` (sectionsToPages → transformContentForSection)
- Section renderer: `apps/web/src/components/tenant/SectionRenderer.tsx` (blockType → component mapping)
- Navigation: `apps/web/src/components/tenant/navigation.ts` (nav item derivation)
- Font presets: `packages/contracts/src/constants/font-presets.ts` (8 preset definitions)
- Pricing: `apps/web/src/lib/pricing.ts` (formatPriceDisplay, calculateClientPrice)
