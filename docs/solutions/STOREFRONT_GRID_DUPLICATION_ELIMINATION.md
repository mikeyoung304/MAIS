# Storefront Component Refactoring: Grid Duplication & Memoization

## Problem Statement

The storefront grid layout had two critical issues identified in code review:

1. **Grid Layout Duplication**: Both `StorefrontHome` and `TierSelector` components implemented identical responsive grid logic independently, violating the DRY principle. Each component duplicated the same conditional Tailwind classes to handle 1-2-3+ column layouts.

2. **Missing React Memoization**: Two heavily-used presentational components (`SegmentCard` and `TierCard`) lacked memoization. These components were rendered inside loops and could re-render unnecessarily when parent components updated, causing performance degradation on pages with multiple segments or tiers.

### Impact

- Code maintenance burden: Grid layout changes required updates in multiple locations
- Runtime performance: Unnecessary re-renders of card components even when props didn't change
- Inconsistent behavior: Future layout changes could diverge between grid implementations

---

## Investigation

### Pattern Analysis

**Grid Layout Pattern:**
The responsive grid system needed to handle three distinct scenarios:

| Scenario | Columns                      | Behavior                  | Use Case                     |
| -------- | ---------------------------- | ------------------------- | ---------------------------- |
| 1 item   | 1 col                        | Centered with `max-w-2xl` | Single product/segment offer |
| 2 items  | 1 (mobile) → 2 (md+)         | Centered with `max-w-4xl` | Budget vs Premium tier       |
| 3+ items | 1 (mobile) → 2 (md) → 3 (lg) | Full width                | Complete tier system         |

**Memoization Requirement:**

- `SegmentCard` is a thin wrapper around `ChoiceCardBase`, mapping `SegmentDto` → props
- `TierCard` is a thin wrapper around `ChoiceCardBase`, mapping `PackageDto` → props
- Both are pure components (deterministic output given props)
- Both are rendered in `.map()` loops within grids
- Parent `StorefrontHome` and `TierSelector` update frequently (fetching data, etc.)

### Code Locations Analyzed

**StorefrontHome** (before refactoring):

```typescript
// Grid layout defined inline - duplicate grid logic
<div className={clsx(
  'grid gap-6 lg:gap-8',
  segments.length === 1 && 'grid-cols-1 max-w-2xl mx-auto',
  segments.length === 2 && 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto',
  segments.length >= 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
)}>
  {segments.map(segment => <SegmentCard key={segment.id} segment={segment} />)}
</div>
```

**TierSelector** (before refactoring):

```typescript
// Identical grid layout logic repeated
<div className={clsx(
  'grid gap-6 lg:gap-8',
  configuredTiers.length === 1 && 'grid-cols-1 max-w-2xl mx-auto',
  configuredTiers.length === 2 && 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto',
  configuredTiers.length >= 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
)}>
  {configuredTiers.map(tier => <TierCard ... />)}
</div>
```

**Card Components** (before memoization):

```typescript
// SegmentCard - not memoized
export function SegmentCard({ segment }: SegmentCardProps) {
  return <ChoiceCardBase ... />;
}

// TierCard - not memoized
export function TierCard({ package: pkg, ... }: TierCardProps) {
  return <ChoiceCardBase ... />;
}
```

---

## Root Cause Analysis

### Why Duplication Existed

1. **Parallel Development**: Components were built independently without shared layout abstraction
2. **Assumed Variation**: Developers may have thought the layouts would diverge (they didn't)
3. **No Design System Layer**: No intermediate component layer for layout patterns
4. **Copy-Paste Comfort**: Grid logic was easier to duplicate than extract and refactor

### Why Memoization Was Missing

1. **Premature Optimization Culture**: React docs recommend memoizing only when profiling shows issues
2. **Component Simplicity Bias**: Thin wrapper components feel "too simple" to need optimization
3. **Mismatch with Codebase Pattern**: `ChoiceCardBase` itself was memoized, but wrappers weren't
4. **No Consistent Memo Policy**: The codebase lacked a guideline for when to apply `memo()`

### Correct Assessment

The duplication was **real and problematic**:

- Grid logic would break if Tailwind utilities changed
- Layout decisions are architectural (should be centralized)
- Made the codebase harder to understand (what's the grid strategy?)

The memoization was **correctly identified as necessary**:

- Cards are pure functions of props
- Cards are in loops (high render count scenarios)
- Cards contain nested ChoiceCardBase which is already memoized
- Pattern matches successful memoization of `ChoiceCardBase`

---

## Solution Steps

### Step 1: Extract Grid Layout to Dedicated Component

Created `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/ChoiceGrid.tsx`:

```typescript
/**
 * ChoiceGrid Component
 *
 * Responsive grid layout for choice cards (segments or tiers).
 * Handles 1, 2, 3, or 4+ items elegantly with appropriate column layouts.
 *
 * Layout behavior:
 * - 1 item: Single column, centered with max-w-2xl
 * - 2 items: 2 columns on md+, centered with max-w-4xl
 * - 3+ items: 3 columns on lg, 2 on md, 1 on mobile (full width)
 */

import { clsx } from 'clsx';

interface ChoiceGridProps {
  children: React.ReactNode;
  itemCount: number;
}

export function ChoiceGrid({ children, itemCount }: ChoiceGridProps) {
  return (
    <div
      className={clsx(
        'grid gap-6 lg:gap-8',
        itemCount === 1 && 'grid-cols-1 max-w-2xl mx-auto',
        itemCount === 2 && 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto',
        itemCount >= 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      )}
    >
      {children}
    </div>
  );
}
```

**Key Design Decisions:**

- **Props**: `children` (content) + `itemCount` (layout determiner)
- **Naming**: "ChoiceGrid" reflects its purpose (grid for choice cards)
- **Comments**: Documented layout behavior in JSDoc comment
- **Simplicity**: ~30 lines, single responsibility (layout only)

### Step 2: Implement React.memo() for Card Components

Updated `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/SegmentCard.tsx`:

```typescript
/**
 * SegmentCard Component
 *
 * Thin wrapper around ChoiceCardBase for segment display.
 * Used in StorefrontHome when tenant has multiple segments.
 *
 * Features:
 * - Maps SegmentDto fields to ChoiceCardBase props
 * - No price display (segments don't show price)
 * - CTA: "See Packages"
 * - Links to /s/{slug}
 * - Memoized to prevent unnecessary re-renders
 */

import { memo } from 'react';
import type { SegmentDto } from '@macon/contracts';
import { ChoiceCardBase } from './ChoiceCardBase';

interface SegmentCardProps {
  segment: SegmentDto;
}

export const SegmentCard = memo(function SegmentCard({ segment }: SegmentCardProps) {
  return (
    <ChoiceCardBase
      title={segment.heroTitle}
      description={segment.heroSubtitle || segment.description || ''}
      imageUrl={segment.heroImage}
      imageAlt={segment.heroTitle}
      categoryLabel={segment.name}
      cta="See Packages"
      href={`/s/${segment.slug}`}
      testId={`segment-card-${segment.slug}`}
    />
  );
});
```

**Key Implementation Details:**

- **Named Function Pattern**: `memo(function SegmentCard(...))` preserves component name for DevTools
- **JSDoc Update**: Added comment emphasizing memoization and its purpose
- **No Logic Changes**: Pure refactoring—behavior identical, only wrapped with `React.memo()`

Updated `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/TierCard.tsx`:

```typescript
/**
 * TierCard Component
 *
 * Thin wrapper around ChoiceCardBase for tier (package) display.
 * Used in TierSelector for the 3-tier pricing layout.
 *
 * Features:
 * - Maps PackageDto fields to ChoiceCardBase props
 * - Shows price (tier cards always display price)
 * - "Most Popular" badge only when exactly 3 tiers AND tier is middle
 * - CTA: "View Details"
 * - Links to /s/{segmentSlug}/{tier} or /tiers/{tier}
 * - Memoized to prevent unnecessary re-renders
 */

import { memo } from 'react';
import type { PackageDto } from '@macon/contracts';
import { ChoiceCardBase } from './ChoiceCardBase';
import {
  getTierDisplayName,
  truncateText,
  CARD_DESCRIPTION_MAX_LENGTH,
  type TierLevel,
} from './utils';

interface TierCardProps {
  package: PackageDto;
  /** The tier level: budget, middle, or luxury */
  tierLevel: TierLevel;
  /** Optional segment slug for routing */
  segmentSlug?: string;
  /** Total number of configured tiers (used for highlighting logic) */
  totalTierCount: number;
}

export const TierCard = memo(function TierCard({
  package: pkg,
  tierLevel,
  segmentSlug,
  totalTierCount,
}: TierCardProps) {
  // Only highlight middle tier when exactly 3 tiers exist
  const isHighlighted = totalTierCount === 3 && tierLevel === 'middle';

  // Build link based on whether we're in a segment context
  const href = segmentSlug
    ? `/s/${segmentSlug}/${tierLevel}`
    : `/tiers/${tierLevel}`;

  // Get image URL, preferring new photos array over legacy photoUrl
  const imageUrl = pkg.photos?.[0]?.url || pkg.photoUrl || null;

  return (
    <ChoiceCardBase
      title={pkg.title}
      description={truncateText(pkg.description, CARD_DESCRIPTION_MAX_LENGTH)}
      imageUrl={imageUrl}
      imageAlt={`${getTierDisplayName(tierLevel)} tier: ${pkg.title}`}
      categoryLabel={getTierDisplayName(tierLevel)}
      price={pkg.priceCents}
      cta="View Details"
      href={href}
      highlighted={isHighlighted}
      testId={`tier-card-${tierLevel}`}
    />
  );
});
```

**Memoization Effectiveness:**

- `TierCard` props: `package`, `tierLevel`, `segmentSlug`, `totalTierCount` (3-4 objects)
- Memo prevents re-render when these props are referentially identical
- Parent `TierSelector` passes new array objects each render—but tiers from `useMemo()`
- Prevents cascading renders to `ChoiceCardBase` → image elements

### Step 3: Update TierSelector to Use ChoiceGrid

Updated `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/TierSelector.tsx`:

```typescript
// BEFORE: Grid layout embedded in component
<div className={clsx(
  'grid gap-6 lg:gap-8',
  configuredTiers.length === 1 && 'grid-cols-1 max-w-2xl mx-auto',
  configuredTiers.length === 2 && 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto',
  configuredTiers.length >= 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
)}>
  {TIER_LEVELS.map((tierLevel) => {
    const pkg = tiers[tierLevel];
    if (!pkg) return null;
    return (
      <TierCard
        key={tierLevel}
        package={pkg}
        tierLevel={tierLevel}
        segmentSlug={segmentSlug}
        totalTierCount={configuredTiers.length}
      />
    );
  })}
</div>

// AFTER: Use extracted ChoiceGrid component
<ChoiceGrid itemCount={configuredTiers.length}>
  {TIER_LEVELS.map((tierLevel) => {
    const pkg = tiers[tierLevel];
    if (!pkg) return null;

    return (
      <TierCard
        key={tierLevel}
        package={pkg}
        tierLevel={tierLevel}
        segmentSlug={segmentSlug}
        totalTierCount={configuredTiers.length}
      />
    );
  })}
</ChoiceGrid>
```

**Benefits:**

- Lines reduced from grid definition (~8 lines) to single component use (1 line)
- Layout logic now centralized and maintainable
- Component responsibilities clearer

### Step 4: Update StorefrontHome to Use ChoiceGrid

Updated `/Users/mikeyoung/CODING/MAIS/client/src/pages/StorefrontHome.tsx`:

```typescript
// Import ChoiceGrid from storefront feature module
import { ChoiceGrid } from '@/features/storefront';

// In component render:
{segments.length > 0 && (
  <ChoiceGrid itemCount={segments.length}>
    {segments.map((segment) => (
      <SegmentCard
        key={segment.id}
        segment={segment}
      />
    ))}
  </ChoiceGrid>
)}
```

### Step 5: Export from Feature Module

Updated `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/index.ts`:

```typescript
/**
 * Storefront Feature Module
 *
 * Customer-facing storefront components for the 3-choice pattern.
 *
 * Components:
 * - ChoiceCardBase: Pure presentation card (base for all choice cards)
 * - SegmentCard: Wrapper for segment display
 * - TierCard: Wrapper for tier/package display
 * - TierSelector: Tier card grid layout
 * - TierDetail: Full detail view with prev/next navigation
 *
 * Utilities:
 * - TIER_LEVELS: Standard tier level constants
 * - getTierDisplayName: Convert tier level to display name
 * - extractTiers: Extract tiers from package list
 * - cardStyles: Shared card styling constants
 */

export { ChoiceCardBase } from './ChoiceCardBase';
export { ChoiceGrid } from './ChoiceGrid'; // ← NEW
export { SegmentCard } from './SegmentCard';
export { TierCard } from './TierCard';
export { TierSelector } from './TierSelector';
export { TierDetail } from './TierDetail';

// Export shared utilities
export {
  TIER_LEVELS,
  getTierDisplayName,
  extractTiers,
  truncateText,
  CARD_DESCRIPTION_MAX_LENGTH,
  type TierLevel,
} from './utils';

// Export shared styles
export { cardStyles } from './cardStyles';
```

---

## Validation & Testing

### Grid Responsiveness Testing

The `ChoiceGrid` component was tested for all scenarios:

1. **1 Item**: Renders with `max-w-2xl mx-auto` centering

   ```
   Desktop:  [  card  ]
   Mobile:   [  card  ]
   ```

2. **2 Items**: Renders with `md:grid-cols-2 max-w-4xl` centering

   ```
   Desktop:  [card 1] [card 2]
   Mobile:   [card 1]
              [card 2]
   ```

3. **3+ Items**: Full-width responsive (md: 2 cols, lg: 3 cols)
   ```
   Desktop:  [card 1] [card 2] [card 3]
             [card 4] ...
   Tablet:   [card 1] [card 2]
             [card 3] [card 4]
   Mobile:   [card 1]
             [card 2]
             [card 3]
   ```

### Memoization Effectiveness Verification

**Before Memoization:**

- Parent `TierSelector` updates → all TierCard components re-render
- Even when tier data unchanged, cards re-rendered due to parent render

**After Memoization:**

- Parent `TierSelector` updates → TierCard checks props with `Object.is()`
- Cards only re-render if `package`, `tierLevel`, `segmentSlug`, or `totalTierCount` change
- Prevents cascading renders to `ChoiceCardBase` and image elements

**Practical Impact:**

- On 4-tier display: ~4 unnecessary renders prevented per parent update
- On 3-segment display: ~3 unnecessary renders prevented per parent update
- Especially important when parent updates frequently (data fetching, sorting)

---

## Related Files & Architecture

### Component Tree

```
StorefrontHome
├── ChoiceGrid [NEW]
│   └── SegmentCard (memo) [UPDATED]
│       └── ChoiceCardBase (memo)
│
TierSelector
├── ChoiceGrid [NEW]
│   └── TierCard (memo) [UPDATED]
│       └── ChoiceCardBase (memo)
│
TierDetail
└── ChoiceCardBase (memo)
```

### Files Modified

| File                 | Change                 | Reason                          |
| -------------------- | ---------------------- | ------------------------------- |
| `ChoiceGrid.tsx`     | Created                | New abstraction for grid layout |
| `SegmentCard.tsx`    | Added `memo()` wrapper | Performance optimization        |
| `TierCard.tsx`       | Added `memo()` wrapper | Performance optimization        |
| `TierSelector.tsx`   | Uses `ChoiceGrid`      | Eliminate duplication           |
| `StorefrontHome.tsx` | Uses `ChoiceGrid`      | Eliminate duplication           |
| `index.ts`           | Export `ChoiceGrid`    | Public API consistency          |

### Import Patterns

```typescript
// Feature module export (preferred)
import { ChoiceGrid, SegmentCard, TierCard } from '@/features/storefront';

// Or specific imports
import { ChoiceGrid } from '@/features/storefront/ChoiceGrid';
import { SegmentCard } from '@/features/storefront/SegmentCard';
```

---

## Key Takeaways

### Design Patterns Applied

1. **Component Composition**: Small, focused components (ChoiceGrid) that handle single responsibility
2. **Props Drilling**: Grid layout determined by `itemCount` prop (simple, explicit API)
3. **React Memoization**: Applied consistently to presentation components in loops
4. **Feature Module Pattern**: Components exported through `index.ts` for organized imports

### When to Apply Similar Solutions

**Duplicate Grid Layouts:**

- Identify grid logic appearing in 2+ components
- Extract into dedicated layout component with `itemCount` or similar prop
- Update all consumers to import the shared component
- Benefit: Maintainability, consistency, reduced code

**Missing Memoization on Cards:**

- Look for components that:
  - Are rendered inside `.map()` loops
  - Are pure functions of their props
  - Don't use `useState` or `useEffect`
  - Are light wrappers around other memoized components
- Wrap with `React.memo(function ComponentName(props) { ... })`
- Benefit: Reduced unnecessary renders, better performance on large lists

### Performance Considerations

**ChoiceGrid Performance:**

- Zero runtime overhead (pure layout component)
- Conditional class application optimized by `clsx` library
- No state or effects

**Card Memoization Performance:**

- Reference comparison on props (Object.is)
- Most beneficial when:
  - Parent renders frequently
  - Tier/segment lists are large (4+ items)
  - Cards contain images (prevent re-layout)
- No performance cost if props always change (memoization transparent)

---

## Implementation Checklist

- [x] Create `ChoiceGrid.tsx` with responsive layout logic
- [x] Wrap `SegmentCard` with `React.memo()`
- [x] Wrap `TierCard` with `React.memo()`
- [x] Update `TierSelector` to use `ChoiceGrid`
- [x] Update `StorefrontHome` to use `ChoiceGrid`
- [x] Export `ChoiceGrid` from `index.ts`
- [x] Verify responsive grid works in all scenarios
- [x] Verify card memoization prevents unnecessary renders
- [x] Update JSDoc comments to document memoization
- [x] Run tests to ensure no functionality changes

---

## Related Documentation

- **Component Architecture**: See `docs/architecture/COMPONENT_PATTERNS.md`
- **Performance**: See `docs/performance/REACT_MEMOIZATION_GUIDE.md`
- **Grid System**: See Tailwind CSS responsive design patterns in component comments
