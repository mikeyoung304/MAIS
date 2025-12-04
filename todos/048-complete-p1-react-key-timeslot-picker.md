---
status: complete
priority: p1
issue_id: '048'
tags: [code-review, scheduling, react, frontend, bug, critical]
dependencies: []
---

# CRITICAL: TimeSlotPicker Uses Array Index as React Key

## Problem Statement

The `TimeSlotPicker` component uses array index as the React key for time slot buttons. This causes React to incorrectly identify which slot is selected when the available slots list changes, leading to wrong slot selection and booking errors.

**Why this matters:** Users may visually select one time slot but actually book a different one when slots refresh or change order.

## Findings

### Code Evidence

**Location:** `client/src/features/scheduling/TimeSlotPicker.tsx:159`

```typescript
{data.slots.map((slot: TimeSlotDto, index: number) => {
  return (
    <button
      key={index}  // ❌ WRONG - using array index
      onClick={() => onSlotSelect(slot)}
      className={cn(
        // ... styles based on selection state
      )}
    >
      {formatTime(slot.startTime)}
    </button>
  );
})}
```

### Why This Is Broken

When using array index as key:

1. **Initial render:** Slots [9:00, 9:30, 10:00], user selects index 1 (9:30)
2. **Slot 9:00 gets booked by someone else**
3. **Re-render:** Slots [9:30, 10:00], React thinks index 1 is still selected
4. **Visual bug:** 10:00 appears selected, but `selectedSlot` state holds 9:30
5. **User confusion:** Display shows 10:00, but clicking "Book" books 9:30

### React Key Requirements

From React docs: "Keys should be stable, predictable, and unique. Using index as key only works if:

- List is static (never reorders)
- Items have no identity (like dividers)

Time slots have identity (`startTime`) and list changes (slots become unavailable)."

### Impact

- Users book wrong time slots
- Refund/cancellation requests
- Customer complaints
- Trust erosion

## Proposed Solutions

### Option A: Use startTime as Key (Recommended)

**Effort:** Trivial | **Risk:** None

```typescript
{data.slots.map((slot: TimeSlotDto) => {
  return (
    <button
      key={slot.startTime}  // ✅ Unique per slot
      onClick={() => onSlotSelect(slot)}
      // ...
    >
      {formatTime(slot.startTime)}
    </button>
  );
})}
```

**Pros:**

- `startTime` is already unique per slot (ISO datetime string)
- Zero risk, trivial change
- Follows React best practices

**Cons:**

- None

### Option B: Composite Key

**Effort:** Trivial | **Risk:** None

If startTime could somehow repeat (edge case):

```typescript
key={`${slot.startTime}-${slot.serviceId}`}
```

## Recommended Action

Implement **Option A** immediately - single line change with zero risk.

## Technical Details

**File to Update:**

- `client/src/features/scheduling/TimeSlotPicker.tsx:159`

**Current Code:**

```typescript
key = { index };
```

**Fixed Code:**

```typescript
key={slot.startTime}
```

## Acceptance Criteria

- [ ] React key changed from `index` to `slot.startTime`
- [ ] Visual selection matches internal state when slots refresh
- [ ] Manual test: Select slot, wait for refresh, verify same slot still selected
- [ ] No console warnings about duplicate keys

## Work Log

| Date       | Action  | Notes                                           |
| ---------- | ------- | ----------------------------------------------- |
| 2025-11-27 | Created | Found during Code Quality review - BLOCKS MERGE |

## Resources

- React Keys documentation: https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key
- Code Quality Reviewer analysis
