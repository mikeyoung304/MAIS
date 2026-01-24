---
status: complete
priority: p1
issue_id: '562'
tags: [code-review, simplicity, agent-ecosystem, dead-code, quality-first-triage]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Removed reset() from BudgetTracker interface/impl and ToolRateLimiter. Removed 6 related tests.'
---

# P1: Remove Dead reset() Methods from Guardrails

> **Quality-First Triage Upgrade:** P3 → P1. "Interface promises functionality that doesn't exist. Every broken promise is cognitive load."

## Problem Statement

The `reset()` method on `BudgetTracker` and `ToolRateLimiter` is defined but **never called**:

```typescript
// types.ts - BudgetTracker.reset()
reset(): void {
  remaining = { ...initialBudgets };
  used = { T1: 0, T2: 0, T3: 0 };
},

// rate-limiter.ts - ToolRateLimiter.reset()
reset(): void {
  this.turnCounts.clear();
  this.sessionCounts.clear();
}
```

Budget trackers are created fresh per turn, and rate limiters only use `resetTurn()`.

**Why it matters:** Dead code clutters the interface and suggests usage that doesn't exist.

## Findings

| Reviewer             | Finding                                            |
| -------------------- | -------------------------------------------------- |
| Simplicity Reviewer  | P1: BudgetTracker.reset() never called - dead code |
| Performance Reviewer | Related: ToolRateLimiter.reset() also unused       |

## Proposed Solutions

### Option 1: Remove Dead Methods (Recommended)

**Effort:** Trivial (15 minutes)

Delete the unused methods.

**Pros:**

- Cleaner interface
- Less dead code

**Cons:**

- None

## Recommended Action

Implement **Option 1** immediately.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/types.ts` - Remove reset() from BudgetTracker
- `server/src/agent/orchestrator/rate-limiter.ts` - Remove reset()
- `server/test/agent/orchestrator/rate-limiter.test.ts` - Remove reset() tests

## Acceptance Criteria

- [ ] Remove BudgetTracker.reset() from interface and implementation
- [ ] Remove ToolRateLimiter.reset()
- [ ] Update or remove related tests
- [ ] Build passes

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2026-01-01 | Created from code review | Simplicity Reviewer flagged |

## Resources

- YAGNI principle
