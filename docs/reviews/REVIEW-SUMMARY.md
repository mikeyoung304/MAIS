# Plan Review Summary — Production Storefront Hardening

**Date:** 2026-02-18
**Plan:** `docs/plans/2026-02-18-fix-production-storefront-hardening-plan.md`
**Agents:** kieran-typescript-reviewer, code-simplicity-reviewer, architecture-strategist, learnings-researcher

---

## Verdict

**Plan is sound and well-scoped.** 2 P1 corrections required before implementing Issue 6. 5 P2 improvements to apply during implementation. 4 P3 cleanup items. Phase ordering (data → components → polish) is correct. No over-engineering detected. The testimonials and HowItWorksSection fixes are minimal and correct. Risk is concentrated in Issue 6 (nav derivation).

---

## Finding Counts

| Severity | Count | Blocking?                                       |
| -------- | ----- | ----------------------------------------------- |
| P1       | 2     | Must fix before implementing Phase 2c (Issue 6) |
| P2       | 5     | Apply during implementation                     |
| P3       | 4     | Cleanup items                                   |

---

## P1 Findings (Must Fix)

### P1-1: `SECTION_TYPE_TO_PAGE` key type must be `SectionTypeName`, not `string`

**Source:** kieran-typescript-reviewer

The plan declares:

```typescript
const SECTION_TYPE_TO_PAGE: Partial<Record<string, PageName>> = { ... }
```

`string` as key type silently accepts typos and won't catch unhandled section types when new ones are added to contracts. Use `SectionTypeName` (the discriminated union from `@macon/contracts`):

```typescript
import type { SectionTypeName } from '@macon/contracts';
const SECTION_TYPE_TO_PAGE: Partial<Record<SectionTypeName, PageName>> = { ... }
```

Runtime impact: none. TypeScript impact: compile-time errors on typos + exhaustiveness signal on new section types.

---

### P1-2: Plan incorrectly claims anchor IDs are missing — they already exist

**Source:** architecture-strategist

`SectionRenderer.tsx:24-37` already defines `SECTION_TYPE_TO_ANCHOR_ID` and applies `id={anchorId}` to every section wrapper `<div>`. The anchors `#about`, `#services`, `#gallery`, `#testimonials`, `#faq`, `#contact` are already in the DOM.

The nav fix is purely changing the nav derivation function in `TenantNav.tsx`. No DOM changes needed. Remove any plan prose that implies anchor IDs need to be added.

**Corollary:** `SECTION_TYPE_TO_ANCHOR_ID` already maps `features → 'services'` — the deduplication intent is already encoded at the rendering layer.

---

## P2 Findings (Apply During Implementation)

### P2-1: Delete `getAnchorNavigationItems()` in the same commit as the nav fix

**Source:** code-simplicity-reviewer, architecture-strategist

After `TenantNav.tsx` switches to `getNavItemsFromHomeSections()`, `getAnchorNavigationItems()` has zero callers. Per the "No Debt" principle, delete it in the same commit. Also update the file-level docstring (which says "only enabled pages appear in nav" — wrong for the new architecture).

Also audit `getNavigationItems()` (multi-page path function) — likely dead code too.

---

### P2-2: Nav loop should iterate `PAGE_ORDER` not `pages.home.sections` (fixes non-deterministic ordering)

**Source:** code-simplicity-reviewer

The proposed loop iterates `pages.home.sections` in DB insertion order. Nav item order is non-deterministic across seed runs. Iterate `PAGE_ORDER` instead — guarantees canonical order, eliminates the `seen` Set, makes the `hero` skip check disappear:

```typescript
const items: NavItem[] = [{ label: 'Home', path: '' }];
for (const page of PAGE_ORDER) {
  if (page === 'home') continue;
  const hasSection = pages.home.sections.some((s) => SECTION_TYPE_TO_PAGE[s.type] === page);
  if (hasSection) {
    items.push({ label: PAGE_LABELS[page], path: PAGE_ANCHORS[page] });
  }
}
```

7 lines vs. 12. Ordering is provably correct and deterministic.

---

### P2-3: Testimonials transform should use `delete`, not `name: undefined`

**Source:** code-simplicity-reviewer, kieran-typescript-reviewer

Spreading `{ name: undefined }` does NOT remove the key — it sets it to `undefined`. Every other case in `transformContentForSection()` uses `delete transformed.fieldName` (lines 57, 70, 77, 84, 88, 94). Match the existing pattern:

```typescript
transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => {
  const out = { ...item };
  if (out.name && !out.authorName) {
    out.authorName = out.name;
    delete out.name;
  }
  if (out.role && !out.authorRole) {
    out.authorRole = out.role;
    delete out.role;
  }
  return out;
});
```

---

### P2-4: Exclude `features` from `SECTION_TYPE_TO_PAGE` (semantic mismatch)

**Source:** architecture-strategist

Mapping `features` → `'services'` nav item produces "Services" label for a "How It Works" process steps section. Macon's FEATURES section is titled "Schedule, Shoot, Select" — not service offerings. The brainstorm also plans both a FEATURES section AND a services/tiers area — both would produce "Services" nav items.

**Recommended fix:** Exclude `features` from `SECTION_TYPE_TO_PAGE`. The `SegmentTiersSection` already renders at `#services` anchor — tiers ARE the services nav item, not the FEATURES process steps.

Expected Macon nav result: Home | About | Testimonials | Contact ✓

---

### P2-5: Document as architectural decision: single-page scroll = nav from home sections

**Source:** architecture-strategist

The root cause is that `getAnchorNavigationItems()` was designed for a multi-page architecture that was never built. `getNavItemsFromHomeSections()` is the correct permanent fix. After implementing, run `/workflows:compound` to document: "MAIS is single-page scroll. Nav derives from sections on home page, not page-level enabled flags." This prevents a future developer from reintroducing `getAnchorNavigationItems()` because its name looks more correct.

---

## P3 Findings (Cleanup)

### P3-1: Remove unreachable `hero` skip — document in map comment instead

`hero` is not in `SECTION_TYPE_TO_PAGE` so `!pageName` already skips it. The `if (section.type === 'hero') continue;` guard is dead code. Move the explanation to the map definition:

```typescript
const SECTION_TYPE_TO_PAGE = {
  // hero intentionally excluded — always at top, no anchor nav needed
  // cta intentionally excluded — closing section, not a nav destination
  about: 'about',
  ...
}
```

(This naturally disappears if P2-2's `PAGE_ORDER` loop is adopted.)

---

### P3-2: Price explanation wording encodes Little Bit Farm's business model

The "Accommodation booked separately after purchase" wording is tenant-specific in a shared `DateBookingWizard`. Use a neutral phrase or store the explanation in `tier.priceNote` and render generically.

---

### P3-3: Font `<link>` in body IS the accepted pattern — adjust investigation focus

**Source:** learnings-researcher

Compound doc `per-tenant-css-theming-semantic-tokens-and-branding-route-fix.md` already established: `<link>` in body is correct for data-driven per-tenant fonts — `next/font/google` only works for build-time-known fonts. Phase 3a investigation should focus on whether the `classic` preset's `googleFontsUrl` is valid and non-redundant with root layout's `next/font` load, NOT on moving the `<link>` tag.

---

### P3-4: Scroll-reveal fix requires clearing inline style, not just class removal

**Source:** learnings-researcher

From `scroll-reveal-playwright-inline-opacity-specificity.md`: `useScrollReveal` sets `el.style.opacity = '0'` inline (specificity 1000). Removing `reveal-on-scroll` class alone won't fix visibility — the inline style wins the cascade. If the testimonials opacity issue persists after class removal, the hook itself must clear `el.style.opacity` when the IntersectionObserver fires.

---

## What the Plan Gets Right

- Phase ordering (data → components → polish) minimizes test noise
- `Array.isArray(transformed.items)` guard in testimonials is correctly load-bearing (null-defeats-defaults)
- Deleting `HowItWorksSection.tsx` entirely — appropriately ruthless per "No Debt" principle
- Risk matrix identifies "tenants without FEATURES" gap and correctly notes `build_first_draft` coverage
- Both bugs in Issue 5 correctly identified (field mismatch AND ghost class)
- Documented learnings from prior compound docs applied throughout

---

## Confirmed Safe Assumptions (Agents Checked)

- **Anchor IDs:** Already in DOM via `SectionRenderer.tsx` — no DOM changes needed for nav
- **`Array.isArray` guard:** Present in plan, correctly load-bearing for cast safety
- **`buildAnchorNavHref` reuse:** No changes needed, `NavItem` interface is compatible
- **`PAGE_LABELS`/`PAGE_ANCHORS` indexing:** Type-safe once P1-1 is applied
- **HowItWorksSection callers:** Only `TenantLandingPage.tsx` — safe to delete

---

## Implementation Checklist Amendments

Add to plan's acceptance criteria:

- [ ] `SECTION_TYPE_TO_PAGE` typed as `Partial<Record<SectionTypeName, PageName>>`
- [ ] `getAnchorNavigationItems()` deleted in same commit as `TenantNav` switch
- [ ] Nav loop iterates `PAGE_ORDER`, not `pages.home.sections`
- [ ] Testimonials transform uses `delete` (matches existing pattern in the file)
- [ ] `features` excluded from `SECTION_TYPE_TO_PAGE`
- [ ] No plan prose claims anchor IDs are missing from the DOM

---

## Todo Files Created

- `todos/11009-pending-p1-nav-section-type-to-page-key-type.md` — P1 type fix
- `todos/11010-pending-p2-delete-anchor-nav-items-dead-code.md` — delete dead function
- `todos/11011-pending-p2-nav-loop-page-order-first.md` — ordering fix
- `todos/11012-pending-p2-testimonials-transform-use-delete.md` — match existing pattern
- `todos/11013-pending-p2-exclude-features-from-nav-mapping.md` — semantic fix
