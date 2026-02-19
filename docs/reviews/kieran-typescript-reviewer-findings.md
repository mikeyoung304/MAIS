# TypeScript Review: Production Storefront Hardening Plan

**Reviewer:** kieran-typescript-reviewer
**Date:** 2026-02-18
**Plan Reviewed:** `docs/plans/2026-02-18-fix-production-storefront-hardening-plan.md`
**Scope:** Issue 5 (testimonials transform) and Issue 6 (nav derivation from sections)

---

## Summary

| Priority | Count | Description                                                          |
| -------- | ----- | -------------------------------------------------------------------- |
| **P1**   | 1     | Key type mismatch causes indexing to fail under strict TypeScript    |
| **P2**   | 2     | Type gap in testimonials cast; redundant code that creates confusion |
| **P3**   | 2     | Minor correctness notes with no runtime impact                       |

**Overall Assessment:** The logic is sound and the intent is correct, but there is one P1 type-safety hole: `SECTION_TYPE_TO_PAGE` uses `string` as the key type but `section.type` is `SectionTypeName` (a string-literal union). Under `strict`, TypeScript will allow this indexing but produce `PageName | undefined` — which is correct at runtime but the `Partial<Record<string, ...>>` key type is weaker than it needs to be and will not catch unrecognised section types at compile time. The testimonials cast introduces a subtle key-deletion gap. The `hero` guard is confirmed redundant.

---

## P1 Findings

### P1-1: `SECTION_TYPE_TO_PAGE` key type is `string` — misses compile-time exhaustiveness checking

**Location:** `apps/web/src/components/tenant/navigation.ts` (proposed addition)

**The proposed declaration:**

```typescript
const SECTION_TYPE_TO_PAGE: Partial<Record<string, PageName>> = {
  about: 'about',
  ...
};
```

**The problem:** `section.type` is typed as `SectionTypeName` (`'hero' | 'text' | 'about' | 'gallery' | 'testimonials' | 'faq' | 'contact' | 'cta' | 'pricing' | 'services' | 'features' | 'custom'`). The key type `string` is a supertype of `SectionTypeName`, so TypeScript accepts `SECTION_TYPE_TO_PAGE[section.type]` without complaint — the result type is `PageName | undefined`, which is correct.

However, the `string` key type means:

1. **Typos in the map are silently accepted.** `{ abuot: 'about' }` compiles with no error. With `Partial<Record<SectionTypeName, PageName>>`, the typo would be a compile-time error.
2. **New section types added to `SECTION_TYPES` never surface as "unhandled" in the map.** If `'video'` is added to `SECTION_TYPES` and should map to `'gallery'`, the compiler cannot warn that `SECTION_TYPE_TO_PAGE` needs updating.

**Fix:** Use `SectionTypeName` as the key type:

```typescript
import type { SectionTypeName } from '@macon/contracts';

const SECTION_TYPE_TO_PAGE: Partial<Record<SectionTypeName, PageName>> = {
  about: 'about',
  text: 'about',
  services: 'services',
  features: 'services',
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  contact: 'contact',
};
```

TypeScript will error on any key not in `SectionTypeName` and will index it correctly as `PageName | undefined` — identical runtime behaviour, stronger compile-time safety.

**Runtime impact:** None. The `section.type` values from `PagesConfig` are always valid `SectionTypeName` values because `SectionSchema` is a discriminated union with `z.literal(...)` on each `type` field. Changing the key type is a pure type-safety improvement.

---

## P2 Findings

### P2-1: `name: undefined` in object spread does NOT delete the key — it sets it to `undefined`

**Location:** `apps/web/src/lib/storefront-utils.ts` (proposed testimonials case)

**The proposed code:**

```typescript
transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => ({
  ...item,
  ...(item.name && !item.authorName ? { authorName: item.name, name: undefined } : {}),
  ...(item.role && !item.authorRole ? { authorRole: item.role, role: undefined } : {}),
}));
```

**The problem:** Spreading `{ name: undefined }` does NOT delete the `name` key from the resulting object. It creates the key with value `undefined`. The resulting item will have `{ name: undefined, authorName: 'Sarah M.' }`, not `{ authorName: 'Sarah M.' }`.

In practice, `TestimonialsSection.tsx` only accesses `testimonial.authorName` and `testimonial.authorRole`, so the stale `name`/`role` keys are harmless for rendering. But:

1. The object is larger than intended (carries dead keys).
2. Any downstream code checking `'name' in item` would find `true` (the key exists with value `undefined`).
3. The intent stated in the plan comment is to map and remove the old field, which this code does not accomplish.

**Fix option A — use destructuring to exclude the old key:**

```typescript
transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => {
  const { name, role, ...rest } = item;
  return {
    ...rest,
    ...(name && !item.authorName ? { authorName: name } : {}),
    ...(role && !item.authorRole ? { authorRole: role } : {}),
  };
});
```

**Fix option B — accept the stale keys (simpler, acceptable given rendering impact is zero):**
Remove the `name: undefined` and `role: undefined` from the spread. State explicitly in comments that the old keys are left in place and the component ignores them:

```typescript
...(item.name && !item.authorName ? { authorName: item.name } : {}),
...(item.role && !item.authorRole ? { authorRole: item.role } : {}),
```

Fix option B is lower risk and cleaner. Fix option A is more correct if key hygiene matters for serialization.

---

### P2-2: `as Record<string, unknown>[]` cast on `transformed.items` — safe only because of prior switch structure

**Location:** `apps/web/src/lib/storefront-utils.ts` (proposed testimonials case)

**The cast:**

```typescript
transformed.items = (transformed.items as Record<string, unknown>[]).map(...)
```

**The concern:** The plan correctly places the `testimonials` case BEFORE the `default` catch-all. The `default` block only runs if no earlier case matched. Since `testimonials` is a named case, the `default` block will not run for testimonials sections, so `transformed.items` will still hold the original value from `content.items` (unchanged from the spread `{ ...content }` at line 52).

However, the `features`/`services` case renames `items → features`/`images`, meaning by the time the testimonials case runs, `transformed.items` still exists as the raw database value. The cast `as Record<string, unknown>[]` is safe IF the caller always passes seed data shaped as `{ items: Array<{ quote, name, role, rating }> }`. There is no Zod validation at this layer.

**Risk:** If `transformed.items` is `null` (possible from a partially seeded tenant with a `null` items column), the `Array.isArray` guard correctly prevents the map. The cast itself is not executed on `null`. The guard already exists in the plan (`if (Array.isArray(transformed.items))`), so this is safe — but the guard must remain first.

**Recommendation:** No code change needed. Add an explicit comment that the `Array.isArray` guard is load-bearing for the cast safety:

```typescript
// Array.isArray guard is required — transformed.items may be null from DB
if (Array.isArray(transformed.items)) {
  transformed.items = (transformed.items as Record<string, unknown>[]).map(...)
}
```

---

## P3 Findings

### P3-1: The `hero` guard after the map lookup is confirmed redundant — but keep the comment

**Location:** Proposed `getNavItemsFromHomeSections()`

```typescript
const pageName = SECTION_TYPE_TO_PAGE[section.type];
if (!pageName || seen.has(pageName)) continue;
// Skip hero — it's always at top, no nav needed
if (section.type === 'hero') continue;
```

**Confirmed:** `hero` is NOT in `SECTION_TYPE_TO_PAGE`, so `SECTION_TYPE_TO_PAGE['hero']` returns `undefined`. The `if (!pageName || ...)` guard fires first and `continue`s. The `if (section.type === 'hero')` check is unreachable.

**Action:** Remove the dead guard. The comment explaining why hero is excluded is valuable — move it to the map definition:

```typescript
const SECTION_TYPE_TO_PAGE: Partial<Record<SectionTypeName, PageName>> = {
  // hero intentionally excluded — always at top, no anchor nav needed
  // cta intentionally excluded — closing section, not a nav destination
  about: 'about',
  ...
};
```

This self-documents the intentional omissions without a dead code branch.

---

### P3-2: `pageName` type after `SECTION_TYPE_TO_PAGE` lookup is correctly `PageName` — no narrowing needed

**Location:** Proposed `getNavItemsFromHomeSections()`

```typescript
items.push({ label: PAGE_LABELS[pageName], path: PAGE_ANCHORS[pageName] });
```

**Concern checked:** After `if (!pageName || seen.has(pageName)) continue;`, TypeScript narrows `pageName` from `PageName | undefined` to `PageName` (the `!pageName` check eliminates `undefined`). `PAGE_LABELS` and `PAGE_ANCHORS` are both typed `Record<PageName, string>`, so indexing with `PageName` is fully type-safe — no additional assertion or narrowing needed.

**`seen.has(pageName)`:** `seen` is `Set<PageName>`, and `pageName` at that point is still `PageName | undefined`. `Set.has()` accepts `PageName`, which is a subtype of the set's element type — this works correctly. TypeScript does not error here.

**Status:** No issue. Confirmed type-safe as written (once P1-1 is applied to change the key type).

---

## Positive Observations

1. **`seen` Set for deduplication** is correctly typed as `Set<PageName>` — prevents duplicate nav items when both `features` and `services` sections appear on the home page.

2. **`Array.isArray` guard** on testimonials items correctly follows the established pattern from the previous smoke test fix (`null defeats = [] defaults` pitfall). This guard is essential and correctly placed.

3. **`pages?.home?.sections?.length` optional chain** correctly short-circuits for the common case of no sections, returning the `[{ label: 'Home', path: '' }]` fallback without accessing potentially undefined nested properties.

4. **The testimonials field-mapping approach** (conditional spread, only map if source field exists and target doesn't) correctly handles idempotency — running the transform twice does not double-map or corrupt `authorName`/`authorRole` fields.

5. **`buildAnchorNavHref` reuse** in the proposed `TenantNav.tsx` change is correct — no changes to the href-building logic are needed since the `NavItem` interface and anchor behavior are identical.
