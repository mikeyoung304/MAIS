# Code Simplicity Review — Storefront Navigation + Section Cleanup

**Reviewer:** code-simplicity-reviewer
**Date:** 2026-02-18
**Scope:** navigation.ts consolidation, domainParam removal, HowItWorksSection deletion, TestimonialsSection sectionRef, storefront-utils testimonials transform

---

## Summary

1 P1 (dangling dead CSS class), 2 P2 (wrong transform layer, overstated commit scope), 3 P3 (minor). The consolidation from 3→2 navigation functions is clean. The `domainParam` removal from Nav/Footer/Shell is complete. `HowItWorksSection` is fully gone from the codebase. The `sectionRef` in `TestimonialsSection` is correctly attached to the `<section>` element and live. The main issue is a `reveal-on-scroll` CSS class in `CTASection.tsx` that has no definition anywhere in the stylesheet.

---

## P1 — Dangling Dead CSS Class: `reveal-on-scroll` in CTASection

**File:** `apps/web/src/components/tenant/sections/CTASection.tsx`, line 31

```tsx
<section ref={sectionRef} className="reveal-on-scroll bg-accent py-32 md:py-40">
```

`reveal-on-scroll` has no definition in `apps/web/src/styles/globals.css`. The file defines `.reveal-visible`, `.reveal-delay-1/2/3`, and the `storefront-reveal` keyframe animation — but not `reveal-on-scroll`. This was apparently a pre-`useScrollReveal` class name that was never cleaned up when the hook-based approach replaced it.

The `CTASection` still animates correctly because:

1. `sectionRef` (from `useScrollReveal()`) IS attached to the `<section>` element.
2. The `IntersectionObserver` adds `.reveal-visible` dynamically when the element scrolls into view.
3. `.reveal-visible` triggers the `storefront-reveal` keyframe.

The `reveal-on-scroll` class is harmless noise — an unrecognized class silently ignored by both CSS and Tailwind — but it is dead code from a prior implementation pattern.

**Fix:** Remove `reveal-on-scroll` from the `className` on `CTASection.tsx:31`.

This is the only place in the entire codebase where `reveal-on-scroll` appears as a class on a DOM element. Confirmed via grep: zero CSS definitions, one usage site.

---

## P1 Clarification: `sectionRef` in TestimonialsSection Is NOT Dead

The prompt asked whether `sectionRef` became unused after `reveal-on-scroll` was removed from `TestimonialsSection`. It did not.

**File:** `apps/web/src/components/tenant/sections/TestimonialsSection.tsx`, line 37

```tsx
<section ref={sectionRef} className="py-32 md:py-40">
```

The ref IS attached to the `<section>` wrapper. The `useScrollReveal` hook works by attaching an `IntersectionObserver` to whatever element receives the ref callback — no `reveal-on-scroll` class is required on that element. When the `<section>` enters the viewport, the observer adds `.reveal-visible` to the `<section>`, triggering the CSS animation. The hook and ref are both live and functional.

The individual testimonial cards use `reveal-delay-1` / `reveal-delay-2` (line 47) for stagger animation, which also have valid CSS definitions. These are correct.

**No action needed here.**

---

## P2 — Wrong Layer for Testimonials Field Remapping

**File:** `apps/web/src/lib/storefront-utils.ts`, lines 102–118

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

**The problem:** This is a silent runtime shim correcting `name`/`role` → `authorName`/`authorRole` at the presentation layer. The contract (`TestimonialsSectionSchema` in `packages/contracts/src/landing-page.ts:300-301`) requires `authorName` and `authorRole`. If the agent or seed data writes `name` and `role` instead, the data is wrong at its source — and this transform masks it permanently.

**Why this matters:**

1. The mismatch is invisible in logs and tests. Data passes the frontend component but the underlying SectionContent rows contain non-canonical field names.
2. Any future server-side consumer of testimonial content (API export, email generation, PDF summary) will see `name`/`role`, not `authorName`/`authorRole`, because the remap only happens in the frontend layer.
3. If the contract ever renames `authorName` again, there are now two places to update: the contract AND this shim.

**Root cause is upstream.** The agent `add_section` tool in `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` does not provide field name guidance for testimonials items. The `tenant-defaults.ts` TESTIMONIALS default (line 165–173) uses `items: []` with no field name hints. The agent is writing `name`/`role` because nothing in its context establishes `authorName`/`authorRole` as the canonical names.

**The transform is in the wrong place.** It belongs either:

- In the agent tool's default content/description so the agent writes canonical names from the start, OR
- In a data migration that updates existing rows to use canonical field names.

`storefront-utils.ts` should only do structural remapping (field renames like `title → headline`, `body → content`), not content field name correction that should have been right at write time.

**Recommended action:** Open a P2 todo to audit the agent testimonials write path. Ensure the `add_section` tool description (for `testimonials` type) explicitly names `authorName` and `authorRole` as the field names. The shim in `storefront-utils.ts` can stay as a forward-compatibility safety net with a comment noting it is temporary, but it should not be the primary fix.

---

## P2 — `domainParam` Removal Is Partial — Commit Description Overstates Scope

**Files where `domainParam` persists (and correctly so):**

- `apps/web/src/components/tenant/TenantLandingPage.tsx` (lines 26, 107, 130)
- `apps/web/src/components/tenant/TenantLandingPageClient.tsx` (lines 25, 32, 44, 58)
- `apps/web/src/app/t/_domain/page.tsx` (lines 107, 133)
- `apps/web/src/components/tenant/ContactForm.tsx` (lines 12, 43, 59)
- `apps/web/src/components/tenant/SegmentTiersSection.tsx` (lines 36, 258, 352, 357)

**What was removed:** `domainParam` from `TenantNav`, `TenantFooter`, and `TenantSiteShell`. Those three components only needed it for link construction, which is now correctly handled via `basePath` alone.

**What was NOT removed (correctly):** `domainParam` in `SegmentTiersSection` is load-bearing. The `getBookHref` callback at line 350–358 uses it to switch booking link construction:

```typescript
const getBookHref = useCallback(
  (tierSlug: string) => {
    if (domainParam) {
      return `/t/${tenant.slug}/book/${tierSlug}`;
    }
    return `${basePath}/book/${tierSlug}`;
  },
  [basePath, domainParam, tenant.slug]
);
```

For custom domain routes, `basePath` is `''` (empty string). Without this guard, booking links would be `/book/tier-slug` (missing tenant path). The `domainParam` check correctly routes to the slug-based path when on a custom domain.

**The chain is correct:** `_domain/page.tsx` constructs `domainParam = ?domain=...` → passes to `TenantLandingPageClient` → passes to `TenantLandingPage` → passes to `SegmentTiersSection`. This is intentional and necessary.

**The issue is clarity, not correctness.** The commit message "Removed domainParam prop" is ambiguous — it implies full removal when it was partial-by-design. If someone reads the commit and then tries to trace `domainParam` through the codebase, the inconsistency looks like an incomplete refactor rather than an intentional boundary.

**Recommended action:** No code fix needed. If a follow-up commit message or PR description references this change, clarify "Removed domainParam from Nav/Footer/Shell — retained in SegmentTiersSection for custom domain booking link routing."

---

## P3 — `SECTION_TYPE_TO_PAGE` Design Is Cleaner Than Previous Approach

**File:** `apps/web/src/components/tenant/navigation.ts`, lines 76–84

```typescript
const SECTION_TYPE_TO_PAGE: Partial<Record<SectionTypeName, PageName>> = {
  about: 'about',
  text: 'about', // 'text' is legacy alias for 'about'
  services: 'services',
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  contact: 'contact',
};
```

This is cleaner than the previous filter-by-enabled-pages approach. The lookup table is declarative, type-safe, and easily extended. The comment block (lines 65–75) correctly documents why `hero`, `cta`, `features`, `custom`, and `pricing` are excluded.

**One minor omission:** `text: 'about'` maps the legacy alias without a comment. The `text` type is not self-evident to a future reader — they may wonder why a mapping named `text` produces `about`. An inline comment `// 'text' is a legacy alias for 'about'` on line 78 would prevent future confusion.

**No simplification needed** for the `PAGE_ORDER` iteration in `getNavItemsFromHomeSections` (O(pages × sections)). At 7 pages and <15 sections per storefront, this is irrelevant to performance. The current loop is readable. A Set-based alternative exists but offers no practical benefit.

---

## P3 — `buildAnchorNavHref` Has Redundant Guard

**File:** `apps/web/src/components/tenant/navigation.ts`, lines 117–125

```typescript
export function buildAnchorNavHref(basePath: string, item: NavItem): string {
  if (item.path === '') {
    return basePath || '/';
  }
  return `${basePath || ''}${item.path}`;
}
```

The `basePath || ''` on line 124 is redundant. Both callers (`TenantNav` line 46, `TenantFooter` line 26) guarantee a non-null `basePath` before calling this function via `basePathProp ?? '/t/${tenant.slug}'`. The `|| ''` default on line 124 can never activate.

Not worth changing — it is a defensive guard that costs nothing. But it is technically dead.

---

## P3 — HowItWorksSection Fully Eliminated From Source

Confirmed via grep across all of `apps/web/src/`: zero live references to `HowItWorksSection` remain. The deletion is complete. References in `docs/plans/` and `docs/reviews/` are historical documentation, not source code.

---

## Confirmation: Correctly Deleted/Removed Items

| Item                                                       | Verification                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `HowItWorksSection.tsx`                                    | File absent from `apps/web/src/components/tenant/sections/` |
| `HowItWorksSection` barrel export from `sections/index.ts` | No export found                                             |
| `domainParam` from `TenantNav`                             | Not in file                                                 |
| `domainParam` from `TenantFooter`                          | Not in file                                                 |
| `domainParam` from `TenantSiteShell`                       | Not in file                                                 |
| `PAGE_PATHS` constant                                      | Zero references in `apps/web/src/`                          |
| `getNavigationItems` function                              | Zero references in `apps/web/src/`                          |
| `getAnchorNavigationItems` function                        | Zero references in `apps/web/src/`                          |

---

## Findings Index

| Priority | Finding                                                                                           | File                                               | Action Required                               |
| -------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------- | ------------------- | ------------------------------------ |
| P1       | `reveal-on-scroll` class has no CSS definition — dead leftover from pre-hook era                  | `CTASection.tsx:31`                                | Remove the class from `className`             |
| P2       | Testimonials `name`/`role` → `authorName`/`authorRole` remap is at the wrong layer (presentation) | `storefront-utils.ts:102-118`                      | Audit agent write path; open P2 todo          |
| P2       | `domainParam` removal is partial-by-design but commit description is ambiguous                    | `TenantLandingPage.tsx`, `SegmentTiersSection.tsx` | Clarify in follow-up description; no code fix |
| P3       | `text: 'about'` alias in `SECTION_TYPE_TO_PAGE` needs inline comment                              | `navigation.ts:78`                                 | Optional inline comment                       |
| P3       | `buildAnchorNavHref` has unreachable `                                                            |                                                    | ''` guard on line 124                         | `navigation.ts:124` | No action — harmless defensive guard |
| P3       | `sectionRef` in `TestimonialsSection` is correctly live — not dead                                | `TestimonialsSection.tsx:29,37`                    | No action needed                              |
