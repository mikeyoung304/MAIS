---
title: 'Production Storefront Hardening: 5 Systemic Gaps (Seed, Nav, Cache, Duplication, Dead Code)'
category: architecture
severity: p1-p2-mixed
tags:
  - seed-data
  - image-validation
  - navigation-derivation
  - isr-cache
  - dead-code
  - data-driven-ui
  - single-page-storefront
components:
  - server/prisma/seeds/macon-headshots.ts
  - apps/web/src/components/tenant/TenantFooter.tsx
  - apps/web/src/components/tenant/TenantSiteShell.tsx
  - apps/web/src/components/tenant/navigation.ts
  - apps/web/src/components/tenant/TenantLandingPage.tsx
  - apps/web/src/components/tenant/sections/HowItWorksSection.tsx (deleted)
  - apps/web/src/app/t/_domain/layout.tsx
related_issues:
  - 'PR #61 — 7 storefront hardening fixes'
  - 'PR #62 — image URL, footer nav, dead code cleanup'
date_discovered: 2026-02-18
date_resolved: 2026-02-18
---

# Production Storefront Hardening: 5 Systemic Gaps

## Context

During a Playwright smoke test on two production tenants (Macon Headshots + Little Bit Farm at gethandled.ai), we discovered 5 systemic issues that are **not individual bugs but architectural gaps**. Each will recur without process changes.

## Issue 1: Broken External Image URLs in Seeds (No Validation)

### Symptom

About section showed broken image icon. Console: `/_next/image` returned 404.

### Root Cause

Seed referenced Unsplash photo `photo-1576694040684-77a8e3a9e89f` which doesn't exist. No validation step checks whether external URLs resolve before seeding.

### Fix

Replaced with verified `photo-1542038784456-1ea8e935640e`. Verified via batch HEAD requests:

```typescript
const resp = await page.context().request.head(url);
// { status: 200, ok: true }
```

### Prevention

**Add `validateSeedImages()` that HEAD-checks all external URLs before the seed transaction commits.** Fail the seed if any URL returns non-200. ~2-3 seconds overhead is acceptable.

```typescript
async function validateSeedImages(urls: string[]): Promise<void> {
  const errors: string[] = [];
  for (const url of urls) {
    const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (!resp.ok) errors.push(`${url} → ${resp.status}`);
  }
  if (errors.length) throw new Error(`Broken image URLs:\n${errors.join('\n')}`);
}
```

---

## Issue 2: Nav Derivation Split (Footer Only Showed "Home")

### Symptom

TenantNav showed 5 anchor links. TenantFooter showed only "Home".

### Root Cause

Two incompatible derivation functions:

- `TenantNav` → `getNavItemsFromHomeSections()` — scans section types on home page
- `TenantFooter` → `getNavigationItems()` — checks page-level `enabled` flags

In single-page mode, `sectionsToPages()` sets `about.enabled = sortedPageMap.has('about')` → **false** (sections live on 'home', not 'about'). Footer correctly followed its logic — the logic was wrong for the architecture.

### Fix

Unified footer to use same derivation as nav. Deleted dead code:

- Switched `TenantFooter` to `getNavItemsFromHomeSections()` + `buildAnchorNavHref()`
- Removed `getNavigationItems()`, `buildNavHref()`, `PAGE_PATHS` from `navigation.ts`
- Removed unused `domainParam` prop from `TenantSiteShell`

### Prevention

**Single-page rule:** When all sections live on the home page, ALWAYS derive nav from section types — never from page-level `enabled` flags. Both TenantNav and TenantFooter must use the same function.

Add a sync test:

```typescript
it('nav and footer derive identical items', () => {
  const pages = buildTestPagesConfig();
  const navItems = getNavItemsFromHomeSections(pages);
  // Both components should produce the same list
  expect(navItems.length).toBeGreaterThan(1);
});
```

---

## Issue 3: ISR Cache Staleness After Re-Seed

### Symptom

After re-seeding production, first page load still showed old data (old Unsplash URL, old booking types).

### Root Cause

Next.js `revalidate: 60` uses stale-while-revalidate. First request after data change serves **stale** cached page, triggers background regeneration. Second request gets fresh data.

### Workaround

Cache-bust with query param: `?_v=2` or `?_bust={Date.now()}`

### Prevention

**Document ISR behavior in deploy runbook.** After any production seed:

1. Wait 2 minutes for background regeneration
2. Or call Vercel's on-demand revalidation API (`revalidatePath`)
3. Or verify with cache-busting query param

Future: Add `POST /api/revalidate` endpoint triggered by seed scripts.

---

## Issue 4: Hardcoded Component + Data-Driven Equivalent = Duplicate

### Symptom

"How It Works" section appeared twice on every storefront.

### Root Cause

`TenantLandingPage.tsx` had a hardcoded `<HowItWorksSection>` at a fixed slot **and** seeds created a FEATURES section with title "How It Works" that rendered via `SectionRenderer`. Both rendered.

### Fix

Deleted the hardcoded `HowItWorksSection.tsx` entirely. All section rendering now goes through `SectionRenderer` exclusively.

### Prevention

**Convention:** ALL sections render through `SectionRenderer` — no hardcoded section components in page layouts. The data-driven pipeline is the single path.

Enforcement: If `TenantLandingPage.tsx` imports from `./sections/*`, that's a code smell. The only approved section renderer is `SectionRenderer`.

---

## Issue 5: Dead Code After Nav Refactor

### Symptom

`getNavigationItems`, `buildNavHref`, `PAGE_PATHS` existed in `navigation.ts` with zero callers.

### Root Cause

When TenantNav switched to `getNavItemsFromHomeSections()`, the old functions weren't deleted. No automated detection caught the orphans.

### Fix

Grepped for callers → confirmed zero → deleted all three.

### Prevention

Already covered by CLAUDE.md Pitfall #14 (orphan imports after deletions). Enforcement:

```bash
# After any refactor that replaces a function:
grep -r "oldFunctionName" apps/ server/ packages/ --include="*.ts" --include="*.tsx"
# If 0 results → delete immediately
```

---

## Cross-References

### Related Compound Docs

- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md` — Same pattern: N independent copies of truth → drift
- `docs/solutions/architecture/app-router-route-tree-deduplication-domain-vs-slug-pattern.md` — Route dedup via shared utility
- `docs/solutions/build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md` — Dead code after deletions
- `docs/solutions/react-performance/CACHE_INVALIDATION_QUICK_REFERENCE.md` — Cache invalidation patterns
- `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md` — Prior smoke test findings

### CLAUDE.md Pitfalls

- Pitfall #14: Orphan imports after deletions
- Pitfall #15: Root vs workspace typecheck

### Memory Notes

- "Constants duplication trap: 7 lists → single source of truth in contracts"
- "Cache invalidation key drift is silent"
- "Project Principle: No Debt — be ruthless with deleting code"

---

## Environments Affected

| Environment        | Impact                                                                              |
| ------------------ | ----------------------------------------------------------------------------------- |
| Local              | Seed runs with broken URLs silently                                                 |
| Render (API)       | Seed data committed with bad URLs                                                   |
| Vercel (Frontend)  | `/_next/image` proxy returns 404 for bad URLs; ISR cache delays visibility of fixes |
| Cloud Run (Agents) | Not affected                                                                        |
| CI                 | No image URL validation step exists                                                 |

---

## Summary: The 5 Gaps

| Gap                                 | Category          | Fix Type                        | Status            |
| ----------------------------------- | ----------------- | ------------------------------- | ----------------- |
| No image URL validation in seeds    | Data integrity    | Add `validateSeedImages()`      | **TODO**          |
| Nav derivation split                | Logic duplication | Unified to single function      | **Done** (PR #62) |
| ISR cache invisible after seed      | Deploy process    | Document + add revalidation API | **TODO**          |
| Hardcoded + data-driven duplication | Convention        | Deleted hardcoded component     | **Done** (PR #61) |
| Dead code after refactor            | Hygiene           | Deleted + grep verification     | **Done** (PR #62) |
