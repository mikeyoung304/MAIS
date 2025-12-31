---
status: complete
priority: p2
issue_id: '350'
tags: [code-review, performance, react, rendering]
dependencies: []
---

# Performance: DayPicker modifiersStyles Object Recreation

## Problem Statement

The `modifiersStyles` object for React DayPicker is created inline on every render, causing unnecessary reference changes and potential calendar flicker.

**Why it matters:** Object recreation triggers React DayPicker re-renders even when the actual style values haven't changed, impacting user experience during date selection.

## Findings

**File:** `client/src/features/storefront/DateBookingWizard.tsx:131-136`

```typescript
// Created inline - new reference on every render
modifiersStyles={{
  selected: { backgroundColor: '#F97316', color: 'white' },
}}
```

**Agent:** performance-oracle

## Proposed Solutions

### Option A: Extract to module-level constant (Recommended)

- **Pros:** Zero runtime cost, simplest fix
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

```typescript
const DAY_PICKER_STYLES = {
  selected: { backgroundColor: '#F97316', color: 'white' },
} as const;

// In component
modifiersStyles = { DAY_PICKER_STYLES };
```

### Option B: Use useMemo

- **Pros:** Works if styles need to be dynamic
- **Cons:** Adds complexity for static data
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A - Extract to module-level constant since styles are static.

## Technical Details

- **Affected files:** `client/src/features/storefront/DateBookingWizard.tsx`
- **Components:** DateBookingWizard, DateSelectionStep
- **Database changes:** None

## Acceptance Criteria

- [ ] modifiersStyles is a stable reference (module constant or memoized)
- [ ] No visible flicker when interacting with date picker
- [ ] All date booking tests pass

## Work Log

| Date       | Action                   | Learnings                        |
| ---------- | ------------------------ | -------------------------------- |
| 2024-12-24 | Created from code review | performance-oracle agent finding |

## Resources

- React DayPicker optimization: https://react-day-picker.js.org/
