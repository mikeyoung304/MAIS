---
status: complete
priority: p2
issue_id: '016'
tags: [code-review, refactoring, dry, storefront]
dependencies: []
---

# Extract Duplicate Storefront Utilities to Shared Module

## Problem Statement

PR #6 introduces several utility functions that are duplicated across multiple files. This violates DRY principles and creates maintenance burden - if one copy is updated, others may be missed.

**Why this matters:** Duplicate code increases bundle size and risk of bugs when one copy diverges from another.

## Findings

### Duplicated Functions

1. **`getTierDisplayName()`** - 12 lines duplicated in 2 files:
   - `client/src/features/storefront/TierCard.tsx` (lines 33-44)
   - `client/src/features/storefront/TierDetail.tsx` (lines 45-56)

2. **`extractTiers()`** - 17 lines duplicated in 2 files:
   - `client/src/features/storefront/TierSelector.tsx` (lines 44-59)
   - `client/src/features/storefront/TierDetail.tsx` (lines 61-76)

3. **`TIER_LEVELS` constant** - Defined 4 times with different names:
   - `TIER_LEVELS` in TierDetail.tsx and TierSelector.tsx
   - `VALID_TIERS` in TierDetailPage.tsx and RootTiers.tsx

4. **`truncate()`** - Generic utility in TierCard.tsx (lines 49-52)

### Impact

- ~40 lines of duplicated code
- Inconsistent naming (`TIER_LEVELS` vs `VALID_TIERS`)
- Increased bundle size (~500 bytes gzipped)

## Proposed Solutions

### Option A: Create Shared Utils Module (Recommended)

**Effort:** Small | **Risk:** Low

Create `/client/src/features/storefront/utils.ts`:

```typescript
export const TIER_LEVELS = ['budget', 'middle', 'luxury'] as const;
export type TierLevel = (typeof TIER_LEVELS)[number];

export function getTierDisplayName(tierLevel: string): string {
  switch (tierLevel) {
    case 'budget':
      return 'Essential';
    case 'middle':
      return 'Popular';
    case 'luxury':
      return 'Premium';
    default:
      return tierLevel.charAt(0).toUpperCase() + tierLevel.slice(1);
  }
}

export function extractTiers(packages: PackageDto[]): Record<TierLevel, PackageDto | undefined> {
  const tiers: Record<TierLevel, PackageDto | undefined> = {
    budget: undefined,
    middle: undefined,
    luxury: undefined,
  };
  for (const pkg of packages) {
    const grouping = pkg.grouping?.toLowerCase();
    if (grouping && TIER_LEVELS.includes(grouping as TierLevel)) {
      tiers[grouping as TierLevel] = pkg;
    }
  }
  return tiers;
}
```

**Pros:**

- Single source of truth
- Reduces bundle size
- Easier to test utilities in isolation
- Consistent exports from feature module

**Cons:**

- Requires updating 6 files to import from new location

### Option B: Move to Global Utils

**Effort:** Small | **Risk:** Low

Move `truncate()` to `client/src/lib/utils.ts`, keep tier-specific utilities in storefront feature.

**Pros:**

- `truncate()` could be reused elsewhere
- Separation of generic vs domain-specific utilities

**Cons:**

- Two locations to check for utilities

## Recommended Action

Implement **Option A** - Create `client/src/features/storefront/utils.ts` and export from `index.ts`.

## Technical Details

**Files to Create:**

- `client/src/features/storefront/utils.ts`

**Files to Update:**

- `client/src/features/storefront/TierCard.tsx` - Import from utils
- `client/src/features/storefront/TierDetail.tsx` - Import from utils
- `client/src/features/storefront/TierSelector.tsx` - Import from utils
- `client/src/features/storefront/index.ts` - Export utils
- `client/src/pages/TierDetailPage.tsx` - Import from feature
- `client/src/pages/RootTiers.tsx` - Import from feature

## Acceptance Criteria

- [ ] `TIER_LEVELS` and `TierLevel` type exported from single location
- [ ] `getTierDisplayName()` not duplicated
- [ ] `extractTiers()` not duplicated
- [ ] All imports updated to use shared utils
- [ ] TypeScript compilation passes
- [ ] No runtime errors on storefront pages

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2025-11-27 | Created | Found during PR #6 code review |

## Resources

- PR #6: https://github.com/mikeyoung304/MAIS/pull/6
- Performance review identified bundle size impact
- Code quality review identified DRY violations
