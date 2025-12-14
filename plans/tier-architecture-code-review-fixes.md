# Tier Architecture Code Review Fixes

## Status: COMPLETED

**Completed:** December 14, 2025

---

## Summary

Addressed the critical findings from the code review of commit `1a3711d`. Based on three reviewer perspectives (DHH/Rails philosophy, Practical implementation, Code simplicity), we adopted a **minimalist approach** focusing on actual bugs rather than theoretical improvements.

### What Was Done

| Item | Status | Lines Changed |
|------|--------|---------------|
| Fix La Petit Mariage seed (canonical tier names) | ✅ Done | 9 edits |
| Add production guard to LPM seed | ✅ Done | 8 lines |
| Write 5 smoke tests for `normalizeGrouping()` | ✅ Done | 32 lines |
| Add 1 parameterized E2E test for legacy redirects | ✅ Done | 16 lines |

### What Was Cut (Based on Reviews)

| Item | Reason |
|------|--------|
| Phase 2 React optimizations (P2-3, P2-4, P2-5, P2-6) | Premature optimization - no measured perf issue |
| 100+ unit tests for utils.ts | E2E tests already cover behavior - 5 smoke tests suffice |
| Deprecation plan for LEGACY_TIER_ALIASES | Documentation theater - aliases work fine |
| Migration rollback docs | Migration already applied - too late for rollback docs |
| 8 E2E redirect tests | 1 parameterized test covers all cases |

---

## Changes Made

### 1. La Petit Mariage Seed Fix

**File:** `server/prisma/seeds/la-petit-mariage.ts`

Changed all non-canonical grouping values to canonical tier names:

```diff
- grouping: 'Elopement'
+ grouping: 'tier_1'  // (tier_2, tier_3 for other packages in segment)

- grouping: 'Micro Wedding'
+ grouping: 'tier_1'  // (tier_2, tier_3 for other packages in segment)

- grouping: 'Full Wedding'
+ grouping: 'tier_1'  // (tier_2, tier_3 for other packages in segment)
```

**Note:** Each segment (Elopements, Micro Weddings, Full Weddings) now has 3 packages with `tier_1`, `tier_2`, `tier_3` grouping. The package `name` and `description` fields provide the semantic meaning (e.g., "Simple Vows", "Essential Elopement", "All-Inclusive Elopement").

### 2. Production Guard Added

Added to `seedLaPetitMarriage()` function (mirrors LBHF pattern):

```typescript
// Production guard - prevent accidental data destruction
if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_PRODUCTION_SEED !== 'true'
) {
  throw new Error(
    'Production seed blocked. Set ALLOW_PRODUCTION_SEED=true to override.'
  );
}
```

### 3. Smoke Tests

**File:** `client/src/features/storefront/__tests__/utils.test.ts`

5 smoke tests covering critical paths:

1. `normalizeGrouping('tier_1')` → `'tier_1'` (canonical pass-through)
2. `normalizeGrouping('budget')` → `'tier_1'` (legacy alias mapping)
3. `normalizeGrouping('Elopement')` → `null` (unmapped values)
4. `normalizeGrouping('TIER_1')` → `'tier_1'` (case insensitivity)
5. `normalizeGrouping('')` → `null` (empty string)

### 4. E2E Test for Legacy Redirects

**File:** `e2e/tests/storefront.spec.ts`

DHH-style parameterized test:

```typescript
test.describe('Legacy Tier URL Redirects', () => {
  const legacyRedirects = [
    ['budget', 'tier_1'],
    ['middle', 'tier_2'],
    ['luxury', 'tier_3'],
  ] as const;

  legacyRedirects.forEach(([legacy, canonical]) => {
    test(`redirects /tiers/${legacy} to /tiers/${canonical}`, async ({ page }) => {
      await page.goto(`/tiers/${legacy}`);
      await page.waitForURL(new RegExp(`/tiers/${canonical}`));
      expect(page.url()).toContain(`/tiers/${canonical}`);
    });
  });
});
```

---

## Test Results

| Suite | Status |
|-------|--------|
| Server tests (1132) | ✅ All pass |
| Client smoke tests (5) | ✅ All pass |
| TypeScript | ✅ No errors |

**Note:** Pre-existing failing test in `EditableImage.test.tsx` is unrelated to this change.

---

## Reviewer Recommendations Applied

### DHH (Rails Philosophy)
> "This plan is 70% ceremony, 30% value. Fix the LPM seed bug and move on."

✅ Applied - Fixed the bug, added minimal tests, skipped ceremony.

### Practical Implementation
> "Must verify LPM production data before changes."

✅ Applied - User confirmed app is still demo mode, no production bookings.

### Code Simplicity
> "The best code is no code. Code is working (1132 tests passing). Only ONE actual bug: LPM seed."

✅ Applied - Total changes: ~65 lines across 3 files.

---

## Files Changed

- `server/prisma/seeds/la-petit-mariage.ts` - Fixed grouping values, added production guard
- `client/src/features/storefront/__tests__/utils.test.ts` - New file (5 smoke tests)
- `e2e/tests/storefront.spec.ts` - Added legacy redirect tests

---

## What's NOT Done (Intentionally Skipped)

These items were reviewed and intentionally not implemented:

1. **Hook call in TierCard memo (P2-3)** - React hooks in memo are fine if stable
2. **useMemo for getDisplayName (P2-4)** - 3 property lookups don't need caching
3. **Dev warning in useTenant (P2-5)** - Already returns undefined gracefully
4. **useValidateTier hook (P2-6)** - Would be 40 lines to replace 8 lines of "duplication"
5. **LEGACY_TIER_ALIASES deprecation tracking (P2-7)** - Aliases work fine, remove when ready
6. **isTierLevel type guard (P3-10)** - Type assertion works, guard adds no value
7. **Migration rollback docs (P3-11)** - Migration already applied

---

## Original Code Review Reference

| Priority | Count | Description | Action |
|----------|-------|-------------|--------|
| P1 Critical | 2 | Test coverage, unmapped tiers | ✅ Fixed |
| P2 Important | 6 | React opts, error handling | ⏭️ Skipped (YAGNI) |
| P3 Nice-to-Have | 4 | Minor opts, documentation | ⏭️ Skipped (YAGNI) |
