# Consolidated Review Summary — Storefront Nav/Footer/Section Cleanup

**Date:** 2026-02-18
**Reviewers:** julik-frontend-races-reviewer, kieran-typescript-reviewer, code-simplicity-reviewer, architecture-strategist, learnings-researcher
**Scope:** navigation.ts rewrite, TenantNav/TenantFooter/TenantSiteShell refactor, HowItWorksSection deletion, TestimonialsSection reveal-on-scroll removal, storefront-utils testimonials transform, domainParam removal

---

## Totals

| Severity  | Count  | Notes                                 |
| --------- | ------ | ------------------------------------- |
| P1        | 2      | Fix before merge                      |
| P2        | 7      | Fix in this PR or immediate follow-up |
| P3        | 6      | Low urgency, nice-to-have             |
| **Total** | **15** | After de-duplication across 5 agents  |

---

## P1 — Critical (Fix Before Merge)

### P1-01 — Hydration Mismatch: `new Date().getFullYear()` in TenantFooter

**Severity:** P1
**Agents:** julik-frontend-races-reviewer (primary)
**File:** `apps/web/src/components/tenant/TenantFooter.tsx:27`

**Description:**
`new Date().getFullYear()` is evaluated at request time on the server. If the page is served via ISR (`revalidate = 60`) and the cached HTML crosses a year boundary, or if `TenantFooter` is ever converted to a `'use client'` component, the server-computed year will diverge from the client-computed year, triggering React's hydration mismatch error and white-screening the footer. The component is currently rendered inside a `<Suspense>` boundary wrapping `<EditModeGate>` (a Client Component), which increases the future risk surface.

**Recommended fix:**
Use `suppressHydrationWarning` on the containing element, or replace with a build-time constant:

```tsx
// Option A — suppressHydrationWarning (safest for live year display)
<time suppressHydrationWarning>{new Date().getFullYear()}</time>;

// Option B — build-time constant (simplest, acceptable for footer year)
const CURRENT_YEAR = new Date().getFullYear(); // evaluated at build time
```

---

### P1-02 — Dead `reveal-on-scroll` CSS Class Left in CTASection

**Severity:** P1
**Agents:** code-simplicity-reviewer (P1 primary), architecture-strategist (confirmed P3 — escalated due to PR context: same class was removed from TestimonialsSection in this PR, making the CTASection omission a clear oversight)
**File:** `apps/web/src/components/tenant/sections/CTASection.tsx:31`

```tsx
<section ref={sectionRef} className="reveal-on-scroll bg-accent py-32 md:py-40">
```

**Description:**
`reveal-on-scroll` has no definition in `apps/web/src/styles/globals.css`. The file defines `.reveal-visible`, `.reveal-delay-1/2/3`, and the `storefront-reveal` keyframe — but not `reveal-on-scroll`. Commit `24a37db7` removed this class from `TestimonialsSection.tsx` but missed `CTASection.tsx`. The CTA section still animates correctly because `sectionRef` (from `useScrollReveal()`) is still attached and drives animation via `.reveal-visible`. The class is confirmed dead code with zero CSS definitions and one remaining DOM usage.

**Recommended fix:**
Remove `reveal-on-scroll` from the `className` on `CTASection.tsx:31`.

---

## P2 — Important (Fix in This PR or Immediate Follow-Up)

### P2-01 — Testimonials Transform: Seed Is the Bug Source, Presentation Layer Is the Wrong Fix

**Severity:** P2
**Agents:** code-simplicity-reviewer, architecture-strategist, julik-frontend-races-reviewer, kieran-typescript-reviewer, learnings-researcher (5-way convergence — highest confidence finding)
**Known Pattern:** `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md` (pricing case), `docs/solutions/patterns/tenant-storefront-content-authoring-workflow.md`

**Files:**

- `apps/web/src/lib/storefront-utils.ts:102-118`
- `server/prisma/seeds/macon-headshots.ts:490-507`

**Description:**
The `testimonials` case in `transformContentForSection()` maps `name → authorName` and `role → authorRole`. This masks a seed authoring defect: the seed writes `name`/`role` but `TestimonialsSectionSchema` in `packages/contracts/src/landing-page.ts:300-301` requires `authorName`/`authorRole`. Consequences:

1. Raw `SectionContent.content` JSON fails validation against the contract schema.
2. AI agents write `authorName`/`authorRole` (correct); seed data writes `name`/`role` (wrong). Two formats coexist silently; the shim unifies them invisibly.
3. Any future server-side consumer of testimonial content (email, export, PDF) will see `name`/`role`, not the canonical field names.

The current transform also has two code-level bugs (from kieran-typescript-reviewer P2-2):

- `as Record<string, unknown>[]` cast is unsafe — if DB returns `[null, {...}]`, `{ ...null }` throws `TypeError` at runtime.
- `if (out.name && ...)` truthiness check skips remapping when `out.name === ""`, leaving the item with neither field name.

Additionally, the `authorPhotoUrl` field used in `TestimonialsSection.tsx:54` has no remap — if seed stores it as `photo` or `photoUrl`, the image silently drops.

**Recommended fix:**

1. Fix the seed file: change `name`/`role` to `authorName`/`authorRole` in `macon-headshots.ts`.
2. Add null-safety filter to the transform:
   ```typescript
   .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
   ```
3. Change truthiness check to `if (out.name !== undefined && !out.authorName)`.
4. Add `authorPhotoUrl` remap alongside `name` and `role`.
5. Leave the shim with a comment: `// Safety net: seed data may use legacy field names; canonical names are authorName/authorRole/authorPhotoUrl`.

---

### P2-02 — Duplicate Section Types Produce Invalid Duplicate Anchor IDs in the DOM

**Severity:** P2
**Agents:** architecture-strategist (primary)
**File:** `apps/web/src/components/tenant/SectionRenderer.tsx:151-180`

**Description:**
`getNavItemsFromHomeSections()` produces one nav item per page type via `Array.prototype.some()`. However, `SectionRenderer` assigns `id={anchorId}` to every section wrapper `<div>` unconditionally. If a tenant has two `testimonials` sections on the home page (the schema allows it — no uniqueness constraint on `blockType + pageName` in `SectionContent`), two `<div id="testimonials">` elements are rendered. The HTML spec requires unique IDs. Browsers resolve anchor links to the first matching element — the second section is unreachable via `#testimonials`. Currently latent (no seed tenant has duplicate home-page section types); becomes active as soon as any AI agent adds a second section of the same type.

**Recommended fix:**
Track assigned anchor IDs in a `Set<string>` scoped to the render call, and omit the `id` attribute for subsequent sections that would produce a duplicate.

---

### P2-03 — `domainParam` Removal Is Partial-by-Design but Commit Description Is Misleading

**Severity:** P2
**Agents:** code-simplicity-reviewer, architecture-strategist, kieran-typescript-reviewer, learnings-researcher (4-way)
**Known Pattern:** `docs/solutions/architecture/storefront-systemic-issues-seed-nav-cache-duplication-gap.md`, `docs/solutions/architecture/app-router-route-tree-deduplication-domain-vs-slug-pattern.md`

**Files:**

- `apps/web/src/components/tenant/TenantLandingPage.tsx:26,107,130`
- `apps/web/src/components/tenant/SegmentTiersSection.tsx:349-358`
- `apps/web/src/components/tenant/ContactForm.tsx:59`

**Description:**
Commit `b0c536ce` says "Remove unused domainParam prop." It correctly removes the prop from `TenantSiteShell`, `TenantNav`, and `TenantFooter`. However, `domainParam` remains active in `SegmentTiersSection` (booking link routing — `basePath` is `""` on domain routes; without the guard, booking links become broken `/book/tier-slug`) and `ContactForm` ("Back to Home" href). Both retentions are correct and load-bearing. The risk: a future developer reading `TenantSiteShell` will not expect `domainParam` three layers down and may attempt to "complete the cleanup."

**Recommended fix:**
No code change needed. Add a comment in `TenantLandingPage.tsx` near the `domainParam` prop:

```typescript
/**
 * domainParam is intentionally retained for domain-routing link construction
 * in SegmentTiersSection (booking URLs) and ContactForm (home href).
 * It was removed from TenantSiteShell/Nav/Footer only — those components
 * use basePath for link construction. See PR #62.
 */
```

---

### P2-04 — `s.type as SectionTypeName` Cast Masks Future Type Drift

**Severity:** P2
**Agents:** julik-frontend-races-reviewer (P3-02), kieran-typescript-reviewer (P2-1) — escalated to P2 by independent flagging

**File:** `apps/web/src/components/tenant/navigation.ts:102`

```typescript
(s) => SECTION_TYPE_TO_PAGE[s.type as SectionTypeName] === page;
```

**Description:**
`s.type` is already typed as the exact union `SectionTypeName` — the cast is a no-op that TypeScript accepts silently. The risk is forward-compatibility: if a new section type is added to `SectionSchema` but not to `SectionTypeName` (or vice versa), TypeScript would normally surface a type error at this call site. The redundant cast papers over that divergence silently. Without the cast, TypeScript would flag the divergence at compile time — the desired behavior.

**Recommended fix:**

```typescript
(s) => SECTION_TYPE_TO_PAGE[s.type] === page;
```

Remove the cast. `SECTION_TYPE_TO_PAGE` is correctly typed as `Partial<Record<SectionTypeName, PageName>>` — the cast at the call site is redundant.

---

### P2-05 — Testimonials Transform Missing `authorPhotoUrl` Field Remap

**Severity:** P2
**Agents:** julik-frontend-races-reviewer (P2-03 extension)

**Files:**

- `apps/web/src/lib/storefront-utils.ts:102-118`
- `apps/web/src/components/tenant/sections/TestimonialsSection.tsx:54`

**Description:**
`TestimonialsSection.tsx:54` uses `item.authorPhotoUrl`. The transform maps `name → authorName` and `role → authorRole` but has no mapping for the photo field. If the seed or agent writes the photo URL as `photo` or `photoUrl`, the image silently drops from every testimonial card — no error, no console warning.

**Recommended fix:**
Audit the seed testimonials items for the actual photo field name. Add to the transform:

```typescript
if ((out.photo || out.photoUrl) && !out.authorPhotoUrl) {
  out.authorPhotoUrl = out.photo ?? out.photoUrl;
  delete out.photo;
  delete out.photoUrl;
}
```

---

### P2-06 — `SECTION_TYPE_TO_ANCHOR_ID` and `SECTION_TYPE_TO_PAGE` Are Coupled Maps With No Cross-Reference

**Severity:** P2
**Agents:** architecture-strategist (P2-C, P3)

**Files:**

- `apps/web/src/components/tenant/SectionRenderer.tsx:24-37`
- `apps/web/src/components/tenant/navigation.ts:76-84`

**Description:**
`SECTION_TYPE_TO_ANCHOR_ID` in `SectionRenderer` maps `features → "services"` (DOM anchor). `SECTION_TYPE_TO_PAGE` in `navigation.ts` excludes `features` from nav. These maps are semantically coupled: if someone adds `features` to `SECTION_TYPE_TO_PAGE`, the nav link would target `#services` (pointing to `SegmentTiersSection` instead of a features section) with no compile-time warning. The maps live in separate files with zero cross-references; a developer adding a new section type must update both correctly without any tooling enforcement.

**Recommended fix (immediate):** Add cross-reference comments in each map pointing to the other. Longer-term: move `SECTION_TYPE_TO_ANCHOR_ID` from `SectionRenderer` into `navigation.ts` so both mappings are co-located.

---

### P2-07 — `useMemo` Churn on Scroll Due to `pages` Object Identity

**Severity:** P2
**Agents:** julik-frontend-races-reviewer (P2-02), kieran-typescript-reviewer (P3-2) — escalated by scroll-event frequency

**File:** `apps/web/src/components/tenant/TenantNav.tsx:49-56`

**Description:**
`useMemo([basePath, pages])` invalidates when `pages` reference changes. `pages` is a `PagesConfig` object passed from a Server Component via RSC serialization — on soft navigations or router refreshes, React may recreate the RSC tree and pass a new object reference even when the data is identical. `useMemo` uses `Object.is`; a new reference invalidates the memo. Since `TenantNav` re-renders on every scroll event (via `useActiveSection` IntersectionObserver), `getNavItemsFromHomeSections(pages)` — which iterates all sections for each page in `PAGE_ORDER` — runs on every scroll frame.

**Recommended fix:**
Hoist `getNavItemsFromHomeSections(pages)` to the Server Component and pass the derived `navItems` array directly to `TenantNav`. The array is stable when content is stable and avoids the object-identity problem entirely.

---

## P3 — Nice-to-Have (Low Urgency)

### P3-01 — `text: 'about'` Legacy Alias Needs Inline Comment

**File:** `apps/web/src/components/tenant/navigation.ts:78`

The `text: 'about'` entry maps a legacy section type alias without explanation. A future reader will not know why `text` produces `about`.

**Fix:** Add inline comment: `// 'text' is a legacy alias for 'about' — kept for backward compat with older seed data`.

---

### P3-02 — `custom` Section Type Exclusion Undocumented in Nav Map

**File:** `apps/web/src/components/tenant/navigation.ts:65-75`

The JSDoc exclusion list covers `hero`, `cta`, `features`, `pricing` but not `custom`. Todo #11005 shows `custom` was a prior source of confusion.

**Fix:** Add `// custom: no canonical nav label or anchor target — agent-created sections only` to the exclusion comment block.

---

### P3-03 — Suspense Boundary Gives False Sense of Error Containment for Footer

**File:** `apps/web/src/components/tenant/TenantSiteShell.tsx:63-74`

The `<Suspense>` wrapping `<EditModeGate>` handles only async suspensions (`useSearchParams()`). It does not catch synchronous render errors from `TenantFooter`. No current throwing paths in `TenantFooter`, but no `ErrorBoundary` is co-located either.

**Fix:** Add comment to the Suspense boundary clarifying its scope: `// Suspense required for useSearchParams() in EditModeGate — does NOT catch synchronous errors. Add ErrorBoundary if footer becomes data-dependent.`

---

### P3-04 — `buildAnchorNavHref` Has Unreachable `|| ''` Guard

**File:** `apps/web/src/components/tenant/navigation.ts:124`

```typescript
return `${basePath || ''}${item.path}`;
```

Both callers guarantee a non-null `basePath`. The `|| ''` can never activate. Harmless defensive dead code.

**Fix:** No action required.

---

### P3-05 — `SECTION_TYPE_TO_PAGE` Would Benefit from `as const satisfies`

**File:** `apps/web/src/components/tenant/navigation.ts:76`

`as const satisfies Partial<Record<SectionTypeName, PageName>>` would make the map immutable at the type level. Stylistic improvement only; no correctness issue.

**Fix:** Optional.

---

### P3-06 — `features → 'Services'` Nav Label Is a Semantic Trap for Template Redesign

**File:** `apps/web/src/components/tenant/navigation.ts:76-84`

`features` is correctly excluded from `SECTION_TYPE_TO_PAGE`. However, the brainstorm at `docs/brainstorms/2026-02-18-storefront-full-template-redesign-brainstorm.md` plans a template with both a FEATURES ("How It Works") section and a Services section. If a future developer adds `features` to the map targeting `'services'`, the nav would show two "Services" items with no compile warning.

**Fix:** Add a comment in the exclusion JSDoc: `// features: maps to same DOM anchor as 'services' (see SECTION_TYPE_TO_ANCHOR_ID in SectionRenderer). Adding it here produces a conflicting 'Services' nav item.`

---

## De-duplication Log

| Finding                              | Agents That Flagged                                                           | Original Refs                              |
| ------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------ |
| P2-01 testimonials transform layer   | code-simplicity, architecture-strategist, julik, kieran, learnings-researcher | 5-way convergence; merged into one finding |
| P2-03 domainParam commit description | code-simplicity, architecture-strategist, kieran, learnings-researcher        | 4-way; merged                              |
| P2-04 SectionTypeName cast           | julik (P3-02), kieran (P2-1)                                                  | 2-way; escalated from P3 to P2             |
| P2-07 useMemo churn                  | julik (P2-02), kieran (P3-2)                                                  | 2-way; escalated to P2 by scroll frequency |
| P1-02 CTASection reveal-on-scroll    | code-simplicity (P1), architecture-strategist (P3)                            | 2-way; maintained P1 due to PR context     |

---

## Confirmed Correct — No Action Required

| Item                                                                   | Confirmed By                                  | Result                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `sectionRef` in `TestimonialsSection` after `reveal-on-scroll` removal | code-simplicity, kieran                       | Live and functional — hook drives animation via IntersectionObserver, not the CSS class |
| `HowItWorksSection` deletion completeness                              | code-simplicity, learnings-researcher         | Fully removed — zero live references in `apps/web/src/`                                 |
| `domainParam` in `SegmentTiersSection` and `ContactForm`               | code-simplicity, architecture-strategist      | Load-bearing — correctly retained for custom domain booking/home link routing           |
| `getNavItemsFromHomeSections` null safety                              | julik                                         | Optional chain guard handles all null/undefined cases correctly                         |
| Server/Client boundary serialization                                   | julik                                         | No non-serializable values cross the RSC boundary                                       |
| `storefront-utils.ts` mutation safety                                  | julik                                         | `{ ...content }` and `{ ...item }` spreads prevent original object mutation             |
| Section-scan nav is architecturally correct                            | architecture-strategist, learnings-researcher | Single-page scroll storefront: nav from home sections, not page-level enabled flags     |
| `buildAnchorNavHref` fragment href for domain routes                   | kieran                                        | Valid HTML for same-page anchor navigation; benign for current architecture             |

---

## Known Pattern Tags

| Finding                              | Pattern                                                                                                                | Doc                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| P2-01 (null defeats `= []` defaults) | Missing transform case kills React tree; use `Array.isArray()` not default params                                      | `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md`       |
| P2-01 (field aliasing layer)         | `transformContentForSection()` is the single seam for all field name aliasing                                          | `docs/solutions/patterns/tenant-storefront-content-authoring-workflow.md`                  |
| P2-03 (domainParam)                  | domainParam removed from Shell, retained in SegmentTiersSection for domain routing                                     | `docs/solutions/architecture/storefront-systemic-issues-seed-nav-cache-duplication-gap.md` |
| P2-04 (SectionTypeName cast)         | Use `Record<SectionTypeName, ...>` for compile-time exhaustiveness; cast suppresses it                                 | `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`                      |
| P2-06 (parallel maps)                | Section type constants duplication trap — 7+ locations, single source of truth needed                                  | `docs/solutions/patterns/SECTION_TYPES_CONSTANT_DRIFT_RESOLUTION.md`                       |
| P1-01 (year hydration)               | ISR cache boundary + hydration mismatch — no prior doc; candidate for compounding if this causes a production incident | _(new — not yet documented)_                                                               |
