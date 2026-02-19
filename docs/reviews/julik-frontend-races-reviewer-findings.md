# julik-frontend-races-reviewer Findings

**Reviewed:** 2026-02-18
**Reviewer:** julik-frontend-races-reviewer
**Scope:** navigation.ts, TenantNav.tsx, TenantFooter.tsx, TenantSiteShell.tsx, TenantLandingPage.tsx, TestimonialsSection.tsx, storefront-utils.ts

---

## Summary

- P1: 1 (hydration mismatch — year in server footer lands on client)
- P2: 3 (dangling ref after class removal; `pages` object identity causes useMemo churn; testimonials transform only fires on `items`, silently passes through if field is already named `authorName` but `items` key was renamed earlier)
- P3: 3 (Suspense does not catch synchronous errors in TenantFooter; `s.type as SectionTypeName` cast silences unknown types; `custom` excluded from SECTION_TYPE_TO_PAGE with no comment)

Total: 7 findings (1 P1, 3 P2, 3 P3)

---

## P1 Findings

### P1-01 — Hydration Mismatch: `new Date().getFullYear()` in TenantFooter

**File:** `apps/web/src/components/tenant/TenantFooter.tsx:27`

**Finding:**
`TenantFooter` is declared without `'use client'` — it is a Server Component. However, `new Date().getFullYear()` is evaluated at request time on the server. If the rendered HTML is then rehydrated on the client after the year rolls over (e.g., a response cached across a new year boundary), or if the function is ever converted to a Client Component in the future, the year value will diverge between server and client, triggering React's hydration mismatch error.

More immediately: `TenantFooter` is rendered inside a `<Suspense>` boundary wrapping `<EditModeGate>`, which is a `'use client'` component. In Next.js App Router, when a Server Component is a child of a Client Component (even via `children` prop through Suspense), it is serialized and sent as RSC payload. The `currentYear` is computed server-side, so this is safe today — but the enclosure inside an `<EditModeGate>` subtree means any future addition of `'use client'` to TenantFooter will silently break hydration. The bigger risk is that the value is not stable across long-lived cache entries.

**Reproduction path:** Statically render or cache the page across a year boundary (ISR or `cache: 'force-cache'`). The server returns year 2025, client JS rehydrates computing 2026. React throws hydration error, white-screening the footer.

**Recommendation:** Replace inline `new Date().getFullYear()` with a build-time constant or ensure the footer is always server-rendered fresh. Alternatively, add `export const dynamic = 'force-dynamic'` to the route or use `<time suppressHydrationWarning>` with explicit client-side override. The safest approach for a footer year is a static constant updated at build time, or rendering it as a pure client component island.

---

## P2 Findings

### P2-01 — Dangling `sectionRef` in TestimonialsSection After `reveal-on-scroll` Removal

**File:** `apps/web/src/components/tenant/sections/TestimonialsSection.tsx:29,37`

**Finding:**
`useScrollReveal()` returns a callback ref that is attached to the `<section>` element at line 37 (`ref={sectionRef}`). The hook registers the element with an `IntersectionObserver` and sets `style.opacity = '0'` on mount, then adds `.reveal-visible` when the element enters the viewport.

The PR removes the `reveal-on-scroll` CSS class from the `<section>` element but **keeps `ref={sectionRef}`**. This means:

1. The `IntersectionObserver` still fires on the section element.
2. `useScrollReveal` still sets `element.style.opacity = '0'` on mount (via the callback ref path in the hook, lines 54-55).
3. The section becomes invisible on mount and only reappears when the `IntersectionObserver` triggers `reveal-visible`.
4. `reveal-visible` presumably applies `opacity: 1` via a CSS class, but if `reveal-on-scroll` was the class gating that animation, and only `reveal-on-scroll` was removed without removing `reveal-visible` CSS, the behavior depends entirely on global CSS. If `reveal-visible` only activates when paired with `reveal-on-scroll`, the section will be permanently hidden (opacity: 0 set inline, never cleared).

The card `div` elements retain `reveal-delay-1` / `reveal-delay-2` classes which are animation stagger classes, suggesting the intent was to preserve card-level animation. But the hook is attached to the section wrapper, not the cards — so it controls section-level visibility.

**Net effect:** Testimonials section may render as invisible (`opacity: 0`) if the IntersectionObserver fires before the section is in viewport on initial load, depending on CSS.

**Recommendation:** Either remove `ref={sectionRef}` entirely (removing the `useScrollReveal` call if no longer needed), or confirm that the global CSS for `reveal-visible` still applies the correct `opacity: 1` transition without the `reveal-on-scroll` parent class.

### P2-02 — `useMemo` Object Identity: `pages` Prop Causes Every-Render Churn in TenantNav

**File:** `apps/web/src/components/tenant/TenantNav.tsx:49-56`

**Finding:**
`useMemo([basePath, pages])` is correct in principle — the memo invalidates when `pages` changes. The problem is that `pages` is a `PagesConfig` object passed through from a Server Component (`TenantSiteShell`) via serialization boundary.

In Next.js App Router, when a Server Component passes a plain object to a Client Component, the object is serialized as RSC payload and deserialized on the client. On subsequent navigations or re-renders (e.g., soft navigation, router refresh), React may recreate the RSC tree and pass a new object reference even if the data is identical. Since `useMemo` uses `Object.is` for dependency comparison, a new object reference — even with identical contents — invalidates the memo on every render.

This causes `getNavItemsFromHomeSections(pages)` to run on every render of `TenantNav`, defeating the purpose of `useMemo`. For a nav component that re-renders on scroll (via `useActiveSection` which uses `IntersectionObserver` state updates), this means the nav item derivation runs on every scroll event.

**Severity:** P2 — not a correctness bug, but a performance trap that grows worse with section count. With 7+ sections in `PAGE_ORDER`, `getNavItemsFromHomeSections` iterates the full section array N times (once per non-home page in `PAGE_ORDER`). This runs on every scroll-triggered `activeSection` state update.

**Recommendation:** The memoization is structurally sound; the issue is reference stability. Options:

1. Hoist `getNavItemsFromHomeSections(pages)` to the Server Component and pass the derived `navItems` array directly to TenantNav (arrays are stable if content is stable).
2. Memoize with a deep-equality comparator (e.g., `useMemo` with a manual comparison via `JSON.stringify(pages)` as the dep — crude but effective for this size).
3. Accept the current behavior if `TenantNav` rarely re-renders outside of explicit `pages` changes.

### P2-03 — Testimonials Transform: Silent No-Op if `items` Key Was Renamed Upstream

**File:** `apps/web/src/lib/storefront-utils.ts:102-118`

**Finding:**
The `testimonials` case in `transformContentForSection` maps `items → (authorName, authorRole)` by iterating `transformed.items`. However, the function receives `{ ...content }` as `transformed`, meaning it starts from the original DB content shape.

The problem: earlier in the same switch, the `features`/`services` cases delete `items` and write `features`. The `gallery` case deletes `items` and writes `images`. The `pricing` case deletes `items` and writes `tiers`. These transforms are idempotent and isolated to their own case.

For `testimonials`, the transform checks `if (Array.isArray(transformed.items))` — but the DB stores testimonials under `items`. This is correct _on first pass_. However, if a testimonial item already has `authorName` set (e.g., because the agent wrote normalized data), the guard `if (out.name && !out.authorName)` correctly skips. That part is fine.

The actual gap: the `testimonials` case does NOT rename `items` to any canonical field name. After the transform, the field is still called `items` on the returned object. But `TestimonialsSection` destructures the prop typed as `TestimonialsSectionType`, which expects a field named `items` (standard TypeScript schema field). Checking the component at line 30: `const safeItems = Array.isArray(items) ? items : []` — so the field name `items` is correct at the component level.

However, the transform mutates `out.name` and `out.role` to `out.authorName` and `out.authorRole` inside a `{ ...item }` spread. This is safe — each iteration operates on a fresh shallow copy. The original DB objects are not mutated. No issue with mutation safety per se.

The real gap is **incomplete field mapping for the `items` array itself**: after renaming `name → authorName` and `role → authorRole`, there is no remapping of `items` to the `TestimonialsSection.items` field name expected by contracts. This works today only because the field is coincidentally also named `items` in the contracts type. If the contracts type ever renames this field (e.g., to `testimonials`), this transform will silently produce an object with the wrong field name and `safeItems` will be `[]`.

Additionally: the `authorPhotoUrl` field used at `TestimonialsSection.tsx:54` has no corresponding transform. If DB stores it as `photo` or `photoUrl`, the image silently drops. There is no mapping for this field in the transform.

**Recommendation:** Audit the DB seed data for the actual field names for testimonial photos. Add an explicit `photo`/`photoUrl → authorPhotoUrl` remap alongside the existing `name` and `role` remaps. Add a comment in the transform specifying the exact DB field names expected.

---

## P3 Findings

### P3-01 — Suspense Does Not Protect TenantFooter From Synchronous Errors

**File:** `apps/web/src/components/tenant/TenantSiteShell.tsx:63-74`

**Finding:**
The second `<Suspense>` boundary wraps `<EditModeGate>` which in turn wraps `<TenantFooter>`, `<TenantChatWidget>`, and `<StickyMobileCTA>`. The comment says Suspense is required because `useSearchParams()` triggers the client boundary in `EditModeGate`.

This is correct — `useSearchParams()` in `EditModeGate` requires Suspense during static rendering. However, Suspense only catches _async_ suspensions (data fetching, lazy loading). It does not catch synchronous render errors. If `TenantFooter` throws synchronously (e.g., `tenant.branding` access on a malformed tenant object, or a future code change), the error propagates up and is **not caught by Suspense** — it would need an `ErrorBoundary` to be caught.

Currently `TenantFooter` has no throwing paths on the read paths visible in the file, so this is not an active bug. It is a structural gap: the Suspense boundary gives a false sense of error containment for the footer. If a future developer adds async data fetching to `TenantFooter`, they may expect Suspense to handle loading states — but they also need to know that error states are unhandled.

**Recommendation:** Add a comment to the Suspense boundary explicitly stating it covers only `useSearchParams` suspension, not error states. Consider co-locating an `ErrorBoundary` if the footer content ever becomes data-dependent.

### P3-02 — `s.type as SectionTypeName` Cast Silences Unknown Section Types in Navigation

**File:** `apps/web/src/components/tenant/navigation.ts:102`

**Finding:**

```typescript
const hasSection = pages.home.sections.some(
  (s) => SECTION_TYPE_TO_PAGE[s.type as SectionTypeName] === page
);
```

The cast `s.type as SectionTypeName` tells TypeScript the value is a valid `SectionTypeName`. If the DB or agent writes a section type that is not in `SectionTypeName` (e.g., `'grazing'` — referenced in todo #11005, or any future custom type), the cast succeeds at compile time, `SECTION_TYPE_TO_PAGE` lookup returns `undefined`, the nav item is silently excluded, and there is no observable error.

This is currently low-risk because `sectionsToPages()` filters through `BLOCK_TO_SECTION_TYPE` which acts as a whitelist. But `getNavItemsFromHomeSections` can also be called with `pages` derived from other sources (legacy `landingPageConfig` fallback), where the filtering guarantee does not apply.

**Recommendation:** Replace the cast with a type guard or an explicit `SECTION_TYPE_TO_PAGE[s.type as string]` access. The cast adds no runtime safety — it only suppresses a TypeScript error that would otherwise point to a real structural gap.

### P3-03 — `custom` Section Type Exclusion Is Undocumented in SECTION_TYPE_TO_PAGE

**File:** `apps/web/src/components/tenant/navigation.ts:76-84`

**Finding:**
The JSDoc comment above `SECTION_TYPE_TO_PAGE` documents that `hero`, `cta`, `features`, and `pricing` are intentionally excluded. However, `custom` is also absent from the map (and from `PAGE_ORDER`) but is not mentioned in the exclusion comment. This is an incomplete comment.

Todo #11005 ("extract-grazing-constant-and-use-blocktype-enum") and the SECTION_TYPES drift history (MEMORY.md, onboarding smoke test #2) show that `custom` was a source of confusion in the past. The absence of `custom` from both `SECTION_TYPE_TO_PAGE` and `PAGE_ORDER` means any custom section the agent writes will never appear in the nav, with no diagnostic signal.

**Recommendation:** Add `custom` to the JSDoc exclusion list with a rationale: "custom: no canonical nav label or anchor target." This is a documentation-only fix but prevents the next developer from assuming it was an oversight.

---

## Cross-Cutting Observations

### No Race Condition in TenantNav `pages` Prop (Confirmed Safe)

The `pages` prop flows Server → Client as a serialized RSC prop. It is set once at render time and does not update asynchronously. There is no race between the server-rendered nav and the client-hydrated nav because both use the same serialized `pages` value. The `useMemo` churn noted in P2-02 is a performance issue, not a correctness race.

### Server/Client Boundary — No Leakage Found

`TenantSiteShell` passes only serializable props (`TenantPublicDto`, `PagesConfig`, `string`, `React.ReactNode`) across the boundary. No `Symbol`, `Function`, `Date` object (only primitives derived from dates), or non-serializable value is passed. The `themeVars` CSS custom properties object is applied server-side via inline `style` prop and does not cross a client boundary. Clean.

### `getNavItemsFromHomeSections` Null Safety (Confirmed Correct)

The `!pages?.home?.sections?.length` guard at line 94 correctly handles all null/undefined cases: `pages = undefined`, `pages = null`, `pages.home = undefined`, `pages.home.sections = undefined`, `pages.home.sections = []`. The fallback to `[{ label: 'Home', path: '' }]` is appropriate. No null-dereference risk in this function.

### `storefront-utils.ts` Mutation Safety (Confirmed Safe)

The `transformContentForSection` function starts with `const transformed = { ...content }` (shallow spread). The `testimonials` case does `const out = { ...item }` per item (another shallow spread). `delete out.name` operates on the local copy, not on the original DB object. The original `content` reference passed in is never mutated. Safe.

### `TenantLandingPage` Dynamic Section Rendering (No New Issues)

The removal of the static `HowItWorksSection` slot and switch to dynamic `postSections` is straightforward. `buildHomeSections` correctly filters using `postTierTypes` Set. The `indexOffset={preSections.length}` passed to the second `SectionRenderer` is correct for edit-mode data attributes. No race or ordering issue introduced.
