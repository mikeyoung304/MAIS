---
status: complete
priority: p1
issue_id: '585'
tags: [code-review, typescript, type-safety, agent-eval]
dependencies: []
created_at: 2026-01-02
---

# P1: Unsafe Type Assertions in review-actions.ts

> **TypeScript Review:** Non-exhaustive type assertions bypass TypeScript's type checking and could cause runtime errors.

## Problem Statement

The database may return action values that don't match `ReviewActionType`, but the code uses unsafe type assertions.

**File:** `/server/src/agent/feedback/review-actions.ts`

**Issue 1 (Line 234):**

```typescript
const actionType = item.action as ReviewActionType;
if (actionType in actionBreakdown) {
```

The database column is `String`, not an enum. Old data or schema drift could produce invalid values.

**Issue 2 (Lines 311-315):**

```typescript
.filter((a) => a.correctedScore !== null && a.trace?.evalScore !== null)
.map((a) => ({
  traceId: a.traceId,
  originalScore: a.trace!.evalScore!,  // Non-null assertions
  correctedScore: a.correctedScore!,
  delta: a.correctedScore! - a.trace!.evalScore!,
```

Although `.filter()` checks for non-null, TypeScript doesn't narrow the type through `map()`.

## Findings

| Reviewer          | Finding                                                |
| ----------------- | ------------------------------------------------------ |
| TypeScript Review | P1: Non-exhaustive type assertion in review-actions.ts |
| TypeScript Review | P1: Unsafe non-null assertions in review-actions.ts    |

## Proposed Solution

**For Issue 1 - Use type guard:**

```typescript
const VALID_ACTIONS = new Set<ReviewActionType>([
  'approve',
  'reject',
  'escalate',
  'retrain',
  'prompt_updated',
  'bug_filed',
]);

function isValidActionType(action: string): action is ReviewActionType {
  return VALID_ACTIONS.has(action as ReviewActionType);
}

// Usage
if (isValidActionType(item.action)) {
  const actionType = item.action;
  actionBreakdown[actionType] = item._count;
}
```

**For Issue 2 - Use type guard in filter:**

```typescript
.filter((a): a is typeof a & { correctedScore: number; trace: { evalScore: number } } =>
  a.correctedScore !== null && a.trace?.evalScore !== null
)
.map((a) => ({
  originalScore: a.trace.evalScore,  // No ! needed
  correctedScore: a.correctedScore,  // No ! needed
  delta: a.correctedScore - a.trace.evalScore,
}))
```

## Acceptance Criteria

- [ ] Type guards added for ReviewActionType validation
- [ ] Non-null assertions replaced with proper type narrowing
- [ ] No `as Type` casts without validation
- [ ] Typecheck passes without new `any` types

## Work Log

| Date       | Action                         | Learnings                                        |
| ---------- | ------------------------------ | ------------------------------------------------ |
| 2026-01-02 | Created from /workflows:review | TypeScript reviewer identified unsafe assertions |
