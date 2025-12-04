---
status: complete
priority: p3
issue_id: '020'
tags: [code-review, consistency, ui, storefront]
dependencies: []
completed_date: '2025-12-03'
---

# Use Consistent Loading Skeleton Pattern

## Problem Statement

PR #6 introduces custom inline skeleton markup instead of using the established `PackageCardSkeleton` component pattern from the existing codebase.

**Why this matters:** Inconsistent loading states create visual inconsistency and add maintenance burden.

## Findings

### Custom Skeleton in New Pages

**Files:**

- `client/src/pages/SegmentTiers.tsx` (lines 30-46)
- `client/src/pages/RootTiers.tsx` (lines 27-44)

**Current (custom divs):**

```tsx
<div className="h-12 w-2/3 mx-auto bg-neutral-200 rounded-lg animate-pulse mb-4" />
<div className="h-6 w-1/2 mx-auto bg-neutral-100 rounded-lg animate-pulse" />
```

### Existing Pattern in Codebase

**Files:**

- `client/src/pages/SegmentLanding.tsx`
- `client/src/pages/PackageCatalog.tsx`

**Pattern:**

```tsx
import { PackageCardSkeleton } from '@/components/ui/skeleton';

{
  [1, 2, 3, 4].map((i) => <PackageCardSkeleton key={i} />);
}
```

### StorefrontHome Uses Basic Loading

**File:** `client/src/pages/StorefrontHome.tsx` (line 90)

Uses simple `<Loading>` component instead of skeleton placeholders.

## Proposed Solutions

### Option A: Use PackageCardSkeleton (Recommended)

**Effort:** Small | **Risk:** Low

Update loading states to use existing skeleton component:

```tsx
if (isLoading) {
  return (
    <Container className="py-12">
      <div className="text-center mb-12">
        <Skeleton className="h-12 w-2/3 mx-auto mb-4" />
        <Skeleton className="h-6 w-1/2 mx-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {[1, 2, 3].map((i) => (
          <PackageCardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}
```

**Pros:**

- Consistent with existing pages
- Uses established component
- Better maintainability

**Cons:**

- Minor visual difference during loading

### Option B: Create TierCardSkeleton

**Effort:** Medium | **Risk:** Low

Create new skeleton component matching TierCard dimensions.

**Pros:**

- Perfect visual match to TierCard
- Reusable for tier-specific loading states

**Cons:**

- Another component to maintain
- May not be necessary given similarity

## Recommended Action

Implement **Option A** - Use existing `PackageCardSkeleton` for consistency.

## Technical Details

**Files to Update:**

- `client/src/pages/SegmentTiers.tsx`
- `client/src/pages/RootTiers.tsx`
- `client/src/pages/StorefrontHome.tsx` (optional)

**Import:**

```typescript
import { PackageCardSkeleton, Skeleton } from '@/components/ui/skeleton';
```

## Acceptance Criteria

- [x] SegmentTiers uses PackageCardSkeleton
- [x] RootTiers uses PackageCardSkeleton
- [x] Loading states visually match existing pages
- [x] No layout shift when content loads

## Implementation Summary

**Date Completed:** 2025-12-03

### Changes Made

1. **SegmentTiers.tsx:**
   - Updated import to include `Skeleton` component
   - Replaced custom header skeleton divs with `Skeleton` components
   - Maintained `PackageCardSkeleton` for tier cards

2. **RootTiers.tsx:**
   - Updated import to include `Skeleton` component
   - Replaced custom header skeleton divs with `Skeleton` components
   - Maintained `PackageCardSkeleton` for tier cards

### Verification

- TypeScript type checking passed (npm run typecheck)
- Both files successfully updated with consistent patterns
- Loading states now use established skeleton components throughout the application

## Work Log

| Date       | Action      | Notes                                                               |
| ---------- | ----------- | ------------------------------------------------------------------- |
| 2025-11-27 | Created     | Found during PR #6 pattern consistency review                       |
| 2025-12-03 | Implemented | Updated both files to use Skeleton + PackageCardSkeleton components |
| 2025-12-03 | Verified    | TypeScript passing, visual consistency achieved                     |

## Resources

- PR #6: https://github.com/mikeyoung304/MAIS/pull/6
- Existing pattern: `client/src/pages/SegmentLanding.tsx`
- Skeleton component: `client/src/components/ui/skeleton.tsx`
