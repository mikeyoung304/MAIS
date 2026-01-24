---
status: complete
priority: p1
issue_id: 646
tags: [code-review, dry-violation, react, refactoring]
dependencies: []
---

# Duplicate Tier Card Rendering Logic

## Problem Statement

The tier card rendering logic (75+ lines) is duplicated between the single-segment fallback path and the multi-segment expanded view. Bug fixes must be applied twice, violating DRY principle.

**Why it matters:** The single-segment case is a special case of "selected segment" with auto-selection. The code should be unified.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

**Duplicated code locations:**

1. Lines 302-352 (single segment path)
2. Lines 430-457 (selected segment tiers)

Both sections have:

- Same grid layout logic
- Same `TierCard` rendering
- Same `midIndex` calculation for "Most Popular" badge
- Same tier label resolution from `tierDisplayNames`

**Source:** architecture-strategist agent, code-simplicity-reviewer agent

## Proposed Solutions

### Option 1: Extract TierGridSection Component (Recommended)

Create a reusable component for the tier card grid:

```typescript
interface TierGridSectionProps {
  segment: SegmentData;
  packages: PackageData[];
  tenant: TenantStorefrontData['tenant'];
  getBookHref: (slug: string) => string;
}

function TierGridSection({ segment, packages, tenant, getBookHref }: TierGridSectionProps) {
  const midIndex = Math.floor(packages.length / 2);

  const gridClasses = packages.length === 1
    ? 'mx-auto max-w-md md:grid-cols-1'
    : packages.length === 2
      ? 'mx-auto max-w-2xl md:grid-cols-2'
      : 'md:grid-cols-3';

  return (
    <>
      <div className="text-center">
        <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl md:text-5xl">
          {segment.heroTitle || segment.name}
        </h2>
        {segment.heroSubtitle && (
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            {segment.heroSubtitle}
          </p>
        )}
      </div>

      <div className={`mt-16 grid gap-8 ${gridClasses}`}>
        {packages.map((pkg, index) => {
          const isPopular = packages.length > 2 && index === midIndex;
          const tierLabel = tenant.tierDisplayNames?.[
            pkg.tier.toLowerCase() as keyof typeof tenant.tierDisplayNames
          ] || pkg.title;

          return (
            <TierCard
              key={pkg.id}
              pkg={pkg}
              tierLabel={tierLabel}
              bookHref={getBookHref(pkg.slug)}
              isPopular={isPopular}
            />
          );
        })}
      </div>
    </>
  );
}
```

**Pros:**

- Single source of truth for tier rendering
- Easier to test
- Bug fixes applied once

**Cons:**

- New component to maintain

**Effort:** Medium (30 min)
**Risk:** Low

### Option 2: Extract Helper Functions Only

Extract just the repeated calculations:

```typescript
function getTierGridClasses(count: number): string {
  if (count === 1) return 'mx-auto max-w-md md:grid-cols-1';
  if (count === 2) return 'mx-auto max-w-2xl md:grid-cols-2';
  return 'md:grid-cols-3';
}

function renderTierCards(
  packages: PackageData[],
  tenant: TenantPublicDto,
  getBookHref: (slug: string) => string
) {
  const midIndex = Math.floor(packages.length / 2);
  return packages.map((pkg, index) => {
    /* ... */
  });
}
```

**Pros:**

- Smaller change
- Keeps component structure

**Cons:**

- Still some duplication in section headers
- Less clean abstraction

**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

Option 1 - Extract full TierGridSection component

## Technical Details

**Affected files:**

- `apps/web/src/components/tenant/SegmentPackagesSection.tsx`

**Lines to remove after extraction:**

- 302-352 (replaced with `<TierGridSection />`)
- 430-457 (replaced with `<TierGridSection />`)

## Acceptance Criteria

- [ ] Single-segment and multi-segment paths use same rendering component
- [ ] `TierGridSection` handles all tier card logic
- [ ] Grid class calculation is extracted
- [ ] "Most Popular" badge logic works correctly in both paths
- [ ] Visual appearance unchanged

## Work Log

| Date       | Action                   | Learnings                                  |
| ---------- | ------------------------ | ------------------------------------------ |
| 2026-01-08 | Created from code review | DRY violations compound maintenance burden |

## Resources

- Code review: Segment-first browsing implementation
- Component: SegmentPackagesSection.tsx
