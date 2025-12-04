---
title: Component Duplication Prevention Checklist
category: prevention
tags: [react, components, code-review, duplication, performance]
priority: P2
---

# Component Duplication Prevention Checklist

Quick reference for catching component duplication patterns before they accumulate.

## Pre-Implementation Checklist

Before building a new React component, answer these questions:

### 1. Search for Existing Components

```bash
# Search for components with similar structure
grep -rn "interface.*Props" client/src/features/
ls -la client/src/features/*/  # Browse feature modules
```

- [ ] No existing component matches my needs (or I verified it can't be reused)
- [ ] If reusing existing component, confirmed it works for new use case

### 2. Check for Magic Strings/Numbers

```bash
# Find hardcoded values that might appear elsewhere
grep -rn "Essential\|Popular\|Premium" client/src/
grep -rn "See Packages\|View Details" client/src/
grep -rn "\b150\b\|\b300\b\|\b100\b" client/src/  # Common magic numbers
```

- [ ] No hardcoded tier names (should use getTierDisplayName())
- [ ] No magic text lengths (should use CARD_DESCRIPTION_MAX_LENGTH)
- [ ] No repeated CTA text ("View Details", "See Packages")

### 3. Plan Component Structure

Before writing JSX:

- [ ] I've identified the "base" vs "wrapper" pattern
  - Base component: Pure presentation, receives all props explicitly
  - Wrapper component: Maps domain data to base component props
- [ ] Wrapper component will be <30 lines (prop mapping only)
- [ ] Base component will be <100 lines (JSX structure)

---

## During Implementation Checklist

### 4. Implement Base Component

```typescript
// ✅ CORRECT: All props explicit, no domain knowledge
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
  testId,
}: ChoiceCardBaseProps) {
  // Pure presentation logic only
  return ( ... );
});

// ❌ WRONG: Contains domain-specific knowledge
export const CardComponent = memo(function CardComponent({
  segment,
  tier,
  ...otherProps
}: any) {
  // Mixing segment and tier logic
  return ( ... );
});
```

- [ ] Component receives props explicitly (no `...rest`)
- [ ] Component has no knowledge of segments vs tiers
- [ ] Component is pure (same props = same output)
- [ ] Component has no side effects (useEffect for display only)
- [ ] Styled with extracted styles (cardStyles.ts)

### 5. Implement Wrapper Components

```typescript
// ✅ CORRECT: Thin mapping layer
export const SegmentCard = memo(function SegmentCard({
  segment
}: SegmentCardProps) {
  return (
    <ChoiceCardBase
      title={segment.heroTitle}
      description={segment.heroSubtitle || ''}
      imageUrl={segment.heroImage}
      imageAlt={segment.heroTitle}
      categoryLabel={segment.name}
      cta="See Packages"
      href={`/s/${segment.slug}`}
      testId={`segment-card-${segment.slug}`}
    />
  );
});

// ❌ WRONG: Too much logic in wrapper
export function SegmentCard({ segment }: SegmentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const description = segment.heroSubtitle ||
    segment.description?.slice(0, 150) + '...';
  // 50+ lines of custom logic
}
```

- [ ] Wrapper <30 lines (prop mapping only)
- [ ] Wrapper wrapped with `React.memo`
- [ ] Wrapper has no state (unless essential to domain)
- [ ] Wrapper imports constants from utils.ts

### 6. Extract Constants and Utilities

Create `utils.ts` if ANY constant/function appears in 2+ places:

```typescript
// ✅ Create utils.ts immediately when second file needs this
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

export const CARD_DESCRIPTION_MAX_LENGTH = 150;

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
```

- [ ] All hardcoded strings in utils.ts constants
- [ ] All repeated functions in utils.ts
- [ ] Utils exported from feature index (index.ts)
- [ ] Utils have JSDoc comments explaining each export

---

## Code Review Checklist

### 7. Reviewer: Check for Duplication

When reviewing a component PR:

**Automated checks:**

```bash
# Search for identical function signatures
grep -rn "getTierDisplayName\|truncateText" client/src/

# Search for duplicate strings
grep -rn "Essential.*Popular.*Premium" client/src/

# Count lines of similar components
wc -l client/src/features/storefront/*.tsx
```

**Questions to ask:**

- [ ] Is this JSX structure similar to existing components?
  - If yes: Ask author to extract base component
- [ ] Are there hardcoded strings that appear elsewhere?
  - If yes: Ask author to move to utils.ts
- [ ] Is this wrapper component >30 lines?
  - If yes: Ask author to extract prop-mapping logic
- [ ] Is this component receiving object props without memo?
  - If yes: Ask author to add React.memo

**Accept duplication if:**

- ✅ Component is fundamentally different (different domain)
- ✅ Component is used only once
- ✅ Extraction would make code harder to understand
- ✅ Extraction would create circular dependencies

---

## Post-Merge: Maintenance Checklist

### 8. Watch for Decay

After component merged, periodically check:

```bash
# Monthly: Search for duplicate functions
grep -rn "function getTierDisplayName\|function truncateText\|function extractTiers" client/src/

# Monthly: Check for magic number patterns
grep -rn "\b150\b.*description\|\b100\b.*text" client/src/

# Quarterly: Review component sizes (should be <100 lines base, <30 lines wrapper)
for f in client/src/features/storefront/*.tsx; do
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 150 ]; then
    echo "⚠️  $f is $lines lines - consider breaking up"
  fi
done
```

- [ ] No new duplicate functions created
- [ ] No new magic constants hardcoded
- [ ] Component sizes haven't drifted above 150 lines

---

## Real-World Examples

### Example 1: SegmentCard vs TierCard

**Before Refactoring (DUPLICATION):**

```typescript
// SegmentCard.tsx - 40 lines
export function SegmentCard({ segment }: SegmentCardProps) {
  return (
    <Link to={`/s/${segment.slug}`} className="card">
      <div className="image-wrapper">
        <img src={segment.heroImage} alt={segment.heroTitle} />
      </div>
      <h3>{segment.heroTitle}</h3>
      <p>{segment.heroSubtitle}</p>
      <div className="cta">See Packages</div>
    </Link>
  );
}

// TierCard.tsx - 40 lines (nearly identical)
export function TierCard({ tier }: TierCardProps) {
  return (
    <Link to={`/tier/${tier.slug}`} className="card">
      <div className="image-wrapper">
        <img src={tier.photoUrl} alt={tier.title} />
      </div>
      <h3>{tier.title}</h3>
      <p>{tier.description}</p>
      <div className="cta">View Details</div>
    </Link>
  );
}
```

**Problems:**

- Bug in card styling must be fixed in 2 places
- Inconsistent behavior (one updates, other doesn't)
- 80% duplication makes code hard to maintain

**After Refactoring (EXTRACTED):**

```typescript
// ChoiceCardBase.tsx - 90 lines (single source of truth)
export const ChoiceCardBase = memo(function ChoiceCardBase({
  title, description, imageUrl, imageAlt, categoryLabel,
  price, cta, href, highlighted = false, testId,
}: ChoiceCardBaseProps) {
  return (
    <Link to={href} className={...}>
      {/* Complete card structure here */}
    </Link>
  );
});

// SegmentCard.tsx - 15 lines (just mapping)
export const SegmentCard = memo(function SegmentCard({ segment }: SegmentCardProps) {
  return (
    <ChoiceCardBase
      title={segment.heroTitle}
      description={segment.heroSubtitle || ''}
      imageUrl={segment.heroImage}
      imageAlt={segment.heroTitle}
      categoryLabel={segment.name}
      cta="See Packages"
      href={`/s/${segment.slug}`}
      testId={`segment-card-${segment.slug}`}
    />
  );
});

// TierCard.tsx - 15 lines (just mapping)
export const TierCard = memo(function TierCard({ pkg, tierLevel }: TierCardProps) {
  return (
    <ChoiceCardBase
      title={pkg.title}
      description={truncateText(pkg.description, CARD_DESCRIPTION_MAX_LENGTH)}
      imageUrl={pkg.photoUrl}
      imageAlt={`${getTierDisplayName(tierLevel)} tier: ${pkg.title}`}
      categoryLabel={getTierDisplayName(tierLevel)}
      price={pkg.priceCents}
      cta="View Details"
      href={`/tier/${tierLevel}`}
      highlighted={tierLevel === 'middle'}
      testId={`tier-card-${tierLevel}`}
    />
  );
});
```

**Benefits:**

- Single source of truth for card structure
- Bug fix updates all cards at once
- Consistent behavior across all card types
- Easy to test (test ChoiceCardBase once)

### Example 2: Magic Constants Tracking

**Before: Scattered Constants**

```typescript
// TierCard.tsx
const MAX_LENGTH = 150;
const truncated = description.slice(0, MAX_LENGTH) + '...';

// TierDetail.tsx
const maxLength = 150;
const text = description.substring(0, maxLength) + '...';

// TierSelector.tsx (slightly different)
const desc = description.length > 140 ? description.substring(0, 140) + '...' : description;
```

**Problems:**

- Same value (150) defined in 3 ways (inconsistent)
- Changing from 150 to 120 requires finding all 3 places
- Hard to understand why magic number exists

**After: Centralized Constants**

```typescript
// utils.ts - Single source of truth
export const CARD_DESCRIPTION_MAX_LENGTH = 150;

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// TierCard.tsx
import { truncateText, CARD_DESCRIPTION_MAX_LENGTH } from './utils';
<p>{truncateText(pkg.description, CARD_DESCRIPTION_MAX_LENGTH)}</p>

// TierDetail.tsx
import { truncateText, CARD_DESCRIPTION_MAX_LENGTH } from './utils';
<p>{truncateText(description, CARD_DESCRIPTION_MAX_LENGTH)}</p>

// TierSelector.tsx (consistent behavior)
import { truncateText, CARD_DESCRIPTION_MAX_LENGTH } from './utils';
<p>{truncateText(pkg.description, CARD_DESCRIPTION_MAX_LENGTH)}</p>
```

**Benefits:**

- Change max length once, affects all files
- Function consistent across codebase
- Clear intent (named constant explains the value)

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Too Many Props in Base Component

```typescript
// ❌ WRONG: 20+ props, too complex
export function Card({
  title,
  description,
  image,
  categoryLabel,
  price,
  cta,
  href,
  highlighted,
  showBadge,
  badgeText,
  onClick,
  onHover,
  variant,
  size,
  color,
  disabled,
  loading,
  error,
  ...otherProps
}: any) {
  // 200+ lines of conditional rendering
}

// ✅ CORRECT: Only explicit props needed
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
  testId,
}: ChoiceCardBaseProps) {
  // 90 lines, no conditionals
});
```

### ❌ Mistake 2: Forgetting memo() on Wrappers

```typescript
// ❌ WRONG: Re-renders on every parent change
export function SegmentCard({ segment }: SegmentCardProps) {
  return <ChoiceCardBase ... />;
}

// ✅ CORRECT: Prevents unnecessary re-renders
export const SegmentCard = memo(function SegmentCard({ segment }: SegmentCardProps) {
  return <ChoiceCardBase ... />;
});
```

### ❌ Mistake 3: Extracting Too Early

```typescript
// ❌ WRONG: Extract immediately for 1 component
export const CARD_STYLES = {
  base: 'p-4 rounded-lg',
};

// ✅ CORRECT: Extract when 2+ components need it
// Use hardcoded styles in first component
// When building second component, extract to shared module
```

### ❌ Mistake 4: Keeping Duplication for Edge Cases

```typescript
// ❌ WRONG: "Tiers are slightly different so I'll duplicate"
export function TierCard({ tier }: TierCardProps) {
  // 40 lines duplicating SegmentCard structure
}

// ✅ CORRECT: Extract common, handle differences in wrapper
export function TierCard({ pkg, tierLevel }: TierCardProps) {
  return (
    <ChoiceCardBase
      {...commonProps}
      price={pkg.priceCents}  // Only tier-specific difference
      highlighted={tierLevel === 'middle'}  // Only tier-specific difference
    />
  );
}
```

---

## Quick Reference: When to Extract?

| Situation                         | Extract Now                            | Keep Duplicated |
| --------------------------------- | -------------------------------------- | --------------- |
| 1 component uses pattern          | ❌ No                                  | ✅ Yes          |
| 2 components, identical structure | ✅ Yes                                 | ❌ No           |
| 2 components, slightly different  | ✅ Extract base, customize in wrappers | ❌ No           |
| Same function in 2 files          | ✅ Move to utils.ts                    | ❌ No           |
| Magic string appears 2+ times     | ✅ Extract constant                    | ❌ No           |
| Component >40 lines wrapper       | ✅ Break into layers                   | ❌ No           |
| Component >100 lines base         | ✅ Consider breaking                   | ⚠️ Maybe        |

---

## Tools & Commands

### Find Duplication

```bash
# Find identical JSX structures
grep -rn "<Link" client/src/features/storefront/*.tsx | wc -l

# Find duplicate functions
grep -rn "^export function " client/src/features/ | sort | uniq -d

# Find magic numbers
grep -rn "\b150\b\|\b100\b\|\b300\b" client/src/

# Find magic strings
grep -rn "Essential\|Popular\|Premium" client/src/
```

### Verify Memoization

```bash
# Check if wrapper components are memoized
grep -rn "export const.*= memo(" client/src/features/storefront/

# Should find:
# export const SegmentCard = memo(...)
# export const TierCard = memo(...)
```

### Monitor Component Size

```bash
# Check component line counts
wc -l client/src/features/storefront/*.tsx | sort -rn

# Alert if any exceed 150 lines
for f in client/src/features/storefront/*.tsx; do
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 150 ]; then
    echo "⚠️  Large: $f ($lines lines)"
  fi
done
```

---

## References

- **React Docs:** Thinking in Components, Memo, Composition
- **Code Review:** Code Review Checklist in CLAUDE.md
- **Full Details:** code-review-patterns/storefront-component-refactoring-review.md
- **Multi-Tenant:** Ensure no duplication crosses tenant boundaries

---

## Summary

**Prevention Goal:** Catch component duplication at **2 instances**, not 3+

**Three Rules:**

1. **Extract common structures** from 2+ components
2. **Add React.memo** to wrapper components receiving objects
3. **Centralize constants** in utils.ts when used 2+ times

**Key Metric:** Any single utility function defined in only 1 file, no duplicates
