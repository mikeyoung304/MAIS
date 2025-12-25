---
title: React Component Code Review - Quick Reference
category: prevention
tags: [react, components, code-review, quick-reference, checklist]
priority: P2
---

# React Component Code Review - Quick Reference

Print this and pin it at your desk! Quick checklist for React component reviews.

---

## Code Review Checklist (5 min)

### Is This a New Component?

- [ ] **Search first:** Does a similar component exist?

  ```bash
  ls client/src/features/*/  # Browse existing components
  grep -rn "Component.*Props" client/src/  # Check prop interfaces
  ```

- [ ] **Duplication check:** Is JSX >80% identical to another component?
  - YES → Ask to extract base component
  - NO → Continue

- [ ] **Magic values:** Any hardcoded strings/numbers?

  ```bash
  grep -n "Essential\|Popular\|Premium" component.tsx
  grep -n "\b150\b\|\b300\b" component.tsx
  ```

  - YES → Move to utils.ts
  - NO → Continue

### Component Structure Review

- [ ] **Wrapper component:** Does it only map props?
  - Size should be <30 lines (just prop mapping)
  - If >40 lines → Ask to break into smaller pieces

- [ ] **Base component:** Is it pure presentation?
  - No domain knowledge (doesn't know about segments vs tiers)
  - Same props = same output (idempotent)
  - No side effects (except image loading)

- [ ] **Props interface:** Are all props explicit?

  ```typescript
  // ✅ GOOD
  interface ChoiceCardBaseProps {
    title: string;
    description: string;
    imageUrl: string | null;
    cta: string;
    // ... all props explicit
  }

  // ❌ BAD
  interface CardProps {
    data: any;  // Too vague
    ...otherProps  // Catches unintended props
  }
  ```

### Performance Review

- [ ] **Wrapper gets memoized?** Is component wrapped with `React.memo`?
  - Receives object/array props → YES, needs memo
  - Receives only primitive props → NO, memo unnecessary
  - Used in list rendering → YES, needs memo

- [ ] **Props are stable?** Will wrapper re-render unnecessarily?

  ```typescript
  // ❌ BAD: New object every render
  <Card config={{ size: 'large' }} />

  // ✅ GOOD: Stable object
  const config = useMemo(() => ({ size: 'large' }), []);
  <Card config={config} />
  ```

- [ ] **No expensive calculations in render?**

  ```typescript
  // ❌ BAD
  export function Card({ data }) {
    const filtered = data.filter(x => x.price > 100).map(...);  // Every render
    return <div>{filtered}</div>;
  }

  // ✅ GOOD
  export function Card({ data }) {
    const filtered = useMemo(() =>
      data.filter(x => x.price > 100).map(...),
      [data]
    );
    return <div>{filtered}</div>;
  }
  ```

### Test Coverage

- [ ] **Base component tested?** Does it have unit tests?
  - Happy path test (all props provided)
  - Optional props test (omit some props)
  - State changes test (if any)

- [ ] **Wrapper component tested?** Integration tests?
  - Maps props correctly from domain data
  - Renders expected content
  - Links go to correct routes

- [ ] **Memo verified?** Do tests check memo prevents re-renders?
  ```typescript
  test('SegmentCard does not re-render when parent re-renders', () => {
    // Should only render once
  });
  ```

### Final Checks

- [ ] **Styles extracted?** Are card styles in cardStyles.ts or inline?
  - Should be in cardStyles.ts (shared styles)
  - No 20+ line className strings

- [ ] **Utils exported?** Can other components import utilities?
  - Functions: truncateText, getTierDisplayName, extractTiers
  - Constants: TIER_LEVELS, CARD_DESCRIPTION_MAX_LENGTH
  - All exported from feature index (index.ts)

- [ ] **Comments clear?** Does JSDoc explain purpose?
  ```typescript
  /**
   * ChoiceCardBase Component
   *
   * Pure presentation component for storefront choice cards.
   * Used by both SegmentCard and TierCard wrappers.
   */
  ```

---

## Red Flags (Stop & Investigate)

| Flag                                   | Action                    |
| -------------------------------------- | ------------------------- |
| Same function name in 2+ files         | Move to utils.ts          |
| Component >100 lines                   | Break into smaller pieces |
| Component has 15+ props                | Too many responsibilities |
| Hardcoded string appears 2+ times      | Move to constants         |
| No memo on wrapper receiving objects   | Add React.memo            |
| Custom logic in wrapper (>20 lines)    | Extract to base component |
| ImageUrl could be null but no fallback | Add placeholder/gradient  |
| Component deeply nested 5+ levels      | Consider breaking up      |

---

## Before/After Examples

### Example 1: Duplication

**BEFORE (Two Files, Duplication):**

```typescript
// File A: SegmentCard.tsx (40 lines)
export function SegmentCard({ segment }) {
  return (
    <Link to={`/s/${segment.slug}`}>
      <img src={segment.heroImage} />
      <h3>{segment.heroTitle}</h3>
      <p>{segment.description}</p>
      <div className="cta">See Packages</div>
    </Link>
  );
}

// File B: TierCard.tsx (40 lines - nearly identical)
export function TierCard({ tier }) {
  return (
    <Link to={`/tier/${tier.slug}`}>
      <img src={tier.photoUrl} />
      <h3>{tier.title}</h3>
      <p>{tier.description}</p>
      <div className="cta">View Details</div>
    </Link>
  );
}
```

**AFTER (Extracted, No Duplication):**

```typescript
// File A: ChoiceCardBase.tsx (90 lines - Single source of truth)
export const ChoiceCardBase = memo(function ChoiceCardBase({
  title, description, imageUrl, cta, href, ...
}) {
  return (
    <Link to={href}>
      <img src={imageUrl} />
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="cta">{cta}</div>
    </Link>
  );
});

// File B: SegmentCard.tsx (15 lines - Just props mapping)
export const SegmentCard = memo(function SegmentCard({ segment }) {
  return (
    <ChoiceCardBase
      title={segment.heroTitle}
      description={segment.description}
      imageUrl={segment.heroImage}
      cta="See Packages"
      href={`/s/${segment.slug}`}
    />
  );
});

// File C: TierCard.tsx (15 lines - Just props mapping)
export const TierCard = memo(function TierCard({ tier }) {
  return (
    <ChoiceCardBase
      title={tier.title}
      description={tier.description}
      imageUrl={tier.photoUrl}
      cta="View Details"
      href={`/tier/${tier.slug}`}
    />
  );
});
```

**Score:** 40 → 120 lines total, but no duplication, easier to maintain

---

### Example 2: Magic Constants

**BEFORE (Scattered):**

```typescript
// File 1: TierCard.tsx
<span>{tierLevel === 'middle' ? 'Popular' : tierLevel}</span>
const desc = description.slice(0, 150) + '...';

// File 2: TierSelector.tsx
<span>{getTierDisplayName(tierLevel)}</span>  // Different function!

function getTierDisplayName(level) {
  if (level === 'middle') return 'Popular';
  // ...
}

// File 3: TierDetail.tsx
<span>{getTierDisplayName(tierLevel)}</span>  // Same function again!
const truncated = description.substring(0, 150) + '...';
```

**AFTER (Centralized):**

```typescript
// utils.ts - Single source of truth
export const CARD_DESCRIPTION_MAX_LENGTH = 150;

export function getTierDisplayName(tierLevel) {
  switch (tierLevel) {
    case 'middle': return 'Popular';
    // ...
  }
}

export function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// All files import from utils
import { getTierDisplayName, truncateText, CARD_DESCRIPTION_MAX_LENGTH } from './utils';

// File 1, 2, 3 all use same functions
<span>{getTierDisplayName(tierLevel)}</span>
<p>{truncateText(description, CARD_DESCRIPTION_MAX_LENGTH)}</p>
```

---

## Test Examples

### Verify Memo Works

```typescript
test('SegmentCard memoizes correctly', () => {
  const segment = { id: '1', name: 'Test' };

  const { rerender } = render(
    <div>
      <SegmentCard segment={segment} />
      <button>Change Parent</button>
    </div>
  );

  // Should not re-render when parent updates but segment unchanged
  fireEvent.click(screen.getByText('Change Parent'));

  // Visual verification: no visual changes, no expensive calculations
});
```

### Verify Constants Centralized

```typescript
test('getTierDisplayName uses centralized mapping', () => {
  expect(getTierDisplayName('budget')).toBe('Essential');
  expect(getTierDisplayName('middle')).toBe('Popular');
  expect(getTierDisplayName('luxury')).toBe('Premium');
});

test('truncateText respects CARD_DESCRIPTION_MAX_LENGTH', () => {
  const longText = 'a'.repeat(200);
  const result = truncateText(longText, CARD_DESCRIPTION_MAX_LENGTH);

  expect(result.length).toBe(CARD_DESCRIPTION_MAX_LENGTH + 3); // +3 for '...'
});
```

---

## Common Mistakes

### ❌ Mistake 1: Too Many Props in Base

```typescript
export function Card({
  title,
  description,
  image,
  badge,
  price,
  cta,
  href,
  variant,
  size,
  color,
  border,
  shadow,
  onClick,
  onHover,
  disabled,
  loading,
  error,
  warning,
  success,
  ...otherProps
}) {
  // 200 lines of conditional rendering
}
// → TOO COMPLEX
// → Ask author to extract into focused components
```

### ❌ Mistake 2: No Memo on Frequently Rendered

```typescript
export function SegmentCard({ segment }) {
  // Gets re-rendered when parent changes, even if segment unchanged
  return <ChoiceCardBase ... />;
}

// Better with memo:
export const SegmentCard = memo(function SegmentCard({ segment }) {
  return <ChoiceCardBase ... />;
});
```

### ❌ Mistake 3: Hardcoded Values

```typescript
// Don't do this in TierCard AND TierSelector
const maxChars = 150;
const tierNames = { budget: 'Essential', middle: 'Popular', luxury: 'Premium' };

// Instead, use centralized utils.ts
import { CARD_DESCRIPTION_MAX_LENGTH, getTierDisplayName } from './utils';
```

### ❌ Mistake 4: Too Much Logic in Wrapper

```typescript
export function SegmentCard({ segment }) {
  // ❌ These should be in base component
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const description = segment.heroSubtitle || segment.description;

  return (
    <ChoiceCardBase
      {...mapSegmentToProps(segment)}
      imageLoaded={imageLoaded}
      onImageLoad={() => setImageLoaded(true)}
    />
  );
}
```

---

## Approval Criteria

Approve component PR when:

- [ ] ✅ No JSX duplication (not >80% copy-paste)
- [ ] ✅ No hardcoded strings in 2+ files (moved to constants)
- [ ] ✅ Wrapper components <30 lines (just prop mapping)
- [ ] ✅ Base components <100 lines (pure presentation)
- [ ] ✅ Wrapper components wrapped with memo
- [ ] ✅ Tests verify core functionality
- [ ] ✅ Tests verify memo works (for wrapped components)
- [ ] ✅ Clear prop interfaces (no `any` types)
- [ ] ✅ Utilities exported from feature index

---

## Questions to Ask During Review

1. **"Why does this component exist? Is there an existing component it could reuse?"**
   - Checks for duplication before it starts

2. **"What's the minimal data this component needs?"**
   - Forces explicit prop interface (no `...rest`)

3. **"Could this component be used in another context?"**
   - Encourages base/wrapper separation

4. **"Are there hardcoded strings/numbers we'll need to change later?"**
   - Finds magic constants before they scatter

5. **"Will this component ever be rendered in a list?"**
   - Triggers memo discussion

6. **"Does this component do only one thing?"**
   - Keeps components focused

7. **"If we rebrand 'Popular' to 'Best Value', where must we change?"**
   - Tests if constants are truly centralized (should be 1 place)

---

## Terminal Commands

### Find Problems

```bash
# Find duplicate function names
grep -rn "function getTierDisplayName" client/src/features/

# Find magic strings
grep -rn "Essential\|Popular" client/src/ | grep -v utils.ts

# Find large components
wc -l client/src/features/**/*.tsx | sort -rn | head -10

# Find missing memo
grep "^export function" client/src/features/storefront/*.tsx | grep -v memo

# Find hardcoded truncation
grep -rn "\.slice(0, [0-9])" client/src/
```

### Quick Stats

```bash
# Component count per feature
find client/src/features -name "*.tsx" | wc -l

# Total lines in storefront
wc -l client/src/features/storefront/*.tsx | tail -1

# Duplicated function definitions
find client/src/features -name "*.tsx" -exec grep -l "function getTierDisplayName" {} \;
```

---

## Print This!

```
┌─────────────────────────────────────────────┐
│ REACT COMPONENT REVIEW - 30 SECOND VERSION │
├─────────────────────────────────────────────┤
│ 1. Search first - does component exist?    │
│ 2. No JSX duplication - extract if 2+ use  │
│ 3. No magic constants - move to utils.ts   │
│ 4. Wrapper <30 lines - just prop mapping   │
│ 5. Add React.memo - if receives objects    │
│ 6. Tests verify core + memo behavior       │
│ 7. Props explicit - no `any` or `...rest`  │
└─────────────────────────────────────────────┘
```

---

## Related Docs

- **Full Guide:** code-review-patterns/storefront-component-refactoring-review.md
- **Checklist:** COMPONENT-DUPLICATION-PREVENTION.md
- **General Review:** COMPREHENSIVE-PREVENTION-STRATEGIES.md
