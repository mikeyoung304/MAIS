# Feature: Unified 3-Choice Storefront Experience

## Overview

Create a **flagship customer-facing experience** where both segment selection and tier selection use an identical, Apple-quality "3 choices" card pattern. This is the core UX of the platform - optimized for conversions with psychological pricing principles.

**This is NOT an admin UI change.** This is the customer storefront booking flow.

---

## Customer Journey

```
Customer arrives at storefront
           │
           ▼
   ┌───────────────────┐
   │ How many segments │
   │ does tenant have? │
   └───────────────────┘
           │
     ┌─────┴─────┐
     │           │
   0 or 1      2+
     │           │
     ▼           ▼
  Skip to    Segment Selection
  Tiers      (SegmentCards)
     │           │
     │           ▼
     │      Click segment
     │           │
     └─────┬─────┘
           │
           ▼
    Tier Selection
    (TierCards)
    Middle = "Most Popular"
    (only if 3 tiers exist)
           │
           ▼
    Package Details
    (+ optional add-ons)
           │
           ▼
    Booking Confirmation
```

---

## Design Principles

### The "3 Choices" Pattern

This is our flagship UX. Both segment and tier selection pages must look **nearly identical**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│              What brings you here today?                                │
│         Choose the option that best fits your needs                     │
│                                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│   │             │    │ ★ POPULAR   │    │             │               │
│   │   [Photo]   │    │   [Photo]   │    │   [Photo]   │               │
│   │    4:3      │    │    4:3      │    │    4:3      │               │
│   │             │    │  (scaled)   │    │             │               │
│   ├─────────────┤    ├─────────────┤    ├─────────────┤               │
│   │ Title       │    │ Title       │    │ Title       │               │
│   │             │    │ $2,500      │    │             │               │
│   │ Description │    │ Description │    │ Description │               │
│   │             │    │             │    │             │               │
│   │ [See Pkgs]  │    │[View Detail]│    │ [See Pkgs]  │               │
│   └─────────────┘    └─────────────┘    └─────────────┘               │
│                                                                         │
│        Not sure? Our Popular tier is perfect for most.                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Aspect                   | Segment Cards  | Tier Cards                                 |
| ------------------------ | -------------- | ------------------------------------------ |
| **Aspect ratio**         | 4:3            | 4:3                                        |
| **Price displayed**      | No             | Yes (exact price)                          |
| **CTA text**             | "See Packages" | "View Details"                             |
| **"Most Popular" badge** | Never          | Only if exactly 3 tiers AND tier is middle |
| **Hover effects**        | Same           | Same                                       |
| **Mobile layout**        | Vertical stack | Vertical stack                             |

### Conversion Psychology

1. **Decoy Effect**: Budget tier makes middle tier look like best value
2. **Anchoring**: Premium tier sets perception of value ceiling
3. **Visual Emphasis**: Middle tier gets badge, scale, elevated shadow (only when 3 tiers)
4. **Clear CTAs**: Action-oriented button text

---

## Technical Approach

### Architecture: Base + Wrappers Pattern (Simplified)

Instead of a discriminated union, we use a **pure presentation component** with **two thin wrappers**. This eliminates all conditional branching in the base component.

```tsx
// ChoiceCardBase.tsx - Pure presentation, ZERO conditionals
interface ChoiceCardBaseProps {
  title: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string;
  categoryLabel: string; // e.g., "Weddings" or "Popular"
  price?: number; // cents, only for tier cards
  cta: string;
  href: string;
  highlighted?: boolean;
}

export const ChoiceCardBase = memo(function ChoiceCardBase({
  title,
  description,
  imageUrl,
  imageAlt,
  categoryLabel,
  price,
  cta,
  href,
  highlighted = false,
}: ChoiceCardBaseProps) {
  return (
    <Link
      to={href}
      className={clsx(cardStyles.base, highlighted ? cardStyles.highlighted : cardStyles.normal)}
    >
      {/* "Most Popular" badge */}
      {highlighted && (
        <Badge className="absolute top-4 right-4 z-10 bg-macon-orange text-white">
          Most Popular
        </Badge>
      )}

      {/* 4:3 Hero Image with fallback */}
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-macon-navy to-macon-teal/80 flex items-center justify-center">
            <span className="text-white/60 text-lg">{categoryLabel}</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <span className="text-sm font-medium text-white/90 uppercase tracking-wide">
            {categoryLabel}
          </span>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-heading text-2xl md:text-3xl font-semibold mb-2 text-neutral-900">
          {title}
        </h3>

        {/* Price - only rendered if provided */}
        {price !== undefined && (
          <div className="mb-4">
            <span className="text-3xl md:text-4xl font-heading font-bold text-macon-orange">
              {formatCurrency(price)}
            </span>
          </div>
        )}

        <p className="text-lg text-neutral-600 mb-6 line-clamp-3 flex-1">{description}</p>

        {/* CTA - styled div, not nested button (a11y fix) */}
        <div
          className={clsx(
            'w-full min-h-[52px] text-lg flex items-center justify-center rounded-md border-2 font-medium transition-colors',
            highlighted
              ? 'bg-macon-orange text-white border-macon-orange'
              : 'border-macon-orange text-macon-orange hover:bg-macon-orange hover:text-white'
          )}
        >
          {cta}
        </div>
      </div>
    </Link>
  );
});
```

### Thin Wrapper Components

```tsx
// SegmentCard.tsx - Thin wrapper with clear intent
interface SegmentCardProps {
  segment: SegmentDto;
}

export function SegmentCard({ segment }: SegmentCardProps) {
  return (
    <ChoiceCardBase
      title={segment.heroTitle}
      description={segment.heroSubtitle || segment.description || ''}
      imageUrl={segment.heroImage}
      imageAlt={segment.heroTitle}
      categoryLabel={segment.name}
      cta="See Packages"
      href={`/s/${segment.slug}`}
    />
  );
}
```

```tsx
// TierCard.tsx - Thin wrapper with highlighting logic
interface TierCardProps {
  package: PackageDto;
  tierLevel: TierLevel;
  segmentSlug?: string;
  totalTierCount: number; // Used to determine if highlighting applies
}

export function TierCard({ package: pkg, tierLevel, segmentSlug, totalTierCount }: TierCardProps) {
  // Only highlight middle tier when exactly 3 tiers exist
  const isHighlighted = totalTierCount === 3 && tierLevel === 'middle';

  const href = segmentSlug ? `/s/${segmentSlug}/${tierLevel}` : `/tiers/${tierLevel}`;

  return (
    <ChoiceCardBase
      title={pkg.title}
      description={truncateText(pkg.description, 150)}
      imageUrl={pkg.photos?.[0]?.url || pkg.photoUrl || null}
      imageAlt={`${getTierDisplayName(tierLevel)} tier: ${pkg.title}`}
      categoryLabel={getTierDisplayName(tierLevel)}
      price={pkg.priceCents}
      cta="View Details"
      href={href}
      highlighted={isHighlighted}
    />
  );
}
```

### Shared Card Styles

```tsx
// cardStyles.ts - Extracted for DRY
export const cardStyles = {
  base: clsx(
    'group relative overflow-hidden h-full flex flex-col',
    'transition-all duration-300 ease-out',
    'hover:shadow-elevation-3 hover:-translate-y-1',
    'bg-white border-2 rounded-xl',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-macon-orange focus-visible:ring-offset-2'
  ),
  normal: 'border-neutral-200 hover:border-macon-orange/30 shadow-elevation-1',
  highlighted: 'border-macon-orange shadow-elevation-2 scale-[1.02]',
};
```

### Responsive Grid

```tsx
// Handles 1, 2, 3, or 4+ cards elegantly
function ChoiceGrid({ children, itemCount }: { children: React.ReactNode; itemCount: number }) {
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

---

## Files to Change

| File                                                | Change                                                    |
| --------------------------------------------------- | --------------------------------------------------------- |
| `client/src/features/storefront/ChoiceCardBase.tsx` | **NEW** - Pure presentation component                     |
| `client/src/features/storefront/SegmentCard.tsx`    | **NEW** - Thin wrapper for segments                       |
| `client/src/features/storefront/TierCard.tsx`       | **REWRITE** - Thin wrapper using ChoiceCardBase           |
| `client/src/features/storefront/cardStyles.ts`      | **NEW** - Shared styling constants                        |
| `client/src/pages/StorefrontHome.tsx`               | Use SegmentCard, add 1-segment skip, change to 4:3 aspect |
| `client/src/features/storefront/TierSelector.tsx`   | Use new TierCard, pass totalTierCount                     |

### StorefrontHome Changes

```tsx
// 1-segment skip logic (without replace for proper back button)
if (!isLoading && segments?.length === 1) {
  return <Navigate to={`/s/${segments[0].slug}`} />;
}

// 0-segment redirect
if (!isLoading && (!segments || segments.length === 0)) {
  return <Navigate to="/tiers" replace />;
}

// Segment display using new SegmentCard
<ChoiceGrid itemCount={segments.length}>
  {segments.map((segment) => (
    <SegmentCard key={segment.id} segment={segment} />
  ))}
</ChoiceGrid>;
```

### TierSelector Changes

```tsx
// Pass total tier count for highlighting logic
const configuredTiers = useMemo(
  () => TIER_LEVELS.filter((level) => tiers[level] !== undefined),
  [tiers]
);

<ChoiceGrid itemCount={configuredTiers.length}>
  {configuredTiers.map((tierLevel) => {
    const pkg = tiers[tierLevel]!;
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
</ChoiceGrid>;
```

---

## Implementation Plan

### Phase 1: Foundation (2 hours)

- [ ] Create `cardStyles.ts` with shared Tailwind classes
- [ ] Create `ChoiceCardBase.tsx` - pure presentation, zero conditionals
- [ ] Add image fallback handling (gradient when null)
- [ ] Add focus-visible styles for keyboard navigation
- [ ] Verify aspect ratio is 4:3

### Phase 2: Wrappers (1.5 hours)

- [ ] Create `SegmentCard.tsx` wrapper
- [ ] Rewrite `TierCard.tsx` as thin wrapper
- [ ] Pass `totalTierCount` for conditional highlighting
- [ ] Add `getTierDisplayName` to alt text for a11y

### Phase 3: Integration (2 hours)

- [ ] Update `StorefrontHome.tsx`:
  - [ ] Change aspect ratio from 16:9 to 4:3
  - [ ] Use new `SegmentCard` component
  - [ ] Add 1-segment skip logic (without `replace`)
  - [ ] Keep 0-segment redirect (with `replace`)
  - [ ] Delete inline SegmentCard component
- [ ] Update `TierSelector.tsx`:
  - [ ] Use new `TierCard` component
  - [ ] Pass `totalTierCount` prop
  - [ ] Update grid to use `ChoiceGrid`

### Phase 4: Testing (2.5 hours)

- [ ] E2E: 0 segments → redirect to /tiers
- [ ] E2E: 1 segment → skip to /s/{slug} (back button works)
- [ ] E2E: 2 segments → show segment cards, no highlighting
- [ ] E2E: 3 segments → show segment cards
- [ ] E2E: 3 tiers → middle tier has "Most Popular" badge
- [ ] E2E: 2 tiers → NO badge on any tier
- [ ] E2E: 1 tier → single card centered
- [ ] E2E: Missing heroImage → shows gradient fallback
- [ ] E2E: Missing photoUrl → shows gradient fallback
- [ ] Mobile viewport tests (vertical stack)
- [ ] Keyboard navigation test (focus-visible ring)

**Total Estimated Effort: 8 hours**

---

## Acceptance Criteria

### Visual

- [ ] Segment cards and tier cards look identical (same base component)
- [ ] Both use 4:3 aspect ratio
- [ ] Hover: -1px translateY + shadow elevation
- [ ] Mobile: cards stack vertically
- [ ] Gradient fallback when image is missing

### Functional

- [ ] Segment cards show NO price, CTA says "See Packages"
- [ ] Tier cards show exact price, CTA says "View Details"
- [ ] "Most Popular" badge appears ONLY when exactly 3 tiers AND tier is middle
- [ ] 1 segment → auto-skip (back button returns to segment card)
- [ ] 0 segments → redirect to /tiers

### Accessibility

- [ ] Focus-visible ring on keyboard navigation
- [ ] Alt text includes tier level for screen readers
- [ ] No nested interactive elements (Link > Button removed)

### Edge Cases

- [ ] 4+ segments → grid wraps to multiple rows
- [ ] Segment with 0 packages → shows empty state message
- [ ] Invalid segment slug → 404 or redirect

---

## Edge Case Handling

| Scenario                | Behavior                                                      |
| ----------------------- | ------------------------------------------------------------- |
| 0 segments              | Redirect to `/tiers` with `replace`                           |
| 1 segment               | Navigate to `/s/{slug}` without `replace` (back button works) |
| 2 segments              | Show 2 cards, centered on desktop                             |
| 3+ segments             | Show grid, wraps to multiple rows if needed                   |
| 1 tier                  | Single card, centered, no badge                               |
| 2 tiers                 | Two cards, no badge on either                                 |
| 3 tiers                 | Three cards, middle gets "Most Popular" badge                 |
| Missing heroImage       | Show gradient fallback with segment name                      |
| Missing photoUrl        | Show gradient fallback with tier name                         |
| Segment with 0 packages | TierSelector shows "No packages available" message            |

---

## Not Doing (Out of Scope)

- ❌ Admin UI changes (this is storefront only)
- ❌ Price range on segment cards (per requirement)
- ❌ Horizontal carousel on mobile
- ❌ Drag-to-reorder
- ❌ A/B testing infrastructure
- ❌ Staggered fade-in animations (cut from scope - add later if needed)
- ❌ Discriminated union types (simpler wrapper pattern chosen)

---

## Key References

| What                   | Where                                             |
| ---------------------- | ------------------------------------------------- |
| Segment model          | `server/prisma/schema.prisma:144-181`             |
| Package model          | `server/prisma/schema.prisma:183-220`             |
| SegmentDto             | `packages/contracts/src/dto.ts:371-388`           |
| PackageDto             | `packages/contracts/src/dto.ts:77-98`             |
| Current TierCard       | `client/src/features/storefront/TierCard.tsx`     |
| Current TierSelector   | `client/src/features/storefront/TierSelector.tsx` |
| Current StorefrontHome | `client/src/pages/StorefrontHome.tsx`             |
| Tier utils             | `client/src/features/storefront/utils.ts`         |
| Design tokens          | `client/src/styles/design-tokens.css`             |
| formatCurrency         | `client/src/lib/utils.ts:17-22`                   |
| truncateText           | `client/src/features/storefront/utils.ts:57-60`   |

---

## Design System References

**Colors:**

- `--macon-orange: #d97706` (CTAs, highlights)
- `--macon-navy: #1a365d` (primary text)
- `--macon-teal` (gradient fallback)

**Typography:**

- Headings: `Playfair Display` (serif)
- Body: `Inter` (sans-serif)

**Shadows:**

- `elevation-1`: Base card state
- `elevation-2`: Highlighted card
- `elevation-3`: Hover state

**Animation:**

- Cubic-bezier: `cubic-bezier(0.4, 0, 0.2, 1)`
- Duration: 300ms (hover)

---

## Review Feedback Incorporated

This plan was reviewed by 3 specialized agents and updated based on their feedback:

1. **Architecture Simplification**: Changed from discriminated union to base + wrappers pattern (DHH review)
2. **Image Fallback**: Added gradient fallback for null heroImage/photoUrl (Type safety review)
3. **A11y Fix**: Removed nested Button inside Link, use styled div instead (Frontend review)
4. **Conditional Badge**: "Most Popular" only shows when exactly 3 tiers exist (User requirement)
5. **Back Button**: 1-segment skip uses Navigate without `replace` for proper history (UX review)
6. **Aspect Ratio**: Confirmed 16:9 → 4:3 change for segment cards (User requirement)
7. **Scope Cut**: Removed staggered animations from MVP (Simplicity review)

---

**Estimated Effort:** 8 hours (1 day)

**Priority:** P1 - Core storefront experience
