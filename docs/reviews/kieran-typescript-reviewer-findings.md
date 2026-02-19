# TypeScript Review: Storefront Nav/Footer/HowItWorks Refactor

**Reviewer:** kieran-typescript-reviewer
**Date:** 2026-02-18
**Scope:** navigation.ts rewrite, TenantNav/TenantFooter/TenantSiteShell prop cleanup, HowItWorksSection deletion, TestimonialsSection reveal-on-scroll removal, storefront-utils testimonials transform

---

## Summary

| Priority | Count | Description                                                                                     |
| -------- | ----- | ----------------------------------------------------------------------------------------------- |
| **P1**   | 0     | None                                                                                            |
| **P2**   | 3     | Redundant cast masks drift; unsafe array element cast; domainParam prop boundary                |
| **P3**   | 4     | `as const satisfies`; useMemo identity; reveal-on-scroll removal correct; anchor href edge case |

**Overall Assessment:** The refactor is structurally sound. The core goals — unifying nav derivation through `getNavItemsFromHomeSections`, deleting `HowItWorksSection`, and removing `domainParam` from the shell — are correctly executed. Three P2 issues exist: the `as SectionTypeName` cast on `s.type` is redundant and will mask future type drift; the testimonials item array cast does not defend against non-object elements or empty-string `name` fields; and the `domainParam` prop removal is incomplete at the `TenantSiteShell` boundary.

---

## P2 Findings

### P2-1: `s.type as SectionTypeName` is a redundant cast that will mask future type drift

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/navigation.ts` — line 102

```typescript
(s) => SECTION_TYPE_TO_PAGE[s.type as SectionTypeName] === page;
```

`s` is typed as `Section`, which is `z.infer<typeof SectionSchema>` — a discriminated union. Its `.type` field is already typed as the exact union `'hero' | 'text' | 'about' | 'gallery' | 'testimonials' | 'faq' | 'contact' | 'cta' | 'pricing' | 'services' | 'features' | 'custom'`, which is identical to `SectionTypeName`. The cast is a no-op: TypeScript accepts it silently.

The real risk is forward-compatibility. If a new section type is ever added to `SectionSchema` but not to `SECTION_TYPES` (or vice versa), TypeScript would normally surface a type error at this index site. The redundant cast papers over that divergence silently. The correct fix:

```typescript
(s) => SECTION_TYPE_TO_PAGE[s.type] === page;
```

Without the cast, if `Section['type']` ever diverges from `SectionTypeName`, the compiler will error at this line — which is the desired signal. The cast should be removed.

**Note:** The `SECTION_TYPE_TO_PAGE` map itself is correctly typed as `Partial<Record<SectionTypeName, PageName>>` (line 76). This is the right type. The cast at the call site is the problem.

---

### P2-2: Testimonials `items` cast to `Record<string, unknown>[]` does not guard against non-object array elements; truthiness check misses empty-string `name`

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/storefront-utils.ts` — lines 104–116

```typescript
case 'testimonials':
  if (Array.isArray(transformed.items)) {
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
  }
  break;
```

Two issues:

**Issue A — unsafe cast on array elements.** `Array.isArray(transformed.items)` only confirms the outer container is an array. The cast `as Record<string, unknown>[]` assumes every element is a non-null object. If the DB returns `[null, { ... }]` or `[42, { ... }]`, `{ ...item }` on `null` throws `TypeError: null is not iterable` at runtime; on a primitive it silently produces an empty object `{}`. The safe pattern:

```typescript
.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
.map((item) => { ... })
```

**Issue B — truthiness check misses `name: ""`**. The condition `if (out.name && !out.authorName)` will skip the remap when `out.name` is an empty string. That leaves the testimonial item with neither `name` nor `authorName`, causing the component to silently render a blank author. The stricter check is `if ('name' in out && out.name !== undefined)` or simply `if (out.name !== undefined && !out.authorName)`.

---

### P2-3: `domainParam` prop removal is incomplete — `TenantSiteShell` boundary leaves a forward-compatibility gap

**Files:**

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/TenantSiteShell.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/TenantLandingPage.tsx` — line 26
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/TenantLandingPageClient.tsx` — line 25
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/t/_domain/layout.tsx`

`domainParam` was removed from `TenantSiteShell` and `TenantFooter` — correct. However, `TenantLandingPage` and `TenantLandingPageClient` still declare and pass `domainParam` to `SegmentTiersSection` and `ContactForm`. Those uses are legitimate (booking URLs and contact form return links need the domain query param).

The forward-compatibility gap: `TenantSiteShell` now has no `domainParam` context, but it is the layout shell for domain routes (where `basePath=""`). Any future feature added to the shell that constructs a URL (e.g., a CTA button in the nav, a chat widget deep-link, a social share link) will silently produce a wrong URL for domain-based routes — it will omit the `?domain=` parameter needed for round-trip navigation.

Recommended action: document the omission explicitly in `TenantSiteShellProps`:

```typescript
interface TenantSiteShellProps {
  // ...
  /**
   * NOTE: domainParam is intentionally NOT threaded through TenantSiteShell.
   * Nav and footer use anchor links only (no domain-qualified page URLs).
   * If a shell feature ever needs domain-aware URLs, add domainParam here.
   */
}
```

This is not a current bug but is a latent trap for the next contributor.

---

## P3 Findings

### P3-1: `SECTION_TYPE_TO_PAGE` would benefit from `as const satisfies` for immutability

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/navigation.ts` — line 76

```typescript
const SECTION_TYPE_TO_PAGE: Partial<Record<SectionTypeName, PageName>> = { ... };
```

`Partial<Record<SectionTypeName, PageName>>` is the correct type. Minor improvement: using `as const satisfies Partial<Record<SectionTypeName, PageName>>` would make the object immutable at the type level (preventing accidental mutation) while preserving the compiler's exhaustiveness check. Stylistic improvement only — no correctness issue.

---

### P3-2: `useMemo` deps `[basePath, pages]` are correct; `pages` object identity may cause spurious recomputes

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/TenantNav.tsx` — lines 49–56

Both values used inside the memo are in the dep array. No missing or stale deps. The minor note: if the parent re-renders with a new `pages` object reference (e.g., after a build-mode update or ISR revalidation), `useMemo` will recompute. `getNavItemsFromHomeSections` is a simple scan — the recompute is cheap. Not a performance bug; no action required unless profiling shows it as a hotspot.

---

### P3-3: `reveal-on-scroll` class removal from `TestimonialsSection` is correct; tests unaffected

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/sections/TestimonialsSection.tsx`

The `useScrollReveal` hook is still imported and its ref is still attached to the outer `<section>` at line 37. The hook drives animation via `IntersectionObserver` directly — the `reveal-on-scroll` CSS class was a redundant selector from an older pattern. The `reveal-delay-1`/`reveal-delay-2` classes remain on individual card `div` elements (line 47), which is correct.

Test file `storefront-redesign.test.tsx` lines 237–238 asserts for `reveal-delay-1`/`reveal-delay-2` — those assertions still pass since those classes are on the card divs, not the removed outer class. No test breakage.

---

### P3-4: `buildAnchorNavHref` with `basePath=""` produces a fragment-only href — benign today, edge case for multi-page domain routes

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/navigation.ts` — lines 117–125

When `basePath=""` (domain routes) and `item.path="#about"`, the result is `"#about"` — a fragment-only href. This is valid HTML for same-page anchor navigation and works correctly for the single-page scroll architecture.

The edge case: if the footer is ever rendered on a sub-path of a domain route (e.g., `/about`) and the user clicks `#services`, the browser navigates to `/about#services` instead of `/#services`. This is not the current architecture, but worth noting if separate page routes are added for domain tenants in the future.

---

## Summary Table

| ID   | Priority | File                                           | Issue                                                                     |
| ---- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| P2-1 | P2       | `navigation.ts:102`                            | Redundant `as SectionTypeName` cast masks future type drift               |
| P2-2 | P2       | `storefront-utils.ts:104–116`                  | Unsafe array element cast; truthiness check misses `name: ""`             |
| P2-3 | P2       | `TenantSiteShell.tsx`, `TenantLandingPage.tsx` | Incomplete `domainParam` removal — forward-compatibility gap in shell     |
| P3-1 | P3       | `navigation.ts:76`                             | `as const satisfies` would improve immutability of `SECTION_TYPE_TO_PAGE` |
| P3-2 | P3       | `TenantNav.tsx:55`                             | `pages` object identity may cause spurious `useMemo` recomputes           |
| P3-3 | P3       | `TestimonialsSection.tsx`                      | `reveal-on-scroll` removal is correct; tests unaffected                   |
| P3-4 | P3       | `navigation.ts:124`                            | Fragment-only href for domain routes — benign today                       |

---

## Positive Observations

1. `Partial<Record<SectionTypeName, PageName>>` is the correct type for `SECTION_TYPE_TO_PAGE`. The intentional exclusions (hero, cta, features, custom, pricing) are well-documented in the JSDoc comment.

2. `PAGE_ORDER` iteration for nav construction is deterministic and independent of section array ordering in `PagesConfig` — the right approach.

3. `pages?.home?.sections?.length` optional chain correctly short-circuits for the null/undefined case.

4. The `Array.isArray` guard on testimonials items correctly follows the established "null defeats = [] defaults" pattern (Pitfall #11 in the project pitfalls list).

5. `HowItWorksSection` deletion is clean — the export was removed from `sections/index.ts`, the static injection in `TenantLandingPage` was removed, and the file was deleted. No orphan imports detected.
