---
status: complete
priority: p3
issue_id: '021'
tags: [code-review, typescript, type-safety, storefront]
dependencies: []
---

# Remove Non-Null Assertion Operators in TierDetail

## Problem Statement

The `TierDetail` component uses `!` non-null assertion operators to bypass TypeScript null checks, which can lead to runtime errors if the assumptions are wrong.

**Why this matters:** Non-null assertions are a code smell that hide potential null reference errors.

## Findings

### Non-Null Assertions Found

**File:** `client/src/features/storefront/TierDetail.tsx`

**Line 195:**

```typescript
{
  formatCurrency(navigation.prev.pkg!.priceCents);
}
```

**Line 219:**

```typescript
{
  formatCurrency(navigation.next.pkg!.priceCents);
}
```

### Context

These are inside conditional blocks that check `navigation.prev` and `navigation.next`, but TypeScript doesn't understand the conditional narrowing on nested properties.

### Why This Happens

The `navigation` object has this shape:

```typescript
const navigation = {
  prev: prevTier ? { tierLevel: prevTier, pkg: tiers[prevTier] } : null,
  next: nextTier ? { tierLevel: nextTier, pkg: tiers[nextTier] } : null,
};
```

When we check `navigation.prev`, TypeScript doesn't narrow `pkg` automatically.

## Proposed Solutions

### Option A: Destructure for Narrowing (Recommended)

**Effort:** Small | **Risk:** Low

```typescript
{navigation.prev && (() => {
  const { pkg } = navigation.prev;
  return pkg && <div>{formatCurrency(pkg.priceCents)}</div>;
})()}
```

Or cleaner:

```typescript
{navigation.prev?.pkg && (
  <div>{formatCurrency(navigation.prev.pkg.priceCents)}</div>
)}
```

**Pros:**

- Removes unsafe assertions
- TypeScript properly narrows types
- No runtime risk

**Cons:**

- Slightly more verbose

### Option B: Refine Type Definition

**Effort:** Medium | **Risk:** Low

Create a discriminated union type for navigation:

```typescript
type NavItem = {
  tierLevel: TierLevel;
  pkg: PackageDto; // Required, not optional
} | null;

const navigation = useMemo(() => ({
  prev: prevTier && tiers[prevTier] ? { tierLevel: prevTier, pkg: tiers[prevTier]! } : null,
  next: nextTier && tiers[nextTier] ? { tierLevel: nextTier, pkg: tiers[nextTier]! } : null,
}), [...]);
```

**Pros:**

- Better type definition
- Assertions move to definition time

**Cons:**

- Still has one assertion
- More complex type

### Option C: Add Runtime Guards

**Effort:** Small | **Risk:** Low

```typescript
{navigation.prev?.pkg && (
  <div>{formatCurrency(navigation.prev.pkg.priceCents)}</div>
)}
```

**Pros:**

- Simple change
- Optional chaining is safer

**Cons:**

- Doesn't fix the underlying type issue

## Recommended Action

Implement **Option C** - Use optional chaining for simplicity.

## Technical Details

**File to Update:**

- `client/src/features/storefront/TierDetail.tsx` (lines 195, 219)

**Change:**

```typescript
// Before
{
  formatCurrency(navigation.prev.pkg!.priceCents);
}

// After
{
  navigation.prev?.pkg && formatCurrency(navigation.prev.pkg.priceCents);
}
```

## Acceptance Criteria

- [x] No `!` non-null assertions in TierDetail.tsx
- [x] TypeScript compilation passes
- [x] Navigation works correctly with all tier combinations
- [x] No runtime errors when tiers are missing

## Work Log

| Date       | Action    | Notes                                                                    |
| ---------- | --------- | ------------------------------------------------------------------------ |
| 2025-11-27 | Created   | Found during PR #6 code quality review                                   |
| 2025-12-02 | Completed | Replaced non-null assertions with optional chaining at lines 167 and 191 |

## Resources

- PR #6: https://github.com/mikeyoung304/MAIS/pull/6
- TypeScript non-null assertion: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#non-null-assertion-operator-postfix-
