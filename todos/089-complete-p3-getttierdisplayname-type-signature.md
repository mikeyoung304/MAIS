---
status: complete
priority: p3
issue_id: "089"
tags:
  - code-review
  - typescript
  - type-safety
  - storefront
dependencies: []
---

# getTierDisplayName() Accepts Any String Instead of TierLevel

## Problem Statement

The `getTierDisplayName()` function in `utils.ts` accepts `string` parameter instead of the more specific `TierLevel` type, reducing compile-time type safety.

## Findings

### Discovery
Code quality review identified loose typing:

```typescript
// Current (utils.ts line 18)
export function getTierDisplayName(tierLevel: string): string {
  switch (tierLevel) {
    case 'budget': return 'Essential';
    case 'middle': return 'Popular';
    case 'luxury': return 'Premium';
    default: return tierLevel.charAt(0).toUpperCase() + tierLevel.slice(1);
  }
}
```

### Problem
- Accepts any string, not just valid tier levels
- Default case handles invalid inputs silently
- TypeScript can't catch typos like `getTierDisplayName('mddile')`

### Current Usage
All callers pass `TierLevel` type:
- `TierCard.tsx:56` - `getTierDisplayName(tierLevel)` where tierLevel is TierLevel
- `TierSelector.tsx` - Uses tier values from TIER_LEVELS constant

## Proposed Solutions

### Solution 1: Use TierLevel type with default fallback (RECOMMENDED)

```typescript
export function getTierDisplayName(tierLevel: TierLevel): string {
  switch (tierLevel) {
    case 'budget': return 'Essential';
    case 'middle': return 'Popular';
    case 'luxury': return 'Premium';
  }
  // TypeScript ensures exhaustiveness - no default needed
}
```

**Pros:**
- Compile-time validation
- No runtime surprises
- TypeScript exhaustiveness checking

**Cons:**
- Breaking change if any caller passes string

**Effort:** Small (10 min)
**Risk:** Low

### Solution 2: Overload for both signatures

```typescript
export function getTierDisplayName(tierLevel: TierLevel): string;
export function getTierDisplayName(tierLevel: string): string;
export function getTierDisplayName(tierLevel: string): string {
  // implementation
}
```

**Pros:**
- Backwards compatible
- Type-safe for TierLevel callers

**Cons:**
- More complex
- Still allows string abuse

**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files
- `client/src/features/storefront/utils.ts:18-29`

### Components
- getTierDisplayName utility function

### Database Changes
None

## Acceptance Criteria

- [x] Function signature uses TierLevel type
- [x] All callers pass TierLevel (already do)
- [x] TypeScript compiles with no errors
- [x] Exhaustive switch (no default case needed)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-29 | Created during code review | Quality review identified type safety issue |
| 2025-12-02 | Completed implementation | Changed parameter type from string to TierLevel, removed default case, TypeScript compilation passes with no errors |

## Resources

- TypeScript exhaustiveness: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking
