---
status: complete
priority: p2
issue_id: '086'
tags:
  - code-review
  - performance
  - react
  - storefront
dependencies: []
---

# SegmentCard and TierCard Wrapper Components Not Memoized

## Problem Statement

`ChoiceCardBase` is wrapped with `memo()` for performance, but the wrapper components (`SegmentCard` and `TierCard`) are not memoized. This creates unnecessary re-renders when parent components update.

## Findings

### Discovery

Performance review identified that wrappers re-render on every parent update:

```typescript
// ChoiceCardBase - MEMOIZED ✓
export const ChoiceCardBase = memo(function ChoiceCardBase({ ... }) { ... });

// SegmentCard - NOT MEMOIZED ❌
export function SegmentCard({ segment }: SegmentCardProps) { ... }

// TierCard - NOT MEMOIZED ❌
export function TierCard({ package: pkg, ... }: TierCardProps) { ... }
```

### Impact

- When StorefrontHome or TierSelector re-renders, all wrapper components re-render
- ChoiceCardBase memo only prevents re-renders if its props haven't changed
- The wrapper function execution still happens on every parent render

### Severity

LOW-MEDIUM - Wrappers are simple prop mappers, but pattern is incorrect for optimal performance.

## Proposed Solutions

### Solution 1: Wrap both components with memo() (RECOMMENDED)

```typescript
// SegmentCard.tsx
export const SegmentCard = memo(function SegmentCard({ segment }: SegmentCardProps) {
  return <ChoiceCardBase ... />;
});

// TierCard.tsx
export const TierCard = memo(function TierCard({ ... }: TierCardProps) {
  return <ChoiceCardBase ... />;
});
```

**Pros:**

- Consistent with ChoiceCardBase pattern
- Prevents unnecessary re-renders
- Minimal code change

**Cons:**

- Adds shallow comparison overhead (negligible)

**Effort:** Small (5 min)
**Risk:** Low

### Solution 2: Keep as-is, document reasoning

If performance is acceptable, document why memoization was intentionally omitted.

**Pros:**

- No code changes
- Simpler mental model

**Cons:**

- Pattern inconsistency
- Future performance issues as component grows

**Effort:** Small (5 min)
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files

- `client/src/features/storefront/SegmentCard.tsx`
- `client/src/features/storefront/TierCard.tsx`

### Components

- SegmentCard
- TierCard

### Database Changes

None

## Acceptance Criteria

- [ ] Both wrapper components wrapped with memo()
- [ ] Named function used inside memo() for DevTools
- [ ] No functional changes to component behavior
- [ ] TypeScript compiles with no errors

## Work Log

| Date       | Action                     | Learnings                                     |
| ---------- | -------------------------- | --------------------------------------------- |
| 2025-11-29 | Created during code review | Performance review identified memoization gap |

## Resources

- React memo() docs: https://react.dev/reference/react/memo
