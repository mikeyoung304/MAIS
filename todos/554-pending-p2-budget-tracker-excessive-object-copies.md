---
status: resolved
priority: p3
issue_id: '554'
tags: [code-review, performance, agent-ecosystem, acceptable-tradeoff]
dependencies: []
---

# RESOLVED: BudgetTracker Object Copies - Acceptable Trade-off

> **Quality-First Triage:** Downgraded. "Immutability pattern is intentional. ~280 bytes per turn, V8 handles efficiently. Premature optimization concern."

## Problem Statement

The `BudgetTracker` creates new object copies on every property access and consume():

```typescript
// types.ts:52-65
get remaining() {
  return { ...remaining } as const;  // New object per access
},
consume(tier: keyof TierBudgets): boolean {
  remaining = { ...remaining, [tier]: remaining[tier] - 1 };  // New object per call
  used = { ...used, [tier]: used[tier] + 1 };  // New object per call
}
```

This is called in a hot path (lines 835-836 of base-orchestrator.ts) for every tool call. With recursive tool processing, this creates **4+ objects per tool call**.

**Why it matters:** Increased GC pressure during high-throughput operations. With 10+ tool calls per turn, this adds up.

## Findings

| Reviewer             | Finding                                           |
| -------------------- | ------------------------------------------------- |
| Performance Reviewer | P1: BudgetTracker creates excessive object copies |
| Simplicity Reviewer  | reset() method is dead code                       |

## Proposed Solutions

### Option 1: Mutable Internal State, Frozen Snapshots (Recommended)

**Effort:** Small (1 hour)

Keep internal state mutable, only create copies for external access:

```typescript
export function createBudgetTracker(
  initialBudgets: TierBudgets = DEFAULT_TIER_BUDGETS
): BudgetTracker {
  const remaining = { ...initialBudgets }; // Mutable copy
  const used = { T1: 0, T2: 0, T3: 0 }; // Mutable

  return {
    get remaining() {
      return Object.freeze({ ...remaining }); // Only copy on read
    },
    get used() {
      return Object.freeze({ ...used });
    },
    consume(tier: keyof TierBudgets): boolean {
      if (remaining[tier] <= 0) return false;
      remaining[tier]--; // Direct mutation
      used[tier]++; // Direct mutation
      return true;
    },
  };
}
```

**Pros:**

- Eliminates object copies in consume()
- Only creates copies when read (rare)

**Cons:**

- Slightly more complex implementation

### Option 2: Use Counter Variables Instead of Objects

**Effort:** Small (1 hour)

Use separate number variables instead of objects.

**Pros:**

- Zero object allocation

**Cons:**

- More verbose code
- Changes interface

## Recommended Action

Implement **Option 1** - mutable internal state with frozen external access.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/types.ts`

**Current Allocation Per consume():**

- 1 spread for remaining
- 1 spread for used
- Total: 2 objects per call

**After Fix:**

- 0 objects per consume()
- 2 objects only when accessing `.remaining` or `.used`

## Acceptance Criteria

- [ ] Refactor BudgetTracker to use mutable internal state
- [ ] Return frozen objects only on property access
- [ ] All existing tests still pass
- [ ] Add benchmark test showing improvement

## Work Log

| Date       | Action                   | Learnings                                          |
| ---------- | ------------------------ | -------------------------------------------------- |
| 2026-01-01 | Created from code review | Performance Oracle flagged as P1, downgraded to P2 |

## Resources

- Object.freeze docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
