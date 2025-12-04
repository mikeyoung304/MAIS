---
status: complete
priority: p2
issue_id: '085'
tags:
  - code-review
  - architecture
  - dry
  - storefront
dependencies: []
---

# ChoiceGrid Component Duplicated in Two Files

## Problem Statement

The `ChoiceGrid` component is defined identically in two files:

- `client/src/pages/StorefrontHome.tsx` (lines 31-50)
- `client/src/features/storefront/TierSelector.tsx` (lines 43-62)

This violates the DRY principle and creates maintenance burden - any changes to grid behavior must be made in two places, risking inconsistency.

## Findings

### Discovery

During code review of the storefront refactoring, the same 20-line component was found in both files:

```typescript
function ChoiceGrid({ children, itemCount }: { children: React.ReactNode; itemCount: number }) {
  return (
    <div className={clsx(
      'grid gap-6 lg:gap-8',
      itemCount === 1 && 'grid-cols-1 max-w-2xl mx-auto',
      itemCount === 2 && 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto',
      itemCount >= 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    )}>
      {children}
    </div>
  );
}
```

### Impact

- 32 LOC duplication
- Changes require two edits
- Risk of implementations diverging

## Proposed Solutions

### Solution 1: Extract to storefront module (RECOMMENDED)

Create `client/src/features/storefront/ChoiceGrid.tsx` and export from index.ts.

**Pros:**

- Single source of truth
- Co-located with other storefront components
- Easy to find and modify

**Cons:**

- One more file in storefront folder

**Effort:** Small (15 min)
**Risk:** Low

### Solution 2: Create shared UI component

Move to `client/src/ui/ChoiceGrid.tsx` for use across features.

**Pros:**

- Available for other features
- Consistent with UI pattern

**Cons:**

- May be over-generalized for storefront-specific needs

**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files

- `client/src/pages/StorefrontHome.tsx:31-50`
- `client/src/features/storefront/TierSelector.tsx:43-62`
- `client/src/features/storefront/index.ts` (add export)

### Components

- ChoiceGrid

### Database Changes

None

## Acceptance Criteria

- [x] ChoiceGrid defined in single location
- [x] Exported from storefront index.ts
- [x] Both StorefrontHome and TierSelector import from shared location
- [x] No functional changes to grid behavior
- [x] TypeScript compiles with no errors

## Work Log

| Date       | Action                     | Learnings                                                                       |
| ---------- | -------------------------- | ------------------------------------------------------------------------------- |
| 2025-11-29 | Created during code review | Identified during storefront refactoring review                                 |
| 2025-11-30 | Verified already completed | ChoiceGrid extracted to shared component, all imports updated, TypeScript clean |

## Resources

- PR: Current working changes
- Related: storefront refactoring implementation
